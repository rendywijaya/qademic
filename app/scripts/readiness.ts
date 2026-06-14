import { createAdminClient } from '../src/lib/supabase/admin'
async function main(){
  const db=createAdminClient()
  const {data:ohlcv}=await db.from('ohlcv_daily').select('date').order('date',{ascending:false}).limit(1)
  const {data:reg}=await db.from('regime_daily').select('date').order('date',{ascending:false}).limit(1)
  const {count:profiles}=await db.from('profiles').select('*',{count:'exact',head:true})
  const {count:sigs}=await db.from('stock_signals').select('*',{count:'exact',head:true})
  console.log('latest ohlcv date:', ohlcv?.[0]?.date)
  console.log('latest regime date:', reg?.[0]?.date)
  console.log('profiles (users):', profiles)
  console.log('stock_signals universe size:', sigs)
}
main().catch(e=>{console.error(e.message);process.exit(1)})
