import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertUniverseRankings } from '@/lib/supabase/cache'

export const maxDuration = 300

function percentileRank(values: number[], value: number): number {
  const below = values.filter(v => v < value).length
  return Math.round((below / values.length) * 100)
}

interface SignalRow {
  ticker: string; sector: string | null
  rsi_14: number | null
  momentum_1m: number | null; momentum_3m: number | null
  momentum_6m: number | null; momentum_12m: number | null
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1. Load all stock signals
  const { data: signals } = await admin
    .from('stock_signals')
    .select('ticker, rsi_14, momentum_1m, momentum_3m, momentum_6m, momentum_12m')
    .limit(2000)

  if (!signals || signals.length === 0) {
    return NextResponse.json({ ok: true, message: 'No signals data. Run compute-signals first.' })
  }

  // 2. Load sector info from q7 scores or profile
  const { data: q7Rows } = await admin
    .from('stock_q7_scores')
    .select('ticker, sector')
    .limit(2000)
  const sectorMap = Object.fromEntries((q7Rows ?? []).map((r: { ticker: string; sector: string | null }) => [r.ticker, r.sector]))

  const rows = (signals as SignalRow[]).map(r => ({
    ...r,
    sector: sectorMap[r.ticker] ?? null,
  }))

  // 3. Build universe arrays for each signal
  const rsiValues = rows.filter(r => r.rsi_14 != null).map(r => r.rsi_14 as number)
  const mom1mValues = rows.filter(r => r.momentum_1m != null).map(r => r.momentum_1m as number)
  const mom3mValues = rows.filter(r => r.momentum_3m != null).map(r => r.momentum_3m as number)
  const mom6mValues = rows.filter(r => r.momentum_6m != null).map(r => r.momentum_6m as number)
  const mom12mValues = rows.filter(r => r.momentum_12m != null).map(r => r.momentum_12m as number)

  // 4. Load setup scores for setup_score_pct
  const { data: q7Scores } = await admin
    .from('stock_q7_scores')
    .select('ticker, setup_score')
    .limit(2000)
  const setupScoreMap = Object.fromEntries((q7Scores ?? []).map((r: { ticker: string; setup_score: number }) => [r.ticker, r.setup_score]))
  const setupScoreValues = Object.values(setupScoreMap) as number[]

  // 5. Compute rankings per row
  const rankingRows = rows.map(r => {
    // Sector peers
    const peers = rows.filter(p => p.sector != null && p.sector === r.sector)
    const peerRsiVals = peers.filter(p => p.rsi_14 != null).map(p => p.rsi_14 as number)
    const peerMom3mVals = peers.filter(p => p.momentum_3m != null).map(p => p.momentum_3m as number)

    const setupScore = setupScoreMap[r.ticker]

    return {
      ticker: r.ticker,
      sector: r.sector,
      rsi_pct: r.rsi_14 != null && rsiValues.length > 0 ? percentileRank(rsiValues, r.rsi_14) : null,
      momentum_1m_pct: r.momentum_1m != null && mom1mValues.length > 0 ? percentileRank(mom1mValues, r.momentum_1m) : null,
      momentum_3m_pct: r.momentum_3m != null && mom3mValues.length > 0 ? percentileRank(mom3mValues, r.momentum_3m) : null,
      momentum_6m_pct: r.momentum_6m != null && mom6mValues.length > 0 ? percentileRank(mom6mValues, r.momentum_6m) : null,
      momentum_12m_pct: r.momentum_12m != null && mom12mValues.length > 0 ? percentileRank(mom12mValues, r.momentum_12m) : null,
      sector_rsi_pct: r.rsi_14 != null && peerRsiVals.length > 1 ? percentileRank(peerRsiVals, r.rsi_14) : null,
      sector_mom_3m_pct: r.momentum_3m != null && peerMom3mVals.length > 1 ? percentileRank(peerMom3mVals, r.momentum_3m) : null,
      setup_score_pct: setupScore != null && setupScoreValues.length > 0 ? percentileRank(setupScoreValues, setupScore) : null,
    }
  })

  await upsertUniverseRankings(rankingRows)

  return NextResponse.json({ ok: true, tickersRanked: rankingRows.length })
}
