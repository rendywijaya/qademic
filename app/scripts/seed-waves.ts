/**
 * Seed the AI-capex wave: entities, edges, and the wave_shock row.
 * Run: npx tsx --env-file=.env.local scripts/seed-waves.ts
 * Idempotent (upserts on slug / (src,dst,relation)).
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { AI_CAPEX_ENTITIES, AI_CAPEX_EDGES, AI_CAPEX_SHOCK } from '../src/lib/seed/ai-capex'

async function main() {
  const db = createAdminClient()

  // 1. Entities
  const { data: ents, error: entErr } = await db
    .from('graph_entities')
    .upsert(
      AI_CAPEX_ENTITIES.map((e) => ({
        kind: e.kind,
        ticker: e.ticker,
        name: e.name,
        slug: e.slug,
        sector: e.sector,
      })),
      { onConflict: 'slug' },
    )
    .select('id, slug')
  if (entErr) throw entErr
  const idBySlug = new Map<string, string>((ents ?? []).map((r) => [r.slug, r.id]))
  console.log(`✓ entities upserted: ${idBySlug.size}`)

  // 2. Edges
  const edgeRows = AI_CAPEX_EDGES.map((e) => {
    const src_id = idBySlug.get(e.src)
    const dst_id = idBySlug.get(e.dst)
    if (!src_id || !dst_id) throw new Error(`edge references unknown slug: ${e.src} -> ${e.dst}`)
    return {
      src_id,
      dst_id,
      relation: e.relation,
      weight: e.weight,
      confidence: e.confidence,
      evidence: e.evidence,
      source: 'manual',
      as_of: new Date().toISOString().slice(0, 10),
    }
  })
  const { error: edgeErr } = await db
    .from('graph_edges')
    .upsert(edgeRows, { onConflict: 'src_id,dst_id,relation' })
  if (edgeErr) throw edgeErr
  console.log(`✓ edges upserted: ${edgeRows.length}`)

  // 3. Wave shock
  const originId = idBySlug.get(AI_CAPEX_SHOCK.originSlug)
  if (!originId) throw new Error('origin entity missing')
  const { error: shockErr } = await db.from('wave_shocks').upsert(
    {
      slug: AI_CAPEX_SHOCK.slug,
      name: AI_CAPEX_SHOCK.name,
      origin_id: originId,
      magnitude: AI_CAPEX_SHOCK.magnitude,
      stage: AI_CAPEX_SHOCK.stage,
      thesis: AI_CAPEX_SHOCK.thesis,
      active: true,
      detected_by: 'manual',
    },
    { onConflict: 'slug' },
  )
  if (shockErr) throw shockErr
  console.log(`✓ wave_shock upserted: ${AI_CAPEX_SHOCK.slug}`)
  console.log('Done.')
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message ?? e)
  process.exit(1)
})
