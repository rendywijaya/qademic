import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ThesesClient from '@/components/theses/theses-client'
import type { Thesis } from '@/app/actions/theses'

export const metadata = {
  title: 'Theses — Qademic',
  description: 'Your investment theses: claim, kill conditions, and outcomes — written before entry, watched after.',
}

export default async function ThesesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: theses }, { data: regime }] = await Promise.all([
    supabase
      .from('theses')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('regime_daily')
      .select('date, state, exposure_multiplier')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Live market state per thesis ticker — failsafe + current scores vs entry snapshot
  const tickers = [...new Set((theses ?? []).map(t => t.ticker as string))]
  const live: Record<string, { priceVsSma200: number | null; business: number | null; timing: number | null }> = {}
  if (tickers.length > 0) {
    const [{ data: signals }, { data: scores }] = await Promise.all([
      supabase.from('stock_signals').select('ticker, price_vs_sma200').in('ticker', tickers),
      supabase.from('stock_q7_scores').select('ticker, business_score, timing_score').in('ticker', tickers),
    ])
    for (const t of tickers) {
      live[t] = {
        priceVsSma200: (signals ?? []).find(s => s.ticker === t)?.price_vs_sma200 ?? null,
        business: (scores ?? []).find(s => s.ticker === t)?.business_score ?? null,
        timing: (scores ?? []).find(s => s.ticker === t)?.timing_score ?? null,
      }
    }
  }

  return (
    <ThesesClient
      theses={(theses ?? []) as Thesis[]}
      regime={regime as { date: string; state: 'risk_on' | 'neutral' | 'risk_off'; exposure_multiplier: number } | null}
      live={live}
    />
  )
}
