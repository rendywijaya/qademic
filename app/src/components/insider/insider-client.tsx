'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, TrendingUp, TrendingDown, Minus, Search, Loader2, Users, BarChart3 } from 'lucide-react'
import type { InsiderData, InsiderTransaction } from '@/app/api/insider/route'

interface Props {
  initialData: InsiderData | null
  initialTicker: string
}

function formatValue(value: number): string {
  const abs = Math.abs(value)
  const sign = value >= 0 ? '+' : '-'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatShares(shares: number): string {
  const abs = Math.abs(shares)
  const sign = shares >= 0 ? '+' : '-'
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${abs.toLocaleString()}`
}

function TypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    'P-Purchase': { label: 'PURCHASE', color: 'var(--positive)', bg: 'rgba(16,185,129,0.08)' },
    'S-Sale': { label: 'SALE', color: 'var(--negative)', bg: 'rgba(248,113,113,0.08)' },
    'A-Award': { label: 'AWARD', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  }
  const c = config[type] ?? { label: type, color: 'var(--text-muted)', bg: 'transparent' }
  return (
    <span
      className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.06em]"
      style={{ color: c.color, backgroundColor: c.bg, fontFamily: 'var(--font-mono)' }}>
      {c.label}
    </span>
  )
}

function NetSignalCard({ data }: { data: InsiderData }) {
  const isPositive = data.insiderSentiment === 'bullish'
  const isNegative = data.insiderSentiment === 'bearish'
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus
  const color = isPositive ? 'var(--positive)' : isNegative ? 'var(--negative)' : 'var(--amber)'
  const label = isPositive ? 'NET BUYING' : isNegative ? 'NET SELLING' : 'NEUTRAL'

  // For the bar chart, compute buy vs sell totals
  const buys = data.transactions
    .filter(t => t.transactionType === 'P-Purchase')
    .reduce((s, t) => s + (t.securitiesTransacted * t.price), 0)
  const sells = data.transactions
    .filter(t => t.transactionType === 'S-Sale')
    .reduce((s, t) => s + (t.securitiesTransacted * t.price), 0)
  const total = buys + sells || 1
  const buyPct = Math.round((buys / total) * 100)
  const sellPct = 100 - buyPct

  return (
    <div className="rounded-lg border p-6" style={{ borderColor: `${color}30`, backgroundColor: 'var(--surface)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center border"
          style={{ color, borderColor: `${color}30`, backgroundColor: `${color}10` }}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] th-text-ghost"
            style={{ fontFamily: 'var(--font-mono)' }}>
            NET INSIDER SIGNAL
          </div>
          <div className="text-xl font-black" style={{ color, fontFamily: 'var(--font-mono)' }}>
            {label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.08em] th-text-ghost mb-1"
            style={{ fontFamily: 'var(--font-mono)' }}>
            Net Value (90d)
          </div>
          <div className="text-lg font-black tabular-nums"
            style={{ color, fontFamily: 'var(--font-mono)' }}>
            {formatValue(data.netBuyingValue)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.08em] th-text-ghost mb-1"
            style={{ fontFamily: 'var(--font-mono)' }}>
            Net Shares (90d)
          </div>
          <div className="text-lg font-black tabular-nums"
            style={{ color, fontFamily: 'var(--font-mono)' }}>
            {formatShares(data.netBuyingShares)}
          </div>
        </div>
      </div>

      {/* Buy vs Sell bar */}
      <div>
        <div className="flex justify-between text-[9px] th-text-ghost mb-1"
          style={{ fontFamily: 'var(--font-mono)' }}>
          <span>BUYS {buyPct}%</span>
          <span>SELLS {sellPct}%</span>
        </div>
        <div className="flex rounded-full overflow-hidden h-2">
          <div className="h-full" style={{ width: `${buyPct}%`, backgroundColor: 'var(--positive)' }} />
          <div className="h-full" style={{ width: `${sellPct}%`, backgroundColor: 'var(--negative)' }} />
        </div>
      </div>
    </div>
  )
}

function TransactionRow({ t }: { t: InsiderTransaction }) {
  const value = t.securitiesTransacted * t.price
  const formattedValue = value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
    ? `$${(value / 1_000).toFixed(0)}K`
    : `$${value.toFixed(0)}`

  return (
    <tr className="border-b th-border hover:bg-[var(--surface-2)] transition-colors">
      <td className="py-3 px-4 text-[11px] tabular-nums th-text-muted"
        style={{ fontFamily: 'var(--font-mono)' }}>
        {t.transactionDate.slice(0, 10)}
      </td>
      <td className="py-3 px-4">
        <div className="text-xs font-semibold th-text">{t.reportingName}</div>
        <div className="text-[10px] th-text-ghost uppercase tracking-[0.06em]">{t.typeOfOwner}</div>
      </td>
      <td className="py-3 px-4">
        <TypeBadge type={t.transactionType} />
      </td>
      <td className="py-3 px-4 text-[11px] tabular-nums th-text text-right"
        style={{ fontFamily: 'var(--font-mono)' }}>
        {t.securitiesTransacted.toLocaleString()}
      </td>
      <td className="py-3 px-4 text-[11px] tabular-nums th-text-muted text-right"
        style={{ fontFamily: 'var(--font-mono)' }}>
        ${t.price.toFixed(2)}
      </td>
      <td className="py-3 px-4 text-[11px] tabular-nums font-semibold th-text text-right"
        style={{ fontFamily: 'var(--font-mono)' }}>
        {formattedValue}
      </td>
      <td className="py-3 px-4 text-center">
        {t.url ? (
          <a
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-6 h-6 rounded th-text-ghost transition-colors"
            style={{ backgroundColor: 'var(--surface-2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-ghost)')}>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="th-text-ghost text-[10px]">—</span>
        )}
      </td>
    </tr>
  )
}

function OwnershipSummary({ transactions }: { transactions: InsiderTransaction[] }) {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
  const recent = transactions.filter(t => new Date(t.transactionDate).getTime() >= cutoff)

  // Latest securitiesOwned per person
  const ownerMap = new Map<string, number>()
  for (const t of transactions) {
    if (!ownerMap.has(t.reportingName)) {
      ownerMap.set(t.reportingName, t.securitiesOwned ?? 0)
    }
  }
  const totalOwned = Array.from(ownerMap.values()).reduce((s, v) => s + v, 0)
  const distinctInsiders = new Set(recent.map(t => t.reportingName)).size

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 th-text-ghost" />
          <div className="text-[10px] uppercase tracking-[0.12em] th-text-ghost"
            style={{ fontFamily: 'var(--font-mono)' }}>
            Total Insider Ownership
          </div>
        </div>
        <div className="text-2xl font-black tabular-nums th-text"
          style={{ fontFamily: 'var(--font-mono)' }}>
          {totalOwned >= 1_000_000
            ? `${(totalOwned / 1_000_000).toFixed(1)}M`
            : totalOwned >= 1_000
            ? `${(totalOwned / 1_000).toFixed(0)}K`
            : totalOwned.toLocaleString()}
        </div>
        <div className="text-[10px] th-text-ghost mt-0.5">shares held by insiders</div>
      </div>
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 th-text-ghost" />
          <div className="text-[10px] uppercase tracking-[0.12em] th-text-ghost"
            style={{ fontFamily: 'var(--font-mono)' }}>
            Active Insiders (90d)
          </div>
        </div>
        <div className="text-2xl font-black tabular-nums th-text"
          style={{ fontFamily: 'var(--font-mono)' }}>
          {distinctInsiders}
        </div>
        <div className="text-[10px] th-text-ghost mt-0.5">distinct insiders transacted</div>
      </div>
    </div>
  )
}

export default function InsiderClient({ initialData, initialTicker }: Props) {
  const [data, setData] = useState<InsiderData | null>(initialData)
  const [ticker, setTicker] = useState(initialTicker)
  const [inputValue, setInputValue] = useState(initialTicker)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const analyze = useCallback(async (symbol: string) => {
    const t = symbol.trim().toUpperCase()
    if (!t) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/insider?ticker=${encodeURIComponent(t)}`)
      const json = await res.json() as InsiderData
      setData(json)
      setTicker(t)
      router.replace(`/dashboard/insider?ticker=${t}`, { scroll: false })
    } catch {
      setError('Failed to fetch insider data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    analyze(inputValue)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg border flex items-center justify-center"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)' }}>
            <Users className="w-4 h-4" style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold th-text">Insider Trading Tracker</h1>
            <p className="text-xs th-text-muted">SEC Form 4 insider transactions by company</p>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 th-text-ghost pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value.toUpperCase())}
              placeholder="Enter ticker symbol (e.g. AAPL)"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border th-border bg-transparent text-sm th-text placeholder:th-text-ghost outline-none transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              maxLength={10}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-[0.08em] transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: 'var(--amber)',
              color: 'var(--bg)',
              fontFamily: 'var(--font-mono)',
            }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            ANALYZE
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border p-4 text-sm"
          style={{ borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.06)', color: 'var(--negative)' }}>
          {error}
        </div>
      )}

      {/* Empty landing state */}
      {!data && !loading && !error && (
        <div className="text-center py-24 animate-fade-up">
          <div className="w-12 h-12 rounded-xl border mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'rgba(245,158,11,0.2)' }}>
            <Users className="w-6 h-6" style={{ color: 'var(--amber)' }} />
          </div>
          <h2 className="text-lg font-bold th-text mb-2">Track Insider Activity</h2>
          <p className="text-sm th-text-muted max-w-md mx-auto">
            Search a ticker to see insider trading activity from SEC Form 4 filings.
            Insiders often know things the market doesn&apos;t.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-40 rounded-lg" style={{ backgroundColor: 'var(--surface)' }} />
          <div className="h-64 rounded-lg" style={{ backgroundColor: 'var(--surface)' }} />
        </div>
      )}

      {/* Data view */}
      {data && !loading && (
        <div className="space-y-6 animate-fade-up">
          {data.transactions.length === 0 ? (
            <div className="text-center py-16 rounded-lg border th-border"
              style={{ backgroundColor: 'var(--surface)' }}>
              <Users className="w-8 h-8 th-text-ghost mx-auto mb-3" />
              <p className="text-sm th-text-muted">
                No insider transactions found for <span className="th-text font-bold">{ticker}</span>.
              </p>
            </div>
          ) : (
            <>
              {/* Net signal hero */}
              <NetSignalCard data={data} />

              {/* Ownership summary */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] th-text-ghost border-b mb-4 pb-2"
                  style={{ fontFamily: 'var(--font-mono)', borderColor: 'rgba(245,158,11,0.15)' }}>
                  OWNERSHIP SUMMARY
                </div>
                <OwnershipSummary transactions={data.transactions} />
              </div>

              {/* Transaction table */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] th-text-ghost border-b mb-4 pb-2"
                  style={{ fontFamily: 'var(--font-mono)', borderColor: 'rgba(245,158,11,0.15)' }}>
                  RECENT TRANSACTIONS — SEC FORM 4
                </div>
                <div className="rounded-lg border th-border overflow-hidden"
                  style={{ backgroundColor: 'var(--surface)' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b th-border">
                          {['Date', 'Insider', 'Type', 'Shares', 'Price', 'Value', 'Filing'].map(col => (
                            <th key={col}
                              className="py-3 px-4 text-left text-[9px] uppercase tracking-[0.1em] th-text-ghost"
                              style={{ fontFamily: 'var(--font-mono)' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.transactions.slice(0, 15).map((t, i) => (
                          <TransactionRow key={`${t.filingDate}-${t.reportingName}-${i}`} t={t} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 pt-2 border-t th-border text-[10px] th-text-ghost"
                style={{ fontFamily: 'var(--font-mono)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--amber)' }} />
                SEC FORM 4 DATA VIA FMP · REFRESHED EVERY 12H · {ticker}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
