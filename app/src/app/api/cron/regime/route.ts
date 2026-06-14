import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 300

// Market regime (QADEMIC.md §3 job 1; spec = METHODOLOGY.md v2 §7, unchanged in v3).
// Five components, fixed conventional thresholds, computed daily after OHLCV ingest.
// Regime GATES (exposure multiplier, new thesis entries) — never touches stock ranks.

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'
const SECTOR_ETFS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLRE', 'XLU', 'XLC']
const TRADING_DAYS_3M = 63

type State = 'risk_on' | 'neutral' | 'risk_off'

function sma(closes: number[], period: number, endIdx: number): number | null {
  // closes ascending; SMA of the `period` values ending at endIdx (inclusive)
  if (endIdx + 1 < period) return null
  const slice = closes.slice(endIdx + 1 - period, endIdx + 1)
  return slice.reduce((a, b) => a + b, 0) / period
}

async function fetchFredSeries(id: string, limit: number): Promise<number[]> {
  // Returns values descending (newest first), '.' placeholders removed
  try {
    const key = process.env.FRED_API_KEY
    if (!key) return []
    const url = `${FRED_BASE}?series_id=${id}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json() as { observations?: Array<{ value: string }> }
    return (data.observations ?? []).filter(o => o.value !== '.').map(o => parseFloat(o.value))
  } catch {
    return []
  }
}

interface ComponentScores {
  trend: number
  breadth: number
  vol: number
  credit: number
  curve: number
  total: number
  rawState: State
}

function scoreComponents(input: {
  spyClose: number | null
  spySma200: number | null
  pctSectorsAbove200: number | null
  vix: number | null
  hyOas: number | null
  hyOas3mChange: number | null
  yieldCurve: number | null
}): ComponentScores {
  const { spyClose, spySma200, pctSectorsAbove200, vix, hyOas, hyOas3mChange, yieldCurve } = input

  const trend = spyClose !== null && spySma200 !== null ? (spyClose > spySma200 ? 1 : -1) : 0
  const breadth = pctSectorsAbove200 === null ? 0
    : pctSectorsAbove200 >= 60 ? 1 : pctSectorsAbove200 <= 40 ? -1 : 0
  const vol = vix === null ? 0 : vix < 20 ? 1 : vix > 28 ? -1 : 0
  const credit = hyOas === null || hyOas3mChange === null ? 0
    : hyOas < 4.0 && hyOas3mChange < 0.50 ? 1
    : hyOas > 5.0 || hyOas3mChange > 0.75 ? -1 : 0
  const curve = yieldCurve === null ? 0 : yieldCurve >= 0.20 ? 1 : yieldCurve <= -0.50 ? -1 : 0

  const total = trend + breadth + vol + credit + curve
  const rawState: State = total >= 2 ? 'risk_on' : total <= -2 ? 'risk_off' : 'neutral'
  return { trend, breadth, vol, credit, curve, total, rawState }
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // ── Prices: SPY + 11 sector ETFs, enough history for a 200dma today and yesterday
  const tickers = ['SPY', ...SECTOR_ETFS]
  const priceRows = await Promise.all(tickers.map(async t => {
    const { data } = await supabase
      .from('ohlcv_daily')
      .select('date, close')
      .eq('ticker', t)
      .order('date', { ascending: false })
      .limit(260)
    return { ticker: t, rows: (data ?? []).reverse() as Array<{ date: string; close: number }> }
  }))

  const spy = priceRows[0]
  if (spy.rows.length < 201) {
    return NextResponse.json({ error: 'Insufficient SPY history for 200dma' }, { status: 500 })
  }

  // ── FRED: VIX, HY OAS (level + 3m change), yield curve — newest first
  const [vixS, oasS, curveS] = await Promise.all([
    fetchFredSeries('VIXCLS', 5),
    fetchFredSeries('BAMLH0A0HYM2', 75),
    fetchFredSeries('T10Y2Y', 5),
  ])

  // dayOffset 0 = latest close, 1 = previous close (for the whipsaw guard)
  const compute = (dayOffset: number): ComponentScores & {
    spyClose: number; spySma200: number | null; pctAbove: number | null
    vix: number | null; hyOas: number | null; yieldCurve: number | null
  } => {
    const spyIdx = spy.rows.length - 1 - dayOffset
    const spyCloses = spy.rows.map(r => r.close)
    const spyClose = spyCloses[spyIdx]
    const spySma200 = sma(spyCloses, 200, spyIdx)

    const sectorFlags = priceRows.slice(1).map(({ rows }) => {
      const idx = rows.length - 1 - dayOffset
      if (idx < 0) return null
      const closes = rows.map(r => r.close)
      const s = sma(closes, 200, idx)
      return s === null ? null : closes[idx] > s
    }).filter((f): f is boolean => f !== null)
    const pctAbove = sectorFlags.length === 0 ? null
      : Math.round((sectorFlags.filter(Boolean).length / sectorFlags.length) * 10000) / 100

    const vix = vixS[dayOffset] ?? null
    const hyOas = oasS[dayOffset] ?? null
    const hyOasPast = oasS[dayOffset + TRADING_DAYS_3M] ?? null
    const hyOas3mChange = hyOas !== null && hyOasPast !== null ? hyOas - hyOasPast : null
    const yieldCurve = curveS[dayOffset] ?? null

    const scores = scoreComponents({ spyClose, spySma200, pctSectorsAbove200: pctAbove, vix, hyOas, hyOas3mChange, yieldCurve })
    return { ...scores, spyClose, spySma200, pctAbove, vix, hyOas, yieldCurve }
  }

  const today = compute(0)
  const yesterday = compute(1)

  // Whipsaw guard: state flips require 2 consecutive daily closes agreeing,
  // else the previous official state holds.
  const { data: prevRow } = await supabase
    .from('regime_daily')
    .select('state')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevState = (prevRow?.state ?? null) as State | null
  const state: State = today.rawState === yesterday.rawState ? today.rawState : (prevState ?? today.rawState)
  const exposureMultiplier = state === 'risk_on' ? 1.0 : state === 'neutral' ? 0.5 : 0.0

  const date = spy.rows[spy.rows.length - 1].date
  const { error } = await supabase.from('regime_daily').upsert({
    date,
    trend_score: today.trend,
    breadth_score: today.breadth,
    vol_score: today.vol,
    credit_score: today.credit,
    curve_score: today.curve,
    total: today.total,
    state,
    exposure_multiplier: exposureMultiplier,
    spy_close: today.spyClose,
    spy_sma200: today.spySma200,
    pct_sectors_above_200dma: today.pctAbove,
    vix: today.vix,
    hy_oas: today.hyOas,
    yield_curve: today.yieldCurve,
  }, { onConflict: 'date' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true, date, state, total: today.total, exposure_multiplier: exposureMultiplier,
    components: {
      trend: today.trend, breadth: today.breadth, vol: today.vol,
      credit: today.credit, curve: today.curve,
    },
  })
}
