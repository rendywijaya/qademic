'use client'

import { useEffect, useState } from 'react'
import type { DividendData } from '@/app/api/stocks/dividend/route'

const BAR_MAX_PX = 44

function MiniBarChart({ history }: { history: DividendData['history'] }) {
  if (history.length === 0) return null
  const max = Math.max(...history.map(h => h.amount))
  return (
    <div className="flex items-end gap-2">
      {history.map((h) => {
        const ratio = max > 0 ? h.amount / max : 0
        const barPx = Math.max(4, Math.round(ratio * BAR_MAX_PX))
        return (
          <div key={h.year} className="flex flex-col items-center gap-1 flex-1">
            <div className="text-[8px] tabular-nums th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
              ${h.amount.toFixed(2)}
            </div>
            <div className="w-full rounded-sm"
              style={{ height: `${barPx}px`, backgroundColor: 'var(--positive)', opacity: 0.75 }} />
            <div className="text-[8px] th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
              {h.year}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.12em] th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums" style={{ color: color ?? 'var(--text)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  )
}

export default function DividendPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<DividendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/stocks/dividend?ticker=${ticker}`)
      .then(r => r.json())
      .then((d: DividendData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }} />)}
        </div>
        <div className="h-20 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }} />
      </div>
    )
  }

  if (!data || (data.yield === 0 && data.history.length === 0)) {
    return (
      <div className="rounded-lg border px-4 py-5 text-center"
        style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
        <p className="text-xs th-text-ghost">This company does not pay a dividend.</p>
      </div>
    )
  }

  const yieldColor = data.yield > 4 ? 'var(--positive)' : data.yield > 2 ? 'var(--amber)' : 'var(--text-muted)'
  const payoutColor = data.payoutRatio != null
    ? data.payoutRatio > 80 ? 'var(--negative)' : data.payoutRatio > 60 ? 'var(--amber)' : 'var(--positive)'
    : undefined

  return (
    <div className="space-y-5">
      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border"
        style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(16,185,129,0.02)' }}>
        <StatItem label="Dividend Yield" value={data.yield > 0 ? `${data.yield}%` : '—'} color={yieldColor} />
        <StatItem label="Annual Amount" value={data.annualAmount > 0 ? `$${data.annualAmount.toFixed(2)}` : '—'} />
        <StatItem label="Payout Ratio" value={data.payoutRatio != null ? `${data.payoutRatio}%` : '—'} color={payoutColor} />
        <StatItem label="Frequency" value={data.frequency} />
      </div>

      {/* Dates + growth */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatItem label="Ex-Div Date" value={data.exDividendDate ?? '—'} />
        <StatItem label="Payment Date" value={data.paymentDate ?? '—'} />
        <StatItem
          label="5Y Div Growth"
          value={data.fiveYearGrowthRate != null ? `${data.fiveYearGrowthRate > 0 ? '+' : ''}${data.fiveYearGrowthRate}%/yr` : '—'}
          color={data.fiveYearGrowthRate != null ? (data.fiveYearGrowthRate > 0 ? 'var(--positive)' : 'var(--negative)') : undefined}
        />
      </div>

      {/* 5-year history chart */}
      {data.history.length > 1 && (
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] th-text-ghost mb-3"
            style={{ fontFamily: 'var(--font-mono)' }}>
            ANNUAL DIVIDEND HISTORY
          </div>
          <MiniBarChart history={data.history} />
        </div>
      )}

      {/* Payout ratio warning */}
      {data.payoutRatio != null && data.payoutRatio > 80 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
          style={{ backgroundColor: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
          <span style={{ color: 'var(--negative)' }}>⚠</span>
          <span style={{ color: 'var(--negative)' }}>
            High payout ratio ({data.payoutRatio}%) — dividend sustainability may be at risk if earnings decline.
          </span>
        </div>
      )}
    </div>
  )
}
