import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { InsiderData } from '@/app/api/insider/route'
import InsiderClient from '@/components/insider/insider-client'

const TICKER_RE = /^[A-Z.]{1,10}$/

interface PageProps {
  searchParams: Promise<{ ticker?: string }>
}

export default async function InsiderPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { ticker: rawTicker } = await searchParams
  const ticker = rawTicker?.trim().toUpperCase() ?? ''

  let insiderData: InsiderData | null = null

  if (ticker && TICKER_RE.test(ticker)) {
    const apiKey = process.env.FMP_API_KEY
    if (apiKey) {
      try {
        const res = await fetch(
          `https://financialmodelingprep.com/stable/insider-trading?symbol=${ticker}&page=0&apikey=${apiKey}`,
          { next: { revalidate: 43200 } }
        )
        if (res.ok) {
          const raw = await res.json() as Array<{
            symbol: string
            filingDate: string
            transactionDate: string
            reportingName: string
            typeOfOwner: string
            transactionType: string
            securitiesTransacted: number
            price: number
            securitiesOwned: number
            url: string
          }>

          if (Array.isArray(raw)) {
            const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
            const recent90 = raw.filter(t => new Date(t.transactionDate).getTime() >= cutoff)

            let totalBuyValue = 0
            let totalSellValue = 0
            let totalBuyShares = 0
            let totalSellShares = 0

            for (const t of recent90) {
              const shares = t.securitiesTransacted ?? 0
              const price = t.price ?? 0
              const value = shares * price
              if (t.transactionType === 'P-Purchase') {
                totalBuyValue += value
                totalBuyShares += shares
              } else if (t.transactionType === 'S-Sale') {
                totalSellValue += value
                totalSellShares += shares
              }
            }

            const netBuyingValue = totalBuyValue - totalSellValue
            const netBuyingShares = totalBuyShares - totalSellShares
            const insiderSentiment: 'bullish' | 'bearish' | 'neutral' =
              netBuyingValue > 100_000 ? 'bullish'
              : netBuyingValue < -100_000 ? 'bearish'
              : 'neutral'

            insiderData = {
              ticker,
              netBuyingValue,
              netBuyingShares,
              insiderSentiment,
              transactions: raw.slice(0, 20),
              updatedAt: new Date().toISOString(),
            }
          }
        }
      } catch {
        // use null — client will show empty state
      }
    }
  }

  return (
    <InsiderClient
      initialData={insiderData}
      initialTicker={ticker}
    />
  )
}
