'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { EarningsModel } from '@/app/api/stocks/earnings-model/route'

interface Props {
  ticker: string
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex justify-between items-center py-2.5 border-b th-border animate-pulse">
      <div className="h-3 w-28 rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
      <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
    </div>
  )
}

function SkeletonPanel() {
  return (
    <div className="space-y-3">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  )
}

// ── Consensus badge ───────────────────────────────────────────────────────────

type ConsensusRating = EarningsModel['consensusRating']

function ratingStyle(rating: ConsensusRating): { color: string; bg: string; border: string } {
  switch (rating) {
    case 'Strong Buy':
      return {
        color: 'var(--positive)',
        bg: 'rgba(16,185,129,0.10)',
        border: 'rgba(16,185,129,0.25)',
      }
    case 'Buy':
      return {
        color: 'rgba(16,185,129,0.85)',
        bg: 'rgba(16,185,129,0.06)',
        border: 'rgba(16,185,129,0.18)',
      }
    case 'Hold':
      return {
        color: 'var(--amber)',
        bg: 'var(--amber-dim)',
        border: 'var(--amber-border)',
      }
    case 'Sell':
      return {
        color: 'rgba(248,113,113,0.85)',
        bg: 'rgba(248,113,113,0.06)',
        border: 'rgba(248,113,113,0.18)',
      }
    case 'Strong Sell':
      return {
        color: 'var(--negative)',
        bg: 'rgba(248,113,113,0.10)',
        border: 'rgba(248,113,113,0.25)',
      }
  }
}

// ── Recharts custom tooltip ───────────────────────────────────────────────────

interface TooltipPayload {
  value: number
  payload: EarningsModel['surprises'][number]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
}

function SurpriseTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  const sign = d.surprise >= 0 ? '+' : ''
  const beatMiss = d.beat ? 'Beat by' : 'Missed by'
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor: 'var(--surface-2)',
        borderColor: 'var(--border)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text)',
      }}>
      <div className="font-bold mb-0.5">{d.period}</div>
      <div style={{ color: d.beat ? 'var(--positive)' : 'var(--negative)' }}>
        {beatMiss} {sign}{d.surprisePct.toFixed(1)}%
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        ${d.actual.toFixed(2)} vs ${d.estimate.toFixed(2)} est.
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[9px] uppercase tracking-[0.12em] mb-3"
      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
      {children}
    </div>
  )
}

// ── Consensus distribution bar ────────────────────────────────────────────────

interface DistBarProps {
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  total: number
}

function ConsensusBar({ strongBuy, buy, hold, sell, strongSell, total }: DistBarProps) {
  if (total === 0) return null
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`
  const segments = [
    { label: 'Strong Buy', n: strongBuy, color: 'var(--positive)' },
    { label: 'Buy', n: buy, color: 'rgba(16,185,129,0.60)' },
    { label: 'Hold', n: hold, color: 'var(--amber)' },
    { label: 'Sell', n: sell, color: 'rgba(248,113,113,0.60)' },
    { label: 'Strong Sell', n: strongSell, color: 'var(--negative)' },
  ].filter(s => s.n > 0)

  return (
    <div className="space-y-2 mt-3">
      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: pct(s.n), backgroundColor: s.color, flexShrink: 0 }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map(s => (
          <span
            key={s.label}
            className="flex items-center gap-1 text-[9px]"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <span
              className="inline-block w-1.5 h-1.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label} ({s.n})
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function EarningsModelPanel({ ticker }: Props) {
  const [data, setData] = useState<EarningsModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [noData, setNoData] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNoData(false)
    setData(null)

    fetch(`/api/stocks/earnings-model?ticker=${encodeURIComponent(ticker)}`)
      .then(res => {
        if (!res.ok) throw new Error('no-data')
        return res.json() as Promise<EarningsModel>
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

    return () => {
      cancelled = true
    }
  }, [ticker])

  const formatRevenue = (n: number) => {
    if (n === 0) return '—'
    const b = n / 1_000_000_000
    return b >= 1 ? `$${b.toFixed(1)}B` : `$${(n / 1_000_000).toFixed(0)}M`
  }

  const fmt2 = (n: number) => `$${Math.abs(n).toFixed(2)}`
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

  return (
    <div className="rounded-lg border p-5 space-y-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>

      {loading && <SkeletonPanel />}

      {noData && !loading && (
        <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
          Earnings data unavailable for this ticker.
        </p>
      )}

      {data && !loading && (
        <>
          {/* ── Section A: Analyst Consensus ─────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: Rating */}
            <div>
              <SectionLabel>ANALYST CONSENSUS</SectionLabel>
              {data.totalAnalysts > 0 ? (
                <>
                  {/* Badge */}
                  <span
                    className="inline-flex items-center px-3 py-1.5 rounded-md border text-sm font-black tracking-widest uppercase"
                    style={{
                      ...ratingStyle(data.consensusRating),
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: ratingStyle(data.consensusRating).bg,
                      borderColor: ratingStyle(data.consensusRating).border,
                    }}>
                    {data.consensusRating}
                  </span>
                  <ConsensusBar
                    strongBuy={data.strongBuy}
                    buy={data.buy}
                    hold={data.hold}
                    sell={data.sell}
                    strongSell={data.strongSell}
                    total={data.totalAnalysts}
                  />
                </>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No consensus data.</p>
              )}
            </div>

            {/* Right: Price targets */}
            <div>
              <SectionLabel>ANALYST PRICE TARGETS</SectionLabel>
              {data.priceTargetMean > 0 ? (
                <div className="space-y-2">
                  {/* Mean + upside (prominent) */}
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mean Target</span>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-base font-bold tabular-nums"
                        style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                        ${data.priceTargetMean.toFixed(2)}
                      </span>
                      <span
                        className="text-[11px] font-semibold tabular-nums"
                        style={{
                          color: data.priceTargetUpside >= 0 ? 'var(--positive)' : 'var(--negative)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                        {data.priceTargetUpside >= 0 ? '▲' : '▼'} {fmtPct(data.priceTargetUpside)} upside
                      </span>
                    </div>
                  </div>
                  {[
                    { label: 'High', val: `$${data.priceTargetHigh.toFixed(2)}` },
                    { label: 'Low', val: `$${data.priceTargetLow.toFixed(2)}` },
                    { label: 'Analysts', val: `${data.totalAnalysts > 0 ? data.totalAnalysts : '—'} covering` },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span
                        className="text-xs tabular-nums font-semibold"
                        style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No price target data.</p>
              )}
            </div>
          </div>

          {/* ── Section B: EPS Surprise History ──────────────────────────── */}
          {data.surprises.length > 0 && (
            <div>
              {/* Header with beat rate chip */}
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>EPS SURPRISE HISTORY</SectionLabel>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-[0.06em]"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--q3)',
                    backgroundColor: 'rgba(52,211,153,0.08)',
                    border: '1px solid rgba(52,211,153,0.20)',
                  }}>
                  BEAT RATE {data.beatRate.toFixed(1)}% · AVG {data.avgSurprisePct >= 0 ? '+' : ''}{data.avgSurprisePct.toFixed(1)}% SURPRISE
                </span>
              </div>

              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={data.surprises.slice(0, 6).reverse()}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="period"
                    tick={{
                      fontSize: 9,
                      fill: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 9,
                      fill: 'var(--text-dim)',
                      fontFamily: 'var(--font-mono)',
                    }}
                    tickFormatter={v => `${v > 0 ? '+' : ''}${(v as number).toFixed(0)}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<SurpriseTooltip />}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                  <Bar dataKey="surprisePct" radius={[3, 3, 0, 0]}>
                    {data.surprises
                      .slice(0, 6)
                      .reverse()
                      .map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.beat ? 'var(--positive)' : 'var(--negative)'}
                          opacity={0.85}
                        />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Section C: Forward EPS Estimates ─────────────────────────── */}
          {data.estimates.length > 0 && (
            <div>
              <SectionLabel>FORWARD EPS ESTIMATES</SectionLabel>
              <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-2)' }}>
                      {['Quarter', 'EPS Est.', 'Range', 'Analysts'].map(h => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-medium"
                          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.estimates.map((est, i) => (
                      <tr
                        key={est.date}
                        className="border-t"
                        style={{ borderColor: 'var(--border)', backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                        <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                          {est.period}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                          {fmt2(est.epsAvg)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                          {fmt2(est.epsLow)}–{fmt2(est.epsHigh)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {est.analystCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Section D: Revenue Estimates ─────────────────────────────── */}
          {data.estimates.length > 0 && (
            <div>
              <SectionLabel>REVENUE ESTIMATES</SectionLabel>
              <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-2)' }}>
                      {['Quarter', 'Rev. Est.', 'Range', 'Analysts'].map(h => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-medium"
                          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.estimates.map((est, i) => (
                      <tr
                        key={est.date}
                        className="border-t"
                        style={{ borderColor: 'var(--border)', backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                        <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                          {est.period}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                          {formatRevenue(est.revenueAvg)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                          {formatRevenue(est.revenueLow)}–{formatRevenue(est.revenueHigh)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {est.analystCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            className="text-[9px] pt-1"
            style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
            DATA VIA FMP · REFRESHED EVERY 6H · AS OF {data.updatedAt.slice(0, 10)}
          </div>
        </>
      )}
    </div>
  )
}
