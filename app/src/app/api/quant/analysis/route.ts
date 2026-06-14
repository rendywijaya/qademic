import { NextRequest, NextResponse } from 'next/server'
import { getFundamentalsForTicker } from '@/lib/fmp'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import { createClient } from '@/lib/supabase/server'
import { getCachedPriceHistory, writePriceHistoryCache } from '@/lib/supabase/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuantAnalysis {
  ticker: string
  timestamp: string
  fundamentals: FMPFundamentals
  priceHistory: Array<{ date: string; close: number; volume: number }>
  technical: {
    rsi: number
    macd: number
    macdSignal: number
    macdHistogram: number
    sma50: number
    sma200: number
    pctFrom200DMA: number
    bbandsUpper: number
    bbandsLower: number
    bbandsMiddle: number
    bbandsPercent: number
    volume: number
    volumeAvg20: number
    weekHigh52: number
    weekLow52: number
  }
  factors: {
    value: number
    quality: number
    momentum: number
    lowVol: number
    growth: number
    composite: number
  }
  piotroski: {
    score: number
    criteria: {
      roa_positive: boolean
      cfo_positive: boolean
      roa_improving: boolean
      accruals_quality: boolean
      leverage_low: boolean
      liquidity_ok: boolean
      no_dilution: boolean
      margin_improving: boolean
      turnover_improving: boolean
    }
  }
  returns: {
    ret1m: number
    ret3m: number
    ret6m: number
    ret12m: number
  }
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function ema(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = [prices[0]]
  for (let i = 1; i < prices.length; i++) {
    result.push(prices[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

function sma(prices: number[], period: number): number {
  const slice = prices.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

// ─── Technical indicators ─────────────────────────────────────────────────────

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50

  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += Math.abs(diff)
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = avgGain * (13 / 14) + gain * (1 / 14)
    avgLoss = avgLoss * (13 / 14) + loss * (1 / 14)
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function computeMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0 }

  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)

  const startIdx = 25
  const macdLine: number[] = []
  for (let i = startIdx; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i])
  }

  if (macdLine.length < 9) return { macd: macdLine[macdLine.length - 1] ?? 0, signal: 0, histogram: 0 }

  const signalLine = ema(macdLine, 9)
  const lastMacd = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1]

  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
  }
}

function computeBollinger(closes: number[]): {
  upper: number
  lower: number
  middle: number
  percent: number
} {
  if (closes.length < 20) {
    const p = closes[closes.length - 1] ?? 0
    return { upper: p * 1.05, lower: p * 0.95, middle: p, percent: 0.5 }
  }

  const last20 = closes.slice(-20)
  const mean = last20.reduce((a, b) => a + b, 0) / 20
  const variance = last20.reduce((acc, v) => acc + (v - mean) ** 2, 0) / 20
  const stdDev = Math.sqrt(variance)

  const upper = mean + 2 * stdDev
  const lower = mean - 2 * stdDev
  const current = closes[closes.length - 1]
  const percent = upper === lower ? 0.5 : (current - lower) / (upper - lower)

  return { upper, lower, middle: mean, percent }
}

// ─── Factor scores ─────────────────────────────────────────────────────────────

function valueScore(f: FMPFundamentals): number {
  let score = 50
  const pe = f.pe
  if (pe > 0 && pe < 15) score += 20
  else if (pe > 0 && pe < 25) score += 10
  else if (pe > 40) score -= 20

  if (f.debtEquity < 0.3) score += 10
  else if (f.debtEquity > 2) score -= 10

  if (f.dividendYield > 2) score += 10

  return clamp(Math.round(score), 0, 100)
}

function qualityScore(f: FMPFundamentals): number {
  let score = 50

  if (f.roe > 30) score += 20
  else if (f.roe > 15) score += 12
  else if (f.roe > 0) score += 5
  else if (f.roe < 0) score -= 15

  if (f.grossMargin > 70) score += 15
  else if (f.grossMargin > 50) score += 10
  else if (f.grossMargin > 30) score += 5
  else if (f.grossMargin < 10) score -= 10

  if (f.fcfMargin > 25) score += 15
  else if (f.fcfMargin > 10) score += 8
  else if (f.fcfMargin > 0) score += 3
  else if (f.fcfMargin < 0) score -= 20

  return clamp(Math.round(score), 0, 100)
}

function momentumScore(returns: { ret1m: number; ret3m: number; ret6m: number; ret12m: number }): number {
  let score = 50

  if (returns.ret12m > 30) score += 20
  else if (returns.ret12m > 15) score += 12
  else if (returns.ret12m > 5) score += 6
  else if (returns.ret12m < -20) score -= 20
  else if (returns.ret12m < -10) score -= 10

  if (returns.ret3m > 10) score += 10
  else if (returns.ret3m < -10) score -= 10

  return clamp(Math.round(score), 0, 100)
}

function lowVolScore(
  f: FMPFundamentals,
  weekHigh52: number,
  weekLow52: number,
  currentPrice: number,
): number {
  // beta approximated from PE and debt — FMP doesn't expose beta directly
  // but we compute from fundamentals proxy
  let score = 50
  const beta = f.debtEquity > 0 ? 0.8 + f.debtEquity * 0.3 : 0.9

  if (beta < 0.7) score += 20
  else if (beta < 1.0) score += 10
  else if (beta > 1.5) score -= 15
  else if (beta > 2.0) score -= 25

  const rangeWidth = weekHigh52 - weekLow52
  if (rangeWidth > 0) {
    const rangePosition = (currentPrice - weekLow52) / rangeWidth
    if (rangePosition < 0.3) score += 10
    else if (rangePosition > 0.9) score -= 10
  }

  return clamp(Math.round(score), 0, 100)
}

function growthScore(f: FMPFundamentals): number {
  let score = 50

  if (f.revenueGrowth > 40) score += 25
  else if (f.revenueGrowth > 20) score += 15
  else if (f.revenueGrowth > 10) score += 8
  else if (f.revenueGrowth < -10) score -= 20
  else if (f.revenueGrowth < 0) score -= 10

  if (f.revenueGrowth > 20 && f.grossMargin > 60) score += 5

  return clamp(Math.round(score), 0, 100)
}

// ─── Piotroski F-Score ────────────────────────────────────────────────────────

function computePiotroski(f: FMPFundamentals): QuantAnalysis['piotroski'] {
  const netMargin = f.grossMargin * 0.4 // rough proxy for net margin from gross margin
  const estimatedROA = netMargin > 0 ? netMargin * 0.5 : -1 // proxy

  const criteria = {
    roa_positive: f.roe > 0 && f.fcfMargin > 0,
    cfo_positive: f.fcfMargin > 0,
    roa_improving: f.roe > 5 && f.revenueGrowth > 0,
    accruals_quality: f.fcfMargin > netMargin,
    leverage_low: f.debtEquity < 1.0,
    liquidity_ok: f.debtEquity < 2.0 && f.fcfMargin > 0,
    no_dilution: f.revenueGrowth < f.marketCap / Math.max(f.price, 1) * 0.01 || f.marketCap > 0,
    margin_improving: f.revenueGrowth > 0 && f.grossMargin > 40,
    turnover_improving: f.revenueGrowth > 0,
  }

  // Suppress unused variable warning for estimatedROA
  void estimatedROA

  const score = Object.values(criteria).filter(Boolean).length

  return { score, criteria }
}

// ─── Price history fetch ───────────────────────────────────────────────────────

interface FMPHistoricalItem {
  date: string
  close: number
  volume: number
}

interface FMPHistoricalResponse {
  historical: FMPHistoricalItem[]
}

async function fetchPriceHistory(ticker: string): Promise<Array<{ date: string; close: number; volume: number }>> {
  const apiKey = process.env.FMP_API_KEY ?? ''
  if (!apiKey) return []

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/historical-price-full/${ticker}?timeseries=252&apikey=${apiKey}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = (await res.json()) as FMPHistoricalResponse | null
    if (!data || !Array.isArray(data.historical)) return []

    return data.historical
      .map((h) => ({ date: h.date, close: h.close, volume: h.volume }))
      .reverse() // oldest first
  } catch {
    return []
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

const TICKER_RE = /^[A-Z.^]{1,10}$/

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? '').toUpperCase()

  if (!ticker || !TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: 'Pass ?ticker=AAPL' }, { status: 400 })
  }

  // Fetch fundamentals and price history (share one supabase client)
  const supabase = await createClient()
  const fundamentals = await getFundamentalsForTicker(ticker, supabase)

  // Fetch price history (with cache)
  let priceHistory: Array<{ date: string; close: number; volume: number }>
  try {
    const cached = await getCachedPriceHistory(supabase, ticker)
    if (cached) {
      priceHistory = cached
    } else {
      priceHistory = await fetchPriceHistory(ticker)
      if (priceHistory.length > 0) {
        await writePriceHistoryCache(ticker, priceHistory)
      }
    }
  } catch {
    priceHistory = await fetchPriceHistory(ticker)
  }

  const closes = priceHistory.map((p) => p.close)
  const n = closes.length

  // Technical indicators
  const rsi = n > 15 ? computeRSI(closes) : 50
  const { macd, signal: macdSignal, histogram: macdHistogram } = computeMACD(closes)
  const sma50 = n >= 50 ? sma(closes, 50) : closes[n - 1] ?? 0
  const sma200 = n >= 200 ? sma(closes, 200) : closes[n - 1] ?? 0
  const currentPrice = fundamentals.price || closes[n - 1] || 0
  const pctFrom200DMA = sma200 > 0 ? ((currentPrice - sma200) / sma200) * 100 : 0
  const { upper: bbandsUpper, lower: bbandsLower, middle: bbandsMiddle, percent: bbandsPercent } = computeBollinger(closes)

  const volumes = priceHistory.map((p) => p.volume)
  const volume = volumes[volumes.length - 1] ?? 0
  const volumeAvg20 = volumes.length >= 20
    ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
    : volume

  const prices = priceHistory.map((p) => p.close)
  const weekHigh52 = prices.length > 0 ? Math.max(...prices.slice(-252)) : currentPrice
  const weekLow52 = prices.length > 0 ? Math.min(...prices.slice(-252)) : currentPrice

  // Returns
  const retAt = (daysAgo: number): number => {
    const idx = Math.max(0, n - 1 - daysAgo)
    const base = closes[idx]
    if (!base || !closes[n - 1]) return 0
    return ((closes[n - 1] - base) / base) * 100
  }

  const returns = {
    ret1m: retAt(21),
    ret3m: retAt(63),
    ret6m: retAt(126),
    ret12m: retAt(252),
  }

  // Factor scores
  const value = valueScore(fundamentals)
  const quality = qualityScore(fundamentals)
  const momentum = momentumScore(returns)
  const lowVol = lowVolScore(fundamentals, weekHigh52, weekLow52, currentPrice)
  const growth = growthScore(fundamentals)
  const composite = Math.round(
    value * 0.2 + quality * 0.3 + momentum * 0.2 + lowVol * 0.1 + growth * 0.2,
  )

  const piotroski = computePiotroski(fundamentals)

  const analysis: QuantAnalysis = {
    ticker,
    timestamp: new Date().toISOString(),
    fundamentals,
    priceHistory,
    technical: {
      rsi,
      macd,
      macdSignal,
      macdHistogram,
      sma50,
      sma200,
      pctFrom200DMA,
      bbandsUpper,
      bbandsLower,
      bbandsMiddle,
      bbandsPercent,
      volume,
      volumeAvg20,
      weekHigh52,
      weekLow52,
    },
    factors: { value, quality, momentum, lowVol, growth, composite },
    piotroski,
    returns,
  }

  return NextResponse.json(analysis, {
    headers: { 'Cache-Control': 'public, s-maxage=3600' },
  })
}
