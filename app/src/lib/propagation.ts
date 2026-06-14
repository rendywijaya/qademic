/**
 * WorldContrarian — Wave Propagation Engine
 *
 * Deterministic (no AI). Given the interconnection graph and a demand shock at an
 * origin node, diffuse the shock outward along weighted benefit-flow edges and score
 * every reachable node by:
 *
 *   opportunity_score = percentile(exposure) − percentile(priced_in)
 *
 * High score = strong causal exposure to the wave that the market has NOT yet repriced.
 * This is a research prompt ("go look at this node"), never a buy signal.
 *
 * Edge orientation convention: an edge src→dst means "a positive demand shock at src
 * propagates a benefit to dst", with strength = weight (0..1). The `relation` column
 * documents the real-world nature of the link (see lib/seed).
 */

export interface PropNode {
  id: string
  ticker: string | null
  name: string
  kind: string
  sector: string | null
}

export interface PropEdge {
  src_id: string
  dst_id: string
  weight: number
}

export interface PropOutput {
  entity_id: string
  ticker: string | null
  name: string
  kind: string
  hops: number
  raw_exposure: number // normalized 0..1
  exposure_pct: number // 0..100 percentile within this run
  priced_in: number | null // 0..1 (higher = more already repriced)
  priced_in_pct: number | null
  opportunity_score: number | null // exposure_pct − priced_in_pct
}

export interface PropagateOptions {
  decay?: number // benefit lost per hop (default 0.6)
  maxHops?: number // causal distance cap (default 3)
  magnitude?: number // shock size at origin (default 1)
}

/**
 * Pure propagation. `pricedIn` maps entity_id → 0..1 (may be partial/empty); nodes
 * without a priced-in reading get a null opportunity_score and fall back to exposure.
 */
export function propagate(
  nodes: PropNode[],
  edges: PropEdge[],
  originId: string,
  pricedIn: Map<string, number>,
  opts: PropagateOptions = {},
): PropOutput[] {
  const decay = opts.decay ?? 0.6
  const maxHops = opts.maxHops ?? 3
  const magnitude = opts.magnitude ?? 1

  const outgoing = new Map<string, PropEdge[]>()
  for (const e of edges) {
    if (!outgoing.has(e.src_id)) outgoing.set(e.src_id, [])
    outgoing.get(e.src_id)!.push(e)
  }

  // Weighted diffusion with per-hop decay. Exposure accumulates across all paths;
  // first-reach hop is recorded. Each node expands once (BFS layers) to bound cycles.
  const exposure = new Map<string, number>([[originId, magnitude]])
  const hops = new Map<string, number>([[originId, 0]])

  let frontier = [originId]
  for (let h = 1; h <= maxHops; h++) {
    const next: string[] = []
    for (const nodeId of frontier) {
      const base = exposure.get(nodeId) ?? 0
      for (const e of outgoing.get(nodeId) ?? []) {
        const contrib = base * e.weight * decay
        exposure.set(e.dst_id, (exposure.get(e.dst_id) ?? 0) + contrib)
        if (!hops.has(e.dst_id)) {
          hops.set(e.dst_id, h)
          next.push(e.dst_id)
        }
      }
    }
    frontier = Array.from(new Set(next))
    if (frontier.length === 0) break
  }

  // Normalize exposure across beneficiaries (origin excluded so the field spreads 0..1).
  const maxExp = Math.max(
    1e-9,
    ...Array.from(exposure.entries())
      .filter(([id]) => id !== originId)
      .map(([, v]) => v),
  )

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const rows: PropOutput[] = []
  for (const [id, exp] of exposure.entries()) {
    if (id === originId) continue
    const node = nodeById.get(id)
    if (!node) continue
    const pi = pricedIn.get(id)
    rows.push({
      entity_id: id,
      ticker: node.ticker,
      name: node.name,
      kind: node.kind,
      hops: hops.get(id) ?? 99,
      raw_exposure: exp / maxExp,
      exposure_pct: 0,
      priced_in: pi ?? null,
      priced_in_pct: null,
      opportunity_score: null,
    })
  }

  assignPercentile(rows, (r) => r.raw_exposure, (r, p) => (r.exposure_pct = p))
  const priced = rows.filter((r) => r.priced_in != null)
  assignPercentile(priced, (r) => r.priced_in as number, (r, p) => (r.priced_in_pct = p))
  for (const r of rows) {
    if (r.priced_in_pct != null) r.opportunity_score = r.exposure_pct - r.priced_in_pct
  }

  // Rank: un-repriced exposure first. Nodes without priced-in sort by exposure alone.
  rows.sort(
    (a, b) =>
      (b.opportunity_score ?? b.exposure_pct - 50) -
      (a.opportunity_score ?? a.exposure_pct - 50),
  )
  return rows
}

function assignPercentile<T>(arr: T[], get: (t: T) => number, set: (t: T, p: number) => void): void {
  const n = arr.length
  if (n === 0) return
  if (n === 1) {
    set(arr[0], 50)
    return
  }
  const sorted = [...arr].sort((a, b) => get(a) - get(b))
  sorted.forEach((item, i) => set(item, Math.round((i / (n - 1)) * 100)))
}

/**
 * Convert raw momentum-ish signals into a 0..1 "priced in" reading.
 * Higher momentum / further above the 200dma = the market has already moved → more priced in.
 * Inputs are percentile-friendly raw values; callers percentile-rank across the run.
 */
export function pricedInFromSignal(momentum3m: number | null, priceVs200dma: number | null): number | null {
  if (momentum3m == null && priceVs200dma == null) return null
  const m = momentum3m ?? 0
  const p = priceVs200dma ?? 0
  // squash to 0..1 with a logistic; +30% 3m momentum or +30% vs 200dma ≈ strongly repriced
  const raw = 0.6 * m + 0.4 * p
  return 1 / (1 + Math.exp(-raw / 15))
}
