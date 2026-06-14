'use server'

import { createClient } from '@/lib/supabase/server'
import {
  upsertPortfolioHolding,
  removePortfolioHolding as dbRemoveHolding,
} from '@/lib/supabase/queries'
import { revalidatePath } from 'next/cache'

export async function addOrUpdateHolding(
  ticker: string,
  companyName: string | null,
  shares: number,
  avgCost: number,
  notes?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!ticker || shares <= 0 || avgCost <= 0) {
    return { success: false, error: 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const result = await upsertPortfolioHolding(supabase, user.id, {
    ticker,
    company_name: companyName,
    shares,
    avg_cost: avgCost,
    notes,
  })

  if (!result) return { success: false, error: 'Failed to save holding' }

  revalidatePath('/dashboard/portfolio')
  return { success: true }
}

export async function deleteHolding(
  ticker: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const ok = await dbRemoveHolding(supabase, user.id, ticker)
  if (ok) revalidatePath('/dashboard/portfolio')
  return { success: ok }
}
