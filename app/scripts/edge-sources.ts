import { createAdminClient } from '../src/lib/supabase/admin'
async function main(){
  const db=createAdminClient()
  const { data } = await db.from('graph_edges').select('source')
  const counts: Record<string,number> = {}
  for (const e of data??[]) counts[e.source] = (counts[e.source]||0)+1
  console.log('edge sources:', JSON.stringify(counts))
  const { data: sample } = await db.from('graph_edges').select('relation, evidence, confidence').eq('source','edgar').limit(3)
  console.log('\nsample EDGAR-grounded edges:')
  for (const s of sample??[]) console.log(`  [${s.relation}] c${s.confidence}: ${(s.evidence||'').slice(0,160)}`)
}
main().catch(e=>{console.error(e.message);process.exit(1)})
