/**
 * Grounded edge discovery on the wave hubs — proves edges are sourced from real
 * current 10-Ks (note the filing dates + evidence quotes).
 * Run: npx tsx --env-file=.env.local scripts/ground-edges.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { groundEdgesForTicker } from '../src/lib/ai/ground-edges'

const HUBS = ['NVDA', 'MSFT', 'VRT', 'CEG', 'TSM']

async function main() {
  const db = createAdminClient()
  const { data: ents } = await db.from('graph_entities').select('id, ticker, name').not('ticker', 'is', null)
  const companies = (ents ?? []).filter((e) => e.ticker)
  const byTicker = new Map(companies.map((c) => [c.ticker, c]))

  for (const hub of HUBS) {
    const t = byTicker.get(hub)
    if (!t) continue
    const cands = companies.filter((c) => c.ticker !== hub)
    const g = await groundEdgesForTicker(db, t, cands)
    console.log(`\n=== ${hub} === grounded=${g.grounded}${g.filingDate ? ` · 10-K filed ${g.filingDate}` : ''}`)
    if (g.sourceUrl) console.log(`  source: ${g.sourceUrl}`)
    g.result?.found.slice(0, 6).forEach((f) => console.log(`  • ${f.ticker} [${f.relation}] w${f.weight} c${f.confidence}\n      "${f.evidence}"`))
    console.log(`  total edges: ${g.result?.found.length ?? 0} (source tag = ${g.grounded ? 'edgar' : 'ai'})`)
  }
  console.log('\nDone.')
}
main().catch((e) => { console.error('FAIL:', e.message ?? e); process.exit(1) })
