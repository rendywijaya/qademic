'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { ArrowUpRight, ArrowDownRight, Minus, Activity, TrendingUp, BarChart2, ExternalLink } from 'lucide-react'
import type { SectorData, SectorPerformance } from '@/app/api/sectors/route'
import type { MacroData, MacroIndicator } from '@/app/api/macro/route'
import type { MarketItem } from '@/app/api/market-data/route'
import type { SectorRotation } from '@/app/api/rotation/route'
import RotationMap from './rotation-map'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sectorData: SectorData | null
  macroData: MacroData | null
  marketData: MarketItem[] | null
  rotationData?: { sectors: SectorRotation[]; asOf: string | null } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function pctColor(v: number): string {
  if (v > 0.5) return '#10B981'
  if (v > 0) return '#34D399'
  if (v < -0.5) return '#F87171'
  if (v < 0) return '#FCA5A5'
  return '#9CA3AF'
}

function pctBg(v: number): string {
  if (v > 0) return 'rgba(16,185,129,0.08)'
  if (v < 0) return 'rgba(248,113,113,0.08)'
  return 'rgba(156,163,175,0.06)'
}

function signStr(v: number): string {
  return v >= 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`
}

// ─── Macro thresholds ─────────────────────────────────────────────────────────

interface MacroStatus {
  label: string
  color: string
  bg: string
}

function getMacroStatus(id: string, rawValue: string): MacroStatus {
  const n = parseFloat(rawValue.replace(/[^0-9.\-]/g, ''))

  switch (id) {
    case 'FEDFUNDS':
      if (n >= 5) return { label: 'Restrictive', color: '#F87171', bg: 'rgba(248,113,113,0.08)' }
      if (n >= 3) return { label: 'Elevated', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' }
      return { label: 'Accommodative', color: '#10B981', bg: 'rgba(16,185,129,0.08)' }

    case 'CPIAUCSL':
      if (n >= 4) return { label: 'High', color: '#F87171', bg: 'rgba(248,113,113,0.08)' }
      if (n >= 2.5) return { label: 'Elevated', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' }
      if (n >= 0) return { label: 'Normal', color: '#10B981', bg: 'rgba(16,185,129,0.08)' }
      return { label: 'Deflation', color: '#F87171', bg: 'rgba(248,113,113,0.08)' }

    case 'UNRATE':
      if (n >= 6) return { label: 'High', color: '#F87171', bg: 'rgba(248,113,113,0.08)' }
      if (n >= 4.5) return { label: 'Elevated', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' }
      return { label: 'Healthy', color: '#10B981', bg: 'rgba(16,185,129,0.08)' }

    case 'DGS10':
      if (n >= 5) return { label: 'High', color: '#F87171', bg: 'rgba(248,113,113,0.08)' }
      if (n >= 4) return { label: 'Elevated', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' }
      return { label: 'Normal', color: '#10B981', bg: 'rgba(16,185,129,0.08)' }

    case 'T10Y2Y':
      if (n < -0.5) return { label: 'Inverted', color: '#F87171', bg: 'rgba(248,113,113,0.08)' }
      if (n < 0) return { label: 'Flat', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' }
      return { label: 'Normal', color: '#10B981', bg: 'rgba(16,185,129,0.08)' }

    case 'GDP':
      if (n < 0) return { label: 'Contraction', color: '#F87171', bg: 'rgba(248,113,113,0.08)' }
      return { label: 'Expanding', color: '#10B981', bg: 'rgba(16,185,129,0.08)' }

    default:
      return { label: 'Normal', color: '#9CA3AF', bg: 'rgba(156,163,175,0.06)' }
  }
}

// ─── Market Pulse Pill ────────────────────────────────────────────────────────

function MarketPill({ item }: { item: MarketItem }) {
  const up = item.changePercent >= 0
  const color = up ? '#10B981' : '#F87171'
  const Arrow = up ? ArrowUpRight : ArrowDownRight

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border shrink-0 transition-all card-hover"
      style={{
        borderColor: '#1F2937',
        backgroundColor: '#0D1117',
      }}
    >
      <div>
        <div
          className="text-[10px] font-bold tracking-[0.12em] uppercase mb-0.5"
          style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}
        >
          {item.symbol}
        </div>
        <div
          className="text-xs"
          style={{ color: '#6B7280', fontFamily: 'var(--font-dm-sans)' }}
        >
          {item.name}
        </div>
      </div>

      <div className="text-right">
        <div
          className="text-sm font-semibold tabular-nums"
          style={{ color: '#F9FAFB', fontFamily: 'var(--font-mono)' }}
        >
          {item.price}
        </div>
        <div
          className="flex items-center gap-0.5 text-[11px] font-medium tabular-nums justify-end"
          style={{ color, fontFamily: 'var(--font-mono)' }}
        >
          <Arrow className="w-3 h-3" />
          {item.changePercent >= 0 ? '+' : ''}
          {item.changePercent.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

// ─── Sector Card ─────────────────────────────────────────────────────────────

function SectorCard({ sector, rank, maxAbs }: { sector: SectorPerformance; rank: number; maxAbs: number }) {
  const barWidth = maxAbs > 0 ? Math.abs(sector.changePct) / maxAbs : 0
  const isPositive = sector.changePct >= 0

  return (
    <div
      className="relative p-3 rounded-lg border transition-all card-hover overflow-hidden"
      style={{ borderColor: '#1F2937', backgroundColor: 'transparent' }}
    >
      {/* Rank badge */}
      <div
        className="absolute top-2 right-2 text-[9px] font-bold tabular-nums"
        style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}
      >
        #{rank}
      </div>

      {/* Sector color dot + name */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: sector.color }}
        />
        <div
          className="text-[11px] font-medium leading-tight pr-5"
          style={{ color: '#F9FAFB', fontFamily: 'var(--font-dm-sans)' }}
        >
          {sector.sector}
        </div>
      </div>

      {/* ETF label */}
      <div
        className="text-[9px] font-bold tracking-[0.1em] uppercase mb-2"
        style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}
      >
        {sector.etf}
      </div>

      {/* Performance bar track */}
      <div
        className="h-1.5 rounded-full mb-1.5 overflow-hidden"
        style={{ backgroundColor: '#111827' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${barWidth * 100}%`,
            backgroundColor: isPositive ? '#10B981' : '#F87171',
          }}
        />
      </div>

      {/* Change value */}
      <div
        className="text-sm font-bold tabular-nums"
        style={{
          color: pctColor(sector.changePct),
          fontFamily: 'var(--font-mono)',
        }}
      >
        {signStr(sector.changePct)}
      </div>
    </div>
  )
}

// ─── Custom Recharts Tooltip ──────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: SectorPerformance }>
}

function SectorTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div
      className="px-3 py-2 rounded-lg border text-xs"
      style={{
        backgroundColor: '#0D1117',
        borderColor: '#374151',
        color: '#F9FAFB',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div style={{ color: d.color }} className="font-semibold mb-0.5">{d.sector}</div>
      <div style={{ color: pctColor(d.changePct) }}>{signStr(d.changePct)}</div>
      <div style={{ color: '#6B7280' }} className="text-[10px] mt-0.5">{d.etf}</div>
    </div>
  )
}

// ─── Macro Metric Card ────────────────────────────────────────────────────────

function MacroCard({ indicator }: { indicator: MacroIndicator }) {
  const status = getMacroStatus(indicator.id, indicator.value)
  const DirIcon =
    indicator.direction === 'up'
      ? ArrowUpRight
      : indicator.direction === 'down'
      ? ArrowDownRight
      : Minus

  const dirColor =
    indicator.direction === 'up'
      ? '#F87171'
      : indicator.direction === 'down'
      ? '#10B981'
      : '#9CA3AF'

  // Special case: for unemployment and CPI, up is bad; for yield curve, negative is bad
  // Already handled via getMacroStatus — just show direction neutrally

  return (
    <div
      className="p-4 rounded-lg border transition-all card-hover"
      style={{ borderColor: '#1F2937', backgroundColor: 'transparent' }}
    >
      {/* Label */}
      <div
        className="text-[10px] font-semibold tracking-[0.1em] uppercase mb-2"
        style={{ color: '#9CA3AF', fontFamily: 'var(--font-dm-sans)' }}
      >
        {indicator.label}
      </div>

      {/* Value */}
      <div
        className="text-2xl font-bold tabular-nums mb-2 leading-none"
        style={{ color: '#F9FAFB', fontFamily: 'var(--font-mono)' }}
      >
        {indicator.value}
        {indicator.unit !== 'T' && indicator.unit !== '$B' && (
          <span className="text-sm font-normal ml-0.5" style={{ color: '#4B5563' }}>
            {indicator.unit}
          </span>
        )}
      </div>

      {/* Status badge + change */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded"
          style={{
            color: status.color,
            backgroundColor: status.bg,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {status.label}
        </span>

        <div
          className="flex items-center gap-0.5 text-[11px] font-medium tabular-nums"
          style={{ color: dirColor, fontFamily: 'var(--font-mono)' }}
        >
          <DirIcon className="w-3 h-3" />
          {indicator.change}
        </div>
      </div>

      {/* Description */}
      <div
        className="mt-2 text-[10px] leading-relaxed"
        style={{ color: '#4B5563', fontFamily: 'var(--font-dm-sans)' }}
      >
        {indicator.description}
      </div>
    </div>
  )
}

// ─── Animated counter hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(eased * target)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return value
}

// ─── Summary stat: gainers vs losers ────────────────────────────────────────

function FlowSummary({ sectors }: { sectors: SectorPerformance[] }) {
  const gainers = sectors.filter(s => s.changePct > 0).length
  const losers = sectors.filter(s => s.changePct < 0).length
  const total = sectors.length
  const netFlow = sectors.reduce((acc, s) => acc + s.changePct, 0) / (total || 1)

  const gainersAnim = useCountUp(gainers, 600)
  const losersAnim = useCountUp(losers, 600)

  return (
    <div className="flex flex-wrap gap-3">
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
        style={{ borderColor: 'rgba(16,185,129,0.2)', backgroundColor: 'rgba(16,185,129,0.06)' }}
      >
        <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color: '#10B981', fontFamily: 'var(--font-mono)' }}
        >
          {Math.round(gainersAnim)} gaining
        </span>
      </div>

      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
        style={{ borderColor: 'rgba(248,113,113,0.2)', backgroundColor: 'rgba(248,113,113,0.06)' }}
      >
        <ArrowDownRight className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color: '#F87171', fontFamily: 'var(--font-mono)' }}
        >
          {Math.round(losersAnim)} losing
        </span>
      </div>

      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
        style={{
          borderColor: netFlow >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(248,113,113,0.2)',
          backgroundColor: netFlow >= 0 ? 'rgba(16,185,129,0.04)' : 'rgba(248,113,113,0.04)',
        }}
      >
        <Activity className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color: pctColor(netFlow), fontFamily: 'var(--font-mono)' }}
        >
          Avg {signStr(netFlow)}
        </span>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-center h-32 rounded-lg border"
      style={{ borderColor: '#1F2937', color: '#4B5563' }}
    >
      <span className="text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {label}
      </span>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export default function FlowsClient({ sectorData, macroData, marketData, rotationData }: Props) {
  const [mounted, setMounted] = useState(false)
  const now = new Date()

  useEffect(() => setMounted(true), [])

  // Sorted sectors
  const sectors: SectorPerformance[] = sectorData?.sectors
    ? [...sectorData.sectors].sort((a, b) => b.changePct - a.changePct)
    : []

  const maxAbs = sectors.length > 0 ? Math.max(...sectors.map(s => Math.abs(s.changePct))) : 1

  // Bar chart data — same sort order
  const barData = sectors.map(s => ({
    ...s,
    value: s.changePct,
    fill: pctColor(s.changePct),
  }))

  const indicators = macroData?.indicators ?? []

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#050810', color: '#F9FAFB' }}
    >
      {/* ── Page header ─────────────────────────────────────────── */}
      <section
        className="border-b px-4 md:px-6 lg:px-8 py-8 md:py-10"
        style={{ borderColor: '#1F2937' }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Q1 Macro tag */}
          <div
            className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.15em] uppercase mb-4 px-2.5 py-1 rounded border"
            style={{
              color: '#A78BFA',
              borderColor: 'rgba(167,139,250,0.25)',
              backgroundColor: 'rgba(167,139,250,0.06)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <TrendingUp className="w-3 h-3" />
            Q1 Macro Layer · Capital Flows
          </div>

          <h1
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 leading-tight"
            style={{ fontFamily: 'var(--font-bricolage)', color: '#F9FAFB' }}
          >
            Capital Flows &{' '}
            <span style={{ color: '#F59E0B' }}>Market Rotation</span>
          </h1>

          <p
            className="text-sm md:text-base mb-4 max-w-2xl"
            style={{ color: '#9CA3AF', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.7 }}
          >
            Where global money is moving today. Sector rotation, macro environment, and market pulse — all in one view.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: '#F59E0B' }}
              />
              Updated daily at market close
            </div>
            <div
              className="text-xs tabular-nums"
              style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}
            >
              {mounted ? formatDate(now.toISOString()) : ''}
            </div>
          </div>
        </div>
      </section>

      {/* ── Market Pulse Strip ───────────────────────────────────── */}
      <section
        className="border-b px-4 md:px-6 lg:px-8 py-4"
        style={{ borderColor: '#1F2937', backgroundColor: '#0D1117' }}
      >
        <div className="max-w-7xl mx-auto">
          <div
            className="text-[9px] font-bold tracking-[0.15em] uppercase mb-3 flex items-center gap-1.5"
            style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}
          >
            <Activity className="w-3 h-3" />
            Market Pulse
          </div>

          {marketData && marketData.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {marketData.map(item => (
                <MarketPill key={item.symbol} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState label="Market data unavailable" />
          )}
        </div>
      </section>

      {/* ── Rotation Map — where money is flowing (v3 core) ──────── */}
      {rotationData && rotationData.sectors.length > 0 && (
        <section className="px-4 md:px-6 lg:px-8 pt-6 md:pt-8">
          <div className="max-w-7xl mx-auto">
            <RotationMap sectors={rotationData.sectors} asOf={rotationData.asOf} />
          </div>
        </section>
      )}

      {/* ── Main Grid ────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Sector Rotation — 2/3 width ──────────────────── */}
            <div className="lg:col-span-2 space-y-5">
              {/* Section header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart2
                      className="w-4 h-4"
                      style={{ color: '#38BDF8' }}
                    />
                    <h2
                      className="text-lg font-bold"
                      style={{ fontFamily: 'var(--font-bricolage)', color: '#F9FAFB' }}
                    >
                      Sector Rotation
                    </h2>
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: '#6B7280', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    1-day performance · Updated daily
                    {sectorData?.source === 'fallback' && (
                      <span className="ml-2" style={{ color: '#F59E0B' }}>
                        (demo data)
                      </span>
                    )}
                  </p>
                </div>

                {sectors.length > 0 && <FlowSummary sectors={sectors} />}
              </div>

              {sectors.length > 0 ? (
                <>
                  {/* Bar chart */}
                  {mounted && (
                    <div
                      className="rounded-lg border p-4"
                      style={{ borderColor: '#1F2937' }}
                    >
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={barData}
                          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                          barCategoryGap="20%"
                        >
                          <XAxis
                            dataKey="etf"
                            tick={{
                              fontSize: 9,
                              fill: '#6B7280',
                              fontFamily: 'var(--font-mono)',
                            }}
                            axisLine={{ stroke: '#1F2937' }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{
                              fontSize: 9,
                              fill: '#6B7280',
                              fontFamily: 'var(--font-mono)',
                            }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => `${v > 0 ? '+' : ''}${(v as number).toFixed(1)}%`}
                          />
                          <Tooltip
                            content={<SectorTooltip />}
                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                          />
                          <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
                          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                            {barData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Card grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {sectors.map((sector, idx) => (
                      <SectorCard
                        key={sector.slug}
                        sector={sector}
                        rank={idx + 1}
                        maxAbs={maxAbs}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState label="Sector data unavailable" />
              )}
            </div>

            {/* ── Macro Signals — 1/3 width ────────────────────── */}
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity
                    className="w-4 h-4"
                    style={{ color: '#A78BFA' }}
                  />
                  <h2
                    className="text-lg font-bold"
                    style={{ fontFamily: 'var(--font-bricolage)', color: '#F9FAFB' }}
                  >
                    Macro Environment
                  </h2>
                </div>
                <p
                  className="text-xs"
                  style={{ color: '#6B7280', fontFamily: 'var(--font-dm-sans)' }}
                >
                  Federal Reserve + FRED data · Updated daily
                  {macroData?.source === 'fallback' && (
                    <span className="ml-2" style={{ color: '#F59E0B' }}>
                      (demo data)
                    </span>
                  )}
                </p>
              </div>

              {indicators.length > 0 ? (
                <div className="space-y-2">
                  {indicators.map(ind => (
                    <MacroCard key={ind.id} indicator={ind} />
                  ))}
                </div>
              ) : (
                <EmptyState label="Macro data unavailable" />
              )}

              {/* Macro context note */}
              <div
                className="p-3 rounded-lg border text-[10px] leading-relaxed"
                style={{
                  borderColor: 'rgba(167,139,250,0.15)',
                  backgroundColor: 'rgba(167,139,250,0.04)',
                  color: '#6B7280',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                <span style={{ color: '#A78BFA' }} className="font-semibold">Q1 Macro Layer.</span>{' '}
                These macro signals form the top layer of the Q5 Framework — the broadest filter for where capital wants to flow across asset classes and sectors.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        className="border-t px-4 md:px-6 lg:px-8 py-8 mt-4"
        style={{ borderColor: '#1F2937' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <p
                className="text-[11px]"
                style={{ color: '#4B5563', fontFamily: 'var(--font-dm-sans)' }}
              >
                Data: FMP (Financial Modeling Prep), FRED (Federal Reserve Economic Data).
                Updated daily. For educational purposes only — not financial advice.
              </p>
              <p
                className="text-[11px]"
                style={{ color: '#374151', fontFamily: 'var(--font-dm-sans)' }}
              >
                © {now.getFullYear()} Qademic · qademic.com ·{' '}
                <Link href="/methodology" style={{ color: '#6B7280' }}>
                  Methodology — every signal defined &amp; cited
                </Link>
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all shrink-0"
              style={{
                backgroundColor: '#F59E0B',
                color: '#050810',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              Research individual stocks
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
