import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QuantClient from '@/components/quant/quant-client'

export const metadata = {
  title: 'Q4 Quant Analysis — Qademic',
  description: 'Factor scores, technical indicators, DCF, and Piotroski analysis powered by the Q4 quantamental framework.',
}

export default async function QuantPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const ticker = params.ticker?.toUpperCase() ?? null

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6">
      <QuantClient initialTicker={ticker} />
    </div>
  )
}
