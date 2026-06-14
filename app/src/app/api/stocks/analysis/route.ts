import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { gradeFromScores } from '@/lib/grades'
import { getStockQ7Score, upsertStockQ7Score } from '@/lib/supabase/cache'
import {
  scoreQ1, scoreQ2, scoreQ3, scoreQ4, scoreQ5, scoreQ6, scoreQ7,
  calcSetupScore, calcBusinessScore, calcTimingScore, buildTemplateNarrative,
  type MacroInput, type SectorInput, type QuantInput,
  type SentimentInput, type ManagementInput, type CatalystInput,
  type FundamentalInput,
} from '@/lib/scoring'

// ─── Public interfaces (consumed by frontend components — do not remove) ─────

export interface Q5LayerResult {
  score: number
  title: string
  analysis: string
}

export interface Q5StockAnalysis {
  ticker: string
  name: string
  // Every layer is optional: a pillar exists ONLY when its data source did.
  // Missing pillars render as "no data" — never as a fabricated neutral score.
  q1?: Q5LayerResult
  q2?: Q5LayerResult
  q3?: Q5LayerResult
  q4?: Q5LayerResult
  q5?: Q5LayerResult
  q6?: Q5LayerResult
  q7?: Q5LayerResult
  verdict: string
  // Legacy rows only — v3 never produces recommendations (grades + scores instead)
  recommendation?: string | null
  confidence: number
  setupScore?: number
  businessScore?: number
  timingScore?: number
  grade?: string | null
  // true = nightly-scored universe member (full pillar coverage)
  covered?: boolean
  scoreMethod?: 'algorithmic' | 'ai' | 'hybrid'
  updatedAt: string
  fromCache?: boolean
}

// Kept for backward compat — same shape as MacroInput in scoring.ts
export interface MacroContext {
  fedRate: number
  cpi: number
  tenYearYield: number
  yieldCurve: number
  unemployment: number
  vix?: number
  hyOas?: number
}

export interface SectorContext {
  sectorName: string
  sectorChangePct: number
  topSector: string
  topSectorChangePct: number
}

export interface AnalysisInput {
  ticker: string
  name: string
  sector: string
  industry: string
  price: number
  change: number
  marketCap: number
  pe: number
  revenueGrowth: number
  grossMargin: number
  fcfMargin: number
  roe: number
  debtEquity: number
  dividendYield: number
  score: number
  macro?: MacroContext
  sectorCtx?: SectorContext
  // Extended scoring inputs (optional — cron job populates these)
  quantInput?: QuantInput
  sentimentInput?: SentimentInput
  mgmtInput?: ManagementInput
  catalystInput?: CatalystInput
}

// ─── FRED + Sector fetchers (used by cron and this route) ────────────────────

export async function fetchMacroContext(): Promise<MacroContext | undefined> {
  try {
    const FRED = 'https://api.stlouisfed.org/fred/series/observations'
    const key = process.env.FRED_API_KEY
    if (!key) return undefined
    const fetchSeries = (id: string, limit = 2) =>
      fetch(`${FRED}?series_id=${id}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`, { cache: 'no-store' })
        .then(r => r.json())
        .then((d: { observations?: Array<{ value: string }> }) =>
          (d.observations ?? []).filter(o => o.value !== '.').map(o => parseFloat(o.value)))
        .catch(() => [] as number[])
    const [fedRateS, cpiS, tenYearS, curveS, unempS, vixS, hyOasS] = await Promise.all([
      fetchSeries('FEDFUNDS'), fetchSeries('CPIAUCSL', 14), fetchSeries('DGS10'),
      fetchSeries('T10Y2Y'), fetchSeries('UNRATE'), fetchSeries('VIXCLS', 5), fetchSeries('BAMLH0A0HYM2', 5),
    ])
    // CPIAUCSL is an index level — convert to YoY % (observations are monthly, 12 apart)
    const cpi = cpiS.length >= 13 ? ((cpiS[0] / cpiS[12]) - 1) * 100 : 0
    return {
      fedRate: fedRateS[0] ?? 0, cpi, tenYearYield: tenYearS[0] ?? 0,
      yieldCurve: curveS[0] ?? 0, unemployment: unempS[0] ?? 0,
      vix: vixS[0], hyOas: hyOasS[0],
    }
  } catch { return undefined }
}

export async function fetchSectorContextMap(): Promise<Map<string, SectorContext>> {
  const map = new Map<string, SectorContext>()
  try {
    const key = process.env.FMP_API_KEY
    if (!key) return map
    const res = await fetch(`https://financialmodelingprep.com/stable/sector-performance?apikey=${key}`, { cache: 'no-store' })
    if (!res.ok) return map
    const data = await res.json() as Array<{ sector: string; changesPercentage: number }>
    if (!Array.isArray(data)) return map
    const sorted = [...data].sort((a, b) => b.changesPercentage - a.changesPercentage)
    const top = sorted[0]
    for (const s of data) {
      map.set(s.sector, {
        sectorName: s.sector, sectorChangePct: s.changesPercentage,
        topSector: top.sector, topSectorChangePct: top.changesPercentage,
      })
    }
  } catch { /* return empty */ }
  return map
}

// ─── Algorithmic scoring ─────────────────────────────────────────────────────

export function runAlgorithmicScoring(input: AnalysisInput): Q5StockAnalysis {
  // Pillars are scored ONLY when real input data exists — a missing data source
  // produces a missing pillar, never a fabricated neutral score.
  const hasFundamentals =
    input.revenueGrowth !== 0 || input.grossMargin !== 0 || input.fcfMargin !== 0 ||
    input.roe !== 0 || input.debtEquity !== 0 || input.pe > 0

  const q1r = input.macro ? scoreQ1({
    fedRate: input.macro.fedRate, cpi: input.macro.cpi, tenYearYield: input.macro.tenYearYield,
    yieldCurve: input.macro.yieldCurve, unemployment: input.macro.unemployment, vix: input.macro.vix,
  } satisfies MacroInput) : null
  const q2r = input.sectorCtx
    ? scoreQ2({ sectorChangePct1d: input.sectorCtx.sectorChangePct, sectorRank: 5 } satisfies SectorInput)
    : null
  const q3r = hasFundamentals ? scoreQ3({
    revenueGrowth: input.revenueGrowth,
    grossMargin: input.grossMargin,
    fcfMargin: input.fcfMargin,
    roe: input.roe,
    debtEquity: input.debtEquity,
    pe: input.pe > 0 ? input.pe : undefined,
  } satisfies FundamentalInput) : null
  const q4r = input.quantInput ? scoreQ4(input.quantInput) : null
  const q5r = input.sentimentInput ? scoreQ5(input.sentimentInput) : null
  const q6r = input.mgmtInput ? scoreQ6(input.mgmtInput) : null
  const q7r = input.catalystInput ? scoreQ7(input.catalystInput) : null

  // v3: per-stock pillars only — macro (Q1) and sector (Q2) are context, never score inputs
  const setupScore = calcSetupScore({
    q3: q3r?.score, q4: q4r?.score, q5: q5r?.score, q6: q6r?.score, q7: q7r?.score,
  })
  const businessScore = calcBusinessScore({ q3: q3r?.score, q6: q6r?.score })
  const timingScore = calcTimingScore({ q4: q4r?.score, q5: q5r?.score, q7: q7r?.score })
  const grade = businessScore != null && timingScore != null ? gradeFromScores(businessScore, timingScore) : null

  const topSignals = [
    ...(q3r?.signals.slice(0, 1) ?? []),
    ...(q4r?.signals.slice(0, 1) ?? []),
    ...(q5r?.signals.slice(0, 1) ?? []),
  ]
  const scoreLine = [
    businessScore != null ? `Business ${businessScore}` : null,
    timingScore != null ? `Timing ${timingScore}` : null,
    grade != null ? `grade ${grade}` : null,
  ].filter(Boolean).join(', ') || 'insufficient data for scoring'
  const verdict = `${input.name}: ${scoreLine}.${topSignals[0] ? ` ${topSignals[0]}` : ''}${topSignals[1] ? ' ' + topSignals[1] : ''}`

  const confidencePillars = [q3r, q4r, q5r].filter((p): p is NonNullable<typeof p> => p !== null)
  const confidence = confidencePillars.length > 0
    ? Math.round(confidencePillars.reduce((s, p) => s + Math.abs(p.score - 50), 0) / confidencePillars.length) + 40
    : 40

  const layer = (r: { score: number; signals: string[] } | null, title: string, narrativeName: string) =>
    r ? { score: r.score, title, analysis: buildTemplateNarrative(narrativeName, r.signals, r.score) } : undefined

  return {
    ticker: input.ticker,
    name: input.name,
    q1: layer(q1r, 'Macro Context (gates via regime — not in stock score)', 'Macro'),
    q2: layer(q2r, 'Sector Context', 'Sector'),
    q3: layer(q3r, 'Fundamental Quality', 'Fundamental'),
    q4: layer(q4r, 'Technical Positioning', 'Quant'),
    q5: layer(q5r, 'Smart Money Signals', 'Sentiment'),
    q6: layer(q6r, 'Management Quality', 'Management'),
    q7: layer(q7r, 'Catalyst Pipeline', 'Catalyst'),
    verdict,
    confidence: Math.min(95, confidence),
    setupScore: setupScore ?? undefined,
    businessScore: businessScore ?? undefined,
    timingScore: timingScore ?? undefined,
    grade,
    scoreMethod: 'algorithmic',
    updatedAt: new Date().toISOString(),
  }
}

// ─── AI narrative overlay (event-triggered only) ─────────────────────────────

const client = new Anthropic()

export async function runClaudeAnalysis(input: AnalysisInput, algoResult?: Q5StockAnalysis): Promise<Q5StockAnalysis> {
  if (!process.env.ANTHROPIC_API_KEY) return algoResult ?? runAlgorithmicScoring(input)

  const base = algoResult ?? runAlgorithmicScoring(input)

  const macroBlock = input.macro
    ? `\nLIVE MACRO: Fed ${input.macro.fedRate.toFixed(2)}%, CPI ${input.macro.cpi.toFixed(1)}%, Yield Curve ${input.macro.yieldCurve.toFixed(2)}%, Unemployment ${input.macro.unemployment.toFixed(1)}%`
    : ''

  const sectorBlock = input.sectorCtx
    ? `\nSECTOR: ${input.sectorCtx.sectorName} ${input.sectorCtx.sectorChangePct > 0 ? '+' : ''}${input.sectorCtx.sectorChangePct.toFixed(2)}% today`
    : ''

  const algoContext = `
PRE-COMPUTED SCORES (use these exact numbers — do NOT invent new scores):
Q1 Macro: ${base.q1?.score ?? 50}/100 — Key signals: ${base.q1?.analysis ?? 'No data'}
Q2 Sector: ${base.q2?.score ?? 50}/100 — Key signals: ${base.q2?.analysis ?? 'No data'}
Q3 Fundamental: ${base.q3?.score ?? 50}/100 — Key signals: ${base.q3?.analysis ?? 'No data'}
Q4 Quant: ${base.q4?.score ?? 50}/100 — Key signals: ${base.q4?.analysis ?? 'No data'}
Q5 Sentiment: ${base.q5?.score ?? 50}/100 — Key signals: ${base.q5?.analysis ?? 'No data'}
Q6 Management: ${base.q6?.score ?? 50}/100 — Key signals: ${base.q6?.analysis ?? 'No data'}
Q7 Catalyst: ${base.q7?.score ?? 50}/100 — Key signals: ${base.q7?.analysis ?? 'No data'}
Setup Score: ${base.setupScore}/100`

  const prompt = `You are a senior equity analyst at a hedge fund. Write professional, plain-English narrative analysis for ${input.ticker} (${input.name}).

COMPANY DATA:
- Sector: ${input.sector} | Price: $${input.price} | Market Cap: $${(input.marketCap / 1e9).toFixed(1)}B
- Revenue Growth: ${input.revenueGrowth > 0 ? '+' : ''}${input.revenueGrowth.toFixed(1)}% | Gross Margin: ${input.grossMargin.toFixed(1)}% | FCF Margin: ${input.fcfMargin.toFixed(1)}% | ROE: ${input.roe.toFixed(1)}%
${macroBlock}${sectorBlock}
${algoContext}

Using the pre-computed scores above, write ONLY the narrative analysis text (do NOT change scores). Return ONLY valid JSON:
{
  "q1_analysis": "2 crisp sentences on how the current macro regime specifically affects this stock's valuation and earnings",
  "q2_analysis": "2 sentences on sector rotation — is institutional money flowing in or out",
  "q3_analysis": "2 sentences on earnings quality, balance sheet strength, and valuation vs peers",
  "q4_analysis": "2 sentences on price momentum, key technical levels, and factor positioning",
  "q5_analysis": "2 sentences on insider activity, analyst consensus, and smart money positioning",
  "q6_analysis": "2 sentences on management quality, capital allocation track record, and founder-led premium",
  "q7_analysis": "2 sentences on upcoming catalysts and binary events",
  "verdict": "3 sentences: the core investment thesis, the biggest risk, and the single thing to watch"
}

Use specific numbers. No filler. Sound like a hedge fund analyst, not a robo-advisor.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return base

    const text = textBlock.text.trim()
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}') + 1
    if (start === -1) return base

    const parsed = JSON.parse(text.slice(start, end)) as {
      q1_analysis?: string; q2_analysis?: string; q3_analysis?: string
      q4_analysis?: string; q5_analysis?: string; q6_analysis?: string
      q7_analysis?: string; verdict?: string
    }

    return {
      ...base,
      q1: base.q1 ? { ...base.q1, analysis: parsed.q1_analysis ?? base.q1.analysis } : base.q1,
      q2: base.q2 ? { ...base.q2, analysis: parsed.q2_analysis ?? base.q2.analysis } : base.q2,
      q3: base.q3 ? { ...base.q3, analysis: parsed.q3_analysis ?? base.q3.analysis } : base.q3,
      q4: base.q4 ? { ...base.q4, analysis: parsed.q4_analysis ?? base.q4.analysis } : base.q4,
      q5: base.q5 ? { ...base.q5, analysis: parsed.q5_analysis ?? base.q5.analysis } : base.q5,
      q6: base.q6 ? { ...base.q6, analysis: parsed.q6_analysis ?? base.q6.analysis } : base.q6,
      q7: base.q7 ? { ...base.q7, analysis: parsed.q7_analysis ?? base.q7.analysis } : base.q7,
      verdict: parsed.verdict ?? base.verdict,
      scoreMethod: 'hybrid',
      updatedAt: new Date().toISOString(),
    }
  } catch {
    return base
  }
}

// ─── DB → response mapper ─────────────────────────────────────────────────────

function storedToAnalysis(row: NonNullable<Awaited<ReturnType<typeof getStockQ7Score>>>): Q5StockAnalysis {
  return {
    ticker: row.ticker,
    name: row.name,
    q1: { score: row.q1_score ?? 60, title: row.q1_title ?? 'Macro Environment', analysis: row.q1_analysis ?? '' },
    q2: { score: row.q2_score ?? 60, title: row.q2_title ?? 'Sector Momentum', analysis: row.q2_analysis ?? '' },
    q3: { score: row.q3_score ?? 60, title: row.q3_title ?? 'Fundamental Quality', analysis: row.q3_analysis ?? '' },
    q4: { score: row.q4_score ?? 55, title: row.q4_title ?? 'Technical Positioning', analysis: row.q4_analysis ?? '' },
    q5: { score: row.q5_score ?? 55, title: row.q5_title ?? 'Smart Money Signals', analysis: row.q5_analysis ?? '' },
    q6: row.q6_score != null ? { score: row.q6_score, title: row.q6_title ?? 'Management Quality', analysis: row.q6_analysis ?? '' } : undefined,
    q7: row.q7_score != null ? { score: row.q7_score, title: row.q7_title ?? 'Catalyst Pipeline', analysis: row.q7_analysis ?? '' } : undefined,
    verdict: row.verdict ?? '',
    recommendation: row.recommendation ?? null,
    confidence: row.confidence,
    setupScore: row.setup_score,
    businessScore: row.business_score ?? undefined,
    timingScore: row.timing_score ?? undefined,
    scoreMethod: (row.score_method ?? 'algorithmic') as Q5StockAnalysis['scoreMethod'],
    updatedAt: row.scored_at,
    fromCache: true,
  }
}

const TICKER_RE = /^[A-Z.^]{1,10}$/

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const ticker = (sp.get('ticker') ?? '').toUpperCase()

  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  // ── 1. DB cache (pre-computed by nightly cron — fast path) ───────────────
  try {
    const supabase = await createClient()
    const cached = await getStockQ7Score(supabase, ticker)
    if (cached) {
      return NextResponse.json(storedToAnalysis(cached), {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      })
    }
  } catch { /* fall through */ }

  // ── 2. Cache miss — run algorithmic scoring immediately (no AI cost) ─────
  const [macro, sectorsMap] = await Promise.all([
    fetchMacroContext(),
    fetchSectorContextMap(),
  ])

  const sector = sp.get('sector') ?? 'Unknown'
  const sectorCtx = sectorsMap.get(sector)

  const input: AnalysisInput = {
    ticker,
    name: sp.get('name') ?? ticker,
    sector,
    industry: sp.get('industry') ?? 'Unknown',
    price: parseFloat(sp.get('price') ?? '0'),
    change: parseFloat(sp.get('change') ?? '0'),
    marketCap: parseFloat(sp.get('marketCap') ?? '0'),
    pe: parseFloat(sp.get('pe') ?? '0'),
    revenueGrowth: parseFloat(sp.get('revenueGrowth') ?? '0'),
    grossMargin: parseFloat(sp.get('grossMargin') ?? '0'),
    fcfMargin: parseFloat(sp.get('fcfMargin') ?? '0'),
    roe: parseFloat(sp.get('roe') ?? '0'),
    debtEquity: parseFloat(sp.get('debtEquity') ?? '0'),
    dividendYield: parseFloat(sp.get('dividendYield') ?? '0'),
    score: parseInt(sp.get('score') ?? '50'),
    macro,
    sectorCtx,
  }

  const analysis = runAlgorithmicScoring(input)

  // Cache the algorithmic result for future requests
  upsertStockQ7Score(ticker, {
    ticker,
    name: input.name,
    sector: input.sector,
    industry: input.industry,
    price: input.price,
    market_cap: input.marketCap,
    setup_score: analysis.setupScore ?? 50,
    business_score: analysis.businessScore ?? null,
    timing_score: analysis.timingScore ?? null,
    grade: analysis.businessScore != null && analysis.timingScore != null
      ? gradeFromScores(analysis.businessScore, analysis.timingScore)
      : null,
    confidence: analysis.confidence,
    score_method: 'algorithmic',
    q1_score: analysis.q1?.score ?? null, q1_title: analysis.q1?.title ?? null, q1_analysis: analysis.q1?.analysis ?? null,
    q2_score: analysis.q2?.score ?? null, q2_title: analysis.q2?.title ?? null, q2_analysis: analysis.q2?.analysis ?? null,
    q3_score: analysis.q3?.score ?? null, q3_title: analysis.q3?.title ?? null, q3_analysis: analysis.q3?.analysis ?? null,
    q4_score: analysis.q4?.score ?? null, q4_title: analysis.q4?.title ?? null, q4_analysis: analysis.q4?.analysis ?? null,
    q5_score: analysis.q5?.score ?? null, q5_title: analysis.q5?.title ?? null, q5_analysis: analysis.q5?.analysis ?? null,
    q6_score: analysis.q6?.score ?? null, q6_title: analysis.q6?.title ?? null, q6_analysis: analysis.q6?.analysis ?? null,
    q7_score: analysis.q7?.score ?? null, q7_title: analysis.q7?.title ?? null, q7_analysis: analysis.q7?.analysis ?? null,
    verdict: analysis.verdict,
  }).catch(() => undefined)

  return NextResponse.json(analysis, {
    headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' },
  })
}
