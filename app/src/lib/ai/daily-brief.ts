/**
 * Daily Knowledge Injection — the learning feed.
 * Synthesizes the current regime + wave propagation into a brief written to TEACH,
 * with one deep-dive each day. Stored in daily_briefs (global). Mirrors autoresearch's
 * "wake up to a log" — but the log teaches you.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runWave, listActiveShocks } from '../waves'

const client = new Anthropic()
const MODEL = 'claude-sonnet-4-6'

interface BriefFields {
  headline: string
  regime_note: string
  flows_note: string
  waves_note: string
  deep_dive_title: string
  deep_dive_md: string
}

function extractJson<T>(text: string): T {
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s === -1 || e === -1) throw new Error('no JSON in model output')
  return JSON.parse(text.slice(s, e + 1)) as T
}

export async function generateDailyBrief(db: SupabaseClient): Promise<BriefFields> {
  // 1. Regime
  const { data: regimeRows } = await db
    .from('regime_daily')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
  const regime = regimeRows?.[0] ?? null

  // 2. Waves — top opportunities across active shocks
  const shocks = await listActiveShocks(db)
  const waveLines: string[] = []
  let deepDiveTicker: string | null = null
  let deepDiveName: string | null = null
  let deepDiveWave: string | null = null
  for (const s of shocks) {
    const run = await runWave(db, s.slug)
    if (!run) continue
    const top = run.results.filter((r) => r.kind === 'company').slice(0, 6)
    waveLines.push(
      `Wave "${run.shock.name}" (${run.shock.stage}): ` +
        top
          .map((r) => `${r.ticker}(opp ${r.opportunity_score == null ? '—' : Math.round(r.opportunity_score)})`)
          .join(', '),
    )
    if (!deepDiveTicker && top[0]) {
      deepDiveTicker = top[0].ticker
      deepDiveName = top[0].name
      deepDiveWave = run.shock.name
    }
  }

  // 3. Optional pre-written explainer for the deep dive (grounds the teaching)
  let explainerContext = ''
  if (deepDiveTicker) {
    const { data: ex } = await db
      .from('business_explainers')
      .select('what_they_do, value_chain')
      .eq('ticker', deepDiveTicker)
      .single()
    if (ex) explainerContext = `\nKNOWN PROFILE of ${deepDiveTicker}: ${ex.what_they_do} ${ex.value_chain}`
  }

  const regimeStr = regime
    ? `state=${regime.state}, total=${regime.total}/5, SPY ${regime.spy_close} vs 200dma ${Math.round(regime.spy_sma200)}, ${regime.pct_sectors_above_200dma}% of sectors above 200dma, VIX ${regime.vix}, HY-OAS ${regime.hy_oas}, yield-curve ${regime.yield_curve}`
    : 'unavailable'

  const prompt = `Write today's market learning brief. Goal: make the reader BETTER at understanding markets, not richer. Teach.

CURRENT REGIME: ${regimeStr}
WAVE PROPAGATION (opportunity = causal exposure minus how much already repriced; higher = exposed but not yet repriced):
${waveLines.length ? waveLines.join('\n') : '(no active waves)'}
DEEP DIVE TARGET: ${deepDiveName ?? 'pick the most interesting node above'} ${deepDiveTicker ? `(${deepDiveTicker})` : ''}, in the "${deepDiveWave ?? ''}" wave.${explainerContext}

Return ONLY JSON:
{
  "headline": "one punchy sentence capturing today's big picture",
  "regime_note": "explain what the regime reading MEANS and why it matters, teaching the indicators (2-3 sentences)",
  "flows_note": "where money/demand appears to be flowing and the economic-cycle read (2-3 sentences)",
  "waves_note": "what the wave propagation is surfacing — name 1-2 un-repriced beneficiaries and why they're interesting, with the honest caveat that this is a research prompt not a signal (2-3 sentences)",
  "deep_dive_title": "title like 'Today: why X matters'",
  "deep_dive_md": "~250-word markdown teaching piece on the deep-dive target: what it does, its exact role in the wave's value chain, and what would confirm/break the thesis. Teach from scratch."
}
No buy/sell advice, no price targets. Honest, specific, educational.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system:
      "You are WorldContrarian's morning teacher. North star: does this make the reader better at researching investments? You explain the why, you teach the indicators, and you are honest about uncertainty. Return strict JSON.",
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
  const fields = extractJson<BriefFields>(text)

  const full_md =
    `# ${fields.headline}\n\n## Regime\n${fields.regime_note}\n\n## Flows\n${fields.flows_note}\n\n` +
    `## Waves\n${fields.waves_note}\n\n## ${fields.deep_dive_title}\n${fields.deep_dive_md}\n`

  // Partial unique index (brief_date WHERE user_id IS NULL) doesn't match a plain
  // ON CONFLICT target, so replace the global brief manually.
  const today = new Date().toISOString().slice(0, 10)
  await db.from('daily_briefs').delete().eq('brief_date', today).is('user_id', null)
  const { error } = await db.from('daily_briefs').insert({
    brief_date: today,
    user_id: null,
    headline: fields.headline,
    regime_note: fields.regime_note,
    flows_note: fields.flows_note,
    waves_note: fields.waves_note,
    deep_dive_title: fields.deep_dive_title,
    deep_dive_md: fields.deep_dive_md,
    full_md,
    meta: { deep_dive_ticker: deepDiveTicker },
  })
  if (error) throw new Error(`daily_briefs insert failed: ${error.message}`)
  return fields
}
