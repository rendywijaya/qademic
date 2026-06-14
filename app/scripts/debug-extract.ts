import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '../src/lib/supabase/admin'
const client = new Anthropic()
async function main(){
  const db = createAdminClient()
  const { data: ents } = await db.from('graph_entities').select('id, ticker, name').not('ticker','is',null)
  const companies = (ents??[]).filter(e=>e.ticker)
  const target = companies.find(c=>c.ticker==='NVDA')!
  const candidates = companies.filter(c=>c.ticker!=='NVDA')
  const candList = candidates.map(c=>`${c.ticker} (${c.name})`).join(', ')
  const msg = await client.messages.create({
    model:'claude-sonnet-4-6', max_tokens:2000,
    tools:[{name:'record_relationships',description:'Record relationships.',input_schema:{type:'object',properties:{relationships:{type:'array',items:{type:'object',properties:{ticker:{type:'string'},relationship:{type:'string',enum:['supplier_of_target','customer_of_target','competitor']},weight:{type:'number'},confidence:{type:'number'},evidence:{type:'string'}},required:['ticker','relationship','weight','confidence','evidence']}}},required:['relationships']}}],
    tool_choice:{type:'tool',name:'record_relationships'},
    messages:[{role:'user',content:`Target: NVIDIA (NVDA). From ONLY this list identify suppliers/customers/competitors in AI infra. CANDIDATES: ${candList}. Call record_relationships.`}],
  })
  console.log('stop_reason:', msg.stop_reason)
  console.log('content block types:', msg.content.map(b=>b.type))
  const tu = msg.content.find(b=>b.type==='tool_use') as any
  console.log('tool input keys:', tu?Object.keys(tu.input):'NO TOOL_USE')
  console.log('relationships len:', tu?.input?.relationships?.length)
  console.log('raw input (first 500 chars):', JSON.stringify(tu?.input).slice(0,500))
}
main().catch(e=>{console.error('ERR:',e.message);process.exit(1)})
