import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRecentAlerts, type StockAlert } from '@/lib/supabase/cache'
import Link from 'next/link'
import { Bell, AlertTriangle, TrendingUp, FileText, Building2, ChevronRight, Clock } from 'lucide-react'

export const metadata = {
  title: 'Intelligence Alerts — Qademic',
  description: 'Real-time intelligence alerts for your watchlist: insider buys, SEC filings, score changes, institutional moves.',
}

const ALERT_TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  '8k_filing':       { icon: FileText,    color: '#38BDF8', label: '8-K Filing' },
  'insider_buy':     { icon: TrendingUp,  color: '#10B981', label: 'Insider Buy' },
  'q_score_change':  { icon: Bell,        color: '#F59E0B', label: 'Q7 Score' },
  'institutional_new': { icon: Building2, color: '#A78BFA', label: 'Institutional' },
  'forensic_warning': { icon: AlertTriangle, color: '#F87171', label: 'Forensic Alert' },
  'options_unusual': { icon: TrendingUp,  color: '#FB7185', label: 'Options Flow' },
}

const SEVERITY_DOT: Record<string, string> = {
  critical: '#EF4444', warning: '#F87171', info: '#38BDF8', positive: '#10B981',
}

function timeAgo(ts: string | undefined): string {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function AlertCard({ alert }: { alert: StockAlert }) {
  const config = ALERT_TYPE_CONFIG[alert.alert_type] ?? ALERT_TYPE_CONFIG['8k_filing']
  const Icon = config.icon
  const dotColor = SEVERITY_DOT[alert.severity] ?? '#9CA3AF'

  return (
    <Link href={`/dashboard/stocks/${alert.ticker}`}>
      <div className="flex items-start gap-3 p-4 rounded-lg border transition-all"
        style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'rgba(245,158,11,0.2)'
          el.style.backgroundColor = 'rgba(245,158,11,0.03)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = '#1F2937'
          el.style.backgroundColor = 'transparent'
        }}>
        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: dotColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-xs font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{alert.ticker}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded border"
              style={{ color: config.color, borderColor: `${config.color}30`, backgroundColor: `${config.color}10`, fontFamily: 'var(--font-mono)' }}>
              {config.label}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: '#9CA3AF' }}>{alert.body}</p>
        </div>
        <div className="shrink-0 flex items-center gap-1 text-[9px]" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>
          <Clock className="w-3 h-3" />
          {timeAgo(alert.generated_at)}
        </div>
        <ChevronRight className="w-3 h-3 shrink-0" style={{ color: '#6B7280' }} />
      </div>
    </Link>
  )
}

export default async function IntelligencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch latest 50 intelligence alerts (all types)
  const alerts = await getRecentAlerts(supabase, undefined, 50)

  // Group by type for the filter header counts
  const byType = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.alert_type] = (acc[a.alert_type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.15em] mb-2"
          style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ backgroundColor: '#F59E0B' }} />
          INTELLIGENCE ALERTS · WATCHLIST & UNIVERSE
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Market Intelligence</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
          Real-time signals from SEC filings, insider transactions, Q7 score changes, and institutional moves.
        </p>
      </div>

      {/* Summary chips */}
      {Object.keys(byType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, count]) => {
            const cfg = ALERT_TYPE_CONFIG[type]
            if (!cfg) return null
            return (
              <div key={type} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px]"
                style={{ borderColor: `${cfg.color}25`, backgroundColor: `${cfg.color}08`, color: cfg.color, fontFamily: 'var(--font-mono)' }}>
                {cfg.label}: {count}
              </div>
            )
          })}
        </div>
      )}

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: 'var(--border)' }}>
          <Bell className="w-12 h-12 mx-auto mb-4" style={{ color: '#6B7280' }} />
          <h3 className="text-sm font-bold mb-2" style={{ color: '#9CA3AF' }}>No intelligence alerts yet</h3>
          <p className="text-xs leading-relaxed" style={{ color: '#6B7280', maxWidth: 400, margin: '0 auto' }}>
            Alerts are generated nightly from your watchlist. Add stocks to your watchlist, then the nightly pipelines will
            detect SEC filings, insider transactions, and Q7 score changes automatically.
          </p>
          <div className="mt-6 space-y-2 text-[10px]" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>
            <p>Cron schedule:</p>
            <p>• edgar-filings: every 15min during market hours</p>
            <p>• generate-alerts: daily 1am</p>
            <p>• score-stocks: daily 2am</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-center gap-2 pt-2 border-t text-[9px]"
        style={{ borderColor: 'var(--border)', color: '#6B7280', fontFamily: 'var(--font-mono)' }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
        ALERTS GENERATED BY AUTOMATED PIPELINES · DATA FROM SEC EDGAR + FMP · NOT INVESTMENT ADVICE
      </div>
    </div>
  )
}
