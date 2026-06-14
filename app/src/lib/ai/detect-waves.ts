/**
 * Wave auto-detection — "what's the world doing, what's the next wave?"
 *
 * Synthesizes the current regime + the strongest momentum movers (where money is already
 * flowing) and asks Claude to identify EMERGING demand waves that are not yet consensus,
 * then auto-builds each wave as a propagatable subgraph (theme origin → beneficiary
 * companies via exposed_to_theme edges). Beneficiaries are constrained to our covered
 * universe so the propagation engine can immediately score "exposed but not repriced".
 *
 * Uses Claude tool-use for guaranteed structured output.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

const client = new Anthropic()
const MODEL = 'claude-sonnet-4-6'

interface DetectedBeneficiary {
  ticker: string
  name: string
  weight: number
  rationale: string
}
interface DetectedWave {
  slug: string
  name: string
  stage: 'emerging' | 'building' | 'consensus' | 'fading'
  thesis: string
  beneficiaries: DetectedBeneficiary[]
}

const DETECT_TOOL: Anthropic.Tool = {
  name: 'record_waves',
  description: 'Record the emerging demand waves you have identified, each with its beneficiary companies.',
  input_schema: {
    type: 'object',
    properties: {
      waves: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'short kebab-case id, e.g. "onshoring-grid"' },
            name: { type: 'string' },
            stage: { type: 'string', enum: ['emerging', 'building', 'consensus', 'fading'] },
            thesis: { type: 'string', description: 'the causal story: what demand is shifting and why, 2-3 sentences' },
            beneficiaries: {
              type: 'array',
              description: 'companies that benefit, ONLY from the provided covered-universe ticker list',
              items: {
                type: 'object',
                properties: {
                  ticker: { type: 'string' },
                  name: { type: 'string' },
                  weight: { type: 'number', description: 'strength of exposure to this wave, 0.0–1.0' },
                  rationale: { type: 'string', description: 'one sentence on why this company benefits' },
                },
                required: ['ticker', 'name', 'weight', 'rationale'],
              },
            },
          },
          required: ['slug', 'name', 'stage', 'thesis', 'beneficiaries'],
        },
      },
    },
    required: ['waves'],
  },
}

export interface DetectResult {
  created: { slug: string; name: string; beneficiaries: number }[]
  proposed: number
}

export async function detectWaves(db: SupabaseClient, maxWaves = 2): Promise<DetectResult> {
  // ── grounding from real data ──
  const { data: regimeRows } = await db.from('regime_daily').select('*').order('date', { ascending: false }).limit(1)
  const regime = regimeRows?.[0] ?? null
  const { data: leaders } = await db
    .from('stock_signals')
    .select('ticker, momentum_3m, momentum_6m')
    .order('momentum_3m', { ascending: false })
    .limit(30)
  const { data: laggards } = await db
    .from('stock_signals')
    .select('ticker, momentum_3m')
    .order('momentum_3m', { ascending: true })
    .limit(15)
  const { data: existing } = await db.from('wave_shocks').select('name')
  const { data: uni } = await db.from('stock_signals').select('ticker')
  const universe = new Set((uni ?? []).map((r) => r.ticker as string))
  const { data: ranks } = await db.from('universe_rankings').select('ticker, sector')
  const sectorByTicker = new Map((ranks ?? []).map((r) => [r.ticker, r.sector as string | null]))

  const regimeStr = regime
    ? `${regime.state} (${regime.total}/5), VIX ${regime.vix}, ${regime.pct_sectors_above_200dma}% sectors > 200dma, HY-OAS ${regime.hy_oas}, curve ${regime.yield_curve}`
    : 'unavailable'
  const leadersStr = (leaders ?? []).map((l) => `${l.ticker}(+${Math.round(l.momentum_3m)}%/3m)`).join(', ')
  const laggardsStr = (laggards ?? []).map((l) => `${l.ticker}(${Math.round(l.momentum_3m)}%)`).join(', ')
  const existingStr = (existing ?? []).map((e) => e.name).join('; ') || 'none'

  const prompt = `You are scanning for the NEXT investable demand waves — structural shifts in where money and demand are flowing across the economy. Think like a contrarian: where is demand inflecting that the market hasn't fully priced?

CURRENT REGIME: ${regimeStr}
STRONGEST 3-MONTH MOMENTUM (money already flowing here): ${leadersStr}
WEAKEST (money leaving / possible contrarian bases): ${laggardsStr}
WAVES ALREADY TRACKED (do NOT duplicate these): ${existingStr}

Identify up to ${maxWaves} DISTINCT emerging/building waves that are NOT already tracked. For each, give a causal thesis and the beneficiary companies. IMPORTANT: beneficiaries must be drawn from the broad US universe — use real tickers; we will keep only those we cover. Prefer waves where some beneficiaries are NOT yet in the momentum-leaders list (i.e. exposed but not yet repriced). Call record_waves.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    tools: [DETECT_TOOL],
    tool_choice: { type: 'tool', name: 'record_waves' },
    system:
      'You are a macro/thematic strategist who spots structural demand shifts early and reasons about second-order beneficiaries. You are specific and grounded, never vague. Use real, correct tickers.',
    messages: [{ role: 'user', content: prompt }],
  })

  const toolUse = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const waves: DetectedWave[] = toolUse ? ((toolUse.input as { waves?: DetectedWave[] }).waves ?? []) : []

  const created: DetectResult['created'] = []
  for (const w of waves) {
    const beneficiaries = (w.beneficiaries ?? []).filter((b) => universe.has(b.ticker))
    if (beneficiaries.length < 3) continue // need a real subgraph

    // 1. origin theme entity
    const themeSlug = `wave-${w.slug}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const { data: themeRows } = await db
      .from('graph_entities')
      .upsert({ kind: 'theme', ticker: null, name: w.name, slug: themeSlug }, { onConflict: 'slug' })
      .select('id, slug')
    const themeId = themeRows?.[0]?.id
    if (!themeId) continue

    // 2. beneficiary company entities (slug = ticker)
    const { data: entRows } = await db
      .from('graph_entities')
      .upsert(
        beneficiaries.map((b) => ({
          kind: 'company',
          ticker: b.ticker,
          name: b.name,
          slug: b.ticker,
          sector: sectorByTicker.get(b.ticker) ?? null,
        })),
        { onConflict: 'slug' },
      )
      .select('id, slug')
    const idBySlug = new Map((entRows ?? []).map((r) => [r.slug, r.id]))

    // 3. exposed_to_theme edges (theme → beneficiary)
    const edgeRows = beneficiaries
      .map((b) => {
        const dst = idBySlug.get(b.ticker)
        if (!dst) return null
        return {
          src_id: themeId,
          dst_id: dst,
          relation: 'exposed_to_theme',
          weight: Math.max(0, Math.min(1, Number(b.weight) || 0.5)),
          confidence: 0.6,
          evidence: b.rationale,
          source: 'ai',
          as_of: new Date().toISOString().slice(0, 10),
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    if (edgeRows.length) await db.from('graph_edges').upsert(edgeRows, { onConflict: 'src_id,dst_id,relation', ignoreDuplicates: true })

    // 4. wave shock
    await db.from('wave_shocks').upsert(
      {
        slug: w.slug,
        name: w.name,
        origin_id: themeId,
        magnitude: 1.0,
        stage: w.stage,
        thesis: w.thesis,
        active: true,
        detected_by: 'ai',
      },
      { onConflict: 'slug' },
    )
    created.push({ slug: w.slug, name: w.name, beneficiaries: edgeRows.length })
  }

  return { created, proposed: waves.length }
}
