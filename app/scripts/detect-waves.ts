/**
 * Run wave auto-detection: discover emerging waves and auto-build them.
 * Run: npx tsx --env-file=.env.local scripts/detect-waves.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { detectWaves } from '../src/lib/ai/detect-waves'
import { runWave } from '../src/lib/waves'

async function main() {
  const db = createAdminClient()
  console.log('Scanning for emerging waves...')
  const result = await detectWaves(db)
  console.log(`Proposed ${result.proposed}, created ${result.created.length}:`)
  for (const w of result.created) {
    console.log(`\n=== ${w.name} (${w.slug}) — ${w.beneficiaries} beneficiaries ===`)
    const run = await runWave(db, w.slug)
    if (!run) continue
    console.log(`  thesis: ${run.shock.thesis}`)
    run.results.filter((r) => r.kind === 'company').slice(0, 6).forEach((r, i) => {
      const opp = r.opportunity_score == null ? '—' : Math.round(r.opportunity_score)
      console.log(`  ${i + 1}. ${r.ticker}  exp%=${r.exposure_pct} priced%=${r.priced_in_pct ?? '—'} opp=${opp}`)
    })
  }
}
main().catch((e) => { console.error('FAILED:', e.message ?? e); process.exit(1) })
