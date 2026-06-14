import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWatchlist } from '@/lib/supabase/queries'
import { getFundamentalsForTicker } from '@/lib/fmp'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import WatchlistClient from '@/components/watchlist/watchlist-client'

export const metadata = {
  title: 'Watchlist — Qademic',
  description: 'Track your saved stocks with live prices and fundamentals.',
}

export default async function WatchlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const items = await getWatchlist(supabase, user.id)

  // Fetch fundamentals for all tickers in parallel (cache-first via DB)
  const fundamentalsArray = await Promise.all(
    items.map(item => getFundamentalsForTicker(item.ticker, supabase))
  )

  const fundamentals: Record<string, FMPFundamentals> = {}
  for (const f of fundamentalsArray) {
    fundamentals[f.ticker] = f
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6">
      <WatchlistClient items={items} fundamentals={fundamentals} />
    </div>
  )
}
