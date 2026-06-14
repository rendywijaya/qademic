import { createAdminClient } from '../src/lib/supabase/admin'

async function main() {
  const db = createAdminClient()
  for (const [table, cols] of [
    ['stock_signals', 'ticker, momentum_3m, price_vs_sma200'],
    ['ohlcv_daily', 'ticker'],
    ['universe_rankings', 'ticker'],
    ['stock_q7_scores', 'ticker'],
  ] as const) {
    const { count } = await db.from(table).select('*', { count: 'exact', head: true })
    console.log(`${table}: ${count ?? 0} rows`)
  }
  const { data } = await db
    .from('stock_signals')
    .select('ticker, momentum_3m, price_vs_sma200')
    .in('ticker', ['NVDA', 'VRT', 'CCJ', 'MU', 'TSM'])
  console.log('sample signals:', JSON.stringify(data ?? []))
}
main().catch((e) => { console.error(e.message); process.exit(1) })
