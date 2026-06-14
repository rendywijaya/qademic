import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getManagementScore, getForensicSignals } from '@/lib/supabase/cache'

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const TICKER_RE = /^[A-Z.^]{1,10}$/

async function fetchLiveManagement(ticker: string, apiKey: string) {
  try {
    const [execRes, metricsRes] = await Promise.all([
      fetch(`${FMP_BASE}/key-executives?symbol=${ticker}&apikey=${apiKey}`, { next: { revalidate: 86400 } }),
      fetch(`${FMP_BASE}/key-metrics?symbol=${ticker}&period=annual&limit=3&apikey=${apiKey}`, { next: { revalidate: 86400 } }),
    ])

    const executives = execRes.ok ? await execRes.json() : []
    const metrics = metricsRes.ok ? await metricsRes.json() : []

    const ceo = Array.isArray(executives)
      ? executives.find((e: { title?: string }) => e.title?.toLowerCase().includes('ceo') || e.title?.toLowerCase().includes('chief executive'))
      : null

    const roics = Array.isArray(metrics)
      ? metrics.map((m: { roic?: number | null }) => m.roic).filter((r): r is number => r != null)
      : []

    return {
      ceo_name: ceo?.name ?? null,
      roic_1yr: roics[0] != null ? Math.round(roics[0] * 1000) / 10 : null,
      roic_3yr_avg: roics.length >= 3 ? Math.round((roics.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3) * 1000) / 10 : null,
    }
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? '').toUpperCase()
  if (!TICKER_RE.test(ticker)) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })

  const supabase = await createClient()
  const [management, forensic] = await Promise.all([
    getManagementScore(supabase, ticker),
    getForensicSignals(supabase, ticker),
  ])

  if (management) {
    return NextResponse.json({ ticker, available: true, management, forensic: forensic ?? null }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
    })
  }

  // Live fallback — basic data only
  const apiKey = process.env.FMP_API_KEY ?? ''
  if (apiKey) {
    const live = await fetchLiveManagement(ticker, apiKey)
    if (live) {
      return NextResponse.json({
        ticker, available: true,
        management: {
          ticker,
          ...live,
          is_founder_led: null,
          insider_ownership_pct: null,
          roic_5yr_avg: null,
          roic_trend: null,
          fcf_conversion: null,
          debt_trend: null,
          capital_alloc_score: null,
          mgmt_score: null,
          scored_at: new Date().toISOString(),
        },
        forensic: null,
      })
    }
  }

  return NextResponse.json({ ticker, available: false, message: 'Management data not yet computed. Run compute-signals cron.' })
}
