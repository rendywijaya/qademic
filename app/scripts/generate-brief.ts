/**
 * Generate today's daily learning brief.
 * Run: npx tsx --env-file=.env.local scripts/generate-brief.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { generateDailyBrief } from '../src/lib/ai/daily-brief'

async function main() {
  const db = createAdminClient()
  console.log('Generating daily brief...')
  const brief = await generateDailyBrief(db)
  console.log('\n✓ HEADLINE:', brief.headline)
  console.log('\nREGIME:', brief.regime_note)
  console.log('\nFLOWS:', brief.flows_note)
  console.log('\nWAVES:', brief.waves_note)
  console.log('\nDEEP DIVE:', brief.deep_dive_title)
}
main().catch((e) => { console.error('FAILED:', e.message ?? e); process.exit(1) })
