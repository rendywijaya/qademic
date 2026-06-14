'use server'

import { createClient } from '@/lib/supabase/server'
import { updateProfile, updateUserSettings } from '@/lib/supabase/queries'
import { revalidatePath } from 'next/cache'

export async function saveProfile(data: {
  full_name: string
  username: string
  bio: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const result = await updateProfile(supabase, user.id, {
    full_name: data.full_name.trim() || null,
    username: data.username.trim() || null,
    bio: data.bio.trim() || null,
  })

  if (!result) return { success: false, error: 'Failed to save profile' }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function saveUserSettings(data: {
  notifications_enabled: boolean
  email_digest: boolean
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive'
  investment_style: 'value' | 'growth' | 'quant' | 'blend'
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Try update first; if no row exists, upsert
  const { data: existing } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('user_id', user.id)
    .single()

  let result
  if (existing) {
    result = await updateUserSettings(supabase, user.id, data)
  } else {
    const { data: inserted } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id, ...data })
      .select()
      .single()
    result = inserted
  }

  if (!result) return { success: false, error: 'Failed to save settings' }

  revalidatePath('/dashboard/settings')
  return { success: true }
}
