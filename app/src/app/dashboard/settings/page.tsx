import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile, getUserSettings } from '@/lib/supabase/queries'
import type { Profile, UserSettings } from '@/lib/supabase/types'
import SettingsClient from '@/components/settings/settings-client'

export const metadata = { title: 'Settings — Qademic' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profile, userSettings] = await Promise.all([
    getProfile(supabase, user.id),
    getUserSettings(supabase, user.id),
  ])

  const defaultSettings: Omit<UserSettings, 'user_id' | 'updated_at'> = {
    theme: 'dark',
    notifications_enabled: true,
    email_digest: true,
    risk_tolerance: 'moderate',
    investment_style: 'blend',
  }

  const resolvedSettings = userSettings
    ? {
        theme: userSettings.theme,
        notifications_enabled: userSettings.notifications_enabled,
        email_digest: userSettings.email_digest,
        risk_tolerance: userSettings.risk_tolerance,
        investment_style: userSettings.investment_style,
      }
    : defaultSettings

  const resolvedProfile: Profile = profile ?? {
    id: user.id,
    username: null,
    full_name: null,
    avatar_url: null,
    bio: null,
    subscription_tier: 'free',
    subscription_status: 'active',
    onboarding_completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <SettingsClient
      email={user.email ?? ''}
      profile={resolvedProfile}
      settings={resolvedSettings}
    />
  )
}
