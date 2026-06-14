import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFundamentalsForTicker } from '@/lib/fmp'

export interface FMPFundamentals {
  ticker: string
  name: string
  sector: string
  industry: string
  description?: string
  logoUrl?: string
  website?: string
  price: number
  change: number
  marketCap: number
  pe: number
  revenueGrowth: number
  grossMargin: number
  fcfMargin: number
  roe: number
  debtEquity: number
  dividendYield: number
  beta?: number
  score: number
  source: 'fmp' | 'fallback' | 'db_scores'
  updatedAt: string
}

const TICKER_RE = /^[A-Z.^]{1,10}$/

export async function GET(request: NextRequest) {
  if (!process.env.FMP_API_KEY) {
    return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 })
  }

  const raw = request.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => TICKER_RE.test(t))
    .slice(0, 20)

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'Pass ?tickers=AAPL,MSFT' }, { status: 400 })
  }

  const supabase = await createClient()
  const results = await Promise.all(tickers.map(t => getFundamentalsForTicker(t, supabase)))

  return NextResponse.json(
    { data: results, updatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' } },
  )
}
