import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertInstitutionalHoldings } from '@/lib/supabase/cache'

export const maxDuration = 300

const FMP_BASE = 'https://financialmodelingprep.com/stable'

interface FMPInstitutionalHolder {
  holder: string
  shares: number
  dateReported: string
  change: number
  changeType: string
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

  // Process watchlist + top stocks
  const { data: watchlistRows } = await admin.from('watchlist').select('ticker').limit(200)
  const { data: q7Rows } = await admin.from('stock_q7_scores').select('ticker').limit(100)
  const allTickers = [
    ...new Set([
      ...(watchlistRows ?? []).map((r: { ticker: string }) => r.ticker),
      ...(q7Rows ?? []).map((r: { ticker: string }) => r.ticker),
    ])
  ]

  // Determine current quarter label (e.g. "2025-Q1")
  const now = new Date()
  const quarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`

  let processed = 0
  for (let i = 0; i < allTickers.length; i++) {
    const ticker = allTickers[i]
    try {
      const url = `${FMP_BASE}/institutional-holder?symbol=${ticker}&apikey=${apiKey}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const data = await res.json() as FMPInstitutionalHolder[]
      if (!Array.isArray(data) || data.length === 0) continue

      const top10 = data.slice(0, 10)
      await upsertInstitutionalHoldings(
        top10.map(h => ({
          ticker,
          fund_name: h.holder,
          cik: null,
          quarter,
          shares: h.shares ?? null,
          value_usd: null, // would need price * shares
          change_shares: h.change ?? null,
          change_type: h.changeType ?? null,
          filed_at: h.dateReported ?? null,
        }))
      )
      processed++
    } catch { /* continue */ }

    if (i < allTickers.length - 1) await sleep(400)
  }

  return NextResponse.json({ ok: true, tickersProcessed: processed, total: allTickers.length, quarter })
}
