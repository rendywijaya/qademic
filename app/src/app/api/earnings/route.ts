import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const TICKER_RE = /^[A-Z.^]{1,10}$/

export interface EarningsEvent {
  ticker: string
  companyName: string
  date: string // ISO date
  epsEstimate: number | null
  epsActual: number | null
  revenueEstimate: number | null
  revenueActual: number | null
  surprise: number | null // epsActual - epsEstimate
  surprisePct: number | null // as percentage
  isUpcoming: boolean
}

// ─── FMP raw response shapes ─────────────────────────────────────────────────

interface FMPEarningsSurprise {
  symbol?: string
  date?: string
  actualEarningResult?: number | null
  estimatedEarning?: number | null
  revenueEstimated?: number | null
  revenueActual?: number | null
}

interface FMPEarningCalendar {
  symbol?: string
  date?: string
  eps?: number | null
  epsEstimated?: number | null
  revenueEstimated?: number | null
  revenue?: number | null
  name?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fmpGet<T>(path: string, apiKey: string): Promise<T[] | null> {
  try {
    const separator = path.includes('?') ? '&' : '?'
    const res = await fetch(`${FMP_BASE}/${path}${separator}apikey=${apiKey}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    return Array.isArray(data) ? (data as T[]) : null
  } catch {
    return null
  }
}

function toISODate(raw: string | undefined): string {
  if (!raw) return ''
  // Accept YYYY-MM-DD or similar
  return raw.slice(0, 10)
}

// ─── Per-ticker fetch (cached 6h) ─────────────────────────────────────────────

function getEarningsForTicker(ticker: string, apiKey: string) {
  return unstable_cache(
    async (): Promise<EarningsEvent[]> => {
      const today = new Date()
      const from = today.toISOString().slice(0, 10)
      const to = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)

      const [surprises, calendarAll] = await Promise.all([
        fmpGet<FMPEarningsSurprise>(`earnings-surprises?symbol=${ticker}`, apiKey),
        fmpGet<FMPEarningCalendar>(
          `earning-calendar?symbol=${ticker}&from=${from}&to=${to}`,
          apiKey
        ),
      ])

      const events: EarningsEvent[] = []

      // Upcoming from calendar
      if (calendarAll) {
        for (const ev of calendarAll) {
          if (!ev.date) continue
          const isoDate = toISODate(ev.date)
          if (!isoDate) continue
          events.push({
            ticker,
            companyName: ev.name ?? ticker,
            date: isoDate,
            epsEstimate: ev.epsEstimated ?? null,
            epsActual: ev.eps ?? null,
            revenueEstimate: ev.revenueEstimated ?? null,
            revenueActual: ev.revenue ?? null,
            surprise: null,
            surprisePct: null,
            isUpcoming: true,
          })
        }
      }

      // Past results from surprises (limit to last 60 days)
      const cutoff = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)

      if (surprises) {
        for (const ev of surprises) {
          if (!ev.date) continue
          const isoDate = toISODate(ev.date)
          if (!isoDate || isoDate < cutoff) continue

          const actual = ev.actualEarningResult ?? null
          const estimate = ev.estimatedEarning ?? null
          const surprise =
            actual !== null && estimate !== null ? actual - estimate : null
          const surprisePct =
            surprise !== null && estimate !== null && estimate !== 0
              ? (surprise / Math.abs(estimate)) * 100
              : null

          events.push({
            ticker,
            companyName: ticker,
            date: isoDate,
            epsEstimate: estimate,
            epsActual: actual,
            revenueEstimate: ev.revenueEstimated ?? null,
            revenueActual: ev.revenueActual ?? null,
            surprise,
            surprisePct: surprisePct !== null ? Math.round(surprisePct * 10) / 10 : null,
            isUpcoming: false,
          })
        }
      }

      return events
    },
    [`earnings-${ticker}-v1`],
    { revalidate: 21600 }, // 6 hours
  )
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const apiKey = process.env.FMP_API_KEY ?? ''
  if (!apiKey) {
    return NextResponse.json(
      { data: [] as EarningsEvent[] },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } }
    )
  }

  const raw = request.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => TICKER_RE.test(t))
    .slice(0, 20)

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'Pass ?tickers=AAPL,MSFT' }, { status: 400 })
  }

  const results = await Promise.all(
    tickers.map((t) => getEarningsForTicker(t, apiKey)())
  )
  const flat: EarningsEvent[] = results.flat()

  return NextResponse.json(
    { data: flat, updatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } }
  )
}
