import { NextRequest, NextResponse } from 'next/server'

const FMP_BASE = 'https://financialmodelingprep.com/stable'

export interface DividendPayment {
  date: string
  amount: number
  year: number
}

export interface DividendData {
  ticker: string
  yield: number
  annualAmount: number
  payoutRatio: number | null
  frequency: string
  exDividendDate: string | null
  paymentDate: string | null
  fiveYearGrowthRate: number | null
  history: DividendPayment[]   // annual totals, last 5 years
  source: 'fmp' | 'fallback'
}

interface FMPDividend {
  date: string
  dividend: number
  recordDate?: string
  paymentDate?: string
  declarationDate?: string
}

function detectFrequency(payments: FMPDividend[]): string {
  if (payments.length < 2) return 'Unknown'
  const recent = payments.slice(0, 8)
  if (recent.length >= 4) {
    const gaps = recent.slice(0, -1).map((p, i) => {
      const a = new Date(p.date).getTime()
      const b = new Date(recent[i + 1].date).getTime()
      return Math.abs(a - b) / (1000 * 60 * 60 * 24)
    })
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    if (avgGap < 40) return 'Monthly'
    if (avgGap < 100) return 'Quarterly'
    if (avgGap < 200) return 'Semi-Annual'
    return 'Annual'
  }
  return 'Quarterly'
}

function annualHistory(payments: FMPDividend[]): DividendPayment[] {
  const byYear = new Map<number, number>()
  for (const p of payments) {
    const year = new Date(p.date).getFullYear()
    byYear.set(year, (byYear.get(year) ?? 0) + p.dividend)
  }
  const currentYear = new Date().getFullYear()
  const years = Array.from(byYear.entries())
    .filter(([y]) => y >= currentYear - 5 && y <= currentYear)
    .sort((a, b) => a[0] - b[0])
  return years.map(([year, amount]) => ({ date: `${year}`, amount: Math.round(amount * 100) / 100, year }))
}

function calcGrowthRate(history: DividendPayment[]): number | null {
  if (history.length < 3) return null
  const oldest = history[0].amount
  const newest = history[history.length - 1].amount
  if (oldest <= 0) return null
  const years = history[history.length - 1].year - history[0].year
  if (years <= 0) return null
  return Math.round(((Math.pow(newest / oldest, 1 / years) - 1) * 100) * 10) / 10
}

const TICKER_RE = /^[A-Z.^]{1,10}$/

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? '').toUpperCase()
  if (!TICKER_RE.test(ticker)) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })

  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ticker, yield: 0, annualAmount: 0, payoutRatio: null, frequency: 'Unknown', exDividendDate: null, paymentDate: null, fiveYearGrowthRate: null, history: [], source: 'fallback' } satisfies DividendData)
  }

  try {
    const [divRes, profileRes] = await Promise.all([
      fetch(`${FMP_BASE}/dividends?symbol=${ticker}&apikey=${apiKey}`, { cache: 'no-store' }),
      fetch(`${FMP_BASE}/profile?symbol=${ticker}&apikey=${apiKey}`, { cache: 'no-store' }),
    ])

    const divJson = divRes.ok ? await divRes.json() as FMPDividend[] : []
    const profileJson = profileRes.ok ? await profileRes.json() as Array<{ price?: number; lastDividend?: number; peRatioTTM?: number; payoutRatioTTM?: number }> : []

    const payments = Array.isArray(divJson) ? divJson.filter(d => d.dividend > 0) : []
    const profile = Array.isArray(profileJson) && profileJson.length > 0 ? profileJson[0] : null

    const price = profile?.price ?? 0
    const annualAmount = payments.length > 0
      ? payments.slice(0, 4).reduce((sum, p) => sum + p.dividend, 0)
      : (profile?.lastDividend ?? 0)
    const yieldPct = price > 0 && annualAmount > 0 ? Math.round((annualAmount / price) * 10000) / 100 : 0
    const payoutRatio = profile?.payoutRatioTTM != null ? Math.round(profile.payoutRatioTTM * 100) : null

    const history = annualHistory(payments)
    const frequency = detectFrequency(payments)
    const fiveYearGrowthRate = calcGrowthRate(history)

    const next = payments[0]

    const result: DividendData = {
      ticker,
      yield: yieldPct,
      annualAmount: Math.round(annualAmount * 100) / 100,
      payoutRatio,
      frequency,
      exDividendDate: next?.date ?? null,
      paymentDate: next?.paymentDate ?? null,
      fiveYearGrowthRate,
      history,
      source: 'fmp',
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
    })
  } catch {
    return NextResponse.json({ ticker, yield: 0, annualAmount: 0, payoutRatio: null, frequency: 'Unknown', exDividendDate: null, paymentDate: null, fiveYearGrowthRate: null, history: [], source: 'fallback' } satisfies DividendData)
  }
}
