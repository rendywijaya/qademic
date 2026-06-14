import { NextRequest, NextResponse } from 'next/server'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const TICKER_RE = /^[A-Z.^]{1,10}$/

// ── FMP raw shapes ────────────────────────────────────────────────────────────

interface FMPEstimate {
  symbol: string
  date: string
  estimatedEpsAvg: number
  estimatedEpsHigh: number
  estimatedEpsLow: number
  estimatedRevenueAvg: number
  estimatedRevenueHigh: number
  estimatedRevenueLow: number
  numberAnalystEstimatedEps: number
  numberAnalystEstimatedRevenue: number
}

interface FMPSurprise {
  symbol: string
  date: string
  actualEarningResult: number
  estimatedEarning: number
}

interface FMPPriceTarget {
  symbol: string
  publishedDate: string
  newsURL: string
  newsTitle: string
  analystName: string
  priceTarget: number
  adjPriceTarget: number
  priceWhenPosted: number
  newsPublisher: string
  newsBaseURL: string
  analystCompany: string
}

interface FMPRecommendation {
  symbol: string
  date: string
  analystRatingsbuy: number
  analystRatingsHold: number
  analystRatingsSell: number
  analystRatingsStrongBuy: number
  analystRatingsStrongSell: number
}

// ── Public interface exported for the panel component ─────────────────────────

export interface EarningsModel {
  ticker: string

  estimates: Array<{
    period: string
    date: string
    epsAvg: number
    epsHigh: number
    epsLow: number
    revenueAvg: number
    revenueHigh: number
    revenueLow: number
    analystCount: number
  }>

  surprises: Array<{
    period: string
    date: string
    actual: number
    estimate: number
    surprise: number
    surprisePct: number
    beat: boolean
  }>

  beatRate: number
  avgSurprisePct: number

  priceTargetMean: number
  priceTargetHigh: number
  priceTargetLow: number
  currentPrice: number
  priceTargetUpside: number

  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  totalAnalysts: number
  consensusRating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'

  updatedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "2025-03-31" → "Q1 2025" */
function dateToQuarter(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const month = d.getUTCMonth() + 1 // 1-12
  const year = d.getUTCFullYear()
  const q = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4'
  return `${q} ${year}`
}

function consensusLabel(score: number): EarningsModel['consensusRating'] {
  if (score <= 1.5) return 'Strong Buy'
  if (score <= 2.5) return 'Buy'
  if (score <= 3.5) return 'Hold'
  if (score <= 4.5) return 'Sell'
  return 'Strong Sell'
}

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json() as unknown
    return json as T
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? '').toUpperCase()

  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 503 })
  }

  const today = new Date()

  const [rawEstimates, rawSurprises, rawTargets, rawRecs] = await Promise.all([
    safeFetch<FMPEstimate[]>(
      `${FMP_BASE}/analyst-estimates/${ticker}?apikey=${apiKey}`,
    ),
    safeFetch<FMPSurprise[]>(
      `${FMP_BASE}/earnings-surprises?symbol=${ticker}&apikey=${apiKey}`,
    ),
    safeFetch<FMPPriceTarget[]>(
      `${FMP_BASE}/price-target?symbol=${ticker}&apikey=${apiKey}`,
    ),
    safeFetch<FMPRecommendation[]>(
      `${FMP_BASE}/analyst-stock-recommendations?symbol=${ticker}&apikey=${apiKey}`,
    ),
  ])

  // ── Forward estimates: next 4 future quarters sorted asc ─────────────────
  const estimates: EarningsModel['estimates'] = (rawEstimates ?? [])
    .filter(e => new Date(e.date) > today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 4)
    .map(e => ({
      period: dateToQuarter(e.date),
      date: e.date,
      epsAvg: e.estimatedEpsAvg ?? 0,
      epsHigh: e.estimatedEpsHigh ?? 0,
      epsLow: e.estimatedEpsLow ?? 0,
      revenueAvg: e.estimatedRevenueAvg ?? 0,
      revenueHigh: e.estimatedRevenueHigh ?? 0,
      revenueLow: e.estimatedRevenueLow ?? 0,
      analystCount: e.numberAnalystEstimatedEps ?? e.numberAnalystEstimatedRevenue ?? 0,
    }))

  // ── Earnings surprises: last 8 quarters ───────────────────────────────────
  const surprises: EarningsModel['surprises'] = (rawSurprises ?? [])
    .slice(0, 8)
    .map(s => {
      const surprise = (s.actualEarningResult ?? 0) - (s.estimatedEarning ?? 0)
      const absEst = Math.abs(s.estimatedEarning ?? 0)
      const surprisePct = absEst > 0 ? (surprise / absEst) * 100 : 0
      return {
        period: dateToQuarter(s.date),
        date: s.date,
        actual: s.actualEarningResult ?? 0,
        estimate: s.estimatedEarning ?? 0,
        surprise,
        surprisePct,
        beat: surprise > 0,
      }
    })

  const beats = surprises.filter(s => s.beat).length
  const beatRate = surprises.length > 0 ? (beats / surprises.length) * 100 : 0
  const avgSurprisePct =
    surprises.length > 0
      ? surprises.reduce((acc, s) => acc + s.surprisePct, 0) / surprises.length
      : 0

  // ── Price targets ─────────────────────────────────────────────────────────
  const targets = (rawTargets ?? []).filter(t => t.priceTarget > 0)
  const priceTargetMean =
    targets.length > 0
      ? targets.reduce((acc, t) => acc + t.priceTarget, 0) / targets.length
      : 0
  const priceTargetHigh =
    targets.length > 0 ? Math.max(...targets.map(t => t.priceTarget)) : 0
  const priceTargetLow =
    targets.length > 0 ? Math.min(...targets.map(t => t.priceTarget)) : 0
  const currentPrice = targets.length > 0 ? (targets[0]?.priceWhenPosted ?? 0) : 0
  const priceTargetUpside =
    currentPrice > 0 ? ((priceTargetMean - currentPrice) / currentPrice) * 100 : 0

  // ── Analyst consensus ─────────────────────────────────────────────────────
  const rec = rawRecs?.[0] ?? null
  const strongBuy = rec?.analystRatingsStrongBuy ?? 0
  const buy = rec?.analystRatingsbuy ?? 0
  const hold = rec?.analystRatingsHold ?? 0
  const sell = rec?.analystRatingsSell ?? 0
  const strongSell = rec?.analystRatingsStrongSell ?? 0
  const totalAnalysts = strongBuy + buy + hold + sell + strongSell

  const score =
    totalAnalysts > 0
      ? (strongBuy * 1 + buy * 2 + hold * 3 + sell * 4 + strongSell * 5) / totalAnalysts
      : 3
  const consensusRating = consensusLabel(score)

  const model: EarningsModel = {
    ticker,
    estimates,
    surprises,
    beatRate,
    avgSurprisePct,
    priceTargetMean,
    priceTargetHigh,
    priceTargetLow,
    currentPrice,
    priceTargetUpside,
    strongBuy,
    buy,
    hold,
    sell,
    strongSell,
    totalAnalysts,
    consensusRating,
    updatedAt: new Date().toISOString(),
  }

  return NextResponse.json(model, {
    headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' },
  })
}
