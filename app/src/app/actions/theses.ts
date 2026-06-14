'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Thesis cards (QADEMIC.md §4) — written BEFORE entry, watched after.

export interface KillCondition {
  kind: 'quant' | 'qual'
  description: string
  triggered_at?: string | null
}

export interface Thesis {
  id: string
  ticker: string
  theme: string | null
  status: 'watching' | 'active' | 'closed'
  claim: string
  priced_in: string | null
  kill_conditions: KillCondition[]
  trend_failsafe: boolean
  size_tier: 'starter' | 'standard' | 'high_conviction' | null
  entry_date: string | null
  entry_price: number | null
  exit_date: string | null
  exit_price: number | null
  outcome_pct: number | null
  followed_plan: boolean | null
  review_notes: string | null
  business_score_at_entry: number | null
  timing_score_at_entry: number | null
  regime_at_entry: string | null
  created_at: string
}

type Result = { success: boolean; error?: string }

const TICKER_RE = /^[A-Z.\-]{1,10}$/

export async function createThesis(input: {
  ticker: string
  theme: string
  claim: string
  pricedIn: string
  killConditions: KillCondition[]
  sizeTier: Thesis['size_tier']
}): Promise<Result> {
  const ticker = input.ticker.trim().toUpperCase()
  if (!TICKER_RE.test(ticker)) return { success: false, error: 'Invalid ticker' }
  if (input.claim.trim().length < 20) {
    return { success: false, error: 'Write the claim properly — one paragraph on what must become true' }
  }
  if (input.killConditions.filter(k => k.description.trim()).length === 0) {
    return { success: false, error: 'At least one kill condition is required — define where you are wrong BEFORE entering' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('theses').insert({
    user_id: user.id,
    ticker,
    theme: input.theme.trim() || null,
    claim: input.claim.trim(),
    priced_in: input.pricedIn.trim() || null,
    kill_conditions: input.killConditions.filter(k => k.description.trim()),
    size_tier: input.sizeTier,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/theses')
  return { success: true }
}

export async function activateThesis(
  id: string,
  entry: { date: string; price: number },
): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!entry.date || !(entry.price > 0)) return { success: false, error: 'Entry date and price required' }

  // Snapshot scores + regime at entry — attribution depends on this being honest
  const { data: thesisRow } = await supabase.from('theses').select('ticker').eq('id', id).single()
  let scores: { business_score: number | null; timing_score: number | null } | null = null
  if (thesisRow) {
    const { data } = await supabase
      .from('stock_q7_scores')
      .select('business_score, timing_score')
      .eq('ticker', thesisRow.ticker)
      .maybeSingle()
    scores = data
  }
  const { data: regime } = await supabase
    .from('regime_daily')
    .select('state')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase
    .from('theses')
    .update({
      status: 'active',
      entry_date: entry.date,
      entry_price: entry.price,
      business_score_at_entry: scores?.business_score ?? null,
      timing_score_at_entry: scores?.timing_score ?? null,
      regime_at_entry: regime?.state ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/theses')
  return { success: true }
}

export async function closeThesis(
  id: string,
  exit: { date: string; price: number; followedPlan: boolean; reviewNotes: string },
): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!exit.date || !(exit.price > 0)) return { success: false, error: 'Exit date and price required' }

  const { data: row } = await supabase
    .from('theses')
    .select('entry_price')
    .eq('id', id)
    .single()

  const outcomePct = row?.entry_price
    ? Math.round(((exit.price - row.entry_price) / row.entry_price) * 10000) / 100
    : null

  const { error } = await supabase
    .from('theses')
    .update({
      status: 'closed',
      exit_date: exit.date,
      exit_price: exit.price,
      outcome_pct: outcomePct,
      followed_plan: exit.followedPlan,
      review_notes: exit.reviewNotes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/theses')
  return { success: true }
}

export async function deleteThesis(id: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('theses').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/theses')
  return { success: true }
}
