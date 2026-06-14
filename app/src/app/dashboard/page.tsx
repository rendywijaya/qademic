import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile, getWatchlist } from '@/lib/supabase/queries'
import { getSetupScoreMap, getRecentAlerts, type StockAlert } from '@/lib/supabase/cache'
import { GET as getMarketData } from '@/app/api/market-data/route'
import type { MarketItem } from '@/app/api/market-data/route'
import {
  Bell, ArrowRight, Clock, AlertCircle,
  TrendingUp, TrendingDown, Activity,
} from 'lucide-react'
import StockSearchBar from '@/components/dashboard/stock-search-bar'

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function hoursAgoISO(hours: number) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

function SetupScorePill({ score }: { score: number | undefined }) {
  if (score === undefined) {
    return (
      <div className="text-[10px] px-2 py-0.5 rounded"
        style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--surface-2)', color: 'var(--text-ghost)' }}>
        SETUP: —/100
      </div>
    )
  }
  const color = score >= 70 ? 'var(--positive)' : score >= 50 ? 'var(--amber)' : 'var(--negative)'
  const bg = score >= 70 ? 'rgba(16,185,129,0.10)' : score >= 50 ? 'var(--amber-dim)' : 'rgba(248,113,113,0.10)'
  return (
    <div className="text-[10px] px-2 py-0.5 rounded border"
      style={{ fontFamily: 'var(--font-mono)', color, backgroundColor: bg, borderColor: `${color}30` }}>
      SETUP: {score}/100
    </div>
  )
}

async function fetchMarket(): Promise<MarketItem[]> {
  try {
    const res = await getMarketData()
    return await res.json() as MarketItem[]
  } catch {
    return []
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profile, watchlist, market, { data: regime }, { data: activeTheses }] = await Promise.all([
    user ? getProfile(supabase, user.id) : Promise.resolve(null),
    user ? getWatchlist(supabase, user.id) : Promise.resolve([]),
    fetchMarket(),
    supabase
      .from('regime_daily')
      .select('date, state, exposure_multiplier, total, trend_score, breadth_score, vol_score, credit_score, curve_score')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('theses').select('ticker').eq('status', 'active'),
  ])

  const displayName = profile?.full_name ?? (user?.email?.split('@')[0] ?? 'Investor')

  // Batch-fetch Setup Scores + recent alerts in parallel
  const watchlistTickers = watchlist.map(w => w.ticker)
  const thesisTickers = [...new Set((activeTheses ?? []).map(t => t.ticker as string))]
  const [setupScores, dbAlerts, { data: thesisAlertRows }] = await Promise.all([
    getSetupScoreMap(supabase, watchlistTickers),
    getRecentAlerts(supabase, undefined, 5),
    thesisTickers.length > 0
      ? supabase
          .from('stock_alerts')
          .select('ticker, alert_type, title, body, generated_at')
          .in('ticker', thesisTickers)
          .like('alert_type', 'thesis%')
          .gte('generated_at', hoursAgoISO(48))
          .order('generated_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as Array<{ ticker: string; alert_type: string; title: string; body: string; generated_at: string }> }),
  ])
  const thesisAlerts = thesisAlertRows ?? []

  const regimeMeta = regime
    ? ({
        risk_on:  { label: 'RISK-ON',  color: '#10B981', note: 'Full sizing on new theses' },
        neutral:  { label: 'NEUTRAL',  color: '#F59E0B', note: 'Half sizing on new theses' },
        risk_off: { label: 'RISK-OFF', color: '#F87171', note: 'No new thesis entries' },
      } as const)[regime.state as 'risk_on' | 'neutral' | 'risk_off']
    : null

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Greeting */}
      <div>
        <div className="flex items-center gap-2 text-[10px] mb-1.5 uppercase tracking-[0.1em] th-text-ghost"
          style={{ fontFamily: 'var(--font-mono)' }}>
          <Activity className="w-3.5 h-3.5" />
          <span>{formatDate()}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold th-text">
          {getGreeting()}, {displayName}
        </h1>
        <p className="text-sm mt-1 th-text-dim">Your investment intelligence for today.</p>
      </div>

      {/* ── REGIME — should I be taking risk today? ── */}
      {regime && regimeMeta && (
        <Link href="/flows" className="block rounded-lg border px-4 py-3 transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.06)]"
          style={{ borderColor: `${regimeMeta.color}40`, backgroundColor: `${regimeMeta.color}08` }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-bold tracking-[0.12em]"
                style={{ fontFamily: 'var(--font-mono)', color: regimeMeta.color }}>
                REGIME: {regimeMeta.label} · {Number(regime.exposure_multiplier).toFixed(1)}×
              </span>
              <span className="text-xs th-text-dim">{regimeMeta.note}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[9px] tabular-nums"
              style={{ fontFamily: 'var(--font-mono)' }}>
              {([
                ['TREND', regime.trend_score], ['BREADTH', regime.breadth_score], ['VOL', regime.vol_score],
                ['CREDIT', regime.credit_score], ['CURVE', regime.curve_score],
              ] as Array<[string, number]>).map(([label, v]) => (
                <span key={label} style={{ color: v > 0 ? '#10B981' : v < 0 ? '#F87171' : '#6B7280' }}>
                  {label} {v > 0 ? '+1' : v < 0 ? '−1' : '0'}
                </span>
              ))}
              <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-ghost)' }} />
            </div>
          </div>
        </Link>
      )}

      {/* ── THESIS ALERTS — what needs your attention ── */}
      {thesisAlerts.length > 0 && (
        <section className="rounded-lg border p-4"
          style={{ borderColor: 'rgba(248,113,113,0.35)', backgroundColor: 'rgba(248,113,113,0.05)' }}>
          <div className="text-[10px] uppercase tracking-[0.15em] mb-3 flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-mono)', color: '#F87171' }}>
            <AlertCircle className="w-3.5 h-3.5" />
            YOUR THESES NEED REVIEW
          </div>
          <div className="space-y-2.5">
            {thesisAlerts.map((a, i) => (
              <div key={i} className="text-xs leading-relaxed th-text-dim">
                <span className="font-bold th-text" style={{ fontFamily: 'var(--font-mono)' }}>{a.ticker}</span>
                {' · '}{a.title.replace(`${a.ticker}: `, '')}
              </div>
            ))}
          </div>
          <Link href="/dashboard/theses" className="inline-flex items-center gap-1 mt-3 text-[11px] font-bold"
            style={{ fontFamily: 'var(--font-mono)', color: '#F59E0B' }}>
            REVIEW THESES <ArrowRight className="w-3 h-3" />
          </Link>
        </section>
      )}

      {/* ── STOCK SEARCH ── */}
      <section className="rounded-xl border p-5"
        style={{ borderColor: 'rgba(245,158,11,0.20)', backgroundColor: 'rgba(245,158,11,0.03)' }}>
        <div className="text-[9px] uppercase tracking-[0.18em] mb-3"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}>
          Q7 ANALYSIS · ENTER ANY TICKER
        </div>
        <StockSearchBar />
        <div className="flex flex-wrap gap-2 mt-3">
          {['AAPL','NVDA','MSFT','GOOGL','TSLA','AMZN','META','JPM'].map(t => (
            <Link key={t} href={`/dashboard/stocks/${t}`}
              className="text-[11px] font-bold px-2.5 py-1 rounded-md border transition-all"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', borderColor: 'var(--border)' }}>
              {t}
            </Link>
          ))}
        </div>
      </section>

      {/* ── MARKET TODAY ── */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.15em] th-text-ghost border-b mb-4 pb-2 flex items-center justify-between"
          style={{ fontFamily: 'var(--font-mono)', borderColor: 'rgba(245,158,11,0.15)' }}>
          <span>MARKET TODAY</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ backgroundColor: 'var(--positive)' }} />
            {market.length > 0 ? 'LIVE' : 'LOADING'}
          </span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {(market.length > 0 ? market : [
            { symbol: 'SPY',  name: 'S&P 500',   price: '—', change: 0, changePercent: 0 },
            { symbol: 'QQQ',  name: 'NASDAQ',     price: '—', change: 0, changePercent: 0 },
            { symbol: 'GLD',  name: 'Gold',       price: '—', change: 0, changePercent: 0 },
            { symbol: 'BTC',  name: 'Bitcoin',    price: '—', change: 0, changePercent: 0 },
            { symbol: 'VIX',  name: 'Volatility', price: '—', change: 0, changePercent: 0 },
            { symbol: 'DXY',  name: 'USD Index',  price: '—', change: 0, changePercent: 0 },
          ] as MarketItem[]).map((m) => {
            const up = m.changePercent >= 0
            return (
              <div key={m.symbol}
                className="border rounded-lg p-3.5 th-border"
                style={{ backgroundColor: 'transparent' }}>
                <div className="text-[9px] uppercase tracking-[0.12em] mb-1.5 th-text-ghost"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  {m.name}
                </div>
                <div className="text-base font-bold tabular-nums mb-0.5 th-text"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  {m.price}
                </div>
                <div className="text-[10px] tabular-nums flex items-center gap-1"
                  style={{ fontFamily: 'var(--font-mono)', color: up ? 'var(--positive)' : 'var(--negative)' }}>
                  {m.price !== '—' && (up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
                  {m.price !== '—' ? `${up ? '+' : ''}${m.changePercent.toFixed(2)}%` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── TWO COLUMNS: Alerts + Watchlist ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* My Alerts */}
        <section>
          <div className="flex items-center justify-between border-b mb-4 pb-2"
            style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
            <span className="text-[10px] uppercase tracking-[0.15em] th-text-ghost"
              style={{ fontFamily: 'var(--font-mono)' }}>MY ALERTS</span>
            <Link href="/dashboard/alerts"
              className="text-[10px] flex items-center gap-1"
              style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
              ALL <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {dbAlerts.length > 0 ? dbAlerts.map((alert: StockAlert) => {
              const dotColor = alert.severity === 'warning' ? 'var(--negative)'
                : alert.severity === 'positive' ? 'var(--positive)' : 'var(--amber)'
              const timeStr = alert.generated_at
                ? new Date(alert.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : '—'
              return (
                <Link key={alert.id} href={`/dashboard/stocks/${alert.ticker}`}>
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border th-border card-hover"
                    style={{ backgroundColor: 'transparent' }}>
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold th-text mr-2" style={{ fontFamily: 'var(--font-mono)' }}>
                        {alert.ticker}
                      </span>
                      <div className="text-[11px] th-text-dim leading-relaxed mt-0.5">{alert.body}</div>
                    </div>
                    <div className="text-[9px] th-text-ghost shrink-0 flex items-center gap-1"
                      style={{ fontFamily: 'var(--font-mono)' }}>
                      <Clock className="w-3 h-3" />
                      {timeStr}
                    </div>
                  </div>
                </Link>
              )
            }) : (
              <div className="flex items-center gap-3 p-4 rounded-lg border th-border"
                style={{ backgroundColor: 'transparent' }}>
                <AlertCircle className="w-4 h-4 th-text-ghost shrink-0" />
                <p className="text-xs th-text-dim">
                  {watchlist.length === 0
                    ? 'Add stocks to your watchlist to receive alerts for filings, insider trades, and options flow.'
                    : 'No alerts yet. Alerts are generated nightly from your watchlist filings, insider buys, and score changes.'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* My Watchlist with real Setup Scores */}
        <section>
          <div className="flex items-center justify-between border-b mb-4 pb-2"
            style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
            <span className="text-[10px] uppercase tracking-[0.15em] th-text-ghost"
              style={{ fontFamily: 'var(--font-mono)' }}>MY WATCHLIST</span>
            <Link href="/dashboard/watchlist"
              className="text-[10px] flex items-center gap-1"
              style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
              MANAGE <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {watchlist.length === 0 ? (
            <div className="border rounded-lg p-6 text-center th-border" style={{ backgroundColor: 'transparent' }}>
              <Bell className="w-8 h-8 mx-auto mb-3 th-text-ghost" />
              <p className="text-sm font-semibold th-text mb-1">No stocks tracked yet</p>
              <p className="text-xs th-text-dim mb-4">Add stocks to see your personalised morning brief.</p>
              <Link href="/dashboard/watchlist"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'var(--amber)', color: '#050810' }}>
                Add stocks <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {watchlist.slice(0, 6).map((item) => (
                <Link key={item.ticker} href={`/dashboard/stocks/${item.ticker}`}>
                  <div className="flex items-center gap-3 p-3.5 rounded-lg border th-border card-hover"
                    style={{ backgroundColor: 'transparent' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ backgroundColor: 'var(--surface-2)', color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                      {item.ticker.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold th-text" style={{ fontFamily: 'var(--font-mono)' }}>
                        {item.ticker}
                      </div>
                      <div className="text-[11px] th-text-dim truncate">{item.company_name ?? ''}</div>
                    </div>
                    <div className="shrink-0">
                      <SetupScorePill score={setupScores[item.ticker]} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── MARKET TODAY DEEP LINKS ── */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.15em] th-text-ghost border-b mb-4 pb-2"
          style={{ fontFamily: 'var(--font-mono)', borderColor: 'rgba(245,158,11,0.15)' }}>
          DEEP DIVE
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/macro',   label: 'Macro',    desc: 'Fed, rates, yields, VIX',          color: '#A78BFA' },
            { href: '/dashboard/sectors', label: 'Sectors',  desc: 'Rotation, sector strength',         color: '#38BDF8' },
            { href: '/dashboard/insider', label: 'Insider',  desc: 'Who is buying their own stock',     color: '#FB7185' },
            { href: '/flows',             label: 'Flows',    desc: 'Where capital is rotating',         color: '#F59E0B' },
          ].map((c) => (
            <Link key={c.href} href={c.href}
              className="rounded-lg border p-4 transition-all th-border"
              style={{ backgroundColor: 'transparent' }}>
              <div className="text-xs font-bold mb-1" style={{ color: c.color }}>{c.label}</div>
              <div className="text-[11px] th-text-ghost leading-relaxed">{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
