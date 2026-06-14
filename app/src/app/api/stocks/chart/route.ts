import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const TICKER_RE = /^[A-Z.^]{1,10}$/

type Timeframe = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'

function daysForTimeframe(tf: Timeframe): number {
  return { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'ALL': 99999 }[tf]
}

interface OHLCVRow {
  date: string; open: number; high: number; low: number; close: number
  adj_close: number | null; volume: number | null
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const ticker = (sp.get('ticker') ?? '').toUpperCase()
  const tf = ((sp.get('tf') ?? '1Y') as Timeframe)

  if (!TICKER_RE.test(ticker)) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })

  const supabase = await createClient()
  const fromDate = new Date(Date.now() - daysForTimeframe(tf) * 24 * 3600 * 1000).toISOString().split('T')[0]

  // ── 1. Try DB first ───────────────────────────────────────────────────────
  const { data: dbRows } = await supabase
    .from('ohlcv_daily')
    .select('date,open,high,low,close,adj_close,volume')
    .eq('ticker', ticker)
    .gte('date', fromDate)
    .order('date', { ascending: true })
    .limit(1500)

  if (dbRows && dbRows.length > 0) {
    const rows = dbRows as OHLCVRow[]
    return NextResponse.json({
      ticker, timeframe: tf,
      source: 'db',
      data: rows.map(r => ({
        date: r.date,
        open: r.open, high: r.high, low: r.low,
        close: r.adj_close ?? r.close,
        volume: r.volume ?? 0,
      })),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  }

  // ── 2. Fall back to FMP live ──────────────────────────────────────────────
  const apiKey = process.env.FMP_API_KEY ?? ''
  if (!apiKey) return NextResponse.json({ ticker, timeframe: tf, source: 'empty', data: [] })

  try {
    const url = `${FMP_BASE}/historical-price-eod/full?symbol=${ticker}&from=${fromDate}&apikey=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json({ ticker, timeframe: tf, source: 'empty', data: [] })
    const json = await res.json() as { historical?: Array<{ date: string; open: number; high: number; low: number; close: number; adjClose: number; volume: number }> }
    const rows = (json.historical ?? []).sort((a, b) => a.date.localeCompare(b.date))
    return NextResponse.json({
      ticker, timeframe: tf, source: 'fmp',
      data: rows.map(r => ({
        date: r.date,
        open: r.open, high: r.high, low: r.low,
        close: r.adjClose ?? r.close,
        volume: r.volume ?? 0,
      })),
    })
  } catch {
    return NextResponse.json({ ticker, timeframe: tf, source: 'empty', data: [] })
  }
}
