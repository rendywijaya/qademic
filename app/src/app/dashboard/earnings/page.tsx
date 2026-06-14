import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWatchlist, getPortfolioHoldings } from '@/lib/supabase/queries'
import { unstable_cache } from 'next/cache'
import type { EarningsEvent } from '@/app/api/earnings/route'
import EarningsClient from '@/components/earnings/earnings-client'

export const metadata = {
  title: 'Earnings Calendar — Qademic',
  description: 'Track upcoming earnings reports and past results for your watchlist and portfolio.',
}

// Top 15 universe tickers for Broader Market section (hardcoded, fetch all at once)
const MARKET_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM', 'V',
  'JNJ', 'WMT', 'XOM', 'PG', 'MA', 'HD',
]

const TICKER_RE = /^[A-Z.^]{1,10}$/

// ─── Finnhub types ─────────────────────────────────────────────────────────────

interface FinnhubCalendarEntry {
  symbol?: string
  date?: string
  epsEstimate?: number | null
  revenueEstimate?: number | null
  hour?: string
}

interface FinnhubCalendarResponse {
  earningsCalendar?: FinnhubCalendarEntry[]
}

interface FinnhubEarningsEntry {
  symbol?: string
  period?: string
  actual?: number | null
  estimate?: number | null
  surprise?: number | null
  surprisePercent?: number | null
}

// ─── Finnhub fetchers ──────────────────────────────────────────────────────────

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

async function finnhubGet<T>(path: string, apiKey: string): Promise<T | null> {
  try {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${FINNHUB_BASE}/${path}${sep}token=${apiKey}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// Fetch upcoming earnings calendar for a date range — returns all tickers at once
async function fetchUpcomingCalendar(
  from: string,
  to: string,
  apiKey: string,
): Promise<FinnhubCalendarEntry[]> {
  const data = await finnhubGet<FinnhubCalendarResponse>(
    `calendar/earnings?from=${from}&to=${to}`,
    apiKey,
  )
  return data?.earningsCalendar ?? []
}

// Fetch historical earnings surprises for a single ticker
async function fetchEarningsSurprises(
  ticker: string,
  apiKey: string,
): Promise<FinnhubEarningsEntry[]> {
  const data = await finnhubGet<FinnhubEarningsEntry[]>(
    `stock/earnings?symbol=${ticker}`,
    apiKey,
  )
  return Array.isArray(data) ? data : []
}

// ─── Per-ticker recent-results fetch (cached 6h) ──────────────────────────────

function getRecentEarningsForTicker(ticker: string, apiKey: string) {
  return unstable_cache(
    async (): Promise<EarningsEvent[]> => {
      const today = new Date()
      const cutoff = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)

      const entries = await fetchEarningsSurprises(ticker, apiKey)
      if (!entries.length) return []

      const events: EarningsEvent[] = []

      // Take last 2 quarters only (Finnhub returns newest first)
      for (const ev of entries.slice(0, 2)) {
        const period = ev.period?.slice(0, 10) ?? ''
        if (!period || period < cutoff) continue

        const actual = ev.actual ?? null
        const estimate = ev.estimate ?? null
        const surprise = ev.surprise ?? (
          actual !== null && estimate !== null ? actual - estimate : null
        )
        const surprisePct = ev.surprisePercent != null
          ? Math.round(ev.surprisePercent * 10) / 10
          : surprise !== null && estimate !== null && estimate !== 0
            ? Math.round((surprise / Math.abs(estimate)) * 1000) / 10
            : null

        events.push({
          ticker,
          companyName: ticker,
          date: period,
          epsEstimate: estimate,
          epsActual: actual,
          revenueEstimate: null,
          revenueActual: null,
          surprise: surprise !== null ? Math.round(surprise * 100) / 100 : null,
          surprisePct,
          isUpcoming: false,
        })
      }

      return events
    },
    [`earnings-recent-${ticker}-v2`],
    { revalidate: 21600 },
  )
}

// Cached upcoming calendar (single bulk fetch, valid 6h)
const getUpcomingCalendar = unstable_cache(
  async (from: string, to: string, apiKey: string): Promise<FinnhubCalendarEntry[]> => {
    return fetchUpcomingCalendar(from, to, apiKey)
  },
  ['earnings-upcoming-calendar-v2'],
  { revalidate: 21600 },
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EarningsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const apiKey = process.env.FINNHUB_API_KEY ?? ''

  // Get user's tickers from watchlist + portfolio
  const [watchlist, holdings] = await Promise.all([
    getWatchlist(supabase, user.id),
    getPortfolioHoldings(supabase, user.id),
  ])

  const watchlistTickers = watchlist.map((w) => w.ticker)
  const portfolioTickers = holdings.map((h) => h.ticker)
  const userTickers = [
    ...new Set([...watchlistTickers, ...portfolioTickers]),
  ]
    .filter((t) => TICKER_RE.test(t))
    .slice(0, 20)

  if (!apiKey) {
    return (
      <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6">
        <EarningsClient
          userEvents={[]}
          marketEvents={[]}
          hasTickers={userTickers.length > 0}
        />
      </div>
    )
  }

  // Date range: today → +90 days
  const today = new Date()
  const from = today.toISOString().slice(0, 10)
  const to = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // Fetch upcoming calendar (one bulk call covers all tickers)
  // Fetch recent surprises for user tickers (up to 10, sequential to stay within rate limit)
  // and market tickers in parallel (15 tickers, Promise.all)
  const [calendarEntries, userRecentResults, marketRecentResults] = await Promise.all([
    getUpcomingCalendar(from, to, apiKey),
    // Fetch recent results for user tickers sequentially in small batches
    (async (): Promise<EarningsEvent[]> => {
      const tickers = userTickers.slice(0, 10)
      const results: EarningsEvent[] = []
      for (const ticker of tickers) {
        const events = await getRecentEarningsForTicker(ticker, apiKey)()
        results.push(...events)
      }
      return results
    })(),
    // Market tickers in parallel (all cached, so minimal live calls)
    Promise.all(MARKET_TICKERS.map((t) => getRecentEarningsForTicker(t, apiKey)())).then(
      (r) => r.flat(),
    ),
  ])

  // Build sets for quick lookup
  const userTickerSet = new Set(userTickers)
  const marketTickerSet = new Set(MARKET_TICKERS)

  // Convert upcoming calendar entries to EarningsEvent[]
  const userUpcoming: EarningsEvent[] = []
  const marketUpcoming: EarningsEvent[] = []

  for (const entry of calendarEntries) {
    const ticker = entry.symbol?.toUpperCase() ?? ''
    if (!ticker || !TICKER_RE.test(ticker)) continue
    const date = entry.date?.slice(0, 10) ?? ''
    if (!date) continue

    const event: EarningsEvent = {
      ticker,
      companyName: ticker, // Finnhub calendar doesn't return company names
      date,
      epsEstimate: entry.epsEstimate ?? null,
      epsActual: null,
      revenueEstimate: entry.revenueEstimate ?? null,
      revenueActual: null,
      surprise: null,
      surprisePct: null,
      isUpcoming: true,
    }

    if (userTickerSet.has(ticker)) {
      userUpcoming.push(event)
    } else if (marketTickerSet.has(ticker)) {
      marketUpcoming.push(event)
    }
  }

  // Combine: user events = upcoming + recent results for user tickers
  const userEvents: EarningsEvent[] = [...userUpcoming, ...userRecentResults]

  // Market events = upcoming market (no recent results needed for market section)
  const marketEvents: EarningsEvent[] = marketUpcoming

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6">
      <EarningsClient
        userEvents={userEvents}
        marketEvents={marketEvents}
        hasTickers={userTickers.length > 0}
      />
    </div>
  )
}
