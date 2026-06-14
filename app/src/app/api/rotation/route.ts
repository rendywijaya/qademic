import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Sector rotation engine (QADEMIC.md §3 job 2) — where is money flowing?
// Multi-horizon relative strength vs SPY, computed from our own ohlcv_daily ETF
// history (no vendor calls). Industry-level RS arrives with the S&P 1500 build.
// Evidence basis: industry momentum, Moskowitz & Grinblatt (1999) — rank by 3m RS.

export const revalidate = 3600 // market-wide, identical for everyone, free tier

const SECTORS: Array<{ etf: string; sector: string; color: string }> = [
  { etf: 'XLK',  sector: 'Technology',             color: '#38BDF8' },
  { etf: 'XLF',  sector: 'Financials',             color: '#A78BFA' },
  { etf: 'XLE',  sector: 'Energy',                 color: '#FBBF24' },
  { etf: 'XLV',  sector: 'Healthcare',             color: '#34D399' },
  { etf: 'XLY',  sector: 'Consumer Cyclical',      color: '#F59E0B' },
  { etf: 'XLP',  sector: 'Consumer Defensive',     color: '#60A5FA' },
  { etf: 'XLI',  sector: 'Industrials',            color: '#FB923C' },
  { etf: 'XLB',  sector: 'Basic Materials',        color: '#C084FC' },
  { etf: 'XLRE', sector: 'Real Estate',            color: '#4ADE80' },
  { etf: 'XLU',  sector: 'Utilities',              color: '#94A3B8' },
  { etf: 'XLC',  sector: 'Communication Services', color: '#FB7185' },
]

// Trading-day horizons: 1m ≈ 21, 3m ≈ 63, 6m ≈ 126
const HORIZONS = { rs1m: 21, rs3m: 63, rs6m: 126 } as const

export interface SectorRotation {
  etf: string
  sector: string
  color: string
  rs1m: number | null   // sector return − SPY return, percentage points
  rs3m: number | null
  rs6m: number | null
  rank: number          // 1 = strongest by 3m RS
  above200dma: boolean | null
  pctVs200dma: number | null
  rsTrend: number[]     // weekly RS ratio (ETF/SPY, normalized to 100), ~26 weeks
}

function pctReturn(closes: number[], lookback: number): number | null {
  const end = closes.length - 1
  const start = end - lookback
  if (start < 0 || !closes[start]) return null
  return ((closes[end] - closes[start]) / closes[start]) * 100
}

export async function GET() {
  const supabase = createAdminClient()

  const tickers = ['SPY', ...SECTORS.map(s => s.etf)]
  const series = await Promise.all(tickers.map(async t => {
    const { data } = await supabase
      .from('ohlcv_daily')
      .select('date, close')
      .eq('ticker', t)
      .order('date', { ascending: false })
      .limit(260)
    return (data ?? []).reverse() as Array<{ date: string; close: number }>
  }))

  const spyCloses = series[0].map(r => r.close)
  if (spyCloses.length < HORIZONS.rs6m + 1) {
    return NextResponse.json({ error: 'Insufficient price history' }, { status: 503 })
  }

  const unranked = SECTORS.map((meta, i) => {
    const rows = series[i + 1]
    const closes = rows.map(r => r.close)

    const rs = (lookback: number): number | null => {
      const sec = pctReturn(closes, lookback)
      const spy = pctReturn(spyCloses, lookback)
      if (sec === null || spy === null) return null
      return Math.round((sec - spy) * 100) / 100
    }

    const sma200 = closes.length >= 200
      ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
      : null
    const last = closes[closes.length - 1]

    // Weekly RS ratio sparkline (ETF/SPY indexed to 100 at series start)
    const n = Math.min(closes.length, spyCloses.length)
    const ratios: number[] = []
    for (let idx = n - 1; idx >= 0 && ratios.length < 26; idx -= 5) {
      const c = closes[closes.length - n + idx]
      const s = spyCloses[spyCloses.length - n + idx]
      if (c && s) ratios.unshift(c / s)
    }
    const base = ratios[0] || 1
    const rsTrend = ratios.map(r => Math.round((r / base) * 10000) / 100)

    return {
      ...meta,
      rs1m: rs(HORIZONS.rs1m),
      rs3m: rs(HORIZONS.rs3m),
      rs6m: rs(HORIZONS.rs6m),
      above200dma: sma200 === null ? null : last > sma200,
      pctVs200dma: sma200 === null ? null : Math.round(((last - sma200) / sma200) * 10000) / 100,
      rsTrend,
    }
  })

  const sectors: SectorRotation[] = [...unranked]
    .sort((a, b) => (b.rs3m ?? -Infinity) - (a.rs3m ?? -Infinity))
    .map((s, i) => ({ ...s, rank: i + 1 }))

  return NextResponse.json({
    sectors,
    asOf: series[0][series[0].length - 1]?.date ?? null,
    methodology: 'Relative strength = sector ETF return minus SPY return per horizon. Ranked by 3m RS (Moskowitz & Grinblatt 1999). Educational framework — general information only.',
  })
}
