import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { SECTOR_BY_TICKER, SECTOR_ETFS, INDEX_ETFS } from '@/lib/data/universe'

// The screener engine (QADEMIC.md §6, AI tier "Parse"): Haiku parses the query
// into a structured filter — the data does the filtering. The universe is never
// stuffed into a prompt, results carry only live computed numbers, and every
// reasoning line is deterministic (real values, no generated claims).

export interface ScreenRow {
  ticker: string
  name: string
  sector: string
  price: number | null
  marketCap: number | null
  momentum1m: number | null
  momentum3m: number | null
  momentum6m: number | null
  momentum12m: number | null
  rsi14: number | null
  vsSma200: number | null
  volumeRatio: number | null
  quantScore: number | null
  // Present only for the scored subset (expands with FMP Premium)
  businessScore: number | null
  timingScore: number | null
  setupScore: number | null
  grade: string | null
}

export interface ScreenFilters {
  sectors?: string[] | null
  minMomentum1m?: number | null
  minMomentum3m?: number | null
  minMomentum12m?: number | null
  maxMomentum3m?: number | null
  minRsi?: number | null
  maxRsi?: number | null
  minVsSma200?: number | null
  maxVsSma200?: number | null
  minMarketCap?: number | null
  maxMarketCap?: number | null
  minBusiness?: number | null
  minTiming?: number | null
  minQuant?: number | null
  grades?: string[] | null
  scoredOnly?: boolean | null
  sortBy?: 'quantScore' | 'momentum3m' | 'momentum12m' | 'timingScore' | 'businessScore' | 'marketCap' | 'rsi14' | null
  sortOrder?: 'asc' | 'desc' | null
  limit?: number | null
}

const ETF_SET = new Set<string>([...SECTOR_ETFS, ...INDEX_ETFS])

export async function loadScreenUniverse(): Promise<ScreenRow[]> {
  const admin = createAdminClient()
  const [{ data: signals }, { data: scores }] = await Promise.all([
    admin
      .from('stock_signals')
      .select('ticker, price, momentum_1m, momentum_3m, momentum_6m, momentum_12m, rsi_14, price_vs_sma200, volume_ratio, quant_score')
      .limit(1000),
    admin
      .from('stock_q7_scores')
      .select('ticker, name, sector, market_cap, business_score, timing_score, setup_score, grade')
      .limit(1000),
  ])

  const scoreMap = new Map((scores ?? []).map(s => [s.ticker as string, s]))

  return (signals ?? [])
    .filter(s => !ETF_SET.has(s.ticker as string)) // stocks only; ETFs live on /flows
    .map(s => {
      const sc = scoreMap.get(s.ticker as string)
      return {
        ticker: s.ticker as string,
        name: (sc?.name as string | undefined) || (s.ticker as string),
        // Scored rows can carry '' or 'Unknown' sectors (vendor gaps) — prefer our static map then
        sector: SECTOR_BY_TICKER[s.ticker as string] || (sc?.sector as string | undefined) || 'Unknown',
        price: s.price as number | null,
        marketCap: (sc?.market_cap as number | null) ?? null,
        momentum1m: s.momentum_1m as number | null,
        momentum3m: s.momentum_3m as number | null,
        momentum6m: s.momentum_6m as number | null,
        momentum12m: s.momentum_12m as number | null,
        rsi14: s.rsi_14 as number | null,
        vsSma200: s.price_vs_sma200 as number | null,
        volumeRatio: s.volume_ratio as number | null,
        quantScore: s.quant_score as number | null,
        businessScore: (sc?.business_score as number | null) ?? null,
        timingScore: (sc?.timing_score as number | null) ?? null,
        setupScore: (sc?.setup_score as number | null) ?? null,
        grade: (sc?.grade as string | null) ?? null,
      }
    })
}

const VALID_SECTORS = new Set(Object.values(SECTOR_BY_TICKER))

export function applyScreenFilters(rows: ScreenRow[], f: ScreenFilters): ScreenRow[] {
  const filtered = rows.filter(r => {
    if (f.sectors?.length && !f.sectors.some(s => r.sector.toLowerCase() === s.toLowerCase())) return false
    if (f.minMomentum1m != null && (r.momentum1m === null || r.momentum1m < f.minMomentum1m)) return false
    if (f.minMomentum3m != null && (r.momentum3m === null || r.momentum3m < f.minMomentum3m)) return false
    if (f.maxMomentum3m != null && (r.momentum3m === null || r.momentum3m > f.maxMomentum3m)) return false
    if (f.minMomentum12m != null && (r.momentum12m === null || r.momentum12m < f.minMomentum12m)) return false
    if (f.minRsi != null && (r.rsi14 === null || r.rsi14 < f.minRsi)) return false
    if (f.maxRsi != null && (r.rsi14 === null || r.rsi14 > f.maxRsi)) return false
    if (f.minVsSma200 != null && (r.vsSma200 === null || r.vsSma200 < f.minVsSma200)) return false
    if (f.maxVsSma200 != null && (r.vsSma200 === null || r.vsSma200 > f.maxVsSma200)) return false
    if (f.minMarketCap != null && (r.marketCap === null || r.marketCap < f.minMarketCap)) return false
    if (f.maxMarketCap != null && (r.marketCap === null || r.marketCap > f.maxMarketCap)) return false
    if (f.minBusiness != null && (r.businessScore === null || r.businessScore < f.minBusiness)) return false
    if (f.minTiming != null && (r.timingScore === null || r.timingScore < f.minTiming)) return false
    if (f.minQuant != null && (r.quantScore === null || r.quantScore < f.minQuant)) return false
    if (f.grades?.length && (r.grade === null || !f.grades.includes(r.grade))) return false
    if (f.scoredOnly && r.businessScore === null) return false
    return true
  })

  const sortBy = f.sortBy ?? 'quantScore'
  const dir = f.sortOrder === 'asc' ? 1 : -1
  filtered.sort((a, b) => {
    const av = a[sortBy] ?? -Infinity
    const bv = b[sortBy] ?? -Infinity
    return (Number(av) - Number(bv)) * dir
  })

  return filtered.slice(0, Math.min(f.limit ?? 25, 50))
}

// Deterministic reasoning — only states numbers that are in the row
export function buildReasoning(r: ScreenRow): string {
  const parts: string[] = []
  if (r.momentum3m !== null) parts.push(`3m ${r.momentum3m >= 0 ? '+' : ''}${r.momentum3m.toFixed(1)}%`)
  if (r.momentum12m !== null) parts.push(`12m ${r.momentum12m >= 0 ? '+' : ''}${r.momentum12m.toFixed(1)}%`)
  if (r.vsSma200 !== null) parts.push(`${Math.abs(r.vsSma200).toFixed(1)}% ${r.vsSma200 >= 0 ? 'above' : 'below'} 200dma`)
  if (r.rsi14 !== null) parts.push(`RSI ${r.rsi14}`)
  if (r.businessScore !== null && r.timingScore !== null) {
    parts.push(`Business ${r.businessScore} · Timing ${r.timingScore}${r.grade ? ` · grade ${r.grade}` : ''}`)
  }
  return parts.join(' · ')
}

const client = new Anthropic()

export async function parseQueryToFilters(query: string): Promise<{ filters: ScreenFilters; explanation: string; aiParsed: boolean }> {
  const fallback = { filters: keywordFilters(query), explanation: `Keyword match for: ${query}`, aiParsed: false }
  if (!process.env.ANTHROPIC_API_KEY) return fallback

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Parse this stock screener query into JSON filters. Query: "${query}"

Fields (all optional, omit if not implied):
- sectors: array from exactly: Technology, Communication Services, Financials, Healthcare, Consumer Cyclical, Consumer Defensive, Energy, Industrials, Basic Materials, Real Estate, Utilities
- minMomentum1m / minMomentum3m / minMomentum12m / maxMomentum3m: % return thresholds
- minRsi / maxRsi: 0-100 ("oversold" → maxRsi 35; "overbought" → minRsi 70)
- minVsSma200 / maxVsSma200: % vs 200-day average ("in uptrend"/"above 200dma" → minVsSma200 0; "not extended" → maxVsSma200 25)
- minMarketCap / maxMarketCap: dollars (mega cap → min 200e9; large → min 10e9)
- minBusiness / minTiming: 0-100 ("quality business" → minBusiness 65; "good entry" → minTiming 65)
- grades: array from A,B,C,D,F ("top setups" → ["A","B"])
- scoredOnly: true if the query needs fundamentals (quality/business/management)
- sortBy: quantScore | momentum3m | momentum12m | timingScore | businessScore | marketCap | rsi14
- sortOrder: asc | desc
- limit: number (default 25)

"momentum" → minMomentum3m 10, sortBy momentum3m. "strong momentum" → minMomentum3m 20.
"winners" → minMomentum12m 20. "beaten down"/"losers" → maxMomentum3m -10.
"dip in uptrend" → minVsSma200 0, maxRsi 45.

Return ONLY JSON: {"explanation":"one sentence","filters":{...}}`,
      }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}') + 1
    if (start === -1) return fallback
    const parsed = JSON.parse(text.slice(start, end)) as { explanation?: string; filters?: ScreenFilters }
    const filters = parsed.filters ?? {}
    // Sanitize sectors against the known set
    if (filters.sectors) filters.sectors = filters.sectors.filter(s => VALID_SECTORS.has(s))
    return { filters, explanation: parsed.explanation ?? `Parsed: ${query}`, aiParsed: true }
  } catch {
    return fallback
  }
}

// No-AI fallback: keyword heuristics producing the same structured filters
export function keywordFilters(query: string): ScreenFilters {
  const q = query.toLowerCase()
  const f: ScreenFilters = { sortBy: 'quantScore', sortOrder: 'desc' }

  const sectorKeywords: Array<[string[], string]> = [
    [['tech', 'software', 'semiconductor', 'chip', 'ai '], 'Technology'],
    [['health', 'pharma', 'biotech', 'medical'], 'Healthcare'],
    [['bank', 'financ', 'insurance', 'payment', 'fintech'], 'Financials'],
    [['energy', 'oil', 'gas'], 'Energy'],
    [['industrial', 'defense', 'aerospace'], 'Industrials'],
    [['retail', 'consumer discretionary', 'travel', 'restaurant'], 'Consumer Cyclical'],
    [['staple', 'food', 'beverage'], 'Consumer Defensive'],
    [['utilit'], 'Utilities'],
    [['real estate', 'reit'], 'Real Estate'],
    [['material', 'mining', 'chemical'], 'Basic Materials'],
    [['media', 'telecom', 'communication'], 'Communication Services'],
  ]
  const sectors = sectorKeywords.filter(([keys]) => keys.some(k => q.includes(k))).map(([, s]) => s)
  if (sectors.length > 0) f.sectors = sectors

  if (q.includes('strong momentum')) f.minMomentum3m = 20
  else if (q.includes('momentum')) f.minMomentum3m = 10
  if (q.includes('winner')) f.minMomentum12m = 20
  if (q.includes('oversold')) { f.maxRsi = 35; f.sortBy = 'rsi14'; f.sortOrder = 'asc' }
  if (q.includes('uptrend') || q.includes('above 200')) f.minVsSma200 = 0
  if (q.includes('beaten') || q.includes('loser')) { f.maxMomentum3m = -10; f.sortBy = 'momentum3m'; f.sortOrder = 'asc' }
  if (q.includes('quality')) { f.minBusiness = 65; f.scoredOnly = true }
  if (q.includes('entry') || q.includes('timing')) { f.minTiming = 60; f.scoredOnly = true }
  if (q.includes('large cap') || q.includes('mega cap')) f.minMarketCap = 10e9

  return f
}
