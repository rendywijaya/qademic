'use client'

import { useState, useEffect, useCallback, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, RefreshCw, TrendingUp, TrendingDown,
  Sparkles, X, ChevronUp, ChevronDown, ArrowUpDown,
  BarChart3, PieChart, List, Edit2, Loader2, ShieldAlert,
} from 'lucide-react'
import type { PortfolioHolding } from '@/lib/supabase/types'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import type { StockQuote } from '@/app/api/stocks/prices/route'
import { addOrUpdateHolding, deleteHolding } from '@/app/actions/portfolio'
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'holdings' | 'allocation' | 'insights' | 'risk'
type SortKey = 'ticker' | 'value' | 'pnl' | 'pnlPct' | 'score' | 'shares'
type SortDir = 'asc' | 'desc'

interface EnrichedHolding {
  holding: PortfolioHolding
  currentPrice: number
  dailyChangePct: number
  marketValue: number
  costBasis: number
  unrealizedPnL: number
  unrealizedPnLPct: number
  dailyPnL: number
  score: number
  sector: string
  grossMargin: number
  revenueGrowth: number
  fcfMargin: number
  pe: number
  name: string
  beta: number
}

interface FormState {
  ticker: string
  companyName: string
  shares: string
  avgCost: string
  notes: string
}

const SECTOR_COLORS = [
  '#F59E0B', '#38BDF8', '#34D399', '#A78BFA', '#FB7185',
  '#FBBF24', '#60A5FA', '#4ADE80', '#C084FC', '#F472B6',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${fmt(n)}`
}

function pnlColor(n: number): string {
  if (n > 0) return 'var(--positive)'
  if (n < 0) return 'var(--negative)'
  return 'var(--text-muted)'
}

function pnlSign(n: number): string {
  return n > 0 ? '+' : ''
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, subColor, icon,
}: {
  label: string
  value: string
  sub?: string
  subColor?: string
  icon?: React.ReactNode
}) {
  return (
    <div
      className="border rounded-lg p-4 flex flex-col gap-1"
      style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          {label}
        </span>
        {icon}
      </div>
      <div
        className="text-xl font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="text-[11px] tabular-nums font-medium"
          style={{ fontFamily: 'var(--font-mono)', color: subColor ?? 'var(--text-ghost)' }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

function QScoreBadge({ score }: { score: number }) {
  const [color, bg, border] =
    score >= 80
      ? ['#10B981', 'rgba(16,185,129,0.10)', 'rgba(16,185,129,0.25)']
      : score >= 65
        ? ['#38BDF8', 'rgba(56,189,248,0.10)', 'rgba(56,189,248,0.25)']
        : ['#F59E0B', 'rgba(245,158,11,0.08)', 'rgba(245,158,11,0.25)']
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums"
      style={{ color, backgroundColor: bg, border: `1px solid ${border}`, fontFamily: 'var(--font-mono)' }}
    >
      Q{score}
    </span>
  )
}

function TickerAvatar({ ticker }: { ticker: string }) {
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
      style={{
        backgroundColor: 'var(--amber-dim)',
        border: '1px solid var(--amber-border)',
        color: 'var(--amber)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {ticker.slice(0, 3)}
    </div>
  )
}

// ─── Add / Edit Modal ────────────────────────────────────────────────────────

function AddHoldingModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: PortfolioHolding | null
  onClose: () => void
  onSaved: (h: PortfolioHolding) => void
}) {
  const [form, setForm] = useState<FormState>({
    ticker: initial?.ticker ?? '',
    companyName: initial?.company_name ?? '',
    shares: initial?.shares?.toString() ?? '',
    avgCost: initial?.avg_cost_usd?.toString() ?? '',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!initial

  function set(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ticker = form.ticker.trim().toUpperCase()
    const shares = parseFloat(form.shares)
    const avgCost = parseFloat(form.avgCost)

    if (!ticker) return setError('Ticker is required')
    if (!/^[A-Z.]{1,10}$/.test(ticker)) return setError('Invalid ticker format')
    if (isNaN(shares) || shares <= 0) return setError('Shares must be a positive number')
    if (isNaN(avgCost) || avgCost <= 0) return setError('Avg cost must be a positive number')

    setSaving(true)
    const result = await addOrUpdateHolding(
      ticker,
      form.companyName.trim() || null,
      shares,
      avgCost,
      form.notes.trim() || null
    )

    if (!result.success) {
      setError(result.error ?? 'Failed to save')
      setSaving(false)
      return
    }

    onSaved({
      id: initial?.id ?? crypto.randomUUID(),
      portfolio_id: initial?.portfolio_id ?? '',
      ticker,
      company_name: form.companyName.trim() || null,
      shares,
      avg_cost_usd: avgCost,
      notes: form.notes.trim() || null,
      created_at: initial?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-6 space-y-5 animate-fade-up"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border-mid)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
          >
            {isEdit ? 'Edit Position' : 'Add Position'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-ghost)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ticker + Company row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[10px] uppercase tracking-[0.12em] mb-1.5"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
              >
                TICKER *
              </label>
              <input
                value={form.ticker}
                onChange={e => set('ticker', e.target.value.toUpperCase())}
                placeholder="AAPL"
                disabled={isEdit}
                maxLength={10}
                className="w-full px-3 py-2.5 rounded-lg border text-sm font-bold outline-none transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--amber)',
                  fontFamily: 'var(--font-mono)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--amber-border)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label
                className="block text-[10px] uppercase tracking-[0.12em] mb-1.5"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
              >
                COMPANY
              </label>
              <input
                value={form.companyName}
                onChange={e => set('companyName', e.target.value)}
                placeholder="Apple Inc."
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--amber-border)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          {/* Shares + Avg Cost row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[10px] uppercase tracking-[0.12em] mb-1.5"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
              >
                SHARES *
              </label>
              <input
                value={form.shares}
                onChange={e => set('shares', e.target.value)}
                placeholder="100"
                type="number"
                min="0"
                step="any"
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors tabular-nums"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--amber-border)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label
                className="block text-[10px] uppercase tracking-[0.12em] mb-1.5"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
              >
                AVG COST / SHARE *
              </label>
              <input
                value={form.avgCost}
                onChange={e => set('avgCost', e.target.value)}
                placeholder="150.00"
                type="number"
                min="0"
                step="any"
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors tabular-nums"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--amber-border)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.12em] mb-1.5"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
            >
              NOTES (OPTIONAL)
            </label>
            <input
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Investment thesis..."
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--amber-border)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Cost preview */}
          {form.shares && form.avgCost && !isNaN(parseFloat(form.shares)) && !isNaN(parseFloat(form.avgCost)) && (
            <div
              className="px-3 py-2 rounded-lg border text-[11px] tabular-nums"
              style={{
                backgroundColor: 'var(--amber-dim)',
                borderColor: 'var(--amber-border)',
                color: 'var(--amber)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Total cost basis: ${(parseFloat(form.shares) * parseFloat(form.avgCost)).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          )}

          {error && (
            <div
              className="px-3 py-2 rounded-lg border text-xs"
              style={{
                backgroundColor: 'var(--negative-dim)',
                borderColor: 'rgba(248,113,113,0.25)',
                color: 'var(--negative)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ backgroundColor: 'var(--amber)', color: '#050810' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving...' : isEdit ? 'Update Position' : 'Add Position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── AI Insights Panel ────────────────────────────────────────────────────────

function InsightsPanel({ enriched, totalValue, totalCostBasis, totalPnL, totalPnLPct }: {
  enriched: EnrichedHolding[]
  totalValue: number
  totalCostBasis: number
  totalPnL: number
  totalPnLPct: number
}) {
  const [insights, setInsights] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const generateInsights = useCallback(async () => {
    if (enriched.length === 0) return
    setLoading(true)
    setInsights('')
    setGenerated(false)

    try {
      const body = {
        holdings: enriched.map(e => ({
          ticker: e.holding.ticker,
          companyName: e.name,
          shares: e.holding.shares,
          avgCost: e.holding.avg_cost_usd,
          currentPrice: e.currentPrice,
          marketValue: e.marketValue,
          unrealizedPnL: e.unrealizedPnL,
          unrealizedPnLPct: e.unrealizedPnLPct,
          dailyChangePct: e.dailyChangePct,
          sector: e.sector,
          score: e.score,
          grossMargin: e.grossMargin,
          revenueGrowth: e.revenueGrowth,
          fcfMargin: e.fcfMargin,
          pe: e.pe,
        })),
        totalValue,
        totalCostBasis,
        totalPnL,
        totalPnLPct,
      }

      const res = await fetch('/api/portfolio/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setInsights(prev => prev + decoder.decode(value, { stream: true }))
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }

      setGenerated(true)
    } catch {
      setInsights('Failed to generate insights. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [enriched, totalValue, totalCostBasis, totalPnL, totalPnLPct])

  if (enriched.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <BarChart3 className="w-10 h-10" style={{ color: 'var(--text-ghost)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Add holdings to get AI-powered portfolio analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-sm font-bold"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
          >
            Q5 Portfolio Analysis
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
            AI analysis through Macro · Sector · Fundamental · Quant · Sentiment
          </p>
        </div>
        <button
          onClick={generateInsights}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
          style={{
            backgroundColor: loading ? 'var(--amber-dim)' : 'var(--amber)',
            color: loading ? 'var(--amber)' : '#050810',
            border: loading ? '1px solid var(--amber-border)' : 'none',
          }}
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />
          }
          {loading ? 'Analysing...' : generated ? 'Regenerate' : 'Generate Analysis'}
        </button>
      </div>

      {!insights && !loading && (
        <div
          className="border rounded-xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ borderColor: 'var(--amber-border)', backgroundColor: 'var(--amber-dim)' }}
        >
          <Sparkles className="w-8 h-8" style={{ color: 'var(--amber)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--amber)', fontFamily: 'var(--font-bricolage)' }}>
              Hedge-fund-grade portfolio review
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Claude will analyse your {enriched.length} position{enriched.length !== 1 ? 's' : ''} across all 5 Q-layers
            </p>
          </div>
        </div>
      )}

      {(insights || loading) && (
        <div
          ref={scrollRef}
          className="border rounded-xl p-5 max-h-[540px] overflow-y-auto"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--surface)',
            scrollBehavior: 'smooth',
          }}
        >
          <AIMarkdown text={insights} loading={loading} />
        </div>
      )}

      {generated && (
        <p
          className="text-[10px] text-center"
          style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
        >
          ANALYTICAL COMMENTARY ONLY — NOT FINANCIAL ADVICE · ALWAYS DO YOUR OWN RESEARCH
        </p>
      )}
    </div>
  )
}

function AIMarkdown({ text, loading }: { text: string; loading: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <div className="space-y-0.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2)
          return (
            <span
              key={i}
              className="font-bold block mt-4 first:mt-0 text-[13px]"
              style={{ color: 'var(--amber)', fontFamily: 'var(--font-bricolage)' }}
            >
              {inner}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
      {loading && (
        <span
          className="inline-block w-2 h-4 ml-0.5 align-middle animate-pulse rounded-sm"
          style={{ backgroundColor: 'var(--amber)' }}
        />
      )}
    </div>
  )
}

// ─── Risk Panel ───────────────────────────────────────────────────────────────

function BetaBadge({ beta }: { beta: number }) {
  const [color, bg, border] =
    beta < 0.8
      ? ['var(--positive)', 'rgba(16,185,129,0.08)', 'rgba(16,185,129,0.25)']
      : beta <= 1.2
        ? ['var(--amber)', 'var(--amber-dim)', 'var(--amber-border)']
        : ['var(--negative)', 'rgba(248,113,113,0.08)', 'rgba(248,113,113,0.25)']
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums"
      style={{ color, backgroundColor: bg, border: `1px solid ${border}`, fontFamily: 'var(--font-mono)' }}
    >
      β {beta.toFixed(2)}
    </span>
  )
}

function RiskPanel({ enriched, totalValue }: { enriched: EnrichedHolding[]; totalValue: number }) {
  if (enriched.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <ShieldAlert className="w-10 h-10" style={{ color: 'var(--text-ghost)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Add holdings to see risk analytics.
        </p>
      </div>
    )
  }

  // ── Portfolio-level computations ────────────────────────────────────────────
  const portfolioBeta = totalValue > 0
    ? enriched.reduce((sum, e) => sum + (e.marketValue / totalValue) * e.beta, 0)
    : 1.0

  const hhi = totalValue > 0
    ? enriched.reduce((sum, e) => {
        const w = e.marketValue / totalValue
        return sum + w * w
      }, 0) * 10000
    : 0

  const hhiLabel = hhi < 1000 ? 'DIVERSIFIED' : hhi < 2500 ? 'MODERATE' : 'CONCENTRATED'
  const hhiColor = hhi < 1000 ? 'var(--positive)' : hhi < 2500 ? 'var(--amber)' : 'var(--negative)'

  // VaR: portfolio daily vol assumes uncorrelated positions
  // individual_vol_i ≈ beta_i × 0.01 (1% market daily vol)
  const portfolioVariance = totalValue > 0
    ? enriched.reduce((sum, e) => {
        const w = e.marketValue / totalValue
        const volI = e.beta * 0.01
        return sum + w * w * volI * volI
      }, 0)
    : 0
  const portfolioDailyVol = Math.sqrt(portfolioVariance)
  const dailyVaR = totalValue * portfolioDailyVol * 1.645
  const dailyVaRPct = portfolioDailyVol * 1.645 * 100

  const largestPosition = totalValue > 0
    ? enriched.reduce((max, e) => e.marketValue > max.marketValue ? e : max, enriched[0])
    : null

  // Sector concentration
  const sectorWeights: Record<string, number> = {}
  for (const e of enriched) {
    sectorWeights[e.sector] = (sectorWeights[e.sector] ?? 0) + e.marketValue
  }
  const topSectorEntry = Object.entries(sectorWeights).sort((a, b) => b[1] - a[1])[0]
  const topSector = topSectorEntry ? topSectorEntry[0] : 'N/A'
  const topSectorPct = topSectorEntry && totalValue > 0 ? (topSectorEntry[1] / totalValue) * 100 : 0

  const profitable = enriched.filter(e => e.unrealizedPnL > 0).length
  const winRate = enriched.length > 0 ? (profitable / enriched.length) * 100 : 0

  const betaColor = portfolioBeta < 0.8
    ? 'var(--positive)'
    : portfolioBeta <= 1.2
      ? 'var(--amber)'
      : 'var(--negative)'

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div
        className="text-[10px] uppercase tracking-[0.12em] font-semibold"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
      >
        PORTFOLIO RISK METRICS
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Portfolio Beta */}
        <div
          className="border rounded-lg p-4 space-y-1"
          style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            PORTFOLIO BETA
          </div>
          <div
            className="text-xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: betaColor }}
          >
            {portfolioBeta.toFixed(2)}
          </div>
          <div
            className="text-[10px]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            {portfolioBeta < 0.8 ? 'Defensive' : portfolioBeta <= 1.2 ? 'Market-neutral' : 'Aggressive'}
          </div>
        </div>

        {/* HHI Concentration */}
        <div
          className="border rounded-lg p-4 space-y-1"
          style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            HHI CONCENTRATION
          </div>
          <div
            className="text-xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
          >
            {Math.round(hhi).toLocaleString()}
          </div>
          <div>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                fontFamily: 'var(--font-mono)',
                color: hhiColor,
                backgroundColor: `${hhiColor}18`,
                border: `1px solid ${hhiColor}40`,
              }}
            >
              {hhiLabel}
            </span>
          </div>
        </div>

        {/* Daily VaR */}
        <div
          className="border rounded-lg p-4 space-y-1"
          style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            DAILY VAR (95%)
          </div>
          <div
            className="text-xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--negative)' }}
          >
            -{fmtCurrency(dailyVaR)}
          </div>
          <div
            className="text-[10px] tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            -{dailyVaRPct.toFixed(2)}% of portfolio
          </div>
        </div>

        {/* Largest Position */}
        <div
          className="border rounded-lg p-4 space-y-1"
          style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            LARGEST POSITION
          </div>
          <div
            className="text-xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
          >
            {largestPosition?.holding.ticker ?? '—'}
          </div>
          <div
            className="text-[10px] tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            {largestPosition && totalValue > 0
              ? `${((largestPosition.marketValue / totalValue) * 100).toFixed(1)}% of portfolio`
              : '—'}
          </div>
        </div>

        {/* Top Sector Exposure */}
        <div
          className="border rounded-lg p-4 space-y-1"
          style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            TOP SECTOR EXPOSURE
          </div>
          <div
            className="text-base font-bold truncate"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
          >
            {topSector}
          </div>
          <div
            className="text-[10px] tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            {topSectorPct.toFixed(1)}% allocation
          </div>
        </div>

        {/* Win Rate */}
        <div
          className="border rounded-lg p-4 space-y-1"
          style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            WIN RATE
          </div>
          <div
            className="text-xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: winRate >= 60 ? 'var(--positive)' : winRate >= 40 ? 'var(--amber)' : 'var(--negative)' }}
          >
            {winRate.toFixed(0)}%
          </div>
          <div
            className="text-[10px]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            {profitable}/{enriched.length} positions profitable
          </div>
        </div>
      </div>

      {/* Holdings Risk Table */}
      <div>
        <div
          className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          INDIVIDUAL HOLDINGS RISK
        </div>

        <div
          className="border rounded-xl overflow-hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Table header */}
          <div
            className="grid px-4 py-2.5 border-b"
            style={{
              gridTemplateColumns: '100px 1fr 80px 80px 110px 100px',
              borderColor: 'var(--border)',
              backgroundColor: 'var(--surface)',
            }}
          >
            {(['TICKER', 'COMPANY', 'WEIGHT', 'BETA', 'DAILY VAR', 'STATUS'] as const).map(col => (
              <span
                key={col}
                className="text-[10px] uppercase tracking-[0.10em]"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Table rows */}
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {[...enriched].sort((a, b) => b.marketValue - a.marketValue).map(e => {
              const weight = totalValue > 0 ? (e.marketValue / totalValue) * 100 : 0
              const individualVol = e.beta * 0.01
              const positionVaR = e.marketValue * individualVol * 1.645
              const isAtRisk = e.unrealizedPnLPct < -15

              let pnlStatus: 'PROFIT' | 'AT RISK' | 'LOSS'
              let statusColor: string
              if (e.unrealizedPnL > 0) {
                pnlStatus = 'PROFIT'
                statusColor = 'var(--positive)'
              } else if (isAtRisk) {
                pnlStatus = 'AT RISK'
                statusColor = 'var(--negative)'
              } else {
                pnlStatus = 'LOSS'
                statusColor = 'rgba(248,113,113,0.6)'
              }

              return (
                <div
                  key={e.holding.ticker}
                  className="grid px-4 py-3 items-center"
                  style={{
                    gridTemplateColumns: '100px 1fr 80px 80px 110px 100px',
                  }}
                  onMouseEnter={ev => (ev.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={ev => (ev.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Ticker */}
                  <span
                    className="text-sm font-black tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
                  >
                    {e.holding.ticker}
                  </span>

                  {/* Company */}
                  <span
                    className="text-[11px] truncate"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {e.name}
                  </span>

                  {/* Weight */}
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
                  >
                    {weight.toFixed(1)}%
                  </span>

                  {/* Beta */}
                  <div>
                    <BetaBadge beta={e.beta} />
                  </div>

                  {/* Daily VaR */}
                  <span
                    className="text-sm tabular-nums font-semibold"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--negative)' }}
                  >
                    -{fmtCurrency(positionVaR)}
                  </span>

                  {/* P&L Status */}
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: statusColor,
                      backgroundColor: `${statusColor}18`,
                      border: `1px solid ${statusColor}40`,
                    }}
                  >
                    {pnlStatus}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Table footer */}
          <div
            className="px-4 py-2.5 border-t flex items-center justify-between"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
          >
            <span
              className="text-[10px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
            >
              BETA FROM FMP · VaR ASSUMES UNCORRELATED POSITIONS · 1% MARKET DAILY VOL
            </span>
            <span
              className="text-[10px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
            >
              NOT FINANCIAL ADVICE
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Allocation Chart ─────────────────────────────────────────────────────────

function AllocationTab({ enriched, totalValue }: { enriched: EnrichedHolding[]; totalValue: number }) {
  const sectorData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of enriched) {
      map[e.sector] = (map[e.sector] ?? 0) + e.marketValue
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: (value / totalValue) * 100 }))
      .sort((a, b) => b.value - a.value)
  }, [enriched, totalValue])

  const holdingData = useMemo(() =>
    [...enriched]
      .sort((a, b) => b.marketValue - a.marketValue)
      .map(e => ({
        name: e.holding.ticker,
        value: e.marketValue,
        pct: (e.marketValue / totalValue) * 100,
      })),
    [enriched, totalValue]
  )

  if (enriched.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <PieChart className="w-10 h-10" style={{ color: 'var(--text-ghost)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Add holdings to see allocation.</p>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Sector donut */}
      <div
        className="border rounded-xl p-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.12em] mb-4"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          BY SECTOR
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <RechartsPie>
            <Pie
              data={sectorData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {sectorData.map((_, i) => (
                <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
              }}
              formatter={(value) => [`$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, '']}
            />
          </RechartsPie>
        </ResponsiveContainer>
        <div className="space-y-2 mt-2">
          {sectorData.map((s, i) => (
            <div key={s.name} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
              <span className="flex-1 text-[11px] truncate" style={{ color: 'var(--text-dim)' }}>{s.name}</span>
              <span className="text-[11px] tabular-nums font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                {s.pct.toFixed(1)}%
              </span>
              <span className="text-[10px] tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}>
                {fmtCurrency(s.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Holdings donut */}
      <div
        className="border rounded-xl p-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.12em] mb-4"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          BY POSITION
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <RechartsPie>
            <Pie
              data={holdingData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {holdingData.map((_, i) => (
                <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
              }}
              formatter={(value) => [`$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, '']}
            />
          </RechartsPie>
        </ResponsiveContainer>
        <div className="space-y-2 mt-2">
          {holdingData.map((h, i) => (
            <div key={h.name} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
              <span
                className="flex-1 text-[11px] font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
              >
                {h.name}
              </span>
              <span className="text-[11px] tabular-nums font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                {h.pct.toFixed(1)}%
              </span>
              <span className="text-[10px] tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}>
                {fmtCurrency(h.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PortfolioClientProps {
  initialHoldings: PortfolioHolding[]
  fundamentals: Record<string, FMPFundamentals>
}

export default function PortfolioClient({ initialHoldings, fundamentals: initialFundamentals }: PortfolioClientProps) {
  const router = useRouter()
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(initialHoldings)
  const [fundamentals, setFundamentals] = useState(initialFundamentals)
  const [liveQuotes, setLiveQuotes] = useState<Record<string, StockQuote>>({})
  const [activeTab, setActiveTab] = useState<Tab>('holdings')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editHolding, setEditHolding] = useState<PortfolioHolding | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [refreshing, setRefreshing] = useState(false)
  const [removingTickers, setRemovingTickers] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const fetchPrices = useCallback(async () => {
    if (holdings.length === 0) return
    setRefreshing(true)
    try {
      const tickers = holdings.map(h => h.ticker).join(',')
      const res = await fetch(`/api/stocks/prices?tickers=${tickers}`)
      if (res.ok) {
        const data = await res.json() as Record<string, StockQuote>
        setLiveQuotes(data)
      }
    } finally {
      setRefreshing(false)
    }
  }, [holdings])

  useEffect(() => { fetchPrices() }, [fetchPrices])

  const enriched = useMemo<EnrichedHolding[]>(() => {
    return holdings.map(h => {
      const f = fundamentals[h.ticker]
      const q = liveQuotes[h.ticker]
      const currentPrice = q?.price ?? f?.price ?? 0
      const dailyChangePct = q?.changePercent ?? f?.change ?? 0
      const marketValue = currentPrice * h.shares
      const costBasis = h.avg_cost_usd * h.shares
      const unrealizedPnL = marketValue - costBasis
      const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0
      const dailyPnL = marketValue * (dailyChangePct / 100)

      return {
        holding: h,
        currentPrice,
        dailyChangePct,
        marketValue,
        costBasis,
        unrealizedPnL,
        unrealizedPnLPct,
        dailyPnL,
        score: f?.score ?? 50,
        sector: f?.sector ?? 'Unknown',
        grossMargin: f?.grossMargin ?? 0,
        revenueGrowth: f?.revenueGrowth ?? 0,
        fcfMargin: f?.fcfMargin ?? 0,
        pe: f?.pe ?? 0,
        name: f?.name ?? h.company_name ?? h.ticker,
        beta: f?.beta ?? 1.0,
      }
    })
  }, [holdings, fundamentals, liveQuotes])

  const totals = useMemo(() => {
    const totalValue = enriched.reduce((s, e) => s + e.marketValue, 0)
    const totalCostBasis = enriched.reduce((s, e) => s + e.costBasis, 0)
    const totalPnL = totalValue - totalCostBasis
    const totalPnLPct = totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0
    const totalDailyPnL = enriched.reduce((s, e) => s + e.dailyPnL, 0)
    const totalDailyPct = totalValue > 0 ? (totalDailyPnL / (totalValue - totalDailyPnL)) * 100 : 0
    return { totalValue, totalCostBasis, totalPnL, totalPnLPct, totalDailyPnL, totalDailyPct }
  }, [enriched])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'ticker': diff = a.holding.ticker.localeCompare(b.holding.ticker); break
        case 'value': diff = a.marketValue - b.marketValue; break
        case 'pnl': diff = a.unrealizedPnL - b.unrealizedPnL; break
        case 'pnlPct': diff = a.unrealizedPnLPct - b.unrealizedPnLPct; break
        case 'score': diff = a.score - b.score; break
        case 'shares': diff = a.holding.shares - b.holding.shares; break
      }
      return sortDir === 'asc' ? diff : -diff
    })
  }, [enriched, sortKey, sortDir])

  function handleRowClick(ticker: string, e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-action]')) return
    router.push(`/dashboard/stocks/${ticker}`)
  }

  function handleRemove(ticker: string) {
    setRemovingTickers(prev => new Set(prev).add(ticker))
    startTransition(async () => {
      const result = await deleteHolding(ticker)
      if (result.success) {
        setHoldings(prev => prev.filter(h => h.ticker !== ticker))
        setLiveQuotes(prev => { const n = { ...prev }; delete n[ticker]; return n })
        setFundamentals(prev => { const n = { ...prev }; delete n[ticker]; return n })
      }
      setRemovingTickers(prev => { const n = new Set(prev); n.delete(ticker); return n })
    })
  }

  function handleSaved(h: PortfolioHolding) {
    setHoldings(prev => {
      const exists = prev.findIndex(x => x.ticker === h.ticker)
      if (exists >= 0) {
        const next = [...prev]
        next[exists] = h
        return next
      }
      return [h, ...prev]
    })
    setShowAddModal(false)
    setEditHolding(null)
    fetchPrices()
  }

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col
    return (
      <button
        onClick={() => handleSort(col)}
        className="flex items-center gap-1 text-[10px] uppercase tracking-[0.10em] whitespace-nowrap"
        style={{
          fontFamily: 'var(--font-mono)',
          color: active ? 'var(--amber)' : 'var(--text-ghost)',
        }}
      >
        {label}
        {active
          ? sortDir === 'asc'
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
          : <ArrowUpDown className="w-3 h-3 opacity-30" />
        }
      </button>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'holdings', label: 'Holdings', icon: <List className="w-3.5 h-3.5" /> },
    { key: 'allocation', label: 'Allocation', icon: <PieChart className="w-3.5 h-3.5" /> },
    { key: 'insights', label: 'AI Insights', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { key: 'risk', label: 'Risk', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  ]

  // Empty state
  if (holdings.length === 0) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-black"
              style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
            >
              My Portfolio
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
              0 positions
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: 'var(--amber)', color: '#050810' }}
          >
            <Plus className="w-4 h-4" />
            Add Position
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-24 space-y-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border"
            style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)' }}
          >
            <BarChart3 className="w-7 h-7" style={{ color: 'var(--amber)' }} />
          </div>
          <div className="text-center space-y-2">
            <h3
              className="text-lg font-bold"
              style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
            >
              Start tracking your wealth
            </h3>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
              Add your stock positions to get real-time P&L tracking and AI-powered Q5 portfolio analysis.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: 'var(--amber)', color: '#050810' }}
          >
            <Plus className="w-4 h-4" />
            Add First Position
          </button>
        </div>

        {showAddModal && (
          <AddHoldingModal
            onClose={() => setShowAddModal(false)}
            onSaved={handleSaved}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-black"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
          >
            My Portfolio
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-[11px] tabular-nums"
              style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
            >
              {holdings.length} position{holdings.length !== 1 ? 's' : ''}
            </span>
            {Object.keys(liveQuotes).length > 0 && (
              <>
                <span style={{ color: 'var(--text-ghost)', fontSize: '10px' }}>·</span>
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--positive)' }}
                />
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}
                >
                  LIVE
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPrices}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-ghost)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all"
            style={{ backgroundColor: 'var(--amber)', color: '#050810', fontFamily: 'var(--font-mono)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            ADD POSITION
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Value"
          value={`$${totals.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          sub={`${holdings.length} position${holdings.length !== 1 ? 's' : ''}`}
          icon={<BarChart3 className="w-4 h-4" style={{ color: 'var(--text-ghost)' }} />}
        />
        <StatCard
          label="Today's P&L"
          value={`${pnlSign(totals.totalDailyPnL)}${fmtCurrency(totals.totalDailyPnL)}`}
          sub={`${pnlSign(totals.totalDailyPct)}${fmt(totals.totalDailyPct)}% today`}
          subColor={pnlColor(totals.totalDailyPnL)}
          icon={
            totals.totalDailyPnL >= 0
              ? <TrendingUp className="w-4 h-4" style={{ color: 'var(--positive)' }} />
              : <TrendingDown className="w-4 h-4" style={{ color: 'var(--negative)' }} />
          }
        />
        <StatCard
          label="Total Return"
          value={`${pnlSign(totals.totalPnL)}${fmtCurrency(totals.totalPnL)}`}
          sub={`${pnlSign(totals.totalPnLPct)}${fmt(totals.totalPnLPct)}% all-time`}
          subColor={pnlColor(totals.totalPnL)}
          icon={
            totals.totalPnL >= 0
              ? <TrendingUp className="w-4 h-4" style={{ color: 'var(--positive)' }} />
              : <TrendingDown className="w-4 h-4" style={{ color: 'var(--negative)' }} />
          }
        />
        <StatCard
          label="Cost Basis"
          value={`$${totals.totalCostBasis.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          sub="total invested"
          icon={<List className="w-4 h-4" style={{ color: 'var(--text-ghost)' }} />}
        />
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl border"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', width: 'fit-content' }}
      >
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              fontFamily: 'var(--font-mono)',
              backgroundColor: activeTab === tab.key ? 'var(--amber-dim)' : 'transparent',
              color: activeTab === tab.key ? 'var(--amber)' : 'var(--text-ghost)',
              border: activeTab === tab.key ? '1px solid var(--amber-border)' : '1px solid transparent',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Holdings tab */}
      {activeTab === 'holdings' && (
        <div
          className="border rounded-xl overflow-hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Column headers */}
          <div
            className="grid items-center gap-3 px-4 py-2.5 border-b"
            style={{
              gridTemplateColumns: 'auto 1fr auto auto auto auto auto auto',
              borderColor: 'var(--border)',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div className="w-9" />
            <SortBtn col="ticker" label="TICKER" />
            <SortBtn col="shares" label="SHARES" />
            <span
              className="text-[10px] uppercase tracking-[0.10em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
            >
              AVG COST
            </span>
            <SortBtn col="value" label="VALUE" />
            <SortBtn col="pnl" label="P&L" />
            <SortBtn col="score" label="Q-SCORE" />
            <div className="w-14" />
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {sorted.map((e, idx) => {
              const isRemoving = removingTickers.has(e.holding.ticker)
              const pnlC = pnlColor(e.unrealizedPnL)
              const dayC = pnlColor(e.dailyChangePct)

              return (
                <div
                  key={e.holding.ticker}
                  onClick={(ev) => handleRowClick(e.holding.ticker, ev)}
                  className="grid items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150 group animate-fade-up"
                  style={{
                    gridTemplateColumns: 'auto 1fr auto auto auto auto auto auto',
                    animationDelay: `${idx * 0.04}s`,
                    opacity: isRemoving ? 0.4 : 1,
                    pointerEvents: isRemoving ? 'none' : 'auto',
                  }}
                  onMouseEnter={ev => (ev.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={ev => (ev.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <TickerAvatar ticker={e.holding.ticker} />

                  {/* Ticker info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-black"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                      >
                        {e.holding.ticker}
                      </span>
                      {liveQuotes[e.holding.ticker] && (
                        <div
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ backgroundColor: 'var(--positive)' }}
                        />
                      )}
                    </div>
                    <div
                      className="text-[11px] truncate mt-0.5"
                      style={{ color: 'var(--text-dim)', maxWidth: '160px' }}
                    >
                      {e.name}
                    </div>
                    <div
                      className="text-[10px] mt-0.5"
                      style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
                    >
                      {e.sector}
                    </div>
                  </div>

                  {/* Shares */}
                  <div className="text-right">
                    <span
                      className="text-sm tabular-nums font-semibold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      {e.holding.shares % 1 === 0
                        ? e.holding.shares.toFixed(0)
                        : e.holding.shares.toFixed(4).replace(/\.?0+$/, '')}
                    </span>
                    <div
                      className="text-[10px] tabular-nums mt-0.5"
                      style={{ color: dayC, fontFamily: 'var(--font-mono)' }}
                    >
                      {pnlSign(e.dailyChangePct)}{fmt(e.dailyChangePct)}% today
                    </div>
                  </div>

                  {/* Avg cost */}
                  <div className="text-right">
                    <span
                      className="text-sm tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                    >
                      ${fmt(e.holding.avg_cost_usd)}
                    </span>
                    <div
                      className="text-[10px] tabular-nums mt-0.5"
                      style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
                    >
                      now ${fmt(e.currentPrice)}
                    </div>
                  </div>

                  {/* Market value */}
                  <div className="text-right">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      {fmtCurrency(e.marketValue)}
                    </span>
                  </div>

                  {/* P&L */}
                  <div className="text-right min-w-[80px]">
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)', color: pnlC }}
                    >
                      {pnlSign(e.unrealizedPnL)}{fmtCurrency(e.unrealizedPnL)}
                    </span>
                    <div
                      className="text-[10px] tabular-nums mt-0.5"
                      style={{ fontFamily: 'var(--font-mono)', color: pnlC }}
                    >
                      {pnlSign(e.unrealizedPnLPct)}{fmt(e.unrealizedPnLPct)}%
                    </div>
                  </div>

                  {/* Q-Score */}
                  <div className="flex justify-center">
                    <QScoreBadge score={e.score} />
                  </div>

                  {/* Actions */}
                  <div data-action className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      data-action
                      onClick={(ev) => { ev.stopPropagation(); setEditHolding(e.holding); setShowAddModal(true) }}
                      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: 'var(--amber-dim)',
                        border: '1px solid var(--amber-border)',
                      }}
                      title={`Edit ${e.holding.ticker}`}
                    >
                      <Edit2 className="w-3 h-3" style={{ color: 'var(--amber)' }} />
                    </button>
                    <button
                      data-action
                      onClick={(ev) => { ev.stopPropagation(); handleRemove(e.holding.ticker) }}
                      disabled={isRemoving}
                      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: 'var(--negative-dim)',
                        border: '1px solid rgba(248,113,113,0.2)',
                      }}
                      title={`Remove ${e.holding.ticker}`}
                    >
                      <Trash2 className="w-3 h-3" style={{ color: 'var(--negative)' }} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Table footer */}
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
          >
            <div
              className="flex items-center gap-2 text-[10px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--amber)' }} />
              PRICES VIA YAHOO FINANCE · FUNDAMENTALS VIA FMP
            </div>
            <div
              className="text-[11px] font-semibold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: pnlColor(totals.totalPnL) }}
            >
              TOTAL: {pnlSign(totals.totalPnL)}{fmtCurrency(totals.totalPnL)} ({pnlSign(totals.totalPnLPct)}{fmt(totals.totalPnLPct)}%)
            </div>
          </div>
        </div>
      )}

      {/* Allocation tab */}
      {activeTab === 'allocation' && (
        <AllocationTab enriched={enriched} totalValue={totals.totalValue} />
      )}

      {/* AI Insights tab */}
      {activeTab === 'insights' && (
        <InsightsPanel
          enriched={enriched}
          totalValue={totals.totalValue}
          totalCostBasis={totals.totalCostBasis}
          totalPnL={totals.totalPnL}
          totalPnLPct={totals.totalPnLPct}
        />
      )}

      {/* Risk tab */}
      {activeTab === 'risk' && (
        <RiskPanel enriched={enriched} totalValue={totals.totalValue} />
      )}

      {/* Add / Edit modal */}
      {showAddModal && (
        <AddHoldingModal
          initial={editHolding}
          onClose={() => { setShowAddModal(false); setEditHolding(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
