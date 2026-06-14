import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPortfolioHoldings } from '@/lib/supabase/queries'
import { getFundamentalsForTicker } from '@/lib/fmp'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import PortfolioClient from '@/components/portfolio/portfolio-client'
import RiskPanel from '@/components/portfolio/risk-panel'

export const metadata = {
  title: 'Portfolio & Risk — Qademic',
  description: 'Holdings, theme concentration, and exposure vs regime — one surface (QADEMIC.md §8).',
}

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const holdings = await getPortfolioHoldings(supabase, user.id)

  const fundamentals: Record<string, FMPFundamentals> = {}
  if (holdings.length > 0) {
    const results = await Promise.all(
      holdings.map(h => getFundamentalsForTicker(h.ticker, supabase))
    )
    holdings.forEach((h, i) => {
      fundamentals[h.ticker] = results[i]
    })
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      <PortfolioClient initialHoldings={holdings} fundamentals={fundamentals} />
      <RiskPanel holdings={holdings} />
    </div>
  )
}
