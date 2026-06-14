import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

export interface StockQuote {
  ticker: string
  price: number
  change: number
  changePercent: number
  previousClose: number
}

async function fetchYahooQuote(ticker: string): Promise<StockQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number
            previousClose?: number
            chartPreviousClose?: number
            symbol?: string
          }
        }>
      }
    }
    const meta = json.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null

    const price = meta.regularMarketPrice
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? price
    const change = price - prev
    const changePercent = prev > 0 ? (change / prev) * 100 : 0

    return { ticker, price, change, changePercent, previousClose: prev }
  } catch {
    return null
  }
}

// Cache the fetcher keyed by sorted ticker list
function makeCachedFetcher(tickers: string[]) {
  const key = tickers.slice().sort().join(',')
  return unstable_cache(
    async () => {
      // Fetch in parallel — Yahoo Finance handles this fine at small scale
      const results = await Promise.all(tickers.map(fetchYahooQuote))
      const map: Record<string, StockQuote> = {}
      for (const q of results) {
        if (q) map[q.ticker] = q
      }
      return map
    },
    [`stock-prices-${key}`],
    { revalidate: 900 } // 15 min cache
  )
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => /^[A-Z.^]{1,10}$/.test(t))
    .slice(0, 20) // hard cap

  if (tickers.length === 0) {
    return NextResponse.json({}, { status: 400 })
  }

  const prices = await makeCachedFetcher(tickers)()
  return NextResponse.json(prices, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
  })
}
