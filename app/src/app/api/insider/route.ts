import { NextRequest, NextResponse } from 'next/server'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const TICKER_RE = /^[A-Z.]{1,10}$/
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export interface InsiderTransaction {
  symbol: string
  filingDate: string
  transactionDate: string
  reportingName: string
  typeOfOwner: string
  transactionType: string
  securitiesTransacted: number
  price: number
  securitiesOwned: number
  url: string
}

export interface InsiderData {
  ticker: string
  netBuyingValue: number
  netBuyingShares: number
  insiderSentiment: 'bullish' | 'bearish' | 'neutral'
  transactions: InsiderTransaction[]
  updatedAt: string
}

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? '').toUpperCase()

  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 })
  }

  const empty: InsiderData = {
    ticker,
    netBuyingValue: 0,
    netBuyingShares: 0,
    insiderSentiment: 'neutral',
    transactions: [],
    updatedAt: new Date().toISOString(),
  }

  try {
    const url = `${FMP_BASE}/insider-trading?symbol=${ticker}&page=0&apikey=${apiKey}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json(empty)

    const raw = await res.json() as InsiderTransaction[]
    if (!Array.isArray(raw)) return NextResponse.json(empty)

    // Filter to last 90 days for aggregate calculations
    const cutoff = Date.now() - NINETY_DAYS_MS
    const recent90 = raw.filter(t => new Date(t.transactionDate).getTime() >= cutoff)

    let totalBuyValue = 0
    let totalSellValue = 0
    let totalBuyShares = 0
    let totalSellShares = 0

    for (const t of recent90) {
      const type = t.transactionType
      const shares = t.securitiesTransacted ?? 0
      const price = t.price ?? 0
      const value = shares * price

      if (type === 'P-Purchase') {
        totalBuyValue += value
        totalBuyShares += shares
      } else if (type === 'S-Sale') {
        totalSellValue += value
        totalSellShares += shares
      }
    }

    const netBuyingValue = totalBuyValue - totalSellValue
    const netBuyingShares = totalBuyShares - totalSellShares

    let insiderSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    if (netBuyingValue > 100_000) insiderSentiment = 'bullish'
    else if (netBuyingValue < -100_000) insiderSentiment = 'bearish'

    const transactions = raw.slice(0, 20)

    const data: InsiderData = {
      ticker,
      netBuyingValue,
      netBuyingShares,
      insiderSentiment,
      transactions,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json(empty)
  }
}
