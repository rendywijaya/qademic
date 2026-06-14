// Forward-cohort decile-spread (QADEMIC.md §10). Pure functions — no I/O — so the
// computation is testable and the cron just feeds it rows.
//
// The honest test of a ranking signal: on each historical date, split the universe
// into a top decile and a bottom decile by the score, then measure each stock's
// forward return over a fixed window. Average the spread (top − bottom) across
// cohort dates, and compare to simply holding SPY. Components with no spread get
// killed; weights are never tuned to this (DeMiguel/Garlappi/Uppal 2009).
//
// Forward prices come from score_history's own `price` column (snapshot-time price),
// so this never needs point-in-time fundamentals — it only judges what the ranking
// did, on prices that were real on the day.

export interface ScoreSnapshot {
  ticker: string
  scored_date: string  // 'YYYY-MM-DD'
  score: number | null
  price: number | null
}

export interface SpyBar { date: string; close: number }

export interface ValidationSummary {
  cohorts: number
  nObservations: number
  topAvgFwd: number | null
  bottomAvgFwd: number | null
  spread: number | null
  universeAvgFwd: number | null
  spyAvgFwd: number | null
  firstCohortDate: string | null
  lastCohortDate: string | null
}

export interface ValidationParams {
  windowDays?: number     // forward horizon (calendar days)
  toleranceDays?: number  // how far past the target date a forward snapshot may be
  topQuantile?: number    // decile = 0.10
  minBucket?: number      // floor on stocks per bucket so a cohort is meaningful
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Last SPY close on or before `date`. Rows ascending by date.
function spyCloseAsOf(rows: SpyBar[], date: string): number | null {
  let found: number | null = null
  for (const r of rows) {
    if (r.date <= date) found = r.close
    else break
  }
  return found
}

export function computeForwardCohorts(
  snapshots: ScoreSnapshot[],
  spyRows: SpyBar[],
  params: ValidationParams = {},
): ValidationSummary {
  const windowDays = params.windowDays ?? 30
  const toleranceDays = params.toleranceDays ?? 14
  const topQuantile = params.topQuantile ?? 0.10
  const minBucket = params.minBucket ?? 3

  // Per-ticker ascending price history from the snapshots themselves.
  const byTicker = new Map<string, ScoreSnapshot[]>()
  for (const s of snapshots) {
    if (s.price == null || s.price <= 0) continue
    const arr = byTicker.get(s.ticker) ?? []
    arr.push(s)
    byTicker.set(s.ticker, arr)
  }
  for (const arr of byTicker.values()) arr.sort((a, b) => a.scored_date.localeCompare(b.scored_date))

  const forwardPrice = (ticker: string, target: string): number | null => {
    const arr = byTicker.get(ticker)
    if (!arr) return null
    const limit = addDays(target, toleranceDays)
    for (const s of arr) {
      if (s.scored_date >= target && s.scored_date <= limit) return s.price
    }
    return null
  }

  // Cohorts = distinct dates on which we have scored prices.
  const cohortDates = [...new Set(snapshots.map(s => s.scored_date))].sort()

  const cohortTop: number[] = []
  const cohortBottom: number[] = []
  const cohortSpread: number[] = []
  const cohortUniverse: number[] = []
  const cohortSpy: number[] = []
  const maturedDates: string[] = []
  let nObservations = 0

  for (const date of cohortDates) {
    const target = addDays(date, windowDays)
    // A cohort matures only when forward prints exist — handled naturally below:
    // forwardPrice() returns null for names with no snapshot past `target`, and a
    // cohort with too few matured names to split into two buckets is skipped.
    const entries = snapshots
      .filter(s => s.scored_date === date && s.score != null && s.price != null && s.price > 0)
      .map(s => {
        const fwd = forwardPrice(s.ticker, target)
        return fwd != null ? { ticker: s.ticker, score: s.score as number, fwd: (fwd / (s.price as number) - 1) * 100 } : null
      })
      .filter((e): e is { ticker: string; score: number; fwd: number } => e !== null)

    const bucket = Math.max(minBucket, Math.round(entries.length * topQuantile))
    if (entries.length < bucket * 2) continue  // not enough matured names to split

    const ranked = [...entries].sort((a, b) => b.score - a.score)
    const top = ranked.slice(0, bucket)
    const bottom = ranked.slice(-bucket)

    const topAvg = mean(top.map(e => e.fwd))
    const bottomAvg = mean(bottom.map(e => e.fwd))
    const universeAvg = mean(entries.map(e => e.fwd))
    if (topAvg == null || bottomAvg == null || universeAvg == null) continue

    cohortTop.push(topAvg)
    cohortBottom.push(bottomAvg)
    cohortSpread.push(topAvg - bottomAvg)
    cohortUniverse.push(universeAvg)

    const spyEntry = spyCloseAsOf(spyRows, date)
    const spyExit = spyCloseAsOf(spyRows, addDays(target, toleranceDays))
    if (spyEntry != null && spyExit != null && spyEntry > 0) {
      cohortSpy.push((spyExit / spyEntry - 1) * 100)
    }

    maturedDates.push(date)
    nObservations += entries.length
  }

  const topAvgFwd = mean(cohortTop)
  const bottomAvgFwd = mean(cohortBottom)
  const spreadAvg = mean(cohortSpread)
  const universeAvgFwd = mean(cohortUniverse)
  const spyAvgFwd = mean(cohortSpy)

  return {
    cohorts: maturedDates.length,
    nObservations,
    topAvgFwd: topAvgFwd != null ? round2(topAvgFwd) : null,
    bottomAvgFwd: bottomAvgFwd != null ? round2(bottomAvgFwd) : null,
    spread: spreadAvg != null ? round2(spreadAvg) : null,
    universeAvgFwd: universeAvgFwd != null ? round2(universeAvgFwd) : null,
    spyAvgFwd: spyAvgFwd != null ? round2(spyAvgFwd) : null,
    firstCohortDate: maturedDates[0] ?? null,
    lastCohortDate: maturedDates[maturedDates.length - 1] ?? null,
  }
}
