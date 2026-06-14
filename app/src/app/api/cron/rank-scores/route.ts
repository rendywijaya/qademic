import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeSectorNeutralRanks, type RankInputStock } from '@/lib/ranking'
import { gradeFromScores } from '@/lib/grades'

export const maxDuration = 300

// Sector-neutral percentile-rank pass (QADEMIC.md §4). Runs AFTER score-stocks:
// reads every scored stock's pillar scores, converts Business/Timing into
// cross-sectional sector-neutral percentile ranks, and rewrites them as the
// source of truth. Deterministic, zero AI, idempotent.

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from('stock_q7_scores')
    .select('ticker, sector, q3_score, q4_score, q5_score, q6_score, q7_score')
    .limit(5000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, message: 'No scored stocks yet.' })
  }

  const stocks: RankInputStock[] = (rows as Array<{
    ticker: string; sector: string | null
    q3_score: number | null; q4_score: number | null; q5_score: number | null
    q6_score: number | null; q7_score: number | null
  }>).map(r => ({
    ticker: r.ticker, sector: r.sector,
    q3: r.q3_score, q4: r.q4_score, q5: r.q5_score, q6: r.q6_score, q7: r.q7_score,
  }))

  const ranked = computeSectorNeutralRanks(stocks)
  const today = new Date().toISOString().split('T')[0]

  let updated = 0
  // Small universe — per-row updates are fine and keep this simple.
  await Promise.all(ranked.map(async r => {
    const update: { business_score: number | null; timing_score: number | null; grade?: string } = {
      business_score: r.business,
      timing_score: r.timing,
    }
    if (r.business != null && r.timing != null) {
      update.grade = gradeFromScores(r.business, r.timing)
    }
    const { error: upErr } = await admin.from('stock_q7_scores').update(update).eq('ticker', r.ticker)
    if (!upErr) updated++
    // Keep today's append-only snapshot consistent with the ranks we actually show,
    // so the forward-cohort validation judges the canonical scores.
    await admin.from('score_history')
      .update({ business_score: r.business, timing_score: r.timing })
      .eq('ticker', r.ticker)
      .eq('scored_date', today)
  }))

  return NextResponse.json({
    ok: true,
    method: 'sector_neutral_percentile_rank',
    scored: stocks.length,
    updated,
  })
}
