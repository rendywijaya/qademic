import { NextRequest, NextResponse } from 'next/server'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const TICKER_RE = /^[A-Z.]{1,10}$/

interface FMPShortInterest {
  symbol: string
  date: string
  shortInterest: number
  sharesFloat: number
  shortInterestPercent: number
  daysTocover: number
}

export interface ShortInterestResponse {
  ticker: string
  date: string
  shortInterest: number
  sharesFloat: number
  shortInterestPercent: number
  daysToCover: number
  signal: 'high' | 'moderate' | 'low'
  squeezeRisk: 'elevated' | 'moderate' | 'low'
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

  try {
    const url = `${FMP_BASE}/financial-data/short-interest?symbol=${ticker}&apikey=${apiKey}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'No data' }, { status: 404 })
    }

    const raw = await res.json() as FMPShortInterest[] | FMPShortInterest | null

    const item: FMPShortInterest | null = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null)
    if (!item) {
      return NextResponse.json({ error: 'No data' }, { status: 404 })
    }

    const pct = item.shortInterestPercent ?? 0
    const days = item.daysTocover ?? 0

    const signal: 'high' | 'moderate' | 'low' =
      pct >= 20 ? 'high' : pct >= 10 ? 'moderate' : 'low'

    const squeezeRisk: 'elevated' | 'moderate' | 'low' =
      (pct >= 20 && days >= 5) ? 'elevated'
      : (pct >= 10 || days >= 5) ? 'moderate'
      : 'low'

    const response: ShortInterestResponse = {
      ticker,
      date: item.date,
      shortInterest: item.shortInterest,
      sharesFloat: item.sharesFloat,
      shortInterestPercent: pct,
      daysToCover: days,
      signal,
      squeezeRisk,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
