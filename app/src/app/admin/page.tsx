import { createAdminClient } from '@/lib/supabase/admin'
import { Users, CreditCard, BookOpen, Bell, Cpu, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div
      className="border rounded-xl p-5 flex items-start gap-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--amber-dim)', border: '1px solid var(--amber-border)' }}
      >
        <Icon className="w-4 h-4" style={{ color: 'var(--amber)' }} />
      </div>
      <div>
        <div
          className="text-[10px] uppercase tracking-[0.12em] mb-1"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          {label}
        </div>
        <div
          className="text-2xl font-bold tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

export default async function AdminOverviewPage() {
  // Stats with fallbacks for missing tables / unconfigured service role key
  let totalUsers = 0
  let activeSubscriptions = 0
  let publicTheses = 0
  let activeAlerts = 0
  let totalAiRequests = 0
  let cacheHits = 0
  let recentSignups: Array<{ id: string; full_name: string | null; created_at: string }> = []
  let configError = false

  try {
    const admin = createAdminClient()

    // Total users
    try {
      const { count } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      totalUsers = count ?? 0
    } catch { /* table might not exist */ }

    // Active subscriptions
    try {
      const { count } = await admin
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
      activeSubscriptions = count ?? 0
    } catch { /* table might not exist */ }

    // Public theses
    try {
      const { count } = await admin
        .from('investment_theses')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
      publicTheses = count ?? 0
    } catch { /* table might not exist */ }

    // Active alerts
    try {
      const { count } = await admin
        .from('price_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('triggered', false)
      activeAlerts = count ?? 0
    } catch { /* table might not exist */ }

    // AI usage
    try {
      const { count: total } = await admin
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
      totalAiRequests = total ?? 0

      const { count: hits } = await admin
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('cache_hit', true)
      cacheHits = hits ?? 0
    } catch { /* ai_usage_log may not exist yet */ }

    // Recent sign-ups
    try {
      const { data } = await admin
        .from('profiles')
        .select('id, full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      recentSignups = (data ?? []) as Array<{ id: string; full_name: string | null; created_at: string }>
    } catch { /* ignore */ }

  } catch {
    configError = true
  }

  const cacheHitRate = totalAiRequests > 0 ? ((cacheHits / totalAiRequests) * 100).toFixed(1) : null

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-black"
          style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
        >
          System Overview
        </h1>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
          QADEMIC ADMIN · READ-ONLY DASHBOARD
        </p>
      </div>

      {configError && (
        <div
          className="border rounded-xl px-4 py-3 text-sm"
          style={{
            borderColor: 'rgba(248,113,113,0.25)',
            backgroundColor: 'rgba(248,113,113,0.06)',
            color: 'var(--negative)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Service role key not configured — showing placeholder stats. Set SUPABASE_SERVICE_ROLE_KEY to enable real data.
        </div>
      )}

      {/* System stats */}
      <section className="space-y-3">
        <div
          className="text-[10px] uppercase tracking-[0.12em] font-semibold"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          SYSTEM OVERVIEW
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Users" value={configError ? '—' : totalUsers.toLocaleString()} icon={Users} />
          <StatCard label="Active Subscriptions" value={configError ? '—' : activeSubscriptions.toLocaleString()} icon={CreditCard} />
          <StatCard label="Public Theses" value={configError ? '—' : publicTheses.toLocaleString()} icon={BookOpen} />
          <StatCard label="Active Alerts" value={configError ? '—' : activeAlerts.toLocaleString()} icon={Bell} />
        </div>
      </section>

      {/* AI Usage */}
      <section className="space-y-3">
        <div
          className="text-[10px] uppercase tracking-[0.12em] font-semibold"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          AI USAGE
        </div>

        {!configError && totalAiRequests === 0 ? (
          <div
            className="border rounded-xl px-5 py-4 text-sm"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            No data yet — run cron jobs to populate ai_usage_log
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total AI Requests" value={configError ? '—' : totalAiRequests.toLocaleString()} icon={Cpu} />
            <StatCard
              label="Cache Hit Rate"
              value={configError ? '—' : cacheHitRate !== null ? `${cacheHitRate}%` : '0%'}
              icon={TrendingUp}
            />
          </div>
        )}
      </section>

      {/* Recent sign-ups */}
      <section className="space-y-3">
        <div
          className="text-[10px] uppercase tracking-[0.12em] font-semibold"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          RECENT SIGN-UPS
        </div>

        <div
          className="border rounded-xl overflow-hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Header */}
          <div
            className="grid px-4 py-2.5 border-b"
            style={{
              gridTemplateColumns: '1fr 180px',
              borderColor: 'var(--border)',
              backgroundColor: 'var(--surface)',
            }}
          >
            {(['NAME', 'JOINED'] as const).map(col => (
              <span
                key={col}
                className="text-[10px] uppercase tracking-[0.10em]"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
              >
                {col}
              </span>
            ))}
          </div>

          {recentSignups.length === 0 ? (
            <div
              className="px-4 py-8 text-center text-sm"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {configError ? 'Service role key required to view users' : 'No users yet'}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {recentSignups.map(user => (
                <div
                  key={user.id}
                  className="grid px-4 py-3 items-center"
                  style={{ gridTemplateColumns: '1fr 180px' }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--text)' }}
                  >
                    {user.full_name ?? 'Anonymous'}
                  </span>
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                  >
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
