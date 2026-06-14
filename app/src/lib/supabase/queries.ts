import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, WatchlistItem, ScreenerHistory, UserSettings, Portfolio, PortfolioHolding, PriceAlert, InvestmentThesis } from './types'

// ─── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) return null
    return data as Profile
  } catch {
    return null
  }
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<Pick<Profile, 'username' | 'full_name' | 'avatar_url' | 'bio' | 'onboarding_completed'>>
): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (error) return null
    return data as Profile
  } catch {
    return null
  }
}

// ─── Screener History ────────────────────────────────────────────────────────

export async function saveScreenerQuery(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  results: unknown[]
): Promise<ScreenerHistory | null> {
  try {
    const { data, error } = await supabase
      .from('screener_history')
      .insert({
        user_id: userId,
        query,
        results,
        result_count: results.length,
      })
      .select()
      .single()
    if (error) return null
    return data as ScreenerHistory
  } catch {
    return null
  }
}

export async function getScreenerHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 5
): Promise<ScreenerHistory[]> {
  try {
    const { data, error } = await supabase
      .from('screener_history')
      .select('id, query, result_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data ?? []) as ScreenerHistory[]
  } catch {
    return []
  }
}

// ─── Watchlist ───────────────────────────────────────────────────────────────

export async function getWatchlist(
  supabase: SupabaseClient,
  userId: string
): Promise<WatchlistItem[]> {
  try {
    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })
    if (error) return []
    return (data ?? []) as WatchlistItem[]
  } catch {
    return []
  }
}

export async function addToWatchlist(
  supabase: SupabaseClient,
  userId: string,
  ticker: string,
  companyName: string
): Promise<WatchlistItem | null> {
  try {
    const { data, error } = await supabase
      .from('watchlists')
      .upsert(
        { user_id: userId, ticker: ticker.toUpperCase(), company_name: companyName },
        { onConflict: 'user_id,ticker' }
      )
      .select()
      .single()
    if (error) return null
    return data as WatchlistItem
  } catch {
    return null
  }
}

export async function removeFromWatchlist(
  supabase: SupabaseClient,
  userId: string,
  ticker: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('user_id', userId)
      .eq('ticker', ticker.toUpperCase())
    return !error
  } catch {
    return false
  }
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export async function getOrCreateDefaultPortfolio(
  supabase: SupabaseClient,
  userId: string
): Promise<Portfolio | null> {
  try {
    const { data: existing } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    if (existing) return existing as Portfolio

    const { data: created, error } = await supabase
      .from('portfolios')
      .insert({ user_id: userId, name: 'My Portfolio' })
      .select()
      .single()
    if (error) return null
    return created as Portfolio
  } catch {
    return null
  }
}

// ─── Portfolio Holdings ───────────────────────────────────────────────────────

export async function getPortfolioHoldings(
  supabase: SupabaseClient,
  userId: string
): Promise<PortfolioHolding[]> {
  try {
    const portfolio = await getOrCreateDefaultPortfolio(supabase, userId)
    if (!portfolio) return []

    const { data, error } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as PortfolioHolding[]
  } catch {
    return []
  }
}

export async function upsertPortfolioHolding(
  supabase: SupabaseClient,
  userId: string,
  holding: { ticker: string; company_name?: string | null; shares: number; avg_cost: number; notes?: string | null }
): Promise<PortfolioHolding | null> {
  try {
    const portfolio = await getOrCreateDefaultPortfolio(supabase, userId)
    if (!portfolio) return null

    const { data, error } = await supabase
      .from('portfolio_holdings')
      .upsert(
        {
          portfolio_id: portfolio.id,
          ticker: holding.ticker.toUpperCase(),
          company_name: holding.company_name ?? null,
          shares: holding.shares,
          avg_cost_usd: holding.avg_cost,
          notes: holding.notes ?? null,
        },
        { onConflict: 'portfolio_id,ticker' }
      )
      .select()
      .single()
    if (error) return null
    return data as PortfolioHolding
  } catch {
    return null
  }
}

export async function removePortfolioHolding(
  supabase: SupabaseClient,
  userId: string,
  ticker: string
): Promise<boolean> {
  try {
    const portfolio = await getOrCreateDefaultPortfolio(supabase, userId)
    if (!portfolio) return false

    const { error } = await supabase
      .from('portfolio_holdings')
      .delete()
      .eq('portfolio_id', portfolio.id)
      .eq('ticker', ticker.toUpperCase())
    return !error
  } catch {
    return false
  }
}

// ─── User Settings ───────────────────────────────────────────────────────────

export async function getUserSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSettings | null> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (error) return null
    return data as UserSettings
  } catch {
    return null
  }
}

export async function updateUserSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: Partial<Omit<UserSettings, 'user_id' | 'updated_at'>>
): Promise<UserSettings | null> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .update(settings)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) return null
    return data as UserSettings
  } catch {
    return null
  }
}

// ─── Price Alerts ─────────────────────────────────────────────────────────────

export async function getAlerts(
  supabase: SupabaseClient,
  userId: string
): Promise<PriceAlert[]> {
  try {
    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as PriceAlert[]
  } catch {
    return []
  }
}

export async function createAlert(
  supabase: SupabaseClient,
  userId: string,
  data: { ticker: string; company_name?: string | null; target_price: number; direction: 'above' | 'below' }
): Promise<PriceAlert | null> {
  try {
    const { data: row, error } = await supabase
      .from('price_alerts')
      .insert({
        user_id: userId,
        ticker: data.ticker.toUpperCase(),
        company_name: data.company_name ?? null,
        target_price: data.target_price,
        direction: data.direction,
      })
      .select()
      .single()
    if (error) return null
    return row as PriceAlert
  } catch {
    return null
  }
}

export async function deleteAlert(
  supabase: SupabaseClient,
  userId: string,
  alertId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('price_alerts')
      .delete()
      .eq('id', alertId)
      .eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}

export async function markAlertTriggered(
  supabase: SupabaseClient,
  userId: string,
  alertId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('price_alerts')
      .update({ triggered: true, triggered_at: new Date().toISOString() })
      .eq('id', alertId)
      .eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}

// ─── Community / Investment Theses ───────────────────────────────────────────

export async function getPublicTheses(
  supabase: SupabaseClient,
  limit = 20,
  offset = 0
): Promise<InvestmentThesis[]> {
  try {
    const { data, error } = await supabase
      .from('investment_theses')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) return []
    return (data ?? []) as InvestmentThesis[]
  } catch {
    return []
  }
}

export async function getUserTheses(
  supabase: SupabaseClient,
  userId: string
): Promise<InvestmentThesis[]> {
  try {
    const { data, error } = await supabase
      .from('investment_theses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as InvestmentThesis[]
  } catch {
    return []
  }
}

export async function createThesis(
  supabase: SupabaseClient,
  userId: string,
  data: {
    ticker: string
    company_name?: string | null
    title: string
    thesis_text: string
    direction: 'bullish' | 'bearish' | 'neutral'
    q7_layers?: string[] | null
    ai_score?: number | null
    ai_feedback?: string | null
    ai_risks?: string[] | null
  }
): Promise<InvestmentThesis | null> {
  try {
    const { data: row, error } = await supabase
      .from('investment_theses')
      .insert({
        user_id: userId,
        ticker: data.ticker.toUpperCase(),
        company_name: data.company_name ?? null,
        title: data.title,
        thesis_text: data.thesis_text,
        direction: data.direction,
        q7_layers: data.q7_layers ?? null,
        ai_score: data.ai_score ?? null,
        ai_feedback: data.ai_feedback ?? null,
        ai_risks: data.ai_risks ?? null,
        is_public: true,
      })
      .select()
      .single()
    if (error) return null
    return row as InvestmentThesis
  } catch {
    return null
  }
}

export async function deleteThesis(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('investment_theses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}

export async function upsertReaction(
  supabase: SupabaseClient,
  userId: string,
  thesisId: string,
  reaction: 'like' | 'insightful' | 'disagree'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('thesis_reactions')
      .upsert(
        { user_id: userId, thesis_id: thesisId, reaction },
        { onConflict: 'thesis_id,user_id' }
      )
    return !error
  } catch {
    return false
  }
}

export async function getReactionCounts(
  supabase: SupabaseClient,
  thesisIds: string[]
): Promise<Record<string, { like: number; insightful: number; disagree: number }>> {
  if (thesisIds.length === 0) return {}
  try {
    const { data, error } = await supabase
      .from('thesis_reactions')
      .select('thesis_id, reaction')
      .in('thesis_id', thesisIds)
    if (error) return {}

    const result: Record<string, { like: number; insightful: number; disagree: number }> = {}
    for (const id of thesisIds) {
      result[id] = { like: 0, insightful: 0, disagree: 0 }
    }
    for (const row of (data ?? [])) {
      const r = row as { thesis_id: string; reaction: 'like' | 'insightful' | 'disagree' }
      if (result[r.thesis_id]) {
        result[r.thesis_id][r.reaction]++
      }
    }
    return result
  } catch {
    return {}
  }
}

export async function getUserReactions(
  supabase: SupabaseClient,
  userId: string,
  thesisIds: string[]
): Promise<Record<string, 'like' | 'insightful' | 'disagree'>> {
  if (thesisIds.length === 0) return {}
  try {
    const { data, error } = await supabase
      .from('thesis_reactions')
      .select('thesis_id, reaction')
      .eq('user_id', userId)
      .in('thesis_id', thesisIds)
    if (error) return {}

    const result: Record<string, 'like' | 'insightful' | 'disagree'> = {}
    for (const row of (data ?? [])) {
      const r = row as { thesis_id: string; reaction: 'like' | 'insightful' | 'disagree' }
      result[r.thesis_id] = r.reaction
    }
    return result
  } catch {
    return {}
  }
}
