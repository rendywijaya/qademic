import { createAdminClient } from '../src/lib/supabase/admin'
import { runWave } from '../src/lib/waves'

async function main() {
  const db = createAdminClient()
  const run = await runWave(db, 'ai-capex')
  if (!run) throw new Error('no run')
  console.log(`Wave: ${run.shock.name} | nodes=${run.nodes.length} edges=${run.edges.length}\n`)
  console.log('TOP 12 by opportunity (exposure − priced-in):')
  console.log('rank  ticker  hops  exp%  priced%  opp     name')
  run.results.slice(0, 12).forEach((r, i) => {
    const opp = r.opportunity_score == null ? '  —' : String(Math.round(r.opportunity_score)).padStart(4)
    const pi = r.priced_in_pct == null ? ' —' : String(r.priced_in_pct).padStart(3)
    console.log(
      `${String(i + 1).padStart(3)}   ${(r.ticker ?? r.name).padEnd(7)} ${String(r.hops).padStart(2)}   ${String(r.exposure_pct).padStart(3)}    ${pi}    ${opp}    ${r.name}`,
    )
  })
  console.log('\nBOTTOM 5 (most priced-in / least opportunity):')
  run.results.slice(-5).forEach((r) => {
    const opp = r.opportunity_score == null ? '—' : Math.round(r.opportunity_score)
    console.log(`     ${(r.ticker ?? r.name).padEnd(7)} exp%=${r.exposure_pct} priced%=${r.priced_in_pct ?? '—'} opp=${opp}  ${r.name}`)
  })
}
main().catch((e) => { console.error('FAIL:', e.message ?? e); process.exit(1) })
