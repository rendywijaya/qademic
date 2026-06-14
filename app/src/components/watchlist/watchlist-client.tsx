'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react'
import type { WatchlistItem } from '@/lib/supabase/types'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import type { StockQuote } from '@/app/api/stocks/prices/route'
import { toggleWatchlist } from '@/app/actions/watchlist'
import { formatCurrency, formatPercent, timeAgo } from '@/lib/utils'
import Link from 'next/link'

type SortKey = 'ticker' | 'price' | 'change' | 'score'
type SortDir = 'asc' | 'desc'

interface WatchlistClientProps {
  items: WatchlistItem[]
  fundamentals: Record<string, FMPFundamentals>
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
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tabular-nums"
      style={{ color, backgroundColor: bg, borderColor: border, border: `1px solid ${border}`, fontFamily: 'var(--font-mono)' }}
    >
      Q{score}
    </span>
  )
}

function TickerBadge({ ticker }: { ticker: string }) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: 'var(--amber-dim)', border: '1px solid var(--amber-border)' }}
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

export default function WatchlistClient({ items: initialItems, fundamentals: initialFundamentals }: WatchlistClientProps) {
  const router = useRouter()
  const [items, setItems] = useState<WatchlistItem[]>(initialItems)
  const [fundamentals, setFundamentals] = useState<Record<string, FMPFundamentals>>(initialFundamentals)
  const [liveQuotes, setLiveQuotes] = useState<Record<string, StockQuote>>({})
  const [sortKey, setSortKey] = useState<SortKey>('ticker')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [removingTickers, setRemovingTickers] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const fetchPrices = useCallback(async () => {
    if (items.length === 0) return
    setRefreshing(true)
    try {
      const tickers = items.map(i => i.ticker).join(',')
      const res = await fetch(`/api/stocks/prices?tickers=${tickers}`)
      if (res.ok) {
        const data = await res.json() as Record<string, StockQuote>
        setLiveQuotes(data)
        setLastRefreshed(new Date())
      }
    } finally {
      setRefreshing(false)
    }
  }, [items])

  useEffect(() => {
    fetchPrices()
  }, [fetchPrices])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function handleRemove(ticker: string, companyName: string | null) {
    setRemovingTickers(prev => new Set(prev).add(ticker))
    startTransition(async () => {
      const result = await toggleWatchlist(ticker, companyName ?? ticker, true)
      if (result.success) {
        setItems(prev => prev.filter(i => i.ticker !== ticker))
        setLiveQuotes(prev => {
          const next = { ...prev }
          delete next[ticker]
          return next
        })
        setFundamentals(prev => {
          const next = { ...prev }
          delete next[ticker]
          return next
        })
      }
      setRemovingTickers(prev => {
        const next = new Set(prev)
        next.delete(ticker)
        return next
      })
    })
  }

  function handleRowClick(ticker: string, e: React.MouseEvent) {
    // Don't navigate if remove button was clicked
    const target = e.target as HTMLElement
    if (target.closest('[data-remove-btn]')) return
    router.push(`/dashboard/stocks/${ticker}`)
  }

  const getPrice = (ticker: string) => {
    const live = liveQuotes[ticker]
    if (live) return live.price
    return fundamentals[ticker]?.price ?? 0
  }

  const getChange = (ticker: string) => {
    const live = liveQuotes[ticker]
    if (live) return live.changePercent
    return fundamentals[ticker]?.change ?? 0
  }

  const sorted = [...items].sort((a, b) => {
    let diff = 0
    switch (sortKey) {
      case 'ticker':
        diff = a.ticker.localeCompare(b.ticker)
        break
      case 'price':
        diff = getPrice(a.ticker) - getPrice(b.ticker)
        break
      case 'change':
        diff = getChange(a.ticker) - getChange(b.ticker)
        break
      case 'score':
        diff = (fundamentals[a.ticker]?.score ?? 50) - (fundamentals[b.ticker]?.score ?? 50)
        break
    }
    return sortDir === 'asc' ? diff : -diff
  })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3" style={{ color: 'var(--amber)' }} />
      : <ArrowDown className="w-3 h-3" style={{ color: 'var(--amber)' }} />
  }

  function SortButton({ col, label }: { col: SortKey; label: string }) {
    return (
      <button
        onClick={() => handleSort(col)}
        className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] transition-colors hover:opacity-100"
        style={{
          fontFamily: 'var(--font-mono)',
          color: sortKey === col ? 'var(--amber)' : 'var(--text-ghost)',
        }}
      >
        {label}
        <SortIcon col={col} />
      </button>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6 animate-fade-up">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center border"
          style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)' }}
        >
          <Star className="w-7 h-7" style={{ color: 'var(--amber)' }} />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold th-text" style={{ fontFamily: 'var(--font-bricolage)' }}>
            Your watchlist is empty
          </h3>
          <p className="text-sm th-text-muted max-w-xs">
            Add stocks to your watchlist to track them here. Use the AI Screener to discover great companies.
          </p>
        </div>
        <Link
          href="/dashboard/qtools/screener"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
          style={{ backgroundColor: 'var(--amber)', color: '#050810' }}
        >
          <Search className="w-4 h-4" />
          Find Stocks
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1
              className="text-2xl font-black th-text"
              style={{ fontFamily: 'var(--font-bricolage)' }}
            >
              My Watchlist
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-[11px] tabular-nums th-text-muted"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {items.length} {items.length === 1 ? 'stock' : 'stocks'}
              </span>
              {lastRefreshed && (
                <>
                  <span className="th-text-ghost text-[11px]">·</span>
                  <span
                    className="text-[11px] th-text-ghost"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Refreshed {timeAgo(lastRefreshed)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPrices}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-200"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
          <Link
            href="/dashboard/qtools/screener"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-200"
            style={{
              borderColor: 'var(--amber-border)',
              backgroundColor: 'var(--amber-dim)',
              color: 'var(--amber)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Search className="w-3.5 h-3.5" />
            FIND STOCKS
          </Link>
        </div>
      </div>

      {/* Table header */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Column headers */}
        <div
          className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 px-4 py-2.5 border-b"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <div className="w-10" />
          <SortButton col="ticker" label="TICKER / COMPANY" />
          <SortButton col="price" label="PRICE" />
          <SortButton col="change" label="CHANGE" />
          <span
            className="text-[10px] uppercase tracking-[0.12em] th-text-ghost"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            PE
          </span>
          <SortButton col="score" label="Q-SCORE" />
          <div className="w-7" />
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {sorted.map((item, idx) => {
            const f = fundamentals[item.ticker]
            const live = liveQuotes[item.ticker]
            const price = live?.price ?? f?.price ?? 0
            const changePercent = live?.changePercent ?? f?.change ?? 0
            const isPositive = changePercent > 0
            const isNeutral = changePercent === 0
            const changeColor = isPositive ? 'var(--positive)' : isNeutral ? 'var(--text-ghost)' : 'var(--negative)'
            const isRemoving = removingTickers.has(item.ticker)

            return (
              <div
                key={item.ticker}
                onClick={(e) => handleRowClick(item.ticker, e)}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 px-4 py-3.5 cursor-pointer transition-all duration-150 th-row-hover group animate-fade-up`}
                style={{
                  animationDelay: `${idx * 0.04}s`,
                  opacity: isRemoving ? 0.5 : 1,
                  pointerEvents: isRemoving ? 'none' : 'auto',
                }}
              >
                {/* Ticker badge */}
                <TickerBadge ticker={item.ticker} />

                {/* Ticker + company + sector */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-black th-text"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {item.ticker}
                    </span>
                    {live && (
                      <div
                        className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                        style={{ backgroundColor: 'var(--positive)' }}
                        title="Live price"
                      />
                    )}
                  </div>
                  <div className="text-xs th-text-dim truncate mt-0.5" style={{ maxWidth: '220px' }}>
                    {f?.name ?? item.company_name ?? item.ticker}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {f?.sector && f.sector !== 'Unknown' && (
                      <span
                        className="text-[10px] th-text-ghost"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {f.sector}
                      </span>
                    )}
                    {f?.sector && f.sector !== 'Unknown' && f?.industry && f.industry !== 'Unknown' && (
                      <span className="text-[10px] th-text-ghost">·</span>
                    )}
                    {f?.industry && f.industry !== 'Unknown' && (
                      <span
                        className="text-[10px] th-text-ghost truncate"
                        style={{ maxWidth: '140px' }}
                      >
                        {f.industry}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="text-right">
                  <span
                    className="text-sm font-bold tabular-nums th-text"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {price > 0
                      ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                  <div
                    className="text-[10px] th-text-ghost mt-0.5"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Added {timeAgo(new Date(item.added_at))}
                  </div>
                </div>

                {/* Change % */}
                <div className="text-right min-w-[64px]">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: changeColor, fontFamily: 'var(--font-mono)' }}
                  >
                    {isPositive ? '▲' : isNeutral ? '—' : '▼'}
                    {' '}
                    {Math.abs(changePercent).toFixed(2)}%
                  </span>
                </div>

                {/* PE */}
                <div className="text-right min-w-[48px]">
                  <span
                    className="text-xs tabular-nums th-text-muted"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {f?.pe && f.pe > 0 ? f.pe.toFixed(1) : '—'}
                  </span>
                </div>

                {/* Q-Score */}
                <div className="flex justify-center">
                  {f ? <QScoreBadge score={f.score} /> : <span className="text-xs th-text-ghost">—</span>}
                </div>

                {/* Remove button */}
                <div data-remove-btn className="flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(item.ticker, item.company_name)
                    }}
                    disabled={isRemoving}
                    className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    style={{
                      backgroundColor: 'var(--negative-dim)',
                      border: '1px solid rgba(248,113,113,0.2)',
                    }}
                    title={`Remove ${item.ticker} from watchlist`}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--negative)' }} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-2 pt-1 text-[10px] th-text-ghost"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--amber)' }} />
        LIVE PRICES VIA YAHOO FINANCE · FUNDAMENTALS VIA FMP · REFRESHED ON LOAD
      </div>
    </div>
  )
}
