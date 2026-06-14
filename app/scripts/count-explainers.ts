import { createAdminClient } from '../src/lib/supabase/admin'
async function main(){const db=createAdminClient()
const b=await db.from('business_explainers').select('*',{count:'exact',head:true})
const s=await db.from('sector_explainers').select('*',{count:'exact',head:true})
const e=await db.from('graph_edges').select('source',{count:'exact',head:true}).eq('source','ai')
console.log('business_explainers:',b.count,'| sector_explainers:',s.count,'| ai_edges:',e.count)}
main().catch(e=>{console.error(e.message);process.exit(1)})
