import type { SupabaseClient } from '@supabase/supabase-js'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import { getCachedFundamentals, writeFundamentalsCache } from '@/lib/supabase/cache'
import type { MacroInput, SectorInput, QuantInput, SentimentInput, CatalystInput } from '@/lib/scoring'
import { fetchEdgarFundamentals } from '@/lib/edgar-fundamentals'

const FMP_BASE = 'https://financialmodelingprep.com/stable'

interface FMPProfile {
  symbol: string
  companyName: string
  sector: string
  industry: string
  price: number
  change: number
  changePercentage: number
  marketCap: number
  lastDividend: number
  beta?: number
}

interface FMPIncome {
  date: string
  revenue: number
  grossProfit: number
  netIncome: number
  eps: number
}

interface FMPBalanceSheet {
  totalDebt: number
  totalStockholdersEquity: number
}

interface FMPCashFlow {
  freeCashFlow: number
}

async function fmpFetch<T>(path: string, apiKey: string): Promise<T[] | null> {
  try {
    const res = await fetch(`${FMP_BASE}/${path}&apikey=${apiKey}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : null
  } catch { return null }
}

// ─── Finnhub fallback ────────────────────────────────────────────────────────

interface FinnhubQuote { c: number; d: number; dp: number }
interface FinnhubProfile {
  name: string; finnhubIndustry: string; marketCapitalization: number
  logo?: string; weburl?: string
}
interface FinnhubMetrics {
  metric: {
    grossMarginTTM?: number
    revenueGrowthTTMYoy?: number
    netProfitMarginTTM?: number
    roeTTM?: number
    'totalDebt/totalEquityAnnual'?: number
    peTTM?: number
    beta?: number
    dividendPerShareAnnual?: number
  }
}

// One-line company descriptions for our 45-ticker universe
const COMPANY_DESCRIPTIONS: Record<string, string> = {
  AAPL: 'Designs and sells consumer electronics (iPhone, Mac, iPad), software, and digital services including the App Store, Apple Music, and iCloud.',
  MSFT: 'Cloud computing platform (Azure), enterprise software (Office 365, Windows), gaming (Xbox), and developer tools (GitHub, VS Code).',
  NVDA: 'Designs GPUs and AI accelerators (H100, GB200) powering data centers, AI training, gaming, and autonomous vehicles.',
  GOOGL: 'Dominates online search advertising, operates YouTube, builds Google Cloud, and develops Android — monetizing attention at global scale.',
  AMZN: 'World\'s largest e-commerce marketplace, #1 cloud provider (AWS), and growing advertising business — three massive revenue engines in one.',
  META: 'Owns Facebook, Instagram, and WhatsApp — monetizes 3.3B daily users through targeted advertising. Investing in AI and the metaverse.',
  TSLA: 'Designs and manufactures electric vehicles, sells Full Self-Driving software, and operates the world\'s largest fast-charging network.',
  'BRK.B': 'Berkshire Hathaway — a holding company owning insurance (GEICO), railroads (BNSF), utilities, and equity stakes in AAPL, KO, BAC, and others.',
  JPM: 'America\'s largest bank by assets. Earns through retail banking, investment banking fees, credit cards, and asset management.',
  V: 'Operates the world\'s largest payment network — earns a fee on every Visa transaction processed, not the credit risk.',
  JNJ: 'Global healthcare company spanning pharmaceuticals (cancer, immunology drugs), medical devices, and consumer health products.',
  WMT: 'World\'s largest retailer by revenue. Physical stores, Walmart.com e-commerce, Sam\'s Club, and a fast-growing ad business.',
  XOM: 'One of the world\'s largest oil and gas companies — explores, produces, refines, and sells petroleum products and chemicals globally.',
  UNH: 'America\'s largest health insurer. UnitedHealthcare covers ~50M people; Optum is a data-driven healthcare services platform.',
  PG: 'Makes and sells everyday consumer brands — Tide, Pampers, Gillette, Oral-B — distributed in 180+ countries.',
  MA: 'Operates a global payment network. Earns fees on every Mastercard transaction, with no credit exposure like banks.',
  HD: 'World\'s largest home improvement retailer — sells tools, lumber, appliances, and garden supplies to DIY consumers and contractors.',
  CVX: 'Integrated energy company — explores and produces crude oil and natural gas, refines into fuels, and sells lubricants and chemicals.',
  MRK: 'Pharmaceutical giant known for Keytruda (cancer immunotherapy), Gardasil (HPV vaccine), and a broad human and animal health portfolio.',
  ABBV: 'Biopharmaceutical company — Humira has been the world\'s top-selling drug; transitioning to Skyrizi and Rinvoq for immunology.',
  KO: 'The world\'s most recognized brand — manufactures, markets, and distributes beverage concentrates and syrups to bottlers in 200+ countries.',
  PEP: 'Food and beverage giant — owns Pepsi, Lay\'s, Gatorade, Quaker, and Doritos. Half revenue from snacks, half from drinks.',
  COST: 'Membership-based warehouse retailer. Sells bulk goods at near-cost to drive membership fees, which generate most of its profit.',
  LLY: 'Pharmaceutical leader in diabetes (Mounjaro, Ozempic competitor) and obesity drugs — riding the GLP-1 revolution.',
  AVGO: 'Designs semiconductors for networking, storage, and broadband — plus enterprise software from the CA Technologies and VMware acquisitions.',
  MCD: 'World\'s largest fast food chain. Franchises 95% of its ~40,000 restaurants — earns royalties, rent, and licensing fees from franchisees.',
  CSCO: 'Sells networking equipment (routers, switches), cybersecurity software, and collaboration tools (Webex) to enterprises and governments.',
  ACN: 'Global consulting and IT services firm — helps Fortune 500 companies with digital transformation, cloud migration, and AI implementation.',
  ADBE: 'Creative software monopoly — Photoshop, Illustrator, Premiere, and Acrobat on subscription. Also sells marketing analytics (Experience Cloud).',
  CRM: 'World\'s #1 CRM platform — Salesforce helps sales teams manage customer relationships, pipelines, and automate workflows with AI.',
  NFLX: 'World\'s largest streaming service with 260M+ subscribers. Produces original content and licenses third-party shows and movies.',
  AMD: 'Designs CPUs (Ryzen, EPYC) and GPUs (Instinct MI300) competing directly with Intel and NVIDIA in the AI and data center chip race.',
  INTC: 'Designs and manufactures CPUs for PCs and servers. Transforming into a foundry (Intel Foundry Services) to make chips for other companies.',
  QCOM: 'Designs mobile processor chips (Snapdragon) used in most Android phones, and holds massive wireless technology patent portfolio.',
  TXN: 'Makes analog and embedded processor chips for industrial, automotive, and personal electronics markets — highly profitable, wide moat.',
  INTU: 'Financial software for small businesses (QuickBooks), consumers (TurboTax), and accountants — sticky subscription model with high switching costs.',
  NOW: 'Enterprise cloud platform automating IT, HR, and business workflows. Sticky SaaS model — average customer uses 8+ ServiceNow products.',
  ORCL: 'Enterprise software and cloud database company. Transitioning legacy ERP customers to Oracle Cloud while winning AI workloads with its GPU clusters.',
  IBM: 'Hybrid cloud (Red Hat) and AI consulting services for large enterprises. Divested slower-growth infrastructure business in 2021.',
  GS: 'Premier investment bank — earns fees from M&A advisory, underwriting, trading, and asset management for corporations and institutions.',
  BAC: 'America\'s second-largest bank — retail banking for ~70M consumers, investment banking, wealth management (Merrill Lynch), and corporate banking.',
  WFC: 'Major US retail bank with 70M customers. Recovering from the 2016 fake accounts scandal — strong mortgage lending and consumer banking.',
  C: 'Global bank operating in 160+ countries — earns through institutional banking, treasury services, and consumer banking in key markets.',
  MS: 'Leading investment bank and wealth manager (E*TRADE) — earns through trading, M&A advisory, equity underwriting, and $6T AUM.',
  BLK: 'World\'s largest asset manager with $10T+ AUM — operates iShares (world\'s largest ETF provider) and Aladdin risk management platform.',
  SPY: 'SPDR S&P 500 ETF — passive fund tracking the S&P 500 index, holding all 500 largest US companies proportionally.',
  QQQ: 'Invesco QQQ ETF — tracks the Nasdaq-100 index of the 100 largest non-financial Nasdaq companies, heavily weighted to technology.',
  DIA: 'SPDR Dow Jones ETF — tracks the Dow Jones Industrial Average, holding 30 large-cap blue-chip US companies.',
}

async function getFundamentalsFromFinnhub(ticker: string): Promise<FMPFundamentals | null> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return null
  const base = 'https://finnhub.io/api/v1'
  try {
    const [quoteRes, profileRes, metricsRes] = await Promise.all([
      fetch(`${base}/quote?symbol=${ticker}&token=${apiKey}`, { cache: 'no-store' }),
      fetch(`${base}/stock/profile2?symbol=${ticker}&token=${apiKey}`, { cache: 'no-store' }),
      fetch(`${base}/stock/metric?symbol=${ticker}&metric=all&token=${apiKey}`, { cache: 'no-store' }),
    ])
    if (!quoteRes.ok || !profileRes.ok || !metricsRes.ok) return null
    const [quote, profile, metricsData] = await Promise.all([
      quoteRes.json() as Promise<FinnhubQuote>,
      profileRes.json() as Promise<FinnhubProfile>,
      metricsRes.json() as Promise<FinnhubMetrics>,
    ])
    if (!quote?.c || !profile?.name) return null

    const m = metricsData?.metric ?? {}
    const grossMargin = m.grossMarginTTM ?? 0
    const revenueGrowth = m.revenueGrowthTTMYoy ?? 0
    // FCF margin proxy: net margin since Finnhub free doesn't expose FCF margin directly
    const fcfMargin = m.netProfitMarginTTM ?? 0
    const roe = m.roeTTM ?? 0
    const debtEquity = m['totalDebt/totalEquityAnnual'] ?? 0
    const pe = m.peTTM ?? 0
    const dividendYield = (m.dividendPerShareAnnual ?? 0) > 0 && quote.c > 0
      ? ((m.dividendPerShareAnnual ?? 0) / quote.c) * 100 : 0

    const metrics = { revenueGrowth, grossMargin, fcfMargin, roe, debtEquity }

    // Derive sector from Finnhub industry (rough mapping)
    const industry = profile.finnhubIndustry || 'Unknown'
    const sectorMap: Record<string, string> = {
      Technology: 'Technology', 'Semiconductors': 'Technology',
      Financials: 'Financials', Banks: 'Financials',
      Healthcare: 'Healthcare', 'Pharmaceuticals, Biotechnology & Life Sciences': 'Healthcare',
      'Consumer Discretionary': 'Consumer Discretionary',
      'Consumer Staples': 'Consumer Staples',
      Energy: 'Energy', Utilities: 'Utilities',
      Industrials: 'Industrials', Materials: 'Materials',
      'Real Estate': 'Real Estate', 'Communication Services': 'Communication Services',
    }
    const sector = sectorMap[industry] ?? 'Unknown'

    // Finnhub marketCapitalization is in millions
    const marketCap = (profile.marketCapitalization ?? 0) * 1_000_000

    const result: FMPFundamentals = {
      ticker, name: profile.name, sector, industry,
      description: COMPANY_DESCRIPTIONS[ticker],
      logoUrl: profile.logo ?? undefined,
      website: profile.weburl ?? undefined,
      price: quote.c,
      change: quote.dp,
      marketCap,
      pe: Math.round(pe * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      grossMargin: Math.round(grossMargin * 10) / 10,
      fcfMargin: Math.round(fcfMargin * 10) / 10,
      roe: Math.round(roe * 10) / 10,
      debtEquity: Math.round(debtEquity * 100) / 100,
      dividendYield: Math.round(dividendYield * 100) / 100,
      beta: m.beta != null ? Math.round(m.beta * 100) / 100 : undefined,
      score: calcScore(metrics),
      source: 'fmp',
      updatedAt: new Date().toISOString(),
    }
    return result
  } catch { return null }
}

function calcScore(p: {
  revenueGrowth: number
  grossMargin: number
  fcfMargin: number
  roe: number
  debtEquity: number
}): number {
  let score = 50
  if (p.revenueGrowth > 30) score += 15
  else if (p.revenueGrowth > 15) score += 10
  else if (p.revenueGrowth > 5) score += 5
  else if (p.revenueGrowth < -10) score -= 10
  else if (p.revenueGrowth < 0) score -= 5

  if (p.grossMargin > 70) score += 12
  else if (p.grossMargin > 50) score += 8
  else if (p.grossMargin > 30) score += 4
  else if (p.grossMargin < 10) score -= 8

  if (p.fcfMargin > 25) score += 10
  else if (p.fcfMargin > 10) score += 6
  else if (p.fcfMargin < 0) score -= 10

  if (p.roe > 30) score += 8
  else if (p.roe > 15) score += 5
  else if (p.roe < 0) score -= 8

  if (p.debtEquity < 0.3) score += 5
  else if (p.debtEquity > 3) score -= 5

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ─── EDGAR (SEC XBRL) gap-filler ─────────────────────────────────────────────
// FMP free tier gets 429-throttled, leaving the key margin fields at 0. SEC's XBRL
// company-facts API is free + unthrottled, so we use it to backfill missing pillars.

/** True when the result's headline fundamentals are all zero/missing (FMP gave us nothing usable). */
function fundamentalsAreEmpty(f: FMPFundamentals | null): boolean {
  if (!f) return true
  return !f.revenueGrowth && !f.grossMargin && !f.roe && !f.fcfMargin
}

/**
 * Fill any zero/missing pillar on `base` with the SEC EDGAR value, then recompute the score.
 * Only gaps are filled — existing non-zero FMP/Finnhub numbers are left untouched.
 * `base` may be null (FMP + Finnhub both failed); in that case we build a fresh object.
 */
async function fillFromEdgar(
  ticker: string,
  base: FMPFundamentals | null,
): Promise<FMPFundamentals | null> {
  const edgar = await fetchEdgarFundamentals(ticker)
  if (!edgar) return base

  const start: FMPFundamentals = base ?? {
    ticker, name: ticker, sector: 'Unknown', industry: 'Unknown',
    description: COMPANY_DESCRIPTIONS[ticker],
    price: 0, change: 0, marketCap: 0, pe: 0, revenueGrowth: 0,
    grossMargin: 0, fcfMargin: 0, roe: 0, debtEquity: 0, dividendYield: 0,
    score: 50, source: 'fallback', updatedAt: new Date().toISOString(),
  }

  // Fill only where the existing value is missing/zero (keep good FMP data).
  const merged: FMPFundamentals = {
    ...start,
    name: start.name && start.name !== ticker ? start.name : (edgar.name ?? start.name),
    revenueGrowth: start.revenueGrowth || edgar.revenueGrowth || 0,
    grossMargin: start.grossMargin || edgar.grossMargin || 0,
    fcfMargin: start.fcfMargin || edgar.fcfMargin || 0,
    roe: start.roe || edgar.roe || 0,
    debtEquity: start.debtEquity || edgar.debtEquity || 0,
    updatedAt: new Date().toISOString(),
  }

  // Recompute the score from the now-filled metrics.
  merged.score = calcScore({
    revenueGrowth: merged.revenueGrowth,
    grossMargin: merged.grossMargin,
    fcfMargin: merged.fcfMargin,
    roe: merged.roe,
    debtEquity: merged.debtEquity,
  })

  return merged
}

export async function getFundamentalsForTicker(
  ticker: string,
  supabaseClient?: SupabaseClient,
): Promise<FMPFundamentals> {
  const fallback: FMPFundamentals = {
    ticker, name: ticker, sector: 'Unknown', industry: 'Unknown',
    price: 0, change: 0, marketCap: 0, pe: 0, revenueGrowth: 0,
    grossMargin: 0, fcfMargin: 0, roe: 0, debtEquity: 0, dividendYield: 0,
    score: 50, source: 'fallback', updatedAt: new Date().toISOString(),
  }

  // Check DB cache first
  if (supabaseClient) {
    try {
      const cached = await getCachedFundamentals(supabaseClient, ticker)
      if (cached) return cached as FMPFundamentals
    } catch {
      // Cache read failed — fall through to live fetch
    }
  }

  const apiKey = process.env.FMP_API_KEY ?? ''
  if (!apiKey) {
    // No FMP key: serve pre-computed scores, then backfill margins/growth from EDGAR.
    const scores = await scoresFallback(ticker, supabaseClient) ?? fallback
    return await fillFromEdgar(ticker, scores) ?? scores
  }

  const [profiles, incomes, balances, cashflows] = await Promise.all([
    fmpFetch<FMPProfile>(`profile?symbol=${ticker}`, apiKey),
    fmpFetch<FMPIncome>(`income-statement?symbol=${ticker}&period=annual&limit=2`, apiKey),
    fmpFetch<FMPBalanceSheet>(`balance-sheet-statement?symbol=${ticker}&period=annual&limit=1`, apiKey),
    fmpFetch<FMPCashFlow>(`cash-flow-statement?symbol=${ticker}&period=annual&limit=1`, apiKey),
  ])

  const profile = profiles?.[0]
  const income0 = incomes?.[0]
  const income1 = incomes?.[1]
  const balance = balances?.[0]
  const cashflow = cashflows?.[0]

  // FMP failed (rate limit, plan limit, etc.) — try Finnhub, then EDGAR-fill, then DB.
  if (!profile || !income0) {
    const finnhubData = await getFundamentalsFromFinnhub(ticker)
    if (finnhubData) {
      // Finnhub free tier can leave pillars at 0 too — backfill any gaps from EDGAR.
      const filled = fundamentalsAreEmpty(finnhubData)
        ? (await fillFromEdgar(ticker, finnhubData) ?? finnhubData)
        : finnhubData
      writeFundamentalsCache(ticker, filled).catch(() => undefined)
      return filled
    }
    // Both FMP and Finnhub failed — try EDGAR alone, then fall back to DB scores.
    const scores = await scoresFallback(ticker, supabaseClient)
    const edgarOnly = await fillFromEdgar(ticker, scores)
    if (edgarOnly && !fundamentalsAreEmpty(edgarOnly)) {
      writeFundamentalsCache(ticker, edgarOnly).catch(() => undefined)
      return edgarOnly
    }
    return scores ?? fallback
  }

  const revenue = income0.revenue || 1
  const grossMargin = income0.grossProfit != null ? (income0.grossProfit / revenue) * 100 : 0
  const fcfMargin = cashflow?.freeCashFlow != null ? (cashflow.freeCashFlow / revenue) * 100 : 0
  const roe = balance?.totalStockholdersEquity
    ? (income0.netIncome / balance.totalStockholdersEquity) * 100 : 0
  const debtEquity = balance?.totalStockholdersEquity
    ? (balance.totalDebt || 0) / Math.abs(balance.totalStockholdersEquity) : 0
  const revenueGrowth = income1?.revenue
    ? ((income0.revenue - income1.revenue) / Math.abs(income1.revenue)) * 100 : 0
  const pe = income0.eps && income0.eps > 0 ? profile.price / income0.eps : 0
  const dividendYield = profile.lastDividend && profile.price
    ? (profile.lastDividend / profile.price) * 100 : 0

  const metrics = { revenueGrowth, grossMargin, fcfMargin, roe, debtEquity }

  const result: FMPFundamentals = {
    ticker,
    name: profile.companyName,
    sector: profile.sector || 'Unknown',
    industry: profile.industry || 'Unknown',
    price: profile.price,
    change: profile.changePercentage,
    marketCap: profile.marketCap,
    pe: Math.round(pe * 10) / 10,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    grossMargin: Math.round(grossMargin * 10) / 10,
    fcfMargin: Math.round(fcfMargin * 10) / 10,
    roe: Math.round(roe * 10) / 10,
    debtEquity: Math.round(debtEquity * 100) / 100,
    dividendYield: Math.round(dividendYield * 100) / 100,
    beta: profile.beta != null ? Math.round(profile.beta * 100) / 100 : undefined,
    score: calcScore(metrics),
    source: 'fmp',
    updatedAt: new Date().toISOString(),
  }

  // FMP responded but the headline fundamentals came back empty (throttled/partial data).
  // Backfill the missing pillars from SEC EDGAR so scores aren't stale/blank.
  const finalResult = fundamentalsAreEmpty(result)
    ? (await fillFromEdgar(ticker, result) ?? result)
    : result

  // Write to DB in background — don't await
  writeFundamentalsCache(ticker, finalResult).catch(() => undefined)

  return finalResult
}

// ─── Fallback: build FMPFundamentals from pre-computed stock_q7_scores ────────
// Used when FMP is rate-limited or unavailable. Keeps the page alive from DB.

async function scoresFallback(
  ticker: string,
  supabase?: SupabaseClient,
): Promise<import('@/app/api/fmp/fundamentals/route').FMPFundamentals | null> {
  // Only used for display (stock page when all data sources fail).
  // Returns null for pipeline scoring — zeroed financials corrupt the scoring algorithm.
  // The score-stocks cron checks source !== 'fallback', so we must return null here
  // to prevent it from scoring with zero fundamentals.
  if (!supabase) return null
  try {
    const { data } = await supabase
      .from('stock_q7_scores')
      .select('ticker, name, sector, industry, price, market_cap')
      .eq('ticker', ticker)
      .single()
    if (!data) return null
    const d = data as { ticker: string; name: string; sector: string; industry: string; price: number | null; market_cap: number | null }
    // Return source: 'fallback' so callers that check for it (score-stocks) bail out.
    // Only the display layer renders this gracefully.
    return {
      ticker: d.ticker,
      name: d.name ?? ticker,
      sector: d.sector ?? 'Unknown',
      industry: d.industry ?? 'Unknown',
      price: d.price ?? 0,
      change: 0,
      marketCap: d.market_cap ?? 0,
      pe: 0, revenueGrowth: 0, grossMargin: 0, fcfMargin: 0,
      roe: 0, debtEquity: 0, dividendYield: 0,
      score: 50, source: 'fallback', updatedAt: new Date().toISOString(),
    }
  } catch { return null }
}

// ─── RSI / SMA helpers ───────────────────────────────────────────────────────

function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period
}

function calcRSI14(closes: number[]): number | null {
  if (closes.length < 15) return null
  const recent = closes.slice(-15)
  let gains = 0, losses = 0
  for (let i = 1; i < recent.length; i++) {
    const d = recent[i] - recent[i - 1]
    if (d > 0) gains += d; else losses += Math.abs(d)
  }
  const avgGain = gains / 14
  const avgLoss = losses / 14
  if (avgLoss === 0) return 100
  return Math.round(100 - 100 / (1 + avgGain / avgLoss))
}

function pctChange(closes: number[], daysBack: number): number | null {
  if (closes.length <= daysBack) return null
  const start = closes[closes.length - 1 - daysBack]
  const end = closes[closes.length - 1]
  if (start === 0) return null
  return ((end - start) / start) * 100
}

// ─── FRED macro data (free, no rate limit) ───────────────────────────────────

export async function fetchFredMacro(fredApiKey: string): Promise<MacroInput | null> {
  try {
    const base = 'https://api.stlouisfed.org/fred/series/observations'
    const get = (id: string) =>
      fetch(`${base}?series_id=${id}&api_key=${fredApiKey}&file_type=json&limit=2&sort_order=desc`, { cache: 'no-store' })
        .then(r => r.json())
        .then((d: { observations?: Array<{ value: string }> }) =>
          parseFloat(d.observations?.find(o => o.value !== '.')?.value ?? '0'))
        .catch(() => 0)
    const [fedRate, cpi, tenYearYield, yieldCurve, unemployment] = await Promise.all([
      get('FEDFUNDS'), get('CPIAUCSL'), get('DGS10'), get('T10Y2Y'), get('UNRATE'),
    ])
    return { fedRate, cpi, tenYearYield, yieldCurve, unemployment }
  } catch { return null }
}

// ─── FMP sector performance ───────────────────────────────────────────────────

export async function fetchSectorPerformance(fmpApiKey: string): Promise<Map<string, SectorInput>> {
  const map = new Map<string, SectorInput>()
  try {
    const res = await fetch(`${FMP_BASE}/sector-performance?apikey=${fmpApiKey}`, { cache: 'no-store' })
    if (!res.ok) return map
    const data = await res.json() as Array<{ sector: string; changesPercentage: number }>
    if (!Array.isArray(data)) return map
    const sorted = [...data].sort((a, b) => b.changesPercentage - a.changesPercentage)
    data.forEach((s, idx) => {
      map.set(s.sector.toLowerCase(), {
        sectorChangePct1d: s.changesPercentage,
        sectorRank: sorted.findIndex(x => x.sector === s.sector) + 1,
      })
    })
  } catch { /* return empty */ }
  return map
}

// ─── Quant signals from price history ────────────────────────────────────────

export async function fetchQuantInputs(ticker: string, fmpApiKey: string): Promise<QuantInput | null> {
  try {
    const res = await fetch(
      `${FMP_BASE}/historical-price-eod/light?symbol=${ticker}&limit=260&apikey=${fmpApiKey}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    type PriceRow = { date: string; close: number; volume: number }
    const raw = await res.json() as PriceRow[] | { historical?: PriceRow[] }

    // FMP returns either array directly or nested under 'historical'
    const rows: PriceRow[] = (Array.isArray(raw) ? raw : raw.historical ?? [])
      .sort((a: PriceRow, b: PriceRow) => a.date.localeCompare(b.date)) // oldest→newest

    if (rows.length < 20) return null

    const closes = rows.map((r: { date: string; close: number; volume: number }) => r.close)
    const volumes = rows.map((r: { date: string; close: number; volume: number }) => r.volume)
    const price = closes[closes.length - 1]

    const sma20 = calcSMA(closes, 20) ?? undefined
    const sma50 = calcSMA(closes, 50) ?? undefined
    const sma200 = calcSMA(closes, 200) ?? undefined
    const rsi14 = calcRSI14(closes) ?? undefined

    const avgVol = calcSMA(volumes, 20) ?? 0
    const lastVol = volumes[volumes.length - 1]
    const volumeRatio20d = avgVol > 0 ? lastVol / avgVol : undefined

    return {
      price,
      sma20,
      sma50,
      sma200,
      rsi14,
      momentum1m: pctChange(closes, 21) ?? undefined,
      momentum3m: pctChange(closes, 63) ?? undefined,
      momentum6m: pctChange(closes, 126) ?? undefined,
      volumeRatio20d,
    }
  } catch { return null }
}

// ─── Insider transactions (net buying in USD over last N days) ───────────────

export async function fetchInsiderNet(
  ticker: string,
  fmpApiKey: string,
  days = 90,
): Promise<Pick<SentimentInput, 'insiderNetBuyingUsd'>> {
  try {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    const res = await fetch(
      `${FMP_BASE}/insider-trading?symbol=${ticker}&limit=50&apikey=${fmpApiKey}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return {}
    const rows = await res.json() as Array<{
      transactionDate: string
      transactionType: string
      securitiesTransacted: number
      price: number
    }>
    if (!Array.isArray(rows)) return {}

    let net = 0
    for (const r of rows) {
      if (r.transactionDate < cutoff) continue
      const value = (r.securitiesTransacted ?? 0) * (r.price ?? 0)
      const type = (r.transactionType ?? '').toLowerCase()
      if (type.includes('purchase') || type.includes('buy') || type === 'p-purchase') {
        net += value
      } else if (type.includes('sale') || type.includes('sell') || type === 's-sale') {
        net -= value
      }
    }
    return { insiderNetBuyingUsd: net }
  } catch { return {} }
}

// ─── Analyst consensus + price targets ───────────────────────────────────────

export async function fetchAnalystConsensus(
  ticker: string,
  fmpApiKey: string,
): Promise<Pick<SentimentInput, 'analystBuyPct' | 'analystAvgPtUpside'>> {
  try {
    const [recRes, ptRes, profileRes] = await Promise.all([
      fetch(`${FMP_BASE}/analyst-recommendations?symbol=${ticker}&limit=1&apikey=${fmpApiKey}`, { cache: 'no-store' }),
      fetch(`${FMP_BASE}/price-target-consensus?symbol=${ticker}&apikey=${fmpApiKey}`, { cache: 'no-store' }),
      fetch(`${FMP_BASE}/profile?symbol=${ticker}&apikey=${fmpApiKey}`, { cache: 'no-store' }),
    ])

    const result: Pick<SentimentInput, 'analystBuyPct' | 'analystAvgPtUpside'> = {}

    if (recRes.ok) {
      const recs = await recRes.json() as Array<{
        strongBuy: number; buy: number; hold: number; sell: number; strongSell: number
      }>
      const r = recs?.[0]
      if (r) {
        const total = (r.strongBuy ?? 0) + (r.buy ?? 0) + (r.hold ?? 0) + (r.sell ?? 0) + (r.strongSell ?? 0)
        if (total > 0) {
          result.analystBuyPct = Math.round(((r.strongBuy + r.buy) / total) * 100)
        }
      }
    }

    if (ptRes.ok && profileRes.ok) {
      const ptData = await ptRes.json() as { targetConsensus?: number }
      const profiles = await profileRes.json() as Array<{ price: number }>
      const price = profiles?.[0]?.price
      const target = ptData?.targetConsensus
      if (price && price > 0 && target && target > 0) {
        result.analystAvgPtUpside = Math.round(((target - price) / price) * 100)
      }
    }

    return result
  } catch { return {} }
}

// ─── Earnings calendar + surprise history ────────────────────────────────────

export async function fetchEarningsData(
  ticker: string,
  fmpApiKey: string,
): Promise<Partial<CatalystInput>> {
  try {
    const [surprisesRes, calRes] = await Promise.all([
      fetch(`${FMP_BASE}/earnings-surprises?symbol=${ticker}&limit=8&apikey=${fmpApiKey}`, { cache: 'no-store' }),
      fetch(`${FMP_BASE}/earnings-calendar?symbol=${ticker}&limit=2&apikey=${fmpApiKey}`, { cache: 'no-store' }),
    ])

    const result: Partial<CatalystInput> = {}

    if (surprisesRes.ok) {
      const surprises = await surprisesRes.json() as Array<{
        date: string
        actualEarningResult: number
        estimatedEarning: number
      }>
      if (Array.isArray(surprises) && surprises.length > 0) {
        const last = surprises[0]
        result.lastEarningsBeat = last.actualEarningResult >= last.estimatedEarning
        let streak = 0
        for (const s of surprises) {
          if (s.actualEarningResult >= s.estimatedEarning) streak++
          else break
        }
        result.earningsBeatStreak = streak
      }
    }

    if (calRes.ok) {
      const cal = await calRes.json() as Array<{ date: string }>
      if (Array.isArray(cal) && cal.length > 0) {
        const upcoming = cal.filter(e => new Date(e.date) > new Date())
        if (upcoming.length > 0) {
          const next = new Date(upcoming[0].date)
          result.daysToNextEarnings = Math.round((next.getTime() - Date.now()) / 86_400_000)
        }
      }
    }

    return result
  } catch { return {} }
}
