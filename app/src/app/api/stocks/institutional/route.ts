import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInstitutionalHoldings } from '@/lib/supabase/cache'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const TICKER_RE = /^[A-Z.^]{1,10}$/

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? '').toUpperCase()
  if (!TICKER_RE.test(ticker)) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Check DB ───────────────────────────────────────────────────────────
  const holdings = await getInstitutionalHoldings(supabase, ticker, 10)

  if (holdings.length > 0) {
    return NextResponse.json({ ticker, source: 'db', holdings }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
    })
  }

  // ── 2. Live FMP fallback ──────────────────────────────────────────────────
  const apiKey = process.env.FMP_API_KEY ?? ''
  if (!apiKey) return NextResponse.json({ ticker, source: 'empty', holdings: [] })

  try {
    const url = `${FMP_BASE}/institutional-holder?symbol=${ticker}&apikey=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return NextResponse.json({ ticker, source: 'empty', holdings: [] })
    const data = await res.json()
    if (!Array.isArray(data)) return NextResponse.json({ ticker, source: 'empty', holdings: [] })

    const now = new Date()
    const quarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`

    const mapped = data.slice(0, 10).map((h: {
      holder: string; shares: number; dateReported: string; change: number; changeType: string
    }) => ({
      ticker,
      fund_name: h.holder,
      cik: null,
      quarter,
      shares: h.shares ?? null,
      value_usd: null,
      change_shares: h.change ?? null,
      change_type: h.changeType ?? null,
      filed_at: h.dateReported ?? null,
    }))

    return NextResponse.json({ ticker, source: 'fmp', holdings: mapped }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
    })
  } catch {
    return NextResponse.json({ ticker, source: 'empty', holdings: [] })
  }
}
