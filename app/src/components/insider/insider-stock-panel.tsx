'use client'

import { useEffect, useState } from 'react'
import type { InsiderData, InsiderTransaction } from '@/app/api/insider/route'

function fmt(n: number) {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TransactionRow({ tx }: { tx: InsiderTransaction }) {
  const isBuy = tx.transactionType?.toLowerCase().includes('p-purchase') ||
                tx.transactionType?.toLowerCase().includes('buy')
  const value = tx.securitiesTransacted * tx.price

  return (
    <div className="flex items-center gap-3 py-2.5 border-b th-border last:border-0">
      <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
        style={{ backgroundColor: isBuy ? 'var(--positive)' : 'var(--negative)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold th-text truncate">{tx.reportingName}</div>
        <div className="text-[10px] th-text-ghost">{tx.typeOfOwner} · {fmtDate(tx.transactionDate)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[11px] font-bold tabular-nums" style={{ color: isBuy ? 'var(--positive)' : 'var(--negative)', fontFamily: 'var(--font-mono)' }}>
          {isBuy ? '+' : '-'}{fmt(Math.abs(value))}
        </div>
        <div className="text-[9px] th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
          {tx.securitiesTransacted.toLocaleString()} shares
        </div>
      </div>
    </div>
  )
}

export default function InsiderPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<InsiderData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/insider?ticker=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then((d: InsiderData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (loading) return (
    <div className="space-y-2">
      {[1,2,3].map(i => (
        <div key={i} className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
      ))}
    </div>
  )

  if (!data || data.transactions.length === 0) return (
    <div className="rounded-lg border p-4 text-center th-border">
      <p className="text-xs th-text-dim">No insider transactions found in the last 90 days.</p>
    </div>
  )

  const sentColor = data.insiderSentiment === 'bullish' ? 'var(--positive)' : data.insiderSentiment === 'bearish' ? 'var(--negative)' : 'var(--amber)'

  return (
    <div className="rounded-lg border th-border overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b th-border"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] th-text-ghost mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
            NET 90D FLOW
          </div>
          <div className="text-sm font-bold tabular-nums"
            style={{ color: data.netBuyingValue >= 0 ? 'var(--positive)' : 'var(--negative)', fontFamily: 'var(--font-mono)' }}>
            {data.netBuyingValue >= 0 ? '+' : ''}{fmt(data.netBuyingValue)}
          </div>
        </div>
        <div className="h-8 w-px th-border" />
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] th-text-ghost mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
            SENTIMENT
          </div>
          <div className="text-sm font-bold uppercase" style={{ color: sentColor, fontFamily: 'var(--font-mono)' }}>
            {data.insiderSentiment}
          </div>
        </div>
        <div className="h-8 w-px th-border" />
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] th-text-ghost mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
            TRANSACTIONS
          </div>
          <div className="text-sm font-bold tabular-nums th-text" style={{ fontFamily: 'var(--font-mono)' }}>
            {data.transactions.length}
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="px-4 divide-y divide-[var(--border)]">
        {data.transactions.slice(0, 6).map((tx, i) => (
          <TransactionRow key={i} tx={tx} />
        ))}
      </div>

      {data.transactions.length > 6 && (
        <div className="px-4 py-2 border-t th-border">
          <span className="text-[10px] th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
            +{data.transactions.length - 6} more transactions
          </span>
        </div>
      )}
    </div>
  )
}
