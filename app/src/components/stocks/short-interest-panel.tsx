'use client'

import { useState, useEffect } from 'react'
import type { ShortInterestResponse } from '@/app/api/stocks/short-interest/route'

interface Props {
  ticker: string
}

function SignalBadge({ value, type }: { value: string; type: 'signal' | 'squeeze' }) {
  const isHigh = value === 'high' || value === 'elevated'
  const isMod = value === 'moderate'

  const color = isHigh ? 'var(--negative)' : isMod ? 'var(--amber)' : 'var(--positive)'
  const bg = isHigh ? 'rgba(248,113,113,0.08)' : isMod ? 'var(--amber-dim)' : 'rgba(16,185,129,0.08)'

  const label = type === 'signal'
    ? (isHigh ? 'HIGH' : isMod ? 'MODERATE' : 'LOW')
    : (isHigh ? 'ELEVATED' : isMod ? 'MODERATE' : 'LOW')

  return (
    <span
      className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.06em]"
      style={{ color, backgroundColor: bg, fontFamily: 'var(--font-mono)' }}>
      {label}
    </span>
  )
}

function SkeletonRow() {
  return (
    <div className="flex justify-between items-center py-2.5 border-b th-border animate-pulse">
      <div className="h-3 w-28 rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
      <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
    </div>
  )
}

export default function ShortInterestPanel({ ticker }: Props) {
  const [data, setData] = useState<ShortInterestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [noData, setNoData] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNoData(false)
    setData(null)

    fetch(`/api/stocks/short-interest?ticker=${encodeURIComponent(ticker)}`)
      .then(res => {
        if (!res.ok) throw new Error('no-data')
        return res.json() as Promise<ShortInterestResponse>
      })
      .then(json => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setNoData(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [ticker])

  const formatShortInterest = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1_000).toFixed(0)}K`

  return (
    <div className="rounded-lg border th-border p-5" style={{ backgroundColor: 'var(--surface)' }}>
      {/* Header */}
      <div className="text-[10px] uppercase tracking-[0.15em] th-text-ghost mb-4"
        style={{ fontFamily: 'var(--font-mono)' }}>
        SHORT INTEREST
      </div>

      {loading && (
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {noData && !loading && (
        <p className="text-xs th-text-muted py-2">No short interest data available.</p>
      )}

      {data && !loading && (
        <div className="space-y-0">
          {[
            {
              label: 'Short Float %',
              value: (
                <div className="flex items-center gap-2">
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                    {data.shortInterestPercent.toFixed(1)}%
                  </span>
                  <SignalBadge value={data.signal} type="signal" />
                </div>
              ),
            },
            {
              label: 'Days to Cover',
              value: (
                <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                  {data.daysToCover.toFixed(1)} days
                </span>
              ),
            },
            {
              label: 'Squeeze Risk',
              value: <SignalBadge value={data.squeezeRisk} type="squeeze" />,
            },
            {
              label: 'Shares Short',
              value: (
                <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatShortInterest(data.shortInterest)}
                </span>
              ),
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between py-2.5 border-b th-border last:border-0">
              <span className="text-xs th-text-muted">{label}</span>
              <span className="text-xs font-semibold th-text">{value}</span>
            </div>
          ))}

          <div className="pt-3 text-[9px] th-text-ghost"
            style={{ fontFamily: 'var(--font-mono)' }}>
            AS OF {data.date.slice(0, 10)} · VIA FMP
          </div>
        </div>
      )}
    </div>
  )
}
