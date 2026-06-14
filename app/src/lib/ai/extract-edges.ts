/**
 * AI edge discovery — "analyze the interconnection between everything".
 * Given a target company and a candidate universe, Claude identifies which candidates
 * are key suppliers / customers / competitors, with cited evidence + confidence.
 *
 * Uses Claude tool-use for GUARANTEED structured output (no fragile JSON-from-prose
 * parsing). Edges are stored with source='ai' (separate from the curated 'manual' seed)
 * so we can validate the extractor against ground truth before trusting it to widen.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

const client = new Anthropic()
const MODEL = 'claude-sonnet-4-6'

type Rel = 'supplier_of_target' | 'customer_of_target' | 'competitor'

interface RawRel {
  ticker: string
  relationship: Rel
  weight: number
  confidence: number
  evidence: string
}

export interface ExtractResult {
  target: string
  found: { ticker: string; relation: string; weight: number; confidence: number; evidence: string }[]
}

const RELATIONSHIP_TOOL: Anthropic.Tool = {
  name: 'record_relationships',
  description:
    'Record the supply-chain and competitive relationships between the target company and the candidate companies.',
  input_schema: {
    type: 'object',
    properties: {
      relationships: {
        type: 'array',
        description: 'Only genuine, reasonably-confident relationships. Omit weak/speculative ones.',
        items: {
          type: 'object',
          properties: {
            ticker: { type: 'string', description: 'Candidate ticker (must be from the provided list)' },
            relationship: {
              type: 'string',
              enum: ['supplier_of_target', 'customer_of_target', 'competitor'],
            },
            weight: { type: 'number', description: 'Economic importance of the link, 0.0–1.0' },
            confidence: { type: 'number', description: 'Confidence the link is real, 0.0–1.0' },
            evidence: { type: 'string', description: 'One concrete sentence on the actual business relationship' },
          },
          required: ['ticker', 'relationship', 'weight', 'confidence', 'evidence'],
        },
      },
    },
    required: ['relationships'],
  },
}

export async function extractEdgesForEntity(
  db: SupabaseClient,
  target: { id: string; ticker: string; name: string },
  candidates: { id: string; ticker: string; name: string }[],
  grounding?: { text: string; source: string },
): Promise<ExtractResult> {
  const candList = candidates.map((c) => `${c.ticker} (${c.name})`).join(', ')
  const groundingBlock = grounding
    ? `\n\nSOURCE MATERIAL (the target's own latest 10-K business section and recent news — base your relationships on this and quote the supporting phrase in the evidence field):\n"""\n${grounding.text}\n"""\n`
    : ''
  const prompt = `Target company: ${target.name} (${target.ticker}).
From ONLY this candidate list, identify which are key SUPPLIERS to the target, key CUSTOMERS of the target, or direct COMPETITORS — specifically in the AI infrastructure / data-center value chain.${groundingBlock}
CANDIDATES: ${candList}

${grounding ? 'Prefer relationships supported by the SOURCE MATERIAL above and quote the supporting phrase in evidence. Well-established relationships not mentioned in the text may also be included (note them as general knowledge). ' : ''}Call record_relationships with every genuine relationship. Do not invent tickers outside the candidate list.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 8000, // tool-call JSON for a dense hub (~15 links w/ evidence) must not truncate
    tools: [RELATIONSHIP_TOOL],
    tool_choice: { type: 'tool', name: 'record_relationships' },
    system:
      'You map real supply-chain and competitive relationships between companies. You are precise and conservative — only assert links that genuinely exist.',
    messages: [{ role: 'user', content: prompt }],
  })

  const toolUse = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const raw: RawRel[] = toolUse ? ((toolUse.input as { relationships?: RawRel[] }).relationships ?? []) : []

  const idByTicker = new Map(candidates.map((c) => [c.ticker, c.id]))
  const rows: Array<Record<string, unknown>> = []
  const found: ExtractResult['found'] = []

  for (const r of raw) {
    const otherId = idByTicker.get(r.ticker)
    if (!otherId || otherId === target.id) continue
    let src_id = target.id
    let dst_id = otherId
    let relation = 'drives_demand_for'
    if (r.relationship === 'supplier_of_target') {
      // target's demand flows to its supplier → src=target, dst=other
      src_id = target.id
      dst_id = otherId
    } else if (r.relationship === 'customer_of_target') {
      // customer's demand flows to the target → src=other, dst=target
      src_id = otherId
      dst_id = target.id
    } else {
      relation = 'competes_with'
    }
    rows.push({
      src_id,
      dst_id,
      relation,
      weight: Math.max(0, Math.min(1, Number(r.weight) || 0.4)),
      confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0.5)),
      evidence: r.evidence,
      source: grounding?.source ?? 'ai',
      as_of: new Date().toISOString().slice(0, 10),
    })
    found.push({ ticker: r.ticker, relation: r.relationship, weight: Number(r.weight) || 0.4, confidence: Number(r.confidence) || 0.5, evidence: r.evidence })
  }

  if (rows.length) {
    // do not clobber curated 'manual' edges; only insert ai edges on new (src,dst,relation)
    await db.from('graph_edges').upsert(rows, { onConflict: 'src_id,dst_id,relation', ignoreDuplicates: true })
  }
  return { target: target.ticker, found }
}
