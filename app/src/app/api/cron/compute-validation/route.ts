import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeForwardCohorts, type ScoreSnapshot, type SpyBar } from '@/lib/validation'

export const maxDuration = 300

// Forward-cohort validation cron (QADEMIC.md §10). Nightly, pure deterministic:
// read append-only score_history, compute the decile spread + SPY benchmark over a
// 30-day forward window for each ranking signal, store the summary for the public
// Proof page. Publishes nothing until 30-day windows mature — by construction.

const WINDOW_DAYS = 30

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Pull the full history once. setup_score is not-null; business_score may be null
  // on older rows (added in the v3 migration) — the engine handles that.
  const { data: historyRows, error } = await admin
    .from('score_history')
    .select('ticker, scored_date, setup_score, business_score, price')
    .order('scored_date', { ascending: true })
    .limit(200000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (historyRows ?? []) as Array<{
    ticker: string; scored_date: string
    setup_score: number | null; business_score: number | null; price: number | null
  }>

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, message: 'No score history yet — nothing to validate.' })
  }

  // SPY benchmark over the same windows, from our own daily history.
  const earliest = rows[0].scored_date
  const { data: spyData } = await admin
    .from('ohlcv_daily')
    .select('date, close')
    .eq('ticker', 'SPY')
    .gte('date', earliest)
    .order('date', { ascending: true })
  const spyRows = (spyData ?? []) as SpyBar[]

  const signals: Array<{ key: string; pick: (r: typeof rows[number]) => number | null }> = [
    { key: 'setup_score', pick: r => r.setup_score },
    { key: 'business_score', pick: r => r.business_score },
  ]

  const results = signals.map(({ key, pick }) => {
    const snapshots: ScoreSnapshot[] = rows.map(r => ({
      ticker: r.ticker, scored_date: r.scored_date, score: pick(r), price: r.price,
    }))
    const summary = computeForwardCohorts(snapshots, spyRows, { windowDays: WINDOW_DAYS, topQuantile: 0.10 })
    return { key, summary }
  })

  for (const { key, summary } of results) {
    await admin.from('signal_validation').upsert({
      signal: key,
      window_days: WINDOW_DAYS,
      cohorts: summary.cohorts,
      n_observations: summary.nObservations,
      top_avg_fwd: summary.topAvgFwd,
      bottom_avg_fwd: summary.bottomAvgFwd,
      spread: summary.spread,
      universe_avg_fwd: summary.universeAvgFwd,
      spy_avg_fwd: summary.spyAvgFwd,
      top_quantile: 0.10,
      first_cohort_date: summary.firstCohortDate,
      last_cohort_date: summary.lastCohortDate,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'signal,window_days' })
  }

  return NextResponse.json({
    ok: true,
    windowDays: WINDOW_DAYS,
    historyRows: rows.length,
    spyBars: spyRows.length,
    results: results.map(r => ({ signal: r.key, cohorts: r.summary.cohorts, spread: r.summary.spread })),
  })
}
