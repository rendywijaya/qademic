import { NextResponse } from 'next/server'
import { writeMarketSnapshot } from '@/lib/supabase/cache'

const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY

interface AVQuoteResult {
  price: number
  change: number
  changePercent: number
}

async function avQuote(symbol: string): Promise<AVQuoteResult | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${AV_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json() as { 'Global Quote'?: Record<string, string> }
    const q = data['Global Quote']
    if (!q?.['05. price']) return null
    return {
      price: parseFloat(q['05. price']),
      change: parseFloat(q['09. change']),
      changePercent: parseFloat(q['10. change percent'].replace('%', '')),
    }
  } catch {
    return null
  }
}

async function btcPrice(): Promise<AVQuoteResult | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json() as { bitcoin?: { usd: number; usd_24h_change: number } }
    if (!data.bitcoin) return null
    const { usd, usd_24h_change } = data.bitcoin
    return {
      price: usd,
      change: usd * (usd_24h_change / 100),
      changePercent: usd_24h_change,
    }
  } catch {
    return null
  }
}

const SYMBOLS: Array<{ symbol: string; name: string }> = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'NASDAQ' },
  { symbol: 'GLD', name: 'Gold' },
]

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!AV_KEY) {
    return NextResponse.json({ error: 'ALPHA_VANTAGE_API_KEY not configured' }, { status: 503 })
  }

  const [spy, qqq, gld, btc] = await Promise.allSettled([
    avQuote('SPY'),
    avQuote('QQQ'),
    avQuote('GLD'),
    btcPrice(),
  ])

  const settled = [spy, qqq, gld, btc]
  const rows: Array<{
    symbol: string
    name: string
    price: number
    change_amt: number
    change_pct: number
  }> = []

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      const meta = i === 3 ? { symbol: 'BTC', name: 'Bitcoin' } : SYMBOLS[i]
      rows.push({
        symbol: meta.symbol,
        name: meta.name,
        price: result.value.price,
        change_amt: result.value.change,
        change_pct: result.value.changePercent,
      })
    }
  })

  if (rows.length > 0) {
    await writeMarketSnapshot(rows)
  }

  return NextResponse.json({ ok: true, updated: rows.length })
}
