'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ScreenerApiResult as StockResult } from '@/app/api/screener/route'
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { StockQuote } from '@/app/api/stocks/prices/route'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'

type SortKey = 'ticker' | 'pe' | 'revenueGrowth' | 'marketCap' | 'score' | 'price' | 'change'

interface ResultsTableProps {
  results: StockResult[]
  livePrices?: Record<string, StockQuote>
  fmpData?: Record<string, FMPFundamentals>
}

function ScoreBadge({ score }: { score: number }) {
  const [color, bg] =
    score >= 90 ? ['var(--positive)', 'rgba(16,185,129,0.10)']
    : score >= 75 ? ['var(--info)', 'rgba(56,189,248,0.10)']
    : ['var(--amber)', 'var(--amber-dim)']
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold tabular-nums"
      style={{ color, backgroundColor: bg, borderColor: `${color}40`, fontFamily: 'var(--font-mono)' }}>
      {score}
    </span>
  )
}

export default function ResultsTable({ results, livePrices = {}, fmpData = {} }: ResultsTableProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const enriched = results.map(s => {
    const live = livePrices[s.ticker]
    const fmp = fmpData[s.ticker]
    return {
      ...s,
      price: live?.price ?? fmp?.price ?? s.price,
      change: live?.changePercent ?? fmp?.change ?? s.change,
      pe: fmp?.pe ?? s.pe,
      revenueGrowth: fmp?.revenueGrowth ?? s.revenueGrowth,
      marketCap: fmp?.marketCap ?? s.marketCap,
      score: fmp?.score ?? s.score,
      _live: !!live,
      _fmp: !!fmp,
    }
  })

  const sorted = [...enriched].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const hasLive = Object.keys(livePrices).length > 0
  const hasFmp = Object.keys(fmpData).length > 0
  const loadingPrices = results.length > 0 && !hasLive

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3" style={{ color: 'var(--amber)' }} />
      : <ChevronDown className="w-3 h-3" style={{ color: 'var(--amber)' }} />
  }

  const thStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    color: 'var(--amber)',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    userSelect: 'none',
    padding: '12px 16px',
  }

  return (
    <div className="rounded-lg border th-border overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b th-border th-surface">
        {loadingPrices ? (
          <div className="flex items-center gap-1.5 text-[10px] th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--amber)' }} />
            FETCHING LIVE PRICES...
          </div>
        ) : hasLive ? (
          <div className="flex items-center gap-3 text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--positive)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--positive)' }} />
              LIVE PRICES · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            {hasFmp && (
              <div className="flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--amber)' }} />
                FMP FUNDAMENTALS
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b th-border th-surface-2">
              <th style={{ ...thStyle, textAlign: 'left' }} onClick={() => handleSort('ticker')}>
                <span className="inline-flex items-center gap-1">Ticker <SortIcon field="ticker" /></span>
              </th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('price')}>
                <span className="inline-flex items-center justify-end gap-1 w-full">Price <SortIcon field="price" /></span>
              </th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('change')}>
                <span className="inline-flex items-center justify-end gap-1 w-full">Day % <SortIcon field="change" /></span>
              </th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('pe')}>
                <span className="inline-flex items-center justify-end gap-1 w-full">P/E <SortIcon field="pe" /></span>
              </th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('revenueGrowth')}>
                <span className="inline-flex items-center justify-end gap-1 w-full">Rev Growth <SortIcon field="revenueGrowth" /></span>
              </th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('marketCap')}>
                <span className="inline-flex items-center justify-end gap-1 w-full">Mkt Cap <SortIcon field="marketCap" /></span>
              </th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('score')}>
                <span className="inline-flex items-center justify-end gap-1 w-full">Q Score <SortIcon field="score" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((stock) => {
              const isLive = !!livePrices[stock.ticker]
              const isFmp = !!fmpData[stock.ticker]

              return (
                <tr key={stock.ticker}
                  onClick={() => router.push(`/dashboard/stocks/${stock.ticker}`)}
                  className="border-b th-border last:border-0 transition-colors th-row-hover cursor-pointer">
                  <td style={{ padding: '14px 16px' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md border flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)' }}>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                          {stock.ticker.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-bold" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                          {stock.ticker}
                        </div>
                        <div className="text-xs th-text-dim">{stock.name}</div>
                        {'reasoning' in stock && (stock as StockResult & { reasoning?: string }).reasoning && (
                          <div className="text-[10px] th-text-ghost mt-0.5 max-w-[200px] truncate">
                            {(stock as StockResult & { reasoning?: string }).reasoning}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold tabular-nums th-text" style={{ fontFamily: 'var(--font-mono)' }}>
                        ${stock.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {isLive && (
                        <span className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}>
                          LIVE
                        </span>
                      )}
                      {!isLive && isFmp && (
                        <span className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                          FMP
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span className="text-sm font-medium tabular-nums" style={{
                      fontFamily: 'var(--font-mono)',
                      color: stock.change >= 0 ? 'var(--positive)' : 'var(--negative)',
                    }}>
                      {stock.change >= 0 ? '▲ +' : '▼ '}{Math.abs(stock.change).toFixed(2)}%
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span className="text-sm tabular-nums th-text" style={{ fontFamily: 'var(--font-mono)' }}>
                      {stock.pe > 0 ? `${stock.pe.toFixed(1)}x` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span className="text-sm font-medium tabular-nums" style={{
                      fontFamily: 'var(--font-mono)',
                      color: stock.revenueGrowth >= 20 ? 'var(--positive)' : 'var(--text)',
                    }}>
                      {stock.revenueGrowth >= 0 ? '+' : ''}{stock.revenueGrowth.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span className="text-sm tabular-nums th-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(stock.marketCap, true)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <ScoreBadge score={stock.score} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
