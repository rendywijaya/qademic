import { fetch10KBusiness, getCik } from '../src/lib/edgar'
async function main(){
  for (const t of ['NVDA','VRT','CEG']){
    const cik = await getCik(t)
    const b = await fetch10KBusiness(t)
    if (!b){ console.log(`${t}: cik=${cik} — NO business text`); continue }
    const lc = b.text.toLowerCase()
    const hits = ['customer','supplier','compet','manufactur','foundry','tsmc','contract'].filter(k=>lc.includes(k))
    console.log(`\n=== ${t} (cik ${cik}) — 10-K ${b.date} — ${b.text.length} chars ===`)
    console.log('keyword hits:', hits.join(', ') || 'none')
    console.log('source:', b.sourceUrl)
    console.log('excerpt:', b.text.slice(0, 380).replace(/\n+/g,' '))
  }
}
main().catch(e=>{console.error('FAIL:',e.message);process.exit(1)})
