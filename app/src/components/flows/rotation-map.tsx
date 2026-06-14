'use client'

import Link from 'next/link'
import { Wind } from 'lucide-react'
import type { SectorRotation } from '@/app/api/rotation/route'

// Rotation Map — the v3 core of the Flows surface (QADEMIC.md §3 job 2).
// Multi-horizon relative strength vs SPY. Classic four-phase read:
// 3m RS level = position, 1m RS pace vs 3m average pace = direction.

interface Props {
  sectors: SectorRotation[]
  asOf: string | null
}

type Phase = 'leading' | 'weakening' | 'improving' | 'lagging'

function phaseOf(s: SectorRotation): Phase {
  const rs3m = s.rs3m ?? 0
  const rs1m = s.rs1m ?? 0
  const accelerating = rs1m > rs3m / 3 // 1m pace above the 3m average monthly pace
  if (rs3m > 0) return accelerating ? 'leading' : 'weakening'
  return accelerating ? 'improving' : 'lagging'
}

const PHASE_META: Record<Phase, { label: string; color: string; hint: string }> = {
  leading:   { label: 'LEADING',   color: '#10B981', hint: 'Strong & accelerating — money is here' },
  improving: { label: 'IMPROVING', color: '#F59E0B', hint: 'Weak but accelerating — money arriving' },
  weakening: { label: 'WEAKENING', color: '#FBBF24', hint: 'Strong but fading — money leaving' },
  lagging:   { label: 'LAGGING',   color: '#6B7280', hint: 'Weak & fading — money is gone' },
}

function fmtRs(v: number | null): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}`
}

function rsColor(v: number | null): string {
  if (v === null) return '#4B5563'
  return v >= 0 ? '#10B981' : '#F87171'
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return <div className="w-[88px] h-[26px]" />
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const w = 88
  const h = 26
  const step = w / (points.length - 1)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - 3 - ((p - min) / range) * (h - 6)).toFixed(1)}`)
    .join(' ')
  const lastY = h - 3 - ((points[points.length - 1] - min) / range) * (h - 6)
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth={1.25} opacity={0.85} />
      <circle cx={w} cy={lastY} r={2} fill={color} />
    </svg>
  )
}

export default function RotationMap({ sectors, asOf }: Props) {
  if (sectors.length === 0) return null

  return (
    <div
      className="rounded-lg border"
      style={{ borderColor: '#1F2937', backgroundColor: 'transparent' }}
    >
      {/* Header */}
      <div className="px-4 md:px-5 pt-4 pb-3 border-b" style={{ borderColor: '#1F2937' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            className="text-[9px] font-bold tracking-[0.15em] uppercase flex items-center gap-1.5"
            style={{ color: '#F59E0B', fontFamily: 'var(--font-mono)' }}
          >
            <Wind className="w-3 h-3" />
            Sector Rotation · Relative Strength vs SPY
          </div>
          {asOf && (
            <div className="text-[10px] tabular-nums" style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}>
              AS OF {asOf}
            </div>
          )}
        </div>
        <p className="text-xs mt-2 max-w-2xl" style={{ color: '#9CA3AF', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.6 }}>
          Where money has been flowing — sector return minus SPY return per horizon.
          Ranked by 3-month relative strength (industry momentum persists for months —{' '}
          <span style={{ color: '#6B7280' }}>Moskowitz &amp; Grinblatt 1999</span>).
        </p>
      </div>

      {/* Column heads */}
      <div
        className="hidden md:grid items-center gap-3 px-5 py-2 border-b text-[9px] font-bold tracking-[0.12em] uppercase"
        style={{
          gridTemplateColumns: '24px 1.4fr 64px 64px 64px 100px 110px 92px',
          borderColor: '#1F2937',
          color: '#4B5563',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span>#</span>
        <span>Sector</span>
        <span className="text-right">1M</span>
        <span className="text-right">3M</span>
        <span className="text-right">6M</span>
        <span className="text-right">vs 200DMA</span>
        <span>Phase</span>
        <span className="text-right">26W RS</span>
      </div>

      {/* Rows */}
      <div>
        {sectors.map((s, i) => {
          const phase = phaseOf(s)
          const meta = PHASE_META[phase]
          return (
            <Link
              key={s.etf}
              href={`/dashboard/sectors`}
              className="grid items-center gap-3 px-4 md:px-5 py-2.5 border-b last:border-b-0 transition-colors group grid-cols-[24px_1fr_64px_92px] md:grid-cols-[24px_1.4fr_64px_64px_64px_100px_110px_92px]"
              style={{ borderColor: 'rgba(31,41,55,0.6)' }}
            >
              {/* Rank */}
              <span
                className="text-[11px] tabular-nums font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: i < 3 ? '#F59E0B' : '#4B5563' }}
              >
                {s.rank}
              </span>

              {/* Sector */}
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span
                  className="text-xs font-semibold truncate group-hover:text-white transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)', color: '#F9FAFB' }}
                >
                  {s.sector}
                </span>
                <span className="text-[9px] shrink-0" style={{ fontFamily: 'var(--font-mono)', color: '#4B5563' }}>
                  {s.etf}
                </span>
              </span>

              {/* RS columns — 1m hidden on mobile via order */}
              <span className="hidden md:block text-right text-[11px] tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: rsColor(s.rs1m) }}>
                {fmtRs(s.rs1m)}
              </span>
              <span className="text-right text-[11px] tabular-nums font-bold" style={{ fontFamily: 'var(--font-mono)', color: rsColor(s.rs3m) }}>
                {fmtRs(s.rs3m)}
              </span>
              <span className="hidden md:block text-right text-[11px] tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: rsColor(s.rs6m) }}>
                {fmtRs(s.rs6m)}
              </span>

              {/* 200dma */}
              <span className="hidden md:block text-right text-[10px] tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: s.above200dma ? '#10B981' : '#F87171' }}>
                {s.pctVs200dma === null ? '—' : `${s.pctVs200dma >= 0 ? '+' : ''}${s.pctVs200dma.toFixed(1)}%`}
              </span>

              {/* Phase */}
              <span className="hidden md:flex items-center" title={meta.hint}>
                <span
                  className="text-[8.5px] font-bold tracking-[0.1em] px-1.5 py-0.5 rounded border"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: meta.color,
                    borderColor: `${meta.color}40`,
                    backgroundColor: `${meta.color}0D`,
                  }}
                >
                  {meta.label}
                </span>
              </span>

              {/* Sparkline */}
              <span className="flex justify-end">
                <Sparkline points={s.rsTrend} color={(s.rs3m ?? 0) >= 0 ? '#10B981' : '#F87171'} />
              </span>
            </Link>
          )
        })}
      </div>

      {/* Footer legend */}
      <div
        className="px-4 md:px-5 py-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t"
        style={{ borderColor: '#1F2937' }}
      >
        {(Object.keys(PHASE_META) as Phase[]).map(p => (
          <span key={p} className="text-[9px]" style={{ fontFamily: 'var(--font-mono)', color: '#6B7280' }}>
            <span style={{ color: PHASE_META[p].color }}>{PHASE_META[p].label}</span> {PHASE_META[p].hint}
          </span>
        ))}
      </div>
    </div>
  )
}
