/**
 * Nightly scoring cron — algorithm-first, AI on trigger only.
 *
 * Cost model:
 *   Rule-based scoring:  $0/night (deterministic, no API calls except FMP + FRED)
 *   AI narrative (Pro):  ~2,000 trigger events/night × $0.0015 = ~$3/night = ~$90/month
 *   vs previous:         50 stocks × $0.024/call = ~$1.20/night = ~$36/month (only 50 stocks)
 *   Scale difference:    algorithm runs on ALL stocks; AI fires only on real events
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFundamentalsForTicker, fetchQuantInputs, fetchInsiderNet, fetchAnalystConsensus, fetchEarningsData } from '@/lib/fmp'
import { getManagementScore, upsertStockQ7Score, type StoredQ7Score } from '@/lib/supabase/cache'
import {
  runAlgorithmicScoring, runClaudeAnalysis, fetchMacroContext, fetchSectorContextMap,
  type AnalysisInput, type SectorContext,
} from '@/app/api/stocks/analysis/route'
import { detectTriggers } from '@/lib/scoring'
import { scoreToGrade, gradeFromScores } from '@/lib/grades'

export const maxDuration = 300

const ALWAYS_SCORE = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','BRK.B',
  'JPM','V','JNJ','WMT','XOM','UNH','PG','MA','HD','CVX',
  'MRK','ABBV','KO','PEP','COST','LLY','AVGO','MCD','CSCO',
  'ACN','ADBE','CRM','NFLX','AMD','INTC','QCOM','TXN','INTU',
  'NOW','ORCL','IBM','GS','BAC','WFC','C','MS','BLK',
]

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function scoreOne(
  ticker: string,
  macro: Parameters<typeof runAlgorithmicScoring>[0]['macro'],
  sectorMap: Map<string, SectorContext>,
  fmpKey: string,
  existingScore: Pick<StoredQ7Score, 'setup_score' | 'scored_at'> | null,
): Promise<{ ticker: string; ok: boolean; method?: string; triggered?: boolean }> {
  try {
    const admin = createAdminClient()

    // ── 1. Fetch all data ────────────────────────────────────────────────────
    // Quant signals: read from precomputed stock_signals table (from compute-signals cron)
    // instead of calling FMP historical prices (FMP free tier blocked).
    const { data: signalRow } = await admin
      .from('stock_signals')
      .select('price,sma_20,sma_50,sma_200,price_vs_sma20,price_vs_sma50,price_vs_sma200,rsi_14,momentum_1m,momentum_3m,momentum_6m,momentum_12m,atr_14,volume_avg_20,volume_ratio,quant_score')
      .eq('ticker', ticker)
      .single()

    const dbQuant = signalRow ? {
      price: signalRow.price ?? 0,
      sma20: signalRow.sma_20 ?? undefined,
      sma50: signalRow.sma_50 ?? undefined,
      sma200: signalRow.sma_200 ?? undefined,
      priceVsSma20: signalRow.price_vs_sma20 ?? undefined,
      priceVsSma50: signalRow.price_vs_sma50 ?? undefined,
      priceVsSma200: signalRow.price_vs_sma200 ?? undefined,
      rsi14: signalRow.rsi_14 ?? undefined,
      momentum1m: signalRow.momentum_1m ?? undefined,
      momentum3m: signalRow.momentum_3m ?? undefined,
      momentum6m: signalRow.momentum_6m ?? undefined,
      momentum12m: signalRow.momentum_12m ?? undefined,
      atr14: signalRow.atr_14 ?? undefined,
      volumeAvg20: signalRow.volume_avg_20 ?? undefined,
      volumeRatio: signalRow.volume_ratio ?? undefined,
    } : null

    const [fundamentals, insiderData, analystData, earningsData, mgmtRow] = await Promise.all([
      getFundamentalsForTicker(ticker, admin),
      fetchInsiderNet(ticker, fmpKey, 90),
      fetchAnalystConsensus(ticker, fmpKey),
      fetchEarningsData(ticker, fmpKey),
      getManagementScore(admin, ticker),
    ])

    if (fundamentals.source === 'fallback') return { ticker, ok: false }

    const f = fundamentals
    const sectorCtx = sectorMap.get(f.sector)

    const input: AnalysisInput = {
      ticker: f.ticker, name: f.name, sector: f.sector, industry: f.industry,
      price: f.price, change: f.change, marketCap: f.marketCap, pe: f.pe,
      revenueGrowth: f.revenueGrowth, grossMargin: f.grossMargin, fcfMargin: f.fcfMargin,
      roe: f.roe, debtEquity: f.debtEquity, dividendYield: f.dividendYield, score: f.score,
      macro, sectorCtx,
      quantInput: dbQuant ?? undefined,
      sentimentInput: {
        ...insiderData,
        ...analystData,
      },
      mgmtInput: mgmtRow ? {
        isFounderLed: mgmtRow.is_founder_led ?? undefined,
        insiderOwnershipPct: mgmtRow.insider_ownership_pct ?? undefined,
        roic1yr: mgmtRow.roic_1yr ?? undefined,
        roic3yrAvg: mgmtRow.roic_3yr_avg ?? undefined,
        roicTrend: (mgmtRow.roic_trend as 'improving' | 'stable' | 'declining') ?? undefined,
        debtTrend: (mgmtRow.debt_trend as 'reducing' | 'stable' | 'increasing') ?? undefined,
        precomputedMgmtScore: mgmtRow.mgmt_score ?? undefined,
      } : undefined,
      catalystInput: {
        daysToNextEarnings: earningsData.daysToNextEarnings,
        lastEarningsBeat: earningsData.lastEarningsBeat,
        earningsBeatStreak: earningsData.earningsBeatStreak,
      },
    }

    // ── 2. Algorithmic scoring — always runs, zero AI cost ───────────────────
    const algoResult = runAlgorithmicScoring(input)
    const setupScore = algoResult.setupScore ?? 50

    // ── 3. Detect trigger — should we pay for an AI narrative? ───────────────
    const priceChange1d = f.change

    const trigger = detectTriggers(
      setupScore,
      existingScore ? { setupScore: existingScore.setup_score, scoredAt: existingScore.scored_at } : null,
      earningsData.daysToNextEarnings !== undefined
        ? { daysToNext: earningsData.daysToNextEarnings, justFiled: earningsData.daysToNextEarnings <= 1 }
        : undefined,
      insiderData.insiderNetBuyingUsd,
      priceChange1d,
    )

    // ── 4. Optional AI narrative (event-triggered only) ──────────────────────
    const finalResult = trigger ? await runClaudeAnalysis(input, algoResult) : algoResult
    const method = trigger ? 'hybrid' : 'algorithmic'

    // ── 5. Upsert to DB ──────────────────────────────────────────────────────
    await upsertStockQ7Score(ticker, {
      ticker, name: f.name, sector: f.sector, industry: f.industry,
      price: f.price, market_cap: f.marketCap,
      setup_score: finalResult.setupScore ?? setupScore,
      business_score: finalResult.businessScore ?? null,
      timing_score: finalResult.timingScore ?? null,
      grade: finalResult.businessScore != null && finalResult.timingScore != null
        ? gradeFromScores(finalResult.businessScore, finalResult.timingScore)
        : scoreToGrade(finalResult.setupScore ?? setupScore),
      confidence: finalResult.confidence,
      score_method: method,
      q1_score: finalResult.q1?.score ?? null, q1_title: finalResult.q1?.title ?? null, q1_analysis: finalResult.q1?.analysis ?? null,
      q2_score: finalResult.q2?.score ?? null, q2_title: finalResult.q2?.title ?? null, q2_analysis: finalResult.q2?.analysis ?? null,
      q3_score: finalResult.q3?.score ?? null, q3_title: finalResult.q3?.title ?? null, q3_analysis: finalResult.q3?.analysis ?? null,
      q4_score: finalResult.q4?.score ?? null, q4_title: finalResult.q4?.title ?? null, q4_analysis: finalResult.q4?.analysis ?? null,
      q5_score: finalResult.q5?.score ?? null, q5_title: finalResult.q5?.title ?? null, q5_analysis: finalResult.q5?.analysis ?? null,
      q6_score: finalResult.q6?.score ?? null, q6_title: finalResult.q6?.title ?? null, q6_analysis: finalResult.q6?.analysis ?? null,
      q7_score: finalResult.q7?.score ?? null, q7_title: finalResult.q7?.title ?? null, q7_analysis: finalResult.q7?.analysis ?? null,
      verdict: finalResult.verdict,
    })

    return { ticker, ok: true, method, triggered: !!trigger }
  } catch {
    return { ticker, ok: false }
  }
}

async function processBatch(
  tickers: string[],
  macro: Parameters<typeof runAlgorithmicScoring>[0]['macro'],
  sectorMap: Map<string, SectorContext>,
  fmpKey: string,
  priorScores: Map<string, Pick<StoredQ7Score, 'setup_score' | 'scored_at'>>,
  // Finnhub free tier: 60 calls/min. Each scoreOne makes 3 Finnhub calls → max 3 concurrent
  concurrency = 3,
): Promise<Array<{ ticker: string; ok: boolean; method?: string; triggered?: boolean }>> {
  const results = []
  for (let i = 0; i < tickers.length; i += concurrency) {
    const chunk = tickers.slice(i, i + concurrency)
    const chunkResults = await Promise.all(
      chunk.map(t => scoreOne(t, macro, sectorMap, fmpKey, priorScores.get(t) ?? null))
    )
    results.push(...chunkResults)
    // 3 tickers × 3 Finnhub calls = 9 calls per batch. Sleep 3s between batches = 9 calls/3s = 180/min < limit
    if (i + concurrency < tickers.length) await sleep(3000)
  }
  return results
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fmpKey = process.env.FMP_API_KEY ?? ''
  if (!fmpKey) return NextResponse.json({ error: 'FMP_API_KEY not configured' }, { status: 500 })

  const startedAt = Date.now()
  const admin = createAdminClient()

  // 1. Watchlist tickers
  let watchlistTickers: string[] = []
  try {
    const { data } = await admin.from('watchlist').select('ticker').limit(500)
    if (data) watchlistTickers = [...new Set((data as Array<{ ticker: string }>).map(r => r.ticker))]
  } catch { /* continue */ }

  const all = [...new Set([...watchlistTickers, ...ALWAYS_SCORE])]

  // 2. Load prior scores to detect trigger conditions
  let priorScores = new Map<string, Pick<StoredQ7Score, 'setup_score' | 'scored_at'>>()
  try {
    const { data } = await admin.from('stock_q7_scores').select('ticker, setup_score, scored_at').in('ticker', all)
    if (data) {
      priorScores = new Map(
        (data as Array<Pick<StoredQ7Score, 'ticker' | 'setup_score' | 'scored_at'>>).map(r => [r.ticker, r])
      )
    }
  } catch { /* continue without prior scores */ }

  // 3. Shared macro + sector data once
  const [macro, sectorMap] = await Promise.all([fetchMacroContext(), fetchSectorContextMap()])

  // 4. Process all tickers — algorithm runs for everyone, AI only on triggers
  const results = await processBatch(all, macro, sectorMap, fmpKey, priorScores)

  const scored = results.filter(r => r.ok).length
  const triggered = results.filter(r => r.triggered).length
  const failed = results.filter(r => !r.ok).length

  return NextResponse.json({
    ok: true,
    total: all.length,
    scored,
    triggered,
    failed,
    elapsedMs: Date.now() - startedAt,
    watchlistTickers: watchlistTickers.length,
    scoredAt: new Date().toISOString(),
    costNote: `${triggered} AI calls × ~$0.0015 = ~$${(triggered * 0.0015).toFixed(3)}`,
  })
}
