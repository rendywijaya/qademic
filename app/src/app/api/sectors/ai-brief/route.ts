import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getCachedAIOutput, writeAIOutputCache, logAIUsage } from '@/lib/supabase/cache'
import type { SectorPerformance } from '@/app/api/sectors/route'

const client = new Anthropic()

const CACHE_KEY = 'sectors_brief'
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours
const MODEL = 'claude-haiku-4-5'

interface BriefRequest {
  sectors: SectorPerformance[]
}

function validate(body: unknown): BriefRequest {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.sectors)) throw new Error('Missing sectors')
  return b as unknown as BriefRequest
}

function buildPrompt(req: BriefRequest): string {
  const sorted = [...req.sectors].sort((a, b) => b.changePct - a.changePct)

  const sectorLines = sorted
    .map(s => {
      const sign = s.changePct >= 0 ? '+' : ''
      return `  ${s.sector} (${s.etf}): ${sign}${s.changePct.toFixed(2)}%`
    })
    .join('\n')

  const top3 = sorted.slice(0, 3).map(s => s.sector).join(', ')
  const bottom3 = sorted.slice(-3).map(s => s.sector).join(', ')
  const avgChange = req.sectors.reduce((sum, s) => sum + s.changePct, 0) / req.sectors.length

  const growthSectors = ['Technology', 'Communication Services', 'Consumer Cyclical']
  const defensiveSectors = ['Utilities', 'Consumer Defensive', 'Healthcare']

  const growthAvg = req.sectors
    .filter(s => growthSectors.includes(s.sector))
    .reduce((sum, s, _, arr) => sum + s.changePct / arr.length, 0)

  const defAvg = req.sectors
    .filter(s => defensiveSectors.includes(s.sector))
    .reduce((sum, s, _, arr) => sum + s.changePct / arr.length, 0)

  const riskSignal = growthAvg > defAvg ? 'RISK-ON (growth leading defensives)' : 'RISK-OFF (defensives outperforming growth)'

  return `Write a concise Q2 Sector Rotation briefing based on this live sector performance data:

TODAY'S SECTOR PERFORMANCE (ranked best to worst):
${sectorLines}

SUMMARY:
- Market breadth: avg change ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%
- Leaders today: ${top3}
- Laggards today: ${bottom3}
- Risk signal: ${riskSignal}
- Growth vs Defensive spread: ${(growthAvg - defAvg).toFixed(2)}pp

Structure your response with these exact bold headers:

**SECTOR LEADERSHIP**
Which sectors are leading today and what the underlying fundamentals or macro drivers could explain this outperformance (2-3 sentences).

**ROTATION SIGNAL**
Where money appears to be flowing, what this implies for the economic cycle phase, and whether this rotation aligns with or diverges from recent trend (2-3 sentences).

**SECTOR SETUP**
1-2 specific sector opportunities or risks an investor should be watching — concrete and actionable (2-3 sentences).

**Q2 VERDICT**
3 specific, actionable sector positioning ideas. Bullet points starting with →

Keep it tight — hedge fund morning note quality. Data-driven, no waffle.`
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let brief: BriefRequest
  try {
    const body = await req.json()
    brief = validate(body)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Bad request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Check DB cache — shared across all users
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null

    const cached = await getCachedAIOutput(supabase, CACHE_KEY)
    if (cached) {
      logAIUsage(userId, 'sectors_brief', MODEL, true).catch(() => undefined)
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(cached))
          controller.close()
        },
      })
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Cache': 'HIT',
        },
      })
    }
  } catch {
    // Cache lookup failed — proceed to live generation
  }

  // Live generation — stream to client and accumulate for DB write
  const stream = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    stream: true,
    system: "You are Qademic's Q2 Sector analyst — a senior sector strategist at a hedge fund. Analyze sector rotation patterns with precision. Be data-driven and actionable.",
    messages: [{ role: 'user', content: buildPrompt(brief) }],
  })

  const encoder = new TextEncoder()
  const accumulated: string[] = []

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            accumulated.push(chunk.delta.text)
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
        const fullText = accumulated.join('')
        if (fullText.length > 0) {
          writeAIOutputCache(CACHE_KEY, fullText, CACHE_TTL_MS).catch(() => undefined)
        }
        logAIUsage(userId, 'sectors_brief', MODEL, false).catch(() => undefined)
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Cache': 'MISS',
    },
  })
}
