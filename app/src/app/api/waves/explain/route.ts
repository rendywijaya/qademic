import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedAIOutput, writeAIOutputCache, logAIUsage } from '@/lib/supabase/cache'
import { createClient } from '@/lib/supabase/server'
import { runWave } from '@/lib/waves'

const client = new Anthropic()
const MODEL = 'claude-sonnet-4-6'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 1 day — node reasoning is stable intraday

const RELATION_LABEL: Record<string, string> = {
  exposed_to_theme: 'is exposed to',
  drives_demand_for: 'drives demand for',
  consumes_commodity: 'consumes',
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 503 })
  }

  let shockSlug: string
  let entityId: string
  try {
    const body = await req.json()
    shockSlug = String(body.shock)
    entityId = String(body.entity_id)
    if (!shockSlug || !entityId) throw new Error('missing')
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
  }

  const db = createAdminClient()
  const run = await runWave(db, shockSlug)
  if (!run) return new Response(JSON.stringify({ error: 'unknown shock' }), { status: 404 })

  const node = run.nodes.find((n) => n.id === entityId)
  if (!node) return new Response(JSON.stringify({ error: 'unknown entity' }), { status: 404 })
  const res = run.results.find((r) => r.entity_id === entityId)

  // Build the causal-link context
  const links: string[] = []
  for (const e of run.edges) {
    if (e.src_id === entityId) {
      const other = run.nodes.find((n) => n.id === e.dst_id)
      if (other) links.push(`${node.name} ${RELATION_LABEL[e.relation] ?? e.relation} ${other.name} (strength ${e.weight})${e.evidence ? ` — ${e.evidence}` : ''}`)
    } else if (e.dst_id === entityId) {
      const other = run.nodes.find((n) => n.id === e.src_id)
      if (other) links.push(`${other.name} ${RELATION_LABEL[e.relation] ?? e.relation} ${node.name} (strength ${e.weight})${e.evidence ? ` — ${e.evidence}` : ''}`)
    }
  }

  const cacheKey = `wave_explain:${shockSlug}:${entityId}`
  let userId: string | null = null
  try {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    userId = user?.id ?? null
    const cached = await getCachedAIOutput(sb, cacheKey)
    if (cached) {
      logAIUsage(userId, 'wave_explain', MODEL, true).catch(() => undefined)
      return streamString(cached, 'HIT')
    }
  } catch {
    /* proceed to live */
  }

  const prompt = `WAVE: ${run.shock.name}
THESIS: ${run.shock.thesis ?? '—'}

NODE: ${node.name}${node.ticker ? ` (${node.ticker})` : ''} — type: ${node.kind}
PROPAGATION READOUT (deterministic):
- causal exposure percentile: ${res?.exposure_pct ?? '—'}/100 (how strongly the wave reaches this node, ${res?.hops ?? '?'} hops from origin)
- already-priced-in percentile: ${res?.priced_in_pct ?? 'no market-signal coverage'}
- opportunity score (exposure − priced-in): ${res?.opportunity_score == null ? 'n/a' : Math.round(res.opportunity_score)}

CAUSAL LINKS IN THE GRAPH:
${links.length ? links.map((l) => `- ${l}`).join('\n') : '- (none mapped)'}

Write a tight analyst note (~220 words, plain language) with these bold sections:

**WHY IT'S EXPOSED**
Trace the actual demand path from the wave origin to this node along the links above. Concrete.

**STRESS TEST**
Attack the causal link honestly. Does it really benefit, or is it insulated/diluted? Consider: long-term contracts, input substitution, capacity saturation, margin pass-through, competition, timing/lag, share-of-wallet. This is the part that kills false edges.

**WHAT'S PRICED IN / WHAT TO WATCH**
Given the priced-in reading, what does the current price likely already assume, and what 1–2 observable signals would confirm or break the thesis.

Rules: no buy/sell/hold recommendation, no price target. Distributions and reasoning, not advice. If exposure is weak or already repriced, say so plainly.`

  const stream = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    stream: true,
    system:
      "You are WorldContrarian's interconnection analyst. You map demand waves through supply chains and, crucially, you stress-test every causal link to avoid manufacturing false confidence. Be honest, specific, and contrarian. Never give investment advice.",
    messages: [{ role: 'user', content: prompt }],
  })

  const encoder = new TextEncoder()
  const acc: string[] = []
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            acc.push(chunk.delta.text)
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
        const full = acc.join('')
        if (full.length > 0) writeAIOutputCache(cacheKey, full, CACHE_TTL_MS).catch(() => undefined)
        logAIUsage(userId, 'wave_explain', MODEL, false).catch(() => undefined)
      }
    },
  })
  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Cache': 'MISS' },
  })
}

function streamString(s: string, cache: string): Response {
  const enc = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(s))
        c.close()
      },
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Cache': cache } },
  )
}
