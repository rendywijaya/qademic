import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getCachedAIOutput, writeAIOutputCache, logAIUsage } from '@/lib/supabase/cache'
import type { MacroIndicator } from '@/app/api/macro/route'
import type { MarketItem } from '@/app/api/market-data/route'

const client = new Anthropic()

const CACHE_KEY = 'macro_brief'
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours
const MODEL = 'claude-haiku-4-5'

interface BriefRequest {
  indicators: MacroIndicator[]
  market: MarketItem[]
}

function validate(body: unknown): BriefRequest {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.indicators)) throw new Error('Missing indicators')
  if (!Array.isArray(b.market)) throw new Error('Missing market')
  return b as unknown as BriefRequest
}

function buildPrompt(req: BriefRequest): string {
  const indicatorLines = req.indicators
    .map(i => `  ${i.label}: ${i.value}${i.unit === '%' ? '%' : ''} (prev: ${i.previousValue}${i.unit === '%' ? '%' : ''}, change: ${i.change})`)
    .join('\n')

  const marketLines = req.market
    .map(m => `  ${m.name} (${m.symbol}): ${m.price} (${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}% today)`)
    .join('\n')

  const yieldCurve = req.indicators.find(i => i.id === 'T10Y2Y')
  const isInverted = yieldCurve && parseFloat(yieldCurve.value) < 0
  const fedRate = req.indicators.find(i => i.id === 'FEDFUNDS')
  const cpi = req.indicators.find(i => i.id === 'CPIAUCSL')

  return `Write a concise Q1 Macro briefing for equity investors based on this live data:

MACRO INDICATORS (FRED):
${indicatorLines}

MARKET SNAPSHOT:
${marketLines}

CONTEXT:
- Yield curve: ${isInverted ? 'INVERTED (historically a recession signal, watch carefully)' : 'positive slope (normal)'}
- Fed rate ${fedRate ? fedRate.value + '%' : 'unknown'} vs CPI ${cpi ? cpi.value + '%' : 'unknown'} — real rates are ${fedRate && cpi ? (parseFloat(fedRate.value) - parseFloat(cpi.value) > 0 ? 'positive (restrictive)' : 'negative (accommodative)') : 'unknown'}

Structure your response with these exact bold headers:

**RATE ENVIRONMENT**
2–3 sentences on where rates are, direction, and what it means for equities and bonds.

**INFLATION & GROWTH**
2–3 sentences on CPI trajectory, GDP health, unemployment, and whether stagflation risk is real.

**MARKET SIGNALS**
2–3 sentences on what the indices, VIX, gold, and dollar are telling us about risk appetite.

**YIELD CURVE WATCH**
1–2 sentences specifically on the curve shape and what it's signalling.

**INVESTOR IMPLICATIONS**
3 specific, actionable takeaways for an equity investor right now. Bullet points starting with →

Keep it tight — hedge fund morning note quality. Data-driven, no waffle.`
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  let brief: BriefRequest
  try {
    const body = await req.json()
    brief = validate(body)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Bad request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
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
      logAIUsage(userId, 'macro_brief', MODEL, true).catch(() => undefined)
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(cached))
          controller.close()
        },
      })
      return new Response(readable, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Cache': 'HIT' },
      })
    }
  } catch {
    // Cache lookup failed — proceed to live generation
  }

  // Live generation — stream to client and accumulate for DB write
  const stream = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    stream: true,
    system: 'You are Qademic\'s Q1 Macro analyst — a senior macro strategist writing daily briefings for equity investors. Be concise, precise, and actionable. Use the exact bold headers given. This is analytical commentary, not financial advice.',
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
        // After streaming completes, persist to DB and log usage
        const fullText = accumulated.join('')
        if (fullText.length > 0) {
          writeAIOutputCache(CACHE_KEY, fullText, CACHE_TTL_MS).catch(() => undefined)
        }
        logAIUsage(userId, 'macro_brief', MODEL, false).catch(() => undefined)
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Cache': 'MISS' },
  })
}
