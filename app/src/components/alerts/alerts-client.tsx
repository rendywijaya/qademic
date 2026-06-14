'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import {
  Bell,
  BellOff,
  Trash2,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react'
import type { PriceAlert } from '@/lib/supabase/types'
import type { StockQuote } from '@/app/api/stocks/prices/route'
import { createPriceAlert, deletePriceAlert } from '@/app/actions/alerts'

// ─── Small helpers ────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n: number): string {
  return n.toFixed(2)
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function TickerAvatar({ ticker }: { ticker: string }) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{
        backgroundColor: 'var(--amber-dim)',
        border: '1px solid var(--amber-border)',
      }}
    >
      <span
        className="text-[10px] font-black"
        style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}
      >
        {ticker.slice(0, 3)}
      </span>
    </div>
  )
}

// Progress bar: 0% = alert just set (far away), 100% = price is at target
function AlertProgressBar({
  distancePct,
  isTriggered,
}: {
  distancePct: number
  isTriggered: boolean
}) {
  const fill = isTriggered ? 100 : Math.max(0, Math.min(100, 100 - distancePct))
  const color = isTriggered ? 'var(--positive)' : 'var(--amber)'

  return (
    <div
      className="w-full h-1 rounded-full overflow-hidden"
      style={{ backgroundColor: 'var(--surface-2)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${fill}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Add Alert Form ───────────────────────────────────────────────────────────

interface AddAlertFormProps {
  onClose: () => void
  onAdded: (alert: PriceAlert) => void
}

function AddAlertForm({ onClose, onAdded }: AddAlertFormProps) {
  const [ticker, setTicker] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tickerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    tickerRef.current?.focus()
  }, [])

  async function handleTickerBlur() {
    const t = ticker.trim().toUpperCase()
    if (!t || !/^[A-Z.]{1,10}$/.test(t)) return
    setFetchingPrice(true)
    setCurrentPrice(null)
    try {
      const res = await fetch(`/api/stocks/prices?tickers=${t}`)
      if (res.ok) {
        const data = await res.json() as Record<string, StockQuote>
        if (data[t]) setCurrentPrice(data[t].price)
      }
    } finally {
      setFetchingPrice(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const t = ticker.trim().toUpperCase()
    const price = parseFloat(targetPrice)

    if (!t || !/^[A-Z.]{1,10}$/.test(t)) {
      setError('Enter a valid ticker (e.g. AAPL, MSFT).')
      return
    }
    if (!isFinite(price) || price <= 0) {
      setError('Target price must be a positive number.')
      return
    }

    setSubmitting(true)
    try {
      const result = await createPriceAlert(t, null, price, direction)
      if (result.success && result.alert) {
        onAdded(result.alert)
        onClose()
      } else {
        setError(result.error ?? 'Failed to create alert. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--amber-border)', backgroundColor: 'var(--surface)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span
          className="text-[11px] uppercase tracking-[0.12em] font-semibold"
          style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}
        >
          New Price Alert
        </span>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Ticker + current price */}
        <div className="space-y-1">
          <label
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
          >
            Ticker Symbol
          </label>
          <input
            ref={tickerRef}
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onBlur={handleTickerBlur}
            placeholder="AAPL"
            maxLength={10}
            className="w-full px-3 py-2 rounded-md text-sm outline-none transition-all"
            style={{
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
            }}
          />
          {fetchingPrice && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Fetching price…
            </p>
          )}
          {currentPrice !== null && !fetchingPrice && (
            <p className="text-[11px]" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}>
              Current: ${fmtPrice(currentPrice)}
            </p>
          )}
        </div>

        {/* Target price */}
        <div className="space-y-1">
          <label
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
          >
            Target Price
          </label>
          <input
            type="number"
            value={targetPrice}
            onChange={e => setTargetPrice(e.target.value)}
            placeholder="185.00"
            min="0.000001"
            step="0.01"
            className="w-full px-3 py-2 rounded-md text-sm outline-none transition-all"
            style={{
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>

        {/* Direction toggle */}
        <div className="space-y-1">
          <label
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
          >
            Alert When Price Is
          </label>
          <div className="flex rounded-md overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setDirection('above')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all duration-150"
              style={{
                backgroundColor: direction === 'above' ? 'rgba(16,185,129,0.12)' : 'var(--surface-2)',
                color: direction === 'above' ? 'var(--positive)' : 'var(--text-muted)',
                borderRight: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              ▲ ABOVE
            </button>
            <button
              type="button"
              onClick={() => setDirection('below')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all duration-150"
              style={{
                backgroundColor: direction === 'below' ? 'rgba(248,113,113,0.10)' : 'var(--surface-2)',
                color: direction === 'below' ? 'var(--negative)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              ▼ BELOW
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--negative)', fontFamily: 'var(--font-mono)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg text-sm font-bold transition-all duration-150 disabled:opacity-50"
          style={{ backgroundColor: 'var(--amber)', color: '#050810' }}
        >
          {submitting ? 'Setting Alert…' : 'Set Alert'}
        </button>
      </div>
    </form>
  )
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

interface AlertCardEnriched extends PriceAlert {
  currentPrice: number | null
  isTriggeredLive: boolean
  distancePct: number
}

function AlertCard({
  alert,
  onDelete,
  deleting,
}: {
  alert: AlertCardEnriched
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const isTriggered = alert.triggered || alert.isTriggeredLive
  const { ticker, company_name, target_price, direction, currentPrice, distancePct } = alert

  const directionColor = direction === 'above' ? 'var(--positive)' : 'var(--negative)'
  const directionArrow = direction === 'above' ? '▲' : '▼'

  return (
    <div
      className="rounded-lg border p-4 flex gap-4 items-start group transition-all duration-200"
      style={{
        borderColor: isTriggered ? 'rgba(16,185,129,0.35)' : 'var(--border)',
        backgroundColor: isTriggered ? 'rgba(16,185,129,0.04)' : 'var(--surface)',
        boxShadow: isTriggered ? '0 0 20px rgba(16,185,129,0.08)' : undefined,
        opacity: deleting ? 0.4 : 1,
        pointerEvents: deleting ? 'none' : 'auto',
      }}
    >
      <TickerAvatar ticker={ticker} />

      <div className="flex-1 min-w-0 space-y-2">
        {/* Row 1: ticker + company + triggered badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-sm font-black"
                style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
              >
                {ticker}
              </span>
              {isTriggered && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-[0.08em]"
                  style={{
                    backgroundColor: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.35)',
                    color: 'var(--positive)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Triggered
                </span>
              )}
            </div>
            {company_name && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-dim)', maxWidth: '220px' }}>
                {company_name}
              </p>
            )}
          </div>

          {/* Delete button */}
          <button
            onClick={() => onDelete(alert.id)}
            className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
            style={{
              backgroundColor: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
            }}
            title={`Delete alert for ${ticker}`}
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--negative)' }} />
          </button>
        </div>

        {/* Row 2: target + current + distance */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.1em] mb-0.5"
              style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
            >
              Target
            </p>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: directionColor, fontFamily: 'var(--font-mono)' }}
            >
              {directionArrow} ${fmtPrice(target_price)}
            </span>
          </div>

          {currentPrice !== null && (
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.1em] mb-0.5"
                style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
              >
                Current
              </p>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
              >
                ${fmtPrice(currentPrice)}
              </span>
            </div>
          )}

          <div>
            <p
              className="text-[10px] uppercase tracking-[0.1em] mb-0.5"
              style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
            >
              Distance
            </p>
            {isTriggered ? (
              <span
                className="text-[11px] font-black uppercase"
                style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}
              >
                At target
              </span>
            ) : currentPrice !== null ? (
              <span
                className="text-sm tabular-nums"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {fmtPct(distancePct)}% away
              </span>
            ) : (
              <span className="text-sm" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                —
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <AlertProgressBar distancePct={distancePct} isTriggered={isTriggered} />
      </div>
    </div>
  )
}

// ─── Triggered section ────────────────────────────────────────────────────────

function TriggeredCard({
  alert,
  onResolve,
  resolving,
}: {
  alert: AlertCardEnriched
  onResolve: (id: string) => void
  resolving: boolean
}) {
  const { ticker, company_name, target_price, direction, currentPrice } = alert
  const directionArrow = direction === 'above' ? '▲' : '▼'

  return (
    <div
      className="rounded-lg border p-4 flex gap-4 items-center"
      style={{
        borderColor: 'rgba(16,185,129,0.35)',
        backgroundColor: 'rgba(16,185,129,0.04)',
        boxShadow: '0 0 20px rgba(16,185,129,0.08)',
        opacity: resolving ? 0.4 : 1,
        pointerEvents: resolving ? 'none' : 'auto',
      }}
    >
      <TickerAvatar ticker={ticker} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-black"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
          >
            {ticker}
          </span>
          <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--positive)' }} />
        </div>
        {company_name && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            {company_name}
          </p>
        )}
        <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Target {directionArrow} ${fmtPrice(target_price)}
          {currentPrice !== null && ` · Now $${fmtPrice(currentPrice)}`}
        </p>
      </div>

      <button
        onClick={() => onResolve(alert.id)}
        className="shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150"
        style={{
          backgroundColor: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.30)',
          color: 'var(--positive)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        Mark Resolved
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AlertsClientProps {
  alerts: PriceAlert[]
}

export default function AlertsClient({ alerts: initialAlerts }: AlertsClientProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(initialAlerts)
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [showForm, setShowForm] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const fetchPrices = useCallback(async (currentAlerts: PriceAlert[]) => {
    if (currentAlerts.length === 0) return
    const tickers = [...new Set(currentAlerts.map(a => a.ticker))].join(',')
    try {
      const res = await fetch(`/api/stocks/prices?tickers=${tickers}`)
      if (res.ok) {
        const data = await res.json() as Record<string, StockQuote>
        setQuotes(data)
      }
    } catch {
      // silently fail — prices are best-effort
    }
  }, [])

  useEffect(() => {
    fetchPrices(alerts)
  }, [alerts, fetchPrices])

  function enrichAlerts(rawAlerts: PriceAlert[]): AlertCardEnriched[] {
    return rawAlerts.map(alert => {
      const q = quotes[alert.ticker]
      const currentPrice = q?.price ?? null
      const isTriggeredLive =
        currentPrice !== null &&
        (alert.direction === 'above'
          ? currentPrice >= alert.target_price
          : currentPrice <= alert.target_price)
      const distancePct =
        currentPrice !== null
          ? Math.abs(((alert.target_price - currentPrice) / currentPrice) * 100)
          : 0
      return { ...alert, currentPrice, isTriggeredLive, distancePct }
    })
  }

  function handleAdded(alert: PriceAlert) {
    setAlerts(prev => [alert, ...prev])
  }

  function handleDelete(alertId: string) {
    setDeletingIds(prev => new Set(prev).add(alertId))
    startTransition(async () => {
      const result = await deletePriceAlert(alertId)
      if (result.success) {
        setAlerts(prev => prev.filter(a => a.id !== alertId))
      }
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(alertId)
        return next
      })
    })
  }

  const enriched = enrichAlerts(alerts)
  const activeAlerts = enriched.filter(a => !a.triggered && !a.isTriggeredLive)
  const triggeredAlerts = enriched.filter(a => a.triggered || a.isTriggeredLive)

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (alerts.length === 0 && !showForm) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-black"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-bricolage)' }}
            >
              Price Alerts
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Get notified when stocks hit your target price.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
            style={{
              backgroundColor: 'var(--amber)',
              color: '#050810',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            ADD ALERT
          </button>
        </div>

        <div
          className="flex flex-col items-center justify-center py-24 space-y-5 rounded-lg border"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border"
            style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)' }}
          >
            <Bell className="w-7 h-7" style={{ color: 'var(--amber)' }} />
          </div>
          <div className="text-center space-y-2">
            <h3
              className="text-lg font-bold"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-bricolage)' }}
            >
              No alerts set
            </h3>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
              Get notified when stocks hit your target price. Set your first alert to stay ahead of the market.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{ backgroundColor: 'var(--amber)', color: '#050810' }}
          >
            <Plus className="w-4 h-4" />
            Set First Alert
          </button>
        </div>
      </div>
    )
  }

  // ─── Main view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-black"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-bricolage)' }}
          >
            Price Alerts
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-[11px] tabular-nums"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
            </span>
            {triggeredAlerts.length > 0 && (
              <>
                <span style={{ color: 'var(--text-ghost)' }} className="text-[11px]">·</span>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}
                >
                  {triggeredAlerts.length} triggered
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-150"
          style={
            showForm
              ? {
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }
              : {
                  backgroundColor: 'var(--amber)',
                  borderColor: 'transparent',
                  color: '#050810',
                  fontFamily: 'var(--font-mono)',
                }
          }
        >
          {showForm ? (
            <>
              <X className="w-3.5 h-3.5" />
              CANCEL
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              ADD ALERT
            </>
          )}
        </button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <AddAlertForm onClose={() => setShowForm(false)} onAdded={handleAdded} />
      )}

      {/* Active alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <p
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
          >
            Active — {activeAlerts.length}
          </p>
          <div className="space-y-2">
            {activeAlerts.map((alert, idx) => (
              <div
                key={alert.id}
                className="animate-fade-up"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <AlertCard
                  alert={alert}
                  onDelete={handleDelete}
                  deleting={deletingIds.has(alert.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty active state when form shown but no active alerts */}
      {activeAlerts.length === 0 && !showForm && triggeredAlerts.length > 0 && (
        <div
          className="rounded-lg border p-6 flex flex-col items-center gap-2"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <BellOff className="w-6 h-6" style={{ color: 'var(--text-ghost)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No active alerts. Add one above.
          </p>
        </div>
      )}

      {/* Triggered alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="space-y-3">
          <p
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}
          >
            Triggered — {triggeredAlerts.length}
          </p>
          <div className="space-y-2">
            {triggeredAlerts.map((alert, idx) => (
              <div
                key={alert.id}
                className="animate-fade-up"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <TriggeredCard
                  alert={alert}
                  onResolve={handleDelete}
                  resolving={deletingIds.has(alert.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div
        className="flex items-center gap-2 pt-1 text-[10px]"
        style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--amber)' }} />
        PRICES VIA YAHOO FINANCE · TRIGGERS EVALUATED ON PAGE LOAD
      </div>
    </div>
  )
}
