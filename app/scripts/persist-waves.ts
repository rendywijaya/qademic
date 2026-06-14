import { createAdminClient } from '../src/lib/supabase/admin'
import { runWave, listActiveShocks } from '../src/lib/waves'
async function main(){
  const db=createAdminClient()
  for(const s of await listActiveShocks(db)){
    const run=await runWave(db,s.slug,{persist:true})
    console.log(`persisted ${run?.results.length??0} rows for ${s.slug}`)
  }
  const {count}=await db.from('wave_propagation').select('*',{count:'exact',head:true})
  console.log('wave_propagation total rows:',count)
}
main().catch(e=>{console.error(e.message);process.exit(1)})
