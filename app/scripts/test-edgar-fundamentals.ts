import { fetchEdgarFundamentals } from '../src/lib/edgar-fundamentals'

async function main() {
  for (const t of ['NVDA', 'AAPL', 'VRT', 'CEG']) {
    const f = await fetchEdgarFundamentals(t)
    if (!f) {
      console.log(`\n=== ${t} — NO fundamentals ===`)
      continue
    }
    console.log(`\n=== ${t} — ${f.name ?? '?'} ===`)
    console.log('  revenue:      ', f.revenue != null ? `$${(f.revenue / 1e9).toFixed(1)}B` : '—')
    console.log('  revenueGrowth:', f.revenueGrowth != null ? `${f.revenueGrowth}%` : '—')
    console.log('  grossMargin:  ', f.grossMargin != null ? `${f.grossMargin}%` : '—')
    console.log('  netMargin:    ', f.netMargin != null ? `${f.netMargin}%` : '—')
    console.log('  roe:          ', f.roe != null ? `${f.roe}%` : '—')
    console.log('  debtEquity:   ', f.debtEquity != null ? `${f.debtEquity}` : '—')
    console.log('  fcfMargin:    ', f.fcfMargin != null ? `${f.fcfMargin}%` : '—')
    console.log('  eps:          ', f.eps != null ? `$${f.eps}` : '—')
  }
}

main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
