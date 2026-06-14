import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchYahooOHLCV } from '@/lib/data/yahoo'
import { INGEST_UNIVERSE } from '@/lib/data/universe'

export const maxDuration = 300

// 5-year OHLCV backfill for the price universe (QADEMIC.md §5). Auto-converging:
// each run picks up to `limit` tickers that have no recent data, so scheduling it
// nightly expands coverage to the full universe over ~a week, then no-ops.

const DEFAULT_LIMIT = 80

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function ingestTicker(ticker: string): Promise<{ ticker: string; rows: number; ok: boolean }> {
  // Yahoo uses BRK-B, but our DB and other routes use BRK.B
  const dbTicker = ticker.replace('-', '.')
  const rows = await fetchYahooOHLCV(ticker, '5y')
  if (rows.length === 0) return { ticker: dbTicker, rows: 0, ok: false }

  const admin = createAdminClient()
  const batch = rows.map(r => ({
    ticker: dbTicker,
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    adj_close: r.adjClose,
    volume: r.volume,
  }))

  for (let i = 0; i < batch.length; i += 500) {
    const { error } = await admin.from('ohlcv_daily')
      .upsert(batch.slice(i, i + 500), { onConflict: 'ticker,date', ignoreDuplicates: true })
    if (error) console.error(`ohlcv upsert error ${dbTicker}:`, error.message)
  }

  return { ticker: dbTicker, rows: rows.length, ok: true }
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 200)

  const admin = createAdminClient()
  // Distinct tickers with current data. Supabase caps reads at ~1000 rows, so a
  // wide date-range scan silently under-reports — instead read one row per ticker
  // by pinning to the most recent ingested date (≤ universe size, under the cap).
  const { data: latestRow } = await admin
    .from('ohlcv_daily')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  let alreadyHaveData = new Set<string>()
  if (latestRow?.date) {
    const { data: existing } = await admin
      .from('ohlcv_daily')
      .select('ticker')
      .eq('date', latestRow.date)
    alreadyHaveData = new Set((existing ?? []).map((r: { ticker: string }) => r.ticker))
  }
  const toIngest = INGEST_UNIVERSE
    .filter(t => !alreadyHaveData.has(t.replace('-', '.')))
    .slice(0, limit)

  const results = []
  for (let i = 0; i < toIngest.length; i++) {
    const result = await ingestTicker(toIngest[i])
    results.push(result)
    if (i < toIngest.length - 1) await sleep(200)
  }

  return NextResponse.json({
    ok: true,
    source: 'yahoo-finance',
    universe: INGEST_UNIVERSE.length,
    alreadyIngested: alreadyHaveData.size,
    newlyIngested: results.filter(r => r.ok).length,
    remaining: Math.max(0, INGEST_UNIVERSE.length - alreadyHaveData.size - results.filter(r => r.ok).length),
    failed: results.filter(r => !r.ok).map(r => r.ticker),
    totalRows: results.reduce((s, r) => s + r.rows, 0),
  })
}
