/**
 * Generate living-knowledge explainers for the wave entities + their sectors.
 * Run: npx tsx --env-file=.env.local scripts/generate-explainers.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { generateBusinessExplainer, generateSectorExplainer } from '../src/lib/ai/explainers'

async function main() {
  const db = createAdminClient()
  const { data: ents } = await db
    .from('graph_entities')
    .select('ticker, name, sector, kind')
    .eq('kind', 'company')
    .not('ticker', 'is', null)
  const companies = ents ?? []
  console.log(`Generating explainers for ${companies.length} companies...`)

  const sectors = new Set<string>()
  let ok = 0
  for (const c of companies) {
    try {
      await generateBusinessExplainer(db, c.ticker, c.name, c.sector)
      if (c.sector) sectors.add(c.sector)
      ok++
      console.log(`  ✓ ${c.ticker}`)
    } catch (e) {
      console.log(`  ✗ ${c.ticker}: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log(`\nGenerating ${sectors.size} sector explainers...`)
  for (const s of sectors) {
    const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    try {
      await generateSectorExplainer(db, slug, s, 'sector')
      console.log(`  ✓ ${s}`)
    } catch (e) {
      console.log(`  ✗ ${s}: ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\nDone. ${ok}/${companies.length} company explainers, ${sectors.size} sectors.`)
}
main().catch((e) => { console.error('FAILED:', e.message ?? e); process.exit(1) })
