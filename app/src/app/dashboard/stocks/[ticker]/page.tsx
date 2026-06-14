import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getWatchlist } from '@/lib/supabase/queries'
import { getFundamentalsForTicker } from '@/lib/fmp'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import WatchlistToggle from '@/components/stocks/watchlist-toggle'
import Q7StockAnalysis from '@/components/stocks/q7-stock-analysis'
import StockScoreHero from '@/components/stocks/stock-score-hero'
import ValuationPanel from '@/components/stocks/valuation-panel'

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-US', opts).format(n)
}

function fmtMarketCap(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${fmt(n)}`
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 border-r last:border-r-0"
      style={{ borderColor: 'var(--border)' }}>
      <span className="text-[9px] uppercase tracking-[0.14em]"
        style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums"
        style={{ color: color ?? 'var(--text)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  )
}

const TICKER_RE = /^[A-Z.^]{1,10}$/

interface PageProps {
  params: Promise<{ ticker: string }>
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()

  if (!TICKER_RE.test(ticker)) notFound()

  const supabase = await createClient()
  const fundamentals = await getFundamentalsForTicker(ticker, supabase)

  if (fundamentals.source === 'fallback') {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <div className="text-4xl font-black th-text" style={{ fontFamily: 'var(--font-mono)' }}>
          {ticker}
        </div>
        <p className="th-text-muted text-sm">No data found for this ticker. It may be delisted or invalid.</p>
        <Link href="/dashboard/stocks"
          className="inline-flex items-center gap-2 text-sm"
          style={{ color: 'var(--amber)' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Stocks
        </Link>
      </div>
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  const watchlist = user ? await getWatchlist(supabase, user.id) : []
  const isWatched = watchlist.some(w => w.ticker === ticker)

  const f = fundamentals as FMPFundamentals
  const changePositive = f.change > 0
  const changeNeutral = f.change === 0
  const ChangeIcon = changePositive ? TrendingUp : changeNeutral ? Minus : TrendingDown
  const changeColor = changePositive ? 'var(--positive)' : changeNeutral ? '#9CA3AF' : 'var(--negative)'

  return (
    <div className="max-w-5xl mx-auto animate-fade-up amber-grid-bg" style={{ paddingBottom: 100 }}>

      {/* Back */}
      <div style={{ paddingBottom: 24 }}>
        <Link href="/dashboard/stocks"
          className="inline-flex items-center gap-1.5 text-xs th-text-ghost"
          style={{ fontFamily: 'var(--font-mono)' }}>
          <ArrowLeft className="w-3.5 h-3.5" />
          BACK TO STOCKS
        </Link>
      </div>

      {/* HERO — two-column: ticker info left, score card right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28, alignItems: 'start', paddingBottom: 36 }}>

        {/* Left — ticker, name, price */}
        <div>
          {/* Sector + industry badges */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 4, border: '1px solid rgba(56,189,248,0.25)', color: '#38BDF8', background: 'rgba(56,189,248,0.06)' }}>
              {f.sector}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 4, border: '1px solid rgba(245,158,11,0.2)', color: 'var(--amber)', background: 'var(--amber-dim)' }}>
              {f.industry}
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 52, fontWeight: 800, color: 'var(--amber)', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 4 }}>
            {ticker}
          </h1>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#9CA3AF', marginBottom: 8 }}>{f.name}</p>

          {/* Company description */}
          {f.description && (
            <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 18, maxWidth: 520 }}>
              {f.description}
            </p>
          )}
          {!f.description && (
            <div style={{ marginBottom: 18 }} />
          )}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            ${f.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 20px' }}>
            <ChangeIcon className="w-4 h-4" style={{ color: changeColor }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: changeColor }}>
              {f.change >= 0 ? '+' : ''}{f.change.toFixed(2)}%
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4B5563' }}>TODAY</span>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
            {[
              { label: 'MKT CAP',   value: fmtMarketCap(f.marketCap) },
              { label: 'P/E',       value: f.pe > 0 ? fmt(f.pe, { maximumFractionDigits: 1 }) : '—', color: f.pe > 0 && f.pe < 30 ? '#10B981' : f.pe > 50 ? '#F87171' : undefined },
              { label: 'REV GRW',  value: f.revenueGrowth !== 0 ? `${f.revenueGrowth > 0 ? '+' : ''}${fmt(f.revenueGrowth, { maximumFractionDigits: 1 })}%` : '—', color: f.revenueGrowth > 0 ? '#10B981' : f.revenueGrowth < 0 ? '#F87171' : undefined },
              { label: 'GRS MRG',  value: f.grossMargin !== 0 ? `${fmt(f.grossMargin, { maximumFractionDigits: 1 })}%` : '—', color: f.grossMargin > 40 ? '#10B981' : undefined },
              { label: 'BETA',     value: f.beta != null ? fmt(f.beta, { maximumFractionDigits: 2 }) : '—' },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: '10px 10px', borderRight: '1px solid var(--border)', ...(i === 4 ? { borderRight: 'none' } : {}) }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: s.color ?? 'var(--text)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {user && (
            <div style={{ marginTop: 16 }}>
              <WatchlistToggle ticker={ticker} companyName={f.name} initialWatched={isWatched} />
            </div>
          )}
        </div>

        {/* Right — live score card (fetches analysis, animates bars on load) */}
        <StockScoreHero fundamentals={f} />
      </div>

      {/* Valuation module */}
      <div style={{ marginBottom: 28 }}>
        <ValuationPanel fundamentals={f} />
      </div>

      {/* Full Q7 Analysis */}
      <Q7StockAnalysis fundamentals={f} />

    </div>
  )
}
