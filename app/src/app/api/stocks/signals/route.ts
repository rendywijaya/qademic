import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStockSignals, getUniverseRanking } from '@/lib/supabase/cache'

const TICKER_RE = /^[A-Z.^]{1,10}$/

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? '').toUpperCase()
  if (!TICKER_RE.test(ticker)) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })

  const supabase = await createClient()
  const [signals, ranking] = await Promise.all([
    getStockSignals(supabase, ticker),
    getUniverseRanking(supabase, ticker),
  ])

  if (!signals) {
    return NextResponse.json({ available: false, message: 'Signals not yet computed. Run nightly pipeline.' })
  }

  return NextResponse.json({
    available: true,
    ticker,
    signals,
    ranking: ranking ?? null,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  })
}
