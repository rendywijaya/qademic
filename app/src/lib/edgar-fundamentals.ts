/**
 * Free fundamentals from the SEC XBRL "company facts" API — no key, no FMP rate limit.
 * Used as a fallback when FMP/Finnhub are throttled and our scores go stale/empty.
 *
 * Endpoint: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json  (cik = 10-digit padded)
 * Shape:    .facts['us-gaap'][CONCEPT].units.USD = [{ end, val, fy, fp, form, ... }]
 *
 * SEC fair-access policy requires a User-Agent identifying the requester (same as edgar.ts).
 */

import { getCik } from './edgar'

const SEC_UA = 'WorldContrarian (qademic.com) research contact rendyyap9@gmail.com'
const COMPANY_FACTS = 'https://data.sec.gov/api/xbrl/companyfacts'

async function secFetch(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': SEC_UA, Accept: 'application/json' }, cache: 'no-store' })
}

// One annual datapoint from an XBRL concept's USD unit series.
interface XbrlFact {
  start?: string // present for flow concepts (income/cash-flow); absent for balance-sheet snapshots
  end: string
  val: number
  fy?: number
  fp?: string
  form?: string
}

interface CompanyFacts {
  entityName?: string
  facts?: { 'us-gaap'?: Record<string, { units?: Record<string, XbrlFact[]> }> }
}

export interface EdgarFundamentals {
  revenue: number
  revenueGrowth: number
  grossMargin: number
  netMargin: number
  roe: number
  debtEquity: number
  fcfMargin: number
  eps: number
  name: string
}

// Annual filing forms (domestic 10-K, foreign private issuers 20-F).
const ANNUAL_FORMS = new Set(['10-K', '20-F'])

const DAY_MS = 86_400_000

/** Build a clean, newest-first annual series for one concept name. */
function seriesForConcept(rows: XbrlFact[]): XbrlFact[] {
  // Keep only full-year annual filings (10-K / 20-F, fp === 'FY').
  let annual = rows.filter(r => r.fp === 'FY' && r.form != null && ANNUAL_FORMS.has(r.form))

  // Flow concepts (revenue, income, cash flow) carry a `start`, so a 10-K can also
  // include standalone-quarter figures. Drop anything that isn't ~a full year.
  const hasDuration = annual.some(r => r.start)
  if (hasDuration) {
    annual = annual.filter(r => {
      if (!r.start) return false
      const days = (new Date(r.end).getTime() - new Date(r.start).getTime()) / DAY_MS
      return days >= 340 && days <= 380
    })
  }
  if (annual.length === 0) return []

  // Dedupe by reporting period (a single period can be restated under several `fy`
  // labels across successive filings). Key on the period itself, keep latest filing.
  const byPeriod = new Map<string, XbrlFact>()
  for (const r of annual) {
    const key = `${r.start ?? ''}_${r.end}`
    const existing = byPeriod.get(key)
    if (!existing || (r.fy ?? 0) >= (existing.fy ?? 0)) byPeriod.set(key, r)
  }
  // Newest period first.
  return [...byPeriod.values()].sort((a, b) => b.end.localeCompare(a.end))
}

/**
 * Pull the latest annual value and the prior-year annual value for a concept.
 * Tries each alternate concept name and picks the series whose latest datapoint is the
 * MOST RECENT — filers often retire a concept (leaving a stale series) when switching
 * to a newer tag, so "first concept that exists" alone would grab outdated numbers.
 */
function annualSeries(
  facts: CompanyFacts,
  concepts: string[],
  unit = 'USD',
): { latest: XbrlFact; prior?: XbrlFact } | null {
  const gaap = facts.facts?.['us-gaap']
  if (!gaap) return null

  let best: XbrlFact[] = []
  for (const concept of concepts) {
    const rows = gaap[concept]?.units?.[unit]
    if (!rows || rows.length === 0) continue
    const series = seriesForConcept(rows)
    if (series.length === 0) continue
    if (best.length === 0 || series[0].end > best[0].end) best = series
  }
  if (best.length === 0) return null
  return { latest: best[0], prior: best[1] }
}

/** Round a value to `dp` decimal places, or undefined if not finite. */
function round(v: number, dp: number): number | undefined {
  if (!Number.isFinite(v)) return undefined
  const f = 10 ** dp
  return Math.round(v * f) / f
}

/**
 * Fetch fundamentals for a ticker straight from SEC XBRL company facts.
 * Returns whatever can be computed (fields omitted when inputs are missing),
 * or null if the ticker can't be resolved / has no usable facts.
 */
export async function fetchEdgarFundamentals(
  ticker: string,
): Promise<Partial<EdgarFundamentals> | null> {
  const cik = await getCik(ticker)
  if (!cik) return null

  let facts: CompanyFacts
  try {
    const res = await secFetch(`${COMPANY_FACTS}/CIK${cik}.json`)
    if (!res.ok) return null
    facts = (await res.json()) as CompanyFacts
  } catch {
    return null
  }

  // Concept alternates, tried in order. Many filers expose only a subset.
  const revenueS = annualSeries(facts, [
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'SalesRevenueNet',
  ])
  const grossProfitS = annualSeries(facts, ['GrossProfit'])
  const netIncomeS = annualSeries(facts, ['NetIncomeLoss'])
  const equityS = annualSeries(facts, ['StockholdersEquity'])
  const liabilitiesS = annualSeries(facts, ['Liabilities'])
  const ocfS = annualSeries(facts, ['NetCashProvidedByUsedInOperatingActivities'])
  const capexS = annualSeries(facts, ['PaymentsToAcquirePropertyPlantAndEquipment'])
  // EPS is a per-share figure: XBRL stores it under the 'USD/shares' unit.
  const epsS = annualSeries(facts, ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares')

  const out: Partial<EdgarFundamentals> = {}

  if (facts.entityName) out.name = facts.entityName

  const revenue = revenueS?.latest.val
  if (revenue != null && revenue !== 0) {
    out.revenue = revenue

    // YoY revenue growth (%) — needs a prior-year figure.
    const prevRev = revenueS?.prior?.val
    if (prevRev != null && prevRev !== 0) {
      const g = round(((revenue - prevRev) / Math.abs(prevRev)) * 100, 1)
      if (g != null) out.revenueGrowth = g
    }

    // Margins are all relative to latest revenue.
    const gp = grossProfitS?.latest.val
    if (gp != null) {
      const gm = round((gp / revenue) * 100, 1)
      if (gm != null) out.grossMargin = gm
    }

    const ni = netIncomeS?.latest.val
    if (ni != null) {
      const nm = round((ni / revenue) * 100, 1)
      if (nm != null) out.netMargin = nm
    }

    const ocf = ocfS?.latest.val
    const capex = capexS?.latest.val
    if (ocf != null) {
      // CapEx is reported as a positive cash outflow; subtract it for FCF.
      const fcf = ocf - (capex ?? 0)
      const fm = round((fcf / revenue) * 100, 1)
      if (fm != null) out.fcfMargin = fm
    }
  }

  // ROE and debt/equity need stockholders' equity.
  const equity = equityS?.latest.val
  if (equity != null && equity !== 0) {
    const ni = netIncomeS?.latest.val
    if (ni != null) {
      const roe = round((ni / equity) * 100, 1)
      if (roe != null) out.roe = roe
    }
    const liabilities = liabilitiesS?.latest.val
    if (liabilities != null) {
      const de = round(liabilities / Math.abs(equity), 2)
      if (de != null) out.debtEquity = de
    }
  }

  const eps = epsS?.latest.val
  if (eps != null) {
    const e = round(eps, 2)
    if (e != null) out.eps = e
  }

  // Nothing computable beyond maybe a name — treat as no data.
  const hasNumbers = Object.keys(out).some(k => k !== 'name')
  return hasNumbers ? out : null
}
