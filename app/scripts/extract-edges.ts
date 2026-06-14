/**
 * Validate AI edge extraction against the curated seed.
 * Runs extraction for a few hub companies, then reports how many curated edges the AI
 * rediscovered + what new edges it proposed.
 * Run: npx tsx --env-file=.env.local scripts/extract-edges.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { extractEdgesForEntity } from '../src/lib/ai/extract-edges'

const HUBS = ['NVDA', 'TSM', 'MSFT', 'VRT']

async function main() {
  const db = createAdminClient()
  const { data: ents } = await db.from('graph_entities').select('id, ticker, name').not('ticker', 'is', null)
  const companies = (ents ?? []).filter((e) => e.ticker)
  const byTicker = new Map(companies.map((c) => [c.ticker, c]))

  // curated (manual) neighbors per hub, for the rediscovery check
  const { data: manualEdges } = await db.from('graph_edges').select('src_id, dst_id').eq('source', 'manual')
  const idToTicker = new Map(companies.map((c) => [c.id, c.ticker]))

  for (const hub of HUBS) {
    const target = byTicker.get(hub)
    if (!target) continue
    const candidates = companies.filter((c) => c.ticker !== hub)
    const result = await extractEdgesForEntity(db, target, candidates)

    const curatedNeighbors = new Set<string>()
    for (const e of manualEdges ?? []) {
      if (e.src_id === target.id && idToTicker.get(e.dst_id)) curatedNeighbors.add(idToTicker.get(e.dst_id)!)
      if (e.dst_id === target.id && idToTicker.get(e.src_id)) curatedNeighbors.add(idToTicker.get(e.src_id)!)
    }
    const aiNeighbors = new Set(result.found.map((f) => f.ticker))
    const rediscovered = [...curatedNeighbors].filter((t) => aiNeighbors.has(t))
    const novel = [...aiNeighbors].filter((t) => !curatedNeighbors.has(t))

    console.log(`\n=== ${hub} ===`)
    console.log(`curated neighbors (${curatedNeighbors.size}): ${[...curatedNeighbors].join(', ') || '—'}`)
    console.log(`AI found (${aiNeighbors.size}): ${[...aiNeighbors].join(', ') || '—'}`)
    console.log(`rediscovered ${rediscovered.length}/${curatedNeighbors.size}: ${rediscovered.join(', ') || '—'}`)
    console.log(`novel proposals: ${novel.join(', ') || '—'}`)
    result.found.slice(0, 4).forEach((f) => console.log(`   • ${f.ticker} [${f.relation}] w${f.weight} c${f.confidence} — ${f.evidence}`))
  }
  console.log('\nDone.')
}
main().catch((e) => { console.error('FAILED:', e.message ?? e); process.exit(1) })
