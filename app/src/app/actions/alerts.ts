'use server'

import { createClient } from '@/lib/supabase/server'
import { createAlert, deleteAlert } from '@/lib/supabase/queries'
import { revalidatePath } from 'next/cache'
import type { PriceAlert } from '@/lib/supabase/types'

const TICKER_RE = /^[A-Z.]{1,10}$/

export async function createPriceAlert(
  ticker: string,
  companyName: string | null,
  targetPrice: number,
  direction: 'above' | 'below'
): Promise<{ success: boolean; alert: PriceAlert | null; error?: string }> {
  if (!TICKER_RE.test(ticker.toUpperCase())) {
    return { success: false, alert: null, error: 'Invalid ticker symbol.' }
  }
  if (!isFinite(targetPrice) || targetPrice <= 0) {
    return { success: false, alert: null, error: 'Target price must be greater than zero.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, alert: null, error: 'Not authenticated.' }

  const alert = await createAlert(supabase, user.id, {
    ticker: ticker.toUpperCase(),
    company_name: companyName,
    target_price: targetPrice,
    direction,
  })

  if (alert) {
    revalidatePath('/dashboard/alerts')
  }

  return { success: !!alert, alert }
}

export async function deletePriceAlert(
  alertId: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const ok = await deleteAlert(supabase, user.id, alertId)
  if (ok) {
    revalidatePath('/dashboard/alerts')
  }
  return { success: ok }
}
