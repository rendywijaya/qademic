import { createAdminClient } from '../src/lib/supabase/admin'
async function main() {
  const db = createAdminClient()
  const { data, error } = await db.from('regime_daily').select('*').order('date', { ascending: false }).limit(1)
  if (error) { console.log('regime_daily error:', error.message); return }
  console.log('regime_daily latest:', JSON.stringify(data ?? [], null, 1))
}
main().catch(e => { console.error(e.message); process.exit(1) })
