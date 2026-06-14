import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertSecFiling, insertStockAlert } from '@/lib/supabase/cache'

export const maxDuration = 300

const FMP_BASE = 'https://financialmodelingprep.com/stable'

interface FMPFiling {
  symbol: string
  type: string
  link: string
  finalLink: string
  date: string
  acceptedDate: string
}

async function fetchFilingsForTicker(ticker: string, apiKey: string): Promise<FMPFiling[]> {
  try {
    const url = `${FMP_BASE}/sec-filings-search/symbol?symbol=${ticker}&formType=8-K&limit=5&apikey=${apiKey}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FMP_API_KEY ?? ''
  if (!apiKey) return NextResponse.json({ error: 'FMP_API_KEY not set' }, { status: 500 })

  const admin = createAdminClient()

  // 1. Get watchlisted tickers (personalised alert targets)
  const { data: watchlistRows } = await admin.from('watchlist').select('ticker').limit(200)
  const tickers = [...new Set((watchlistRows ?? []).map((r: { ticker: string }) => r.ticker))]

  if (tickers.length === 0) return NextResponse.json({ ok: true, message: 'No watchlist tickers' })

  // 2. Get IDs we already know about to avoid duplicates
  const { data: existingFilings } = await admin
    .from('sec_filings')
    .select('id')
    .in('ticker', tickers)
    .order('filed_at', { ascending: false })
    .limit(500)
  const knownIds = new Set((existingFilings ?? []).map((r: { id: string }) => r.id))

  let newFilings = 0
  let newAlerts = 0

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    const filings = await fetchFilingsForTicker(ticker, apiKey)

    for (const f of filings) {
      // Use link as stable ID
      const id = f.finalLink ?? f.link
      if (!id || knownIds.has(id)) continue

      await insertSecFiling({
        id,
        ticker: f.symbol ?? ticker,
        filing_type: f.type ?? '8-K',
        title: `${f.type} Filing — ${f.date}`,
        filed_at: f.acceptedDate ?? f.date ?? new Date().toISOString(),
        url: f.finalLink ?? f.link,
      })

      // Generate an alert for significant filings
      await insertStockAlert({
        ticker,
        alert_type: '8k_filing',
        severity: 'info',
        title: `${ticker}: ${f.type ?? '8-K'} filing detected`,
        body: `New SEC ${f.type ?? '8-K'} filing submitted on ${f.date}. AI summary pending.`,
        source_url: f.finalLink ?? f.link,
        metadata: { filing_type: f.type, date: f.date },
      })

      knownIds.add(id)
      newFilings++
      newAlerts++
    }

    if (i < tickers.length - 1) await sleep(300)
  }

  return NextResponse.json({ ok: true, tickers: tickers.length, newFilings, newAlerts })
}
