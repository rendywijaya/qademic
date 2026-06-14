import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAlerts } from '@/lib/supabase/queries'
import AlertsClient from '@/components/alerts/alerts-client'

export const metadata = {
  title: 'Price Alerts — Qademic',
  description: 'Get notified when stocks hit your target price.',
}

export default async function AlertsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const alerts = await getAlerts(supabase, user.id)

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6">
      <AlertsClient alerts={alerts} />
    </div>
  )
}
