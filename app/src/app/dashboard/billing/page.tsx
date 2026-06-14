import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/queries'
import BillingClient from '@/components/billing/billing-client'

export default async function BillingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getProfile(supabase, user.id)

  return (
    <BillingClient
      userId={user.id}
      email={user.email ?? ''}
      profile={profile}
    />
  )
}
