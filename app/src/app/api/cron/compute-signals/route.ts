import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertStockSignals, upsertManagementScore, upsertForensicSignals } from '@/lib/supabase/cache'
import { INGEST_UNIVERSE } from '@/lib/data/universe'

export const maxDuration = 300

const FMP_BASE = 'https://financialmodelingprep.com/stable'

// ─── Technical indicator math ─────────────────────────────────────────────────

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map(c => (c > 0 ? c : 0))
  const losses = changes.map(c => (c < 0 ? -c : 0))
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }
  if (avgLoss === 0) return 100
  return Math.round(100 - 100 / (1 + avgGain / avgLoss))
}

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function atr(rows: Array<{ high: number; low: number; close: number }>, period = 14): number | null {
  if (rows.length < period + 1) return null
  const trs = rows.slice(1).map((r, i) => {
    const prev = rows[i].close
    return Math.max(r.high - r.low, Math.abs(r.high - prev), Math.abs(r.low - prev))
  })
  let avg = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trs.length; i++) {
    avg = (avg * (period - 1) + trs[i]) / period
  }
  return Math.round(avg * 100) / 100
}

function momentum(closes: number[], lookbackDays: number): number | null {
  if (closes.length <= lookbackDays) return null
  const current = closes[closes.length - 1]
  const past = closes[closes.length - 1 - lookbackDays]
  if (!past) return null
  return Math.round(((current - past) / past) * 10000) / 100
}

function computeQuantScore(p: {
  priceVsSma20: number | null; priceVsSma50: number | null; priceVsSma200: number | null
  rsi14: number | null; momentum3m: number | null; momentum12m: number | null
}): number {
  let score = 50
  if (p.priceVsSma200 != null) score += p.priceVsSma200 > 0 ? 8 : -8
  if (p.priceVsSma50 != null)  score += p.priceVsSma50 > 0 ? 6 : -6
  if (p.priceVsSma20 != null)  score += p.priceVsSma20 > 0 ? 4 : -4
  if (p.momentum3m != null) {
    if (p.momentum3m > 20) score += 10
    else if (p.momentum3m > 10) score += 7
    else if (p.momentum3m > 0) score += 4
    else if (p.momentum3m > -10) score -= 4
    else score -= 10
  }
  if (p.momentum12m != null) {
    if (p.momentum12m > 30) score += 8
    else if (p.momentum12m > 15) score += 5
    else if (p.momentum12m > 0) score += 3
    else if (p.momentum12m > -15) score -= 3
    else score -= 8
  }
  if (p.rsi14 != null) {
    if (p.rsi14 >= 50 && p.rsi14 <= 70) score += 6
    else if (p.rsi14 > 70 && p.rsi14 <= 80) score += 3
    else if (p.rsi14 < 30) score -= 6
    else if (p.rsi14 > 80) score -= 4
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

// ─── Management + forensic scoring from FMP ──────────────────────────────────

async function fmpFetchObj<T>(path: string, apiKey: string): Promise<T | null> {
  try {
    const res = await fetch(`${FMP_BASE}/${path}&apikey=${apiKey}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json() as T
  } catch { return null }
}

interface FMPKeyMetric {
  roic: number | null
  debtToEquity: number | null
  freeCashFlowPerShare: number | null
  netIncomePerShare: number | null
}

interface FMPIncomeStmt {
  date: string; revenue: number; grossProfit: number; netIncome: number
  sellingGeneralAndAdministrativeExpenses: number | null
  accountsReceivable?: number | null
}

interface FMPCashflow {
  date: string; operatingCashFlow: number; freeCashFlow: number
}

interface FMPBalanceStmt {
  date: string; totalAssets: number; totalDebt: number; totalStockholdersEquity: number
}

interface FMPExecutive {
  title: string; name: string; isBoard: boolean
}

async function scoreManagementAndForensics(ticker: string, apiKey: string): Promise<void> {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  const [executives, keyMetrics, incomeStmts, cashflows, balanceSheets] = await Promise.all([
    fmpFetchObj<FMPExecutive[]>(`key-executives?symbol=${ticker}`, apiKey),
    fmpFetchObj<FMPKeyMetric[]>(`key-metrics?symbol=${ticker}&period=annual&limit=5`, apiKey),
    fmpFetchObj<FMPIncomeStmt[]>(`income-statement?symbol=${ticker}&period=annual&limit=3`, apiKey),
    fmpFetchObj<FMPCashflow[]>(`cash-flow-statement?symbol=${ticker}&period=annual&limit=3`, apiKey),
    fmpFetchObj<FMPBalanceStmt[]>(`balance-sheet-statement?symbol=${ticker}&period=annual&limit=3`, apiKey),
  ])

  // ── Management scoring ───────────────────────────────────────────────────
  const ceo = executives?.find(e => e.title?.toLowerCase().includes('ceo') || e.title?.toLowerCase().includes('chief executive'))
  const roics = (Array.isArray(keyMetrics) ? keyMetrics : []).map(m => m.roic).filter((r): r is number => r != null)

  const roic1yr = roics[0] != null ? Math.round(roics[0] * 1000) / 10 : null
  const roic3yr = roics.length >= 3 ? Math.round((roics.slice(0, 3).reduce((a, b) => a + b, 0) / 3) * 1000) / 10 : null
  const roic5yr = roics.length >= 5 ? Math.round((roics.slice(0, 5).reduce((a, b) => a + b, 0) / 5) * 1000) / 10 : null

  let roicTrend: string = 'stable'
  if (roics.length >= 3) {
    const recent = roics[0]; const old = roics[2]
    if (recent > old * 1.15) roicTrend = 'improving'
    else if (recent < old * 0.85) roicTrend = 'deteriorating'
  }

  const lastCf = cashflows?.[0]; const lastIncome = incomeStmts?.[0]
  const fcfConversion = (lastCf?.freeCashFlow != null && lastIncome?.netIncome)
    ? Math.round((lastCf.freeCashFlow / lastIncome.netIncome) * 100) : null

  // Debt trend: compare D/E first year vs second year
  const debtEquityYears = (Array.isArray(balanceSheets) ? balanceSheets : []).map(b =>
    b.totalStockholdersEquity ? (b.totalDebt || 0) / Math.abs(b.totalStockholdersEquity) : 0
  )
  let debtTrend: string = 'stable'
  if (debtEquityYears.length >= 2) {
    if (debtEquityYears[0] < debtEquityYears[1] * 0.85) debtTrend = 'improving'
    else if (debtEquityYears[0] > debtEquityYears[1] * 1.15) debtTrend = 'deteriorating'
  }

  let mgmtScore = 50
  if (roic1yr != null) {
    if (roic1yr > 30) mgmtScore += 20
    else if (roic1yr > 20) mgmtScore += 14
    else if (roic1yr > 15) mgmtScore += 8
    else if (roic1yr > 10) mgmtScore += 4
    else if (roic1yr < 5) mgmtScore -= 10
  }
  if (roicTrend === 'improving') mgmtScore += 8
  else if (roicTrend === 'deteriorating') mgmtScore -= 8
  if (fcfConversion != null) {
    if (fcfConversion > 100) mgmtScore += 10
    else if (fcfConversion > 75) mgmtScore += 6
    else if (fcfConversion > 50) mgmtScore += 3
    else if (fcfConversion < 0) mgmtScore -= 8
  }
  if (debtTrend === 'improving') mgmtScore += 5
  else if (debtTrend === 'deteriorating') mgmtScore -= 5

  await upsertManagementScore(ticker, {
    ticker,
    ceo_name: ceo?.name ?? null,
    is_founder_led: null, // requires company age heuristic — set by user feedback
    insider_ownership_pct: null, // requires separate insider endpoint
    roic_1yr: roic1yr,
    roic_3yr_avg: roic3yr,
    roic_5yr_avg: roic5yr,
    roic_trend: roicTrend,
    fcf_conversion: fcfConversion,
    debt_trend: debtTrend,
    capital_alloc_score: fcfConversion != null ? Math.max(0, Math.min(100, Math.round(50 + (fcfConversion - 75) / 4))) : null,
    mgmt_score: Math.max(0, Math.min(100, mgmtScore)),
  })

  await sleep(100)

  // ── Forensic scoring ─────────────────────────────────────────────────────
  const i0 = incomeStmts?.[0]; const i1 = incomeStmts?.[1]
  const b0 = balanceSheets?.[0]; const cf0 = cashflows?.[0]

  if (!i0 || !b0) return

  const accrualsRatio = (cf0 && i0.netIncome != null && b0.totalAssets)
    ? Math.round(((i0.netIncome - cf0.operatingCashFlow) / b0.totalAssets) * 10000) / 100 : null
  const accrualsFlag = accrualsRatio != null ? accrualsRatio > 5 : false

  const revenueGrowth = i1?.revenue ? Math.round(((i0.revenue - i1.revenue) / Math.abs(i1.revenue)) * 1000) / 10 : null
  const grossMarginDelta = i1?.revenue
    ? Math.round(((i0.grossProfit / i0.revenue) - (i1.grossProfit / i1.revenue)) * 10000) : null
  const grossMarginFlag = grossMarginDelta != null ? grossMarginDelta < -200 : false

  // Simplified Beneish M-Score (2-variable approximation using accruals + margin)
  const beneishScore = (accrualsRatio != null && grossMarginDelta != null)
    ? Math.round((-4.84 + 0.92 * (accrualsRatio / 10) + 0.528 * (grossMarginDelta / 1000)) * 100) / 100
    : null
  const beneishFlag = beneishScore != null ? beneishScore > -1.78 : false

  const flags = [accrualsFlag, false, grossMarginFlag, beneishFlag].filter(Boolean).length
  const overallFlag = flags >= 2 ? 'warning' : flags === 1 ? 'watch' : 'clean'
  const forensicScore = Math.max(0, Math.min(100, Math.round(85 - flags * 20)))

  await upsertForensicSignals(ticker, {
    ticker,
    accruals_ratio: accrualsRatio,
    accruals_flag: accrualsFlag,
    receivables_growth: null, // would need accounts_receivable from balance sheet
    revenue_growth: revenueGrowth,
    rev_vs_receivables_flag: false,
    gross_margin_delta: grossMarginDelta,
    gross_margin_flag: grossMarginFlag,
    beneish_m_score: beneishScore,
    beneish_flag: beneishFlag,
    overall_flag: overallFlag,
    forensic_score: forensicScore,
  })
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FMP_API_KEY ?? ''
  if (!apiKey) return NextResponse.json({ error: 'FMP_API_KEY not set' }, { status: 500 })

  const admin = createAdminClient()

  // Shared universe (DB ticker format = dots) — signals are pure DB math, so the
  // whole expanded universe is processed; tickers without ingested bars just skip.
  const tickers = INGEST_UNIVERSE.map(t => t.replace('-', '.'))

  let signaledCount = 0
  let managementCount = 0

  for (const ticker of tickers) {
    // Fetch the MOST RECENT 260 trading days (descending), then restore ascending
    // order for the indicator math. Ascending+limit would silently return the
    // oldest 260 days of the 5yr backfill and compute signals on stale prices.
    const { data: ohlcvRows } = await admin
      .from('ohlcv_daily')
      .select('date,open,high,low,close,volume')
      .eq('ticker', ticker)
      .order('date', { ascending: false })
      .limit(260)

    if (!ohlcvRows || ohlcvRows.length < 20) continue

    type OHLCVRow = { date: string; open: number; high: number; low: number; close: number; volume: number }
    const rows = (ohlcvRows as OHLCVRow[]).reverse()
    const closes = rows.map(r => r.close)
    const vols = rows.map(r => r.volume ?? 0)

    const price = closes[closes.length - 1]
    const sma20 = sma(closes, 20)
    const sma50 = sma(closes, 50)
    const sma200 = sma(closes, 200)
    const rsi14 = rsi(closes)
    const atr14 = atr(rows, 14)
    const mom1m = momentum(closes, 21)
    const mom3m = momentum(closes, 63)
    const mom6m = momentum(closes, 126)
    const mom12m = momentum(closes, 252)

    const pctOf = (v: number | null, ref: number | null) =>
      v != null && ref != null ? Math.round(((price - ref) / ref) * 1000) / 10 : null

    const priceVsSma20 = pctOf(price, sma20)
    const priceVsSma50 = pctOf(price, sma50)
    const priceVsSma200 = pctOf(price, sma200)

    const volAvg20 = Math.round(vols.slice(-20).reduce((a, b) => a + b, 0) / 20)
    const lastVol = vols[vols.length - 1]
    const volumeRatio = volAvg20 > 0 ? Math.round((lastVol / volAvg20) * 100) / 100 : null

    const quantScore = computeQuantScore({ priceVsSma20, priceVsSma50, priceVsSma200, rsi14, momentum3m: mom3m, momentum12m: mom12m })

    await upsertStockSignals(ticker, {
      ticker,
      sma_20: sma20 != null ? Math.round(sma20 * 100) / 100 : null,
      sma_50: sma50 != null ? Math.round(sma50 * 100) / 100 : null,
      sma_200: sma200 != null ? Math.round(sma200 * 100) / 100 : null,
      price,
      price_vs_sma20: priceVsSma20,
      price_vs_sma50: priceVsSma50,
      price_vs_sma200: priceVsSma200,
      momentum_1m: mom1m,
      momentum_3m: mom3m,
      momentum_6m: mom6m,
      momentum_12m: mom12m,
      rsi_14: rsi14,
      atr_14: atr14,
      volume_avg_20: volAvg20,
      volume_ratio: volumeRatio,
      quant_score: quantScore,
    })
    signaledCount++
  }

  // Compute management + forensics for unique tickers (5 FMP calls each — Premium tier)
  // Only run if we have budget. On free tier (250 calls), skip or limit to top 10.
  const managementTickers = tickers.slice(0, 10) // adjust upward with Premium FMP
  for (let i = 0; i < managementTickers.length; i++) {
    await scoreManagementAndForensics(managementTickers[i], apiKey)
    managementCount++
    if (i < managementTickers.length - 1) await sleep(500)
  }

  return NextResponse.json({
    ok: true,
    signalsTickers: signaledCount,
    managementTickers: managementCount,
  })
}
