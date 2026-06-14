/**
 * Wave orchestration: load the interconnection graph + priced-in signals from Supabase,
 * run the deterministic propagation, optionally persist the nightly log.
 * Shared by /api/waves (read) and /api/cron/propagate-waves (persist).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { propagate, pricedInFromSignal, type PropEdge, type PropOutput } from './propagation'

export interface WaveGraphNode {
  id: string
  slug: string
  ticker: string | null
  name: string
  kind: string
  sector: string | null
}

export interface WaveGraphEdge {
  src_id: string
  dst_id: string
  relation: string
  weight: number
  confidence: number
  evidence: string | null
}

export interface WaveShock {
  id: string
  slug: string
  name: string
  origin_id: string | null
  magnitude: number
  stage: string
  thesis: string | null
}

export interface WaveRun {
  shock: WaveShock
  nodes: WaveGraphNode[]
  edges: WaveGraphEdge[]
  results: PropOutput[]
}

export async function runWave(
  db: SupabaseClient,
  shockSlug: string,
  opts: { persist?: boolean } = {},
): Promise<WaveRun | null> {
  const { data: shock } = await db.from('wave_shocks').select('*').eq('slug', shockSlug).single()
  if (!shock) return null

  const { data: entRows } = await db
    .from('graph_entities')
    .select('id, slug, ticker, name, kind, sector')
  const { data: edgeRows } = await db
    .from('graph_edges')
    .select('src_id, dst_id, relation, weight, confidence, evidence')

  const nodes: WaveGraphNode[] = (entRows ?? []) as WaveGraphNode[]
  const edges: WaveGraphEdge[] = (edgeRows ?? []) as WaveGraphEdge[]

  // "priced in" from the existing nightly signals pipeline (momentum + distance above 200dma)
  const tickers = nodes.map((n) => n.ticker).filter((t): t is string => !!t)
  const { data: sig } = await db
    .from('stock_signals')
    .select('ticker, momentum_3m, price_vs_sma200')
    .in('ticker', tickers)
  const sigByTicker = new Map((sig ?? []).map((s) => [s.ticker, s]))

  const pricedIn = new Map<string, number>()
  for (const n of nodes) {
    if (!n.ticker) continue
    const s = sigByTicker.get(n.ticker)
    if (!s) continue
    const pi = pricedInFromSignal(s.momentum_3m, s.price_vs_sma200)
    if (pi != null) pricedIn.set(n.id, pi)
  }

  // Only demand-flow relations propagate benefit. competes_with is shown in the graph
  // but a competitor benefiting does not transmit demand to its rival — exclude it.
  const propEdges: PropEdge[] = edges
    .filter((e) => e.relation !== 'competes_with')
    .map((e) => ({
      src_id: e.src_id,
      dst_id: e.dst_id,
      weight: Number(e.weight),
    }))

  const results = propagate(nodes, propEdges, shock.origin_id as string, pricedIn, {
    magnitude: Number(shock.magnitude) || 1,
  })

  if (opts.persist && results.length) {
    const rows = results.map((r) => ({
      shock_id: shock.id,
      entity_id: r.entity_id,
      ticker: r.ticker,
      hops: r.hops,
      raw_exposure: r.raw_exposure,
      exposure_pct: r.exposure_pct,
      priced_in: r.priced_in,
      priced_in_pct: r.priced_in_pct,
      opportunity_score: r.opportunity_score,
    }))
    await db.from('wave_propagation').insert(rows)
  }

  return { shock: shock as WaveShock, nodes, edges, results }
}

export async function listActiveShocks(db: SupabaseClient): Promise<{ slug: string }[]> {
  const { data } = await db.from('wave_shocks').select('slug').eq('active', true)
  return data ?? []
}
