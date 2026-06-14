import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCachedMarketSnapshot, writeMarketSnapshot } from '@/lib/supabase/cache'

const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY

export interface MarketItem {
  symbol: string
  name: string
  price: string
  change: number
  changePercent: number
}

const FALLBACK: MarketItem[] = [
  { symbol: 'SPY', name: 'S&P 500', price: '5,234.18', change: 42.56, changePercent: 0.82 },
  { symbol: 'QQQ', name: 'NASDAQ', price: '18,124.30', change: 156.30, changePercent: 0.87 },
  { symbol: 'GLD', name: 'Gold', price: '2,341.50', change: 7.23, changePercent: 0.31 },
  { symbol: 'BTC', name: 'Bitcoin', price: '67,420', change: -847.20, changePercent: -1.24 },
  { symbol: 'VIX', name: 'Volatility', price: '14.82', change: -0.63, changePercent: -4.08 },
  { symbol: 'DXY', name: 'USD Index', price: '104.21', change: 0.18, changePercent: 0.17 },
]

interface AVQuoteResult {
  price: number
  change: number
  changePercent: number
}

async function avQuote(symbol: string): Promise<AVQuoteResult | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${AV_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
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
    const data = await res.json() as { bitcoin?: { usd: number; usd_24h_change: number } }
    if (!data.bitcoin) return null
    const { usd, usd_24h_change } = data.bitcoin
    return { price: usd, change: usd * (usd_24h_change / 100), changePercent: usd_24h_change }
  } catch {
    return null
  }
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function snapshotToMarketItems(rows: Array<Record<string, unknown>>): MarketItem[] {
  const mapped = rows.map(r => ({
    symbol: r.symbol as string,
    name: r.name as string,
    price: fmt(r.price as number),
    change: r.change_amt as number,
    changePercent: r.change_pct as number,
  }))
  // Preserve VIX and DXY from fallback if not in DB
  const symbols = new Set(mapped.map(m => m.symbol))
  const extras = FALLBACK.filter(f => !symbols.has(f.symbol))
  return [...mapped, ...extras]
}

async function fetchLive(): Promise<MarketItem[]> {
  if (!AV_KEY) return FALLBACK

  const [spy, qqq, gld, btc] = await Promise.allSettled([
    avQuote('SPY'),
    avQuote('QQQ'),
    avQuote('GLD'),
    btcPrice(),
  ])

  const results: MarketItem[] = [
    spy.status === 'fulfilled' && spy.value
      ? { symbol: 'SPY', name: 'S&P 500', price: fmt(spy.value.price), change: spy.value.change, changePercent: spy.value.changePercent }
      : FALLBACK[0],
    qqq.status === 'fulfilled' && qqq.value
      ? { symbol: 'QQQ', name: 'NASDAQ', price: fmt(qqq.value.price), change: qqq.value.change, changePercent: qqq.value.changePercent }
      : FALLBACK[1],
    gld.status === 'fulfilled' && gld.value
      ? { symbol: 'GLD', name: 'Gold', price: fmt(gld.value.price), change: gld.value.change, changePercent: gld.value.changePercent }
      : FALLBACK[2],
    btc.status === 'fulfilled' && btc.value
      ? { symbol: 'BTC', name: 'Bitcoin', price: fmt(btc.value.price, 0), change: btc.value.change, changePercent: btc.value.changePercent }
      : FALLBACK[3],
    FALLBACK[4], // VIX — not in AV free tier reliably
    FALLBACK[5], // DXY
  ]

  // Write to DB in background — don't await to keep response fast
  const writeRows = results
    .filter(r => r.symbol !== 'VIX' && r.symbol !== 'DXY')
    .map(r => ({
      symbol: r.symbol,
      name: r.name,
      price: parseFloat(r.price.replace(/,/g, '')),
      change_amt: r.change,
      change_pct: r.changePercent,
    }))

  writeMarketSnapshot(writeRows).catch(() => undefined)

  return results
}

export async function GET() {
  // Try DB cache first
  try {
    const supabase = await createClient()
    const cached = await getCachedMarketSnapshot(supabase)
    if (cached) {
      return NextResponse.json(snapshotToMarketItems(cached), {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      })
    }
  } catch {
    // Fall through to live fetch
  }

  const data = await fetchLive()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  })
}
