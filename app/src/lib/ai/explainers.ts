/**
 * Living knowledge base — AI-generated explainers for companies and sectors.
 * Evergreen documents that live on graph nodes; refreshed on material change.
 * Used by scripts/generate-explainers.ts and (later) the refresh-explainers cron.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

const client = new Anthropic()
const MODEL = 'claude-sonnet-4-6'

function extractJson<T>(text: string): T {
  // tolerate code fences / prose around the JSON object
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON in model output')
  return JSON.parse(text.slice(start, end + 1)) as T
}

interface BusinessFields {
  what_they_do: string
  how_they_make_money: string
  value_chain: string
  bull_case: string
  bear_case: string
  what_breaks_it: string
  full_md: string
}

export async function generateBusinessExplainer(
  db: SupabaseClient,
  ticker: string,
  name: string,
  sector: string | null,
): Promise<BusinessFields> {
  const prompt = `Write a deep, plain-language business explainer for ${name} (${ticker})${sector ? `, sector: ${sector}` : ''}.
Teach a smart non-expert how this company actually works. Return ONLY a JSON object with these string fields:
{
  "what_they_do": "what the company actually does, in concrete terms (3-4 sentences)",
  "how_they_make_money": "the revenue model and unit economics — segments, margins, what drives the P&L (3-4 sentences)",
  "value_chain": "where they sit in the value chain: key suppliers they depend on, key customers/end-markets, and who depends on them (3-4 sentences)",
  "bull_case": "the strongest bull argument (2-3 sentences)",
  "bear_case": "the strongest bear argument (2-3 sentences)",
  "what_breaks_it": "the specific things that would break the investment thesis / kill conditions (2-3 sentences)",
  "full_md": "a ~350-word markdown explainer tying it all together with ## headers"
}
Be specific and honest. No buy/sell advice. Use your knowledge as of training; this is an evergreen primer, not market timing.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1600,
    system: 'You are a teaching analyst. You explain businesses clearly and honestly so a reader genuinely understands how they work and make money. Return strict JSON.',
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
  const fields = extractJson<BusinessFields>(text)

  await db.from('business_explainers').upsert(
    {
      ticker,
      name,
      ...fields,
      model: MODEL,
      freshness: new Date().toISOString(),
    },
    { onConflict: 'ticker' },
  )
  return fields
}

interface SectorFields {
  how_it_works: string
  demand_drivers: string
  cycle: string
  value_chain: string
  key_players: string
  full_md: string
}

export async function generateSectorExplainer(
  db: SupabaseClient,
  slug: string,
  name: string,
  level: 'sector' | 'industry' = 'sector',
): Promise<SectorFields> {
  const prompt = `Write a deep, plain-language explainer for the ${name} ${level}.
Teach a smart non-expert how this part of the market actually works. Return ONLY a JSON object:
{
  "how_it_works": "how businesses in this ${level} actually operate and compete (3-4 sentences)",
  "demand_drivers": "what drives demand — the macro and structural forces that move the whole group (3-4 sentences)",
  "cycle": "cyclicality, seasonality, and roughly where the ${level} sits in its cycle today (2-3 sentences)",
  "value_chain": "the value chain: upstream inputs, the core players, downstream customers (3-4 sentences)",
  "key_players": "the most important companies and their distinct roles (2-3 sentences)",
  "full_md": "a ~350-word markdown explainer with ## headers"
}
Be specific and honest. No buy/sell advice.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1600,
    system: 'You are a teaching analyst explaining how a sector of the market works, clearly and honestly. Return strict JSON.',
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
  const fields = extractJson<SectorFields>(text)

  await db.from('sector_explainers').upsert(
    { slug, level, name, ...fields, freshness: new Date().toISOString() },
    { onConflict: 'slug' },
  )
  return fields
}
