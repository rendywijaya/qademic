// Sector-neutral percentile-rank scoring (QADEMIC.md §4 — "ranks not thresholds").
//
// Pure functions. The per-stock pillar scores (Q3..Q7) are the cited factors; here we
// convert each into a SECTOR-NEUTRAL PERCENTILE RANK across the scored universe, then
// equal-weight (1/N) the ranks into Business and Timing. Ranking each factor first,
// then combining, is the doctrine — it removes absolute-band artifacts and makes the
// score answer the only question that matters cross-sectionally: "versus comparable
// companies, where does this one stand?"
//
//   BUSINESS = mean( rank(Q3 Fundamental), rank(Q6 Management) )      — moves quarterly
//   TIMING   = mean( rank(Q4 Quant), rank(Q5 SmartMoney), rank(Q7 Catalyst) ) — daily
//
// Sectors with too few comparable names fall back to a whole-universe rank (a thin
// sector can't support a meaningful percentile) — disclosed on /methodology.

export interface RankInputStock {
  ticker: string
  sector: string | null
  q3: number | null
  q4: number | null
  q5: number | null
  q6: number | null
  q7: number | null
}

export interface RankedStock {
  ticker: string
  business: number | null
  timing: number | null
}

export const MIN_SECTOR_PEERS = 8

type PillarKey = 'q3' | 'q4' | 'q5' | 'q6' | 'q7'

// Percentile of `value` within `values` using the mid-rank convention for ties,
// so the median lands near 50 and ties don't all collapse to the same extreme.
function percentile(values: number[], value: number): number {
  const n = values.length
  if (n === 0) return 50
  if (n === 1) return 50
  let below = 0
  let equal = 0
  for (const v of values) {
    if (v < value) below++
    else if (v === value) equal++
  }
  return Math.round(((below + 0.5 * equal) / n) * 100)
}

// For one pillar, return ticker → sector-neutral percentile (or null if no value).
function rankPillar(stocks: RankInputStock[], key: PillarKey, minPeers: number): Map<string, number | null> {
  const universeValues = stocks.map(s => s[key]).filter((v): v is number => v != null)

  // Group present values by sector once.
  const bySector = new Map<string, number[]>()
  for (const s of stocks) {
    const v = s[key]
    if (v == null) continue
    const sector = s.sector ?? '__unknown__'
    const arr = bySector.get(sector) ?? []
    arr.push(v)
    bySector.set(sector, arr)
  }

  const out = new Map<string, number | null>()
  for (const s of stocks) {
    const v = s[key]
    if (v == null) { out.set(s.ticker, null); continue }
    const sector = s.sector ?? '__unknown__'
    const peers = bySector.get(sector) ?? []
    const pool = peers.length >= minPeers ? peers : universeValues
    out.set(s.ticker, percentile(pool, v))
  }
  return out
}

function meanOf(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length)
}

export function computeSectorNeutralRanks(
  stocks: RankInputStock[],
  minPeers: number = MIN_SECTOR_PEERS,
): RankedStock[] {
  const r3 = rankPillar(stocks, 'q3', minPeers)
  const r4 = rankPillar(stocks, 'q4', minPeers)
  const r5 = rankPillar(stocks, 'q5', minPeers)
  const r6 = rankPillar(stocks, 'q6', minPeers)
  const r7 = rankPillar(stocks, 'q7', minPeers)

  return stocks.map(s => ({
    ticker: s.ticker,
    business: meanOf([r3.get(s.ticker) ?? null, r6.get(s.ticker) ?? null]),
    timing: meanOf([r4.get(s.ticker) ?? null, r5.get(s.ticker) ?? null, r7.get(s.ticker) ?? null]),
  }))
}
