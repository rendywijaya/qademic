import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from './admin'

// ─── Read helpers (use regular client — RLS allows auth reads) ────────────────

export async function getCachedFundamentals(
  supabase: SupabaseClient,
  ticker: string,
): Promise<unknown | null> {
  const maxAge = 24 * 60 * 60 * 1000 // 24h
  try {
    const { data } = await supabase
      .from('fundamentals_cache')
      .select('data, updated_at')
      .eq('ticker', ticker)
      .single()
    if (!data) return null
    if (Date.now() - new Date(data.updated_at as string).getTime() > maxAge) return null
    return data.data
  } catch {
    return null
  }
}

export async function getCachedMarketSnapshot(
  supabase: SupabaseClient,
): Promise<Array<Record<string, unknown>> | null> {
  const maxAge = 30 * 60 * 1000 // 30min
  try {
    const { data } = await supabase
      .from('market_snapshot')
      .select('*')
      .order('symbol')
    if (!data || data.length === 0) return null
    const oldest = Math.min(
      ...(data as Array<Record<string, unknown>>).map(
        r => new Date(r.updated_at as string).getTime(),
      ),
    )
    if (Date.now() - oldest > maxAge) return null
    return data as Array<Record<string, unknown>>
  } catch {
    return null
  }
}

export async function getCachedMacroSnapshot(
  supabase: SupabaseClient,
): Promise<Array<Record<string, unknown>> | null> {
  const maxAge = 24 * 60 * 60 * 1000
  try {
    const { data } = await supabase.from('macro_snapshot').select('*')
    if (!data || data.length === 0) return null
    const oldest = Math.min(
      ...(data as Array<Record<string, unknown>>).map(
        r => new Date(r.updated_at as string).getTime(),
      ),
    )
    if (Date.now() - oldest > maxAge) return null
    return data as Array<Record<string, unknown>>
  } catch {
    return null
  }
}

export async function getCachedPriceHistory(
  supabase: SupabaseClient,
  ticker: string,
): Promise<Array<{ date: string; close: number; volume: number }> | null> {
  const maxAge = 24 * 60 * 60 * 1000
  try {
    const { data } = await supabase
      .from('price_history_cache')
      .select('data, updated_at')
      .eq('ticker', ticker)
      .single()
    if (!data) return null
    if (Date.now() - new Date(data.updated_at as string).getTime() > maxAge) return null
    return data.data as Array<{ date: string; close: number; volume: number }>
  } catch {
    return null
  }
}

export async function getCachedAIOutput(
  supabase: SupabaseClient,
  cacheKey: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('ai_output_cache')
      .select('content, expires_at')
      .eq('cache_key', cacheKey)
      .single()
    if (!data) return null
    if (new Date(data.expires_at as string) < new Date()) return null
    return data.content as string
  } catch {
    return null
  }
}

// ─── Write helpers (use admin client — bypasses RLS) ─────────────────────────

export async function writeFundamentalsCache(
  ticker: string,
  data: unknown,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin
      .from('fundamentals_cache')
      .upsert({ ticker, data, updated_at: new Date().toISOString() })
  } catch {
    // non-fatal — cache write failure must not break the response
  }
}

export async function writeMarketSnapshot(
  rows: Array<{
    symbol: string
    name: string
    price: number
    change_amt: number
    change_pct: number
  }>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin
      .from('market_snapshot')
      .upsert(
        rows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: 'symbol' },
      )
  } catch {
    // non-fatal
  }
}

export async function writeMacroSnapshot(
  rows: Array<Record<string, string>>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin
      .from('macro_snapshot')
      .upsert(
        rows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: 'indicator_id' },
      )
  } catch {
    // non-fatal
  }
}

export async function writePriceHistoryCache(
  ticker: string,
  data: unknown,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin
      .from('price_history_cache')
      .upsert({ ticker, data, updated_at: new Date().toISOString() })
  } catch {
    // non-fatal
  }
}

export async function writeAIOutputCache(
  cacheKey: string,
  content: string,
  ttlMs: number,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const expiresAt = new Date(Date.now() + ttlMs).toISOString()
    await admin
      .from('ai_output_cache')
      .upsert({
        cache_key: cacheKey,
        content,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      })
  } catch {
    // non-fatal
  }
}

// ─── Q7 scores (pre-computed nightly) ───────────────────────────────────────

export interface StoredQ7Score {
  ticker: string
  name: string
  sector: string
  industry: string
  price: number | null
  market_cap: number | null
  setup_score: number
  business_score?: number | null
  timing_score?: number | null
  // Legacy column (NOT NULL + check constraint in DB) — never write it in v3;
  // omitting the key keeps old rows' values and lets new rows take the default.
  recommendation?: string | null
  grade?: string | null
  confidence: number
  score_method: 'algorithmic' | 'ai' | 'hybrid' | null
  q1_score: number | null; q1_title: string | null; q1_analysis: string | null
  q2_score: number | null; q2_title: string | null; q2_analysis: string | null
  q3_score: number | null; q3_title: string | null; q3_analysis: string | null
  q4_score: number | null; q4_title: string | null; q4_analysis: string | null
  q5_score: number | null; q5_title: string | null; q5_analysis: string | null
  q6_score: number | null; q6_title: string | null; q6_analysis: string | null
  q7_score: number | null; q7_title: string | null; q7_analysis: string | null
  verdict: string | null
  scored_at: string
}

export async function getStockQ7Score(
  supabase: SupabaseClient,
  ticker: string,
  maxAgeMs = 26 * 60 * 60 * 1000, // 26h — stale after one missed nightly run
): Promise<StoredQ7Score | null> {
  try {
    const { data } = await supabase
      .from('stock_q7_scores')
      .select('*')
      .eq('ticker', ticker)
      .single()
    if (!data) return null
    if (Date.now() - new Date((data as StoredQ7Score).scored_at).getTime() > maxAgeMs) return null
    return data as StoredQ7Score
  } catch {
    return null
  }
}

export async function getSetupScoreMap(
  supabase: SupabaseClient,
  tickers: string[],
): Promise<Record<string, number>> {
  if (tickers.length === 0) return {}
  try {
    const { data } = await supabase
      .from('stock_q7_scores')
      .select('ticker, setup_score')
      .in('ticker', tickers)
    if (!data) return {}
    return Object.fromEntries(
      (data as Array<{ ticker: string; setup_score: number }>).map(r => [r.ticker, r.setup_score])
    )
  } catch {
    return {}
  }
}

export async function getTopStocks(
  supabase: SupabaseClient,
  limit = 20,
): Promise<StoredQ7Score[]> {
  try {
    const { data } = await supabase
      .from('stock_q7_scores')
      .select('*')
      .order('setup_score', { ascending: false })
      .limit(limit)
    return (data ?? []) as StoredQ7Score[]
  } catch {
    return []
  }
}

export async function upsertStockQ7Score(
  ticker: string,
  record: Omit<StoredQ7Score, 'scored_at'>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const scoredAt = new Date().toISOString()
    await admin
      .from('stock_q7_scores')
      .upsert({ ...record, scored_at: scoredAt }, { onConflict: 'ticker' })

    // Write daily score snapshot for trend charts — non-fatal if fails
    const today = scoredAt.split('T')[0]
    await admin.from('score_history').upsert({
      ticker,
      scored_date: today,
      setup_score: record.setup_score,
      business_score: record.business_score ?? null,
      timing_score: record.timing_score ?? null,
      recommendation: record.recommendation ?? null,
      grade: record.grade ?? null,
      q1_score: record.q1_score ?? null,
      q2_score: record.q2_score ?? null,
      q3_score: record.q3_score ?? null,
      q4_score: record.q4_score ?? null,
      q5_score: record.q5_score ?? null,
      q6_score: record.q6_score ?? null,
      q7_score: record.q7_score ?? null,
      price: record.price ?? null,
    }, { onConflict: 'ticker,scored_date', ignoreDuplicates: false })
  } catch {
    // non-fatal
  }
}

export async function logAIUsage(
  userId: string | null,
  feature: string,
  model: string,
  cacheHit: boolean,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('ai_usage_log').insert({
      user_id: userId,
      feature,
      model,
      cache_hit: cacheHit,
    })
  } catch {
    // non-fatal
  }
}

// ─── Stock signals (computed nightly from OHLCV) ─────────────────────────────

export interface StockSignals {
  ticker: string
  sma_20: number | null; sma_50: number | null; sma_200: number | null
  price: number | null
  price_vs_sma20: number | null; price_vs_sma50: number | null; price_vs_sma200: number | null
  momentum_1m: number | null; momentum_3m: number | null
  momentum_6m: number | null; momentum_12m: number | null
  rsi_14: number | null; atr_14: number | null
  volume_avg_20: number | null; volume_ratio: number | null
  quant_score: number | null
  computed_at: string
}

export async function getStockSignals(
  supabase: SupabaseClient,
  ticker: string,
): Promise<StockSignals | null> {
  try {
    const { data } = await supabase
      .from('stock_signals')
      .select('*')
      .eq('ticker', ticker)
      .single()
    return data as StockSignals | null
  } catch { return null }
}

export async function upsertStockSignals(
  ticker: string,
  record: Omit<StockSignals, 'computed_at'>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('stock_signals')
      .upsert({ ...record, computed_at: new Date().toISOString() }, { onConflict: 'ticker' })
  } catch { /* non-fatal */ }
}

// ─── Universe rankings (percentile vs all stocks) ────────────────────────────

export interface UniverseRanking {
  ticker: string; sector: string | null
  rsi_pct: number | null; momentum_1m_pct: number | null; momentum_3m_pct: number | null
  momentum_6m_pct: number | null; momentum_12m_pct: number | null
  sector_rsi_pct: number | null; sector_mom_3m_pct: number | null
  setup_score_pct: number | null
  ranked_at: string
}

export async function getUniverseRanking(
  supabase: SupabaseClient,
  ticker: string,
): Promise<UniverseRanking | null> {
  try {
    const { data } = await supabase
      .from('universe_rankings')
      .select('*')
      .eq('ticker', ticker)
      .single()
    return data as UniverseRanking | null
  } catch { return null }
}

export async function upsertUniverseRankings(
  rows: Array<Omit<UniverseRanking, 'ranked_at'>>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()
    await admin.from('universe_rankings').upsert(
      rows.map(r => ({ ...r, ranked_at: now })),
      { onConflict: 'ticker' }
    )
  } catch { /* non-fatal */ }
}

// ─── Management scores (Q6) ──────────────────────────────────────────────────

export interface ManagementScore {
  ticker: string; ceo_name: string | null; is_founder_led: boolean | null
  insider_ownership_pct: number | null
  roic_1yr: number | null; roic_3yr_avg: number | null; roic_5yr_avg: number | null
  roic_trend: string | null; fcf_conversion: number | null; debt_trend: string | null
  capital_alloc_score: number | null; mgmt_score: number | null
  scored_at: string
}

export async function getManagementScore(
  supabase: SupabaseClient,
  ticker: string,
): Promise<ManagementScore | null> {
  try {
    const { data } = await supabase.from('management_scores').select('*').eq('ticker', ticker).single()
    return data as ManagementScore | null
  } catch { return null }
}

export async function upsertManagementScore(
  ticker: string,
  record: Omit<ManagementScore, 'scored_at'>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('management_scores')
      .upsert({ ...record, scored_at: new Date().toISOString() }, { onConflict: 'ticker' })
  } catch { /* non-fatal */ }
}

// ─── Forensic signals (earnings quality) ────────────────────────────────────

export interface ForensicSignals {
  ticker: string
  accruals_ratio: number | null; accruals_flag: boolean | null
  receivables_growth: number | null; revenue_growth: number | null; rev_vs_receivables_flag: boolean | null
  gross_margin_delta: number | null; gross_margin_flag: boolean | null
  beneish_m_score: number | null; beneish_flag: boolean | null
  overall_flag: string | null; forensic_score: number | null
  scored_at: string
}

export async function getForensicSignals(
  supabase: SupabaseClient,
  ticker: string,
): Promise<ForensicSignals | null> {
  try {
    const { data } = await supabase.from('forensic_signals').select('*').eq('ticker', ticker).single()
    return data as ForensicSignals | null
  } catch { return null }
}

export async function upsertForensicSignals(
  ticker: string,
  record: Omit<ForensicSignals, 'scored_at'>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('forensic_signals')
      .upsert({ ...record, scored_at: new Date().toISOString() }, { onConflict: 'ticker' })
  } catch { /* non-fatal */ }
}

// ─── Institutional holdings (13F) ────────────────────────────────────────────

export interface InstitutionalHolding {
  ticker: string; fund_name: string; cik: string | null; quarter: string
  shares: number | null; value_usd: number | null; change_shares: number | null
  change_type: string | null; filed_at: string | null
}

export async function getInstitutionalHoldings(
  supabase: SupabaseClient,
  ticker: string,
  limit = 10,
): Promise<InstitutionalHolding[]> {
  try {
    const { data } = await supabase
      .from('institutional_holdings')
      .select('*')
      .eq('ticker', ticker)
      .order('quarter', { ascending: false })
      .order('value_usd', { ascending: false })
      .limit(limit)
    return (data ?? []) as InstitutionalHolding[]
  } catch { return [] }
}

export async function upsertInstitutionalHoldings(
  rows: InstitutionalHolding[],
): Promise<void> {
  if (rows.length === 0) return
  try {
    const admin = createAdminClient()
    await admin.from('institutional_holdings').upsert(rows, { onConflict: 'ticker,fund_name,quarter' })
  } catch { /* non-fatal */ }
}

// ─── Stock alerts ─────────────────────────────────────────────────────────────

export interface StockAlert {
  id?: string; ticker: string; alert_type: string; severity: string
  title: string; body: string; source_url?: string | null
  metadata?: Record<string, unknown> | null; generated_at?: string; expires_at?: string | null
}

export async function getRecentAlerts(
  supabase: SupabaseClient,
  ticker?: string,
  limit = 20,
): Promise<StockAlert[]> {
  try {
    let q = supabase
      .from('stock_alerts')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit)
    if (ticker) q = q.eq('ticker', ticker)
    const { data } = await q
    return (data ?? []) as StockAlert[]
  } catch { return [] }
}

export async function insertStockAlert(
  alert: Omit<StockAlert, 'id' | 'generated_at'>,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('stock_alerts').insert({
      ...alert,
      generated_at: new Date().toISOString(),
    })
  } catch { /* non-fatal */ }
}

export async function insertSecFiling(filing: {
  id: string; ticker: string; filing_type: string; title: string | null
  filed_at: string; period_of_report?: string | null; url?: string | null
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('sec_filings').upsert(
      { ...filing, is_processed: false },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  } catch { /* non-fatal */ }
}
