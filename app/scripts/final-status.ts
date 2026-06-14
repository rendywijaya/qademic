import { createAdminClient } from '../src/lib/supabase/admin'
async function main(){const db=createAdminClient()
for (const t of ['graph_entities','graph_edges','wave_shocks','wave_propagation','business_explainers','sector_explainers','daily_briefs']){
  const {count}=await db.from(t).select('*',{count:'exact',head:true}); console.log(`  ${t}: ${count}`)}
const {data}=await db.from('daily_briefs').select('brief_date,headline,meta').order('brief_date',{ascending:false}).limit(1)
console.log('latest brief:', JSON.stringify(data?.[0]??null))}
main().catch(e=>{console.error(e.message);process.exit(1)})
