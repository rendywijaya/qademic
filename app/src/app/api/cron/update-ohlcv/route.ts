import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchYahooOHLCV } from '@/lib/data/yahoo'
import { INGEST_UNIVERSE } from '@/lib/data/universe'

export const maxDuration = 300

// Nightly bar refresh: last 5 trading days for the whole universe (also heals
// short gaps). Yahoo source — FMP's free tier (250 calls/day) can't cover the
// expanded universe, and prices move to a licensed feed at commercialization.

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  let updated = 0
  let rowsWritten = 0
  const failed: string[] = []

  for (let i = 0; i < INGEST_UNIVERSE.length; i++) {
    const yahooTicker = INGEST_UNIVERSE[i]
    const dbTicker = yahooTicker.replace('-', '.')
    try {
      const rows = await fetchYahooOHLCV(yahooTicker, '5d')
      if (rows.length === 0) { failed.push(dbTicker); continue }

      const { error } = await admin.from('ohlcv_daily').upsert(
        rows.map(r => ({
          ticker: dbTicker,
          date: r.date,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          adj_close: r.adjClose,
          volume: r.volume,
        })),
        { onConflict: 'ticker,date' }
      )
      if (error) { failed.push(dbTicker); continue }
      updated++
      rowsWritten += rows.length
    } catch {
      failed.push(dbTicker)
    }
    if (i < INGEST_UNIVERSE.length - 1) await sleep(120)
  }

  return NextResponse.json({
    ok: true,
    source: 'yahoo-finance',
    universe: INGEST_UNIVERSE.length,
    updated,
    rowsWritten,
    failedCount: failed.length,
    failed: failed.slice(0, 20),
  })
}
