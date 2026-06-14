'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Sparkles,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Layers,
} from 'lucide-react'
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
import type { SectorData, SectorPerformance } from '@/app/api/sectors/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectorsClientProps {
  data: SectorData | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPct(n: number, showSign = true): string {
  const sign = showSign && n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function getRotationTheme(sectors: SectorPerformance[]): { theme: string; description: string } {
  if (sectors.length === 0) return { theme: 'Mixed signals', description: 'Insufficient data to determine rotation theme.' }

  const sorted = [...sectors].sort((a, b) => b.changePct - a.changePct)
  const top3 = sorted.slice(0, 3)

  const topNames = top3.map(s => s.sector)

  if (topNames.includes('Technology') && topNames.includes('Communication Services')) {
    return {
      theme: 'Growth / Risk-On',
      description: 'Tech and Comm Services leading signals strong risk appetite and growth positioning.',
    }
  }
  if (topNames.includes('Utilities') && topNames.includes('Consumer Defensive')) {
    return {
      theme: 'Defensive / Risk-Off',
      description: 'Defensive sectors leading — investors rotating to safety amid uncertainty.',
    }
  }
  if (topNames.includes('Energy')) {
    return {
      theme: 'Commodity / Inflation Play',
      description: 'Energy leadership points to commodity strength and inflation sensitivity.',
    }
  }
  if (topNames.includes('Financials')) {
    return {
      theme: 'Rate-Sensitive Rally',
      description: 'Financials outperforming may signal expectations for higher rates or steeper yield curve.',
    }
  }
  if (topNames.includes('Healthcare')) {
    return {
      theme: 'Defensive Rotation',
      description: 'Healthcare leadership reflects a shift toward quality and defensiveness.',
    }
  }
  return {
    theme: 'Mixed Signals',
    description: 'No clear single theme emerging — sector performance is broadly distributed.',
  }
}

function computeRiskScore(sectors: SectorPerformance[]): number {
  const riskOn = ['Technology', 'Communication Services', 'Consumer Cyclical']
  const riskOff = ['Utilities', 'Consumer Defensive', 'Healthcare']

  const onAvg = sectors
    .filter(s => riskOn.includes(s.sector))
    .reduce((sum, s, _, arr) => sum + s.changePct / arr.length, 0)

  const offAvg = sectors
    .filter(s => riskOff.includes(s.sector))
    .reduce((sum, s, _, arr) => sum + s.changePct / arr.length, 0)

  return onAvg - offAvg
}

// ─── Custom Tooltip for BarChart ──────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: SectorPerformance; value: number }>
}

function SectorTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0].payload
  const pos = item.changePct >= 0

  return (
    <div
      className="border rounded-lg px-3 py-2 text-[11px] shadow-xl"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div className="font-bold mb-1" style={{ color: 'var(--text)' }}>
        {item.sector}
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        ETF: <span style={{ color: 'var(--q2)' }}>{item.etf}</span>
      </div>
      <div
        className="font-bold mt-1"
        style={{ color: pos ? 'var(--positive)' : 'var(--negative)' }}
      >
        {formatPct(item.changePct)}
      </div>
    </div>
  )
}

// ─── Sector Card ──────────────────────────────────────────────────────────────

function SectorCard({ sector }: { sector: SectorPerformance }) {
  const pos = sector.changePct >= 0
  const changeColor = pos ? 'var(--positive)' : 'var(--negative)'
  const changeBg = pos ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)'

  return (
    <div
      className="border rounded-lg p-3 flex flex-col gap-1.5 relative overflow-hidden transition-all hover:shadow-lg"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'transparent',
        borderLeftColor: sector.color,
        borderLeftWidth: '3px',
      }}
    >
      {/* Subtle background tint */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: changeBg, opacity: 0.5 }}
      />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div
            className="text-[11px] font-medium leading-tight"
            style={{ color: 'var(--text)' }}
          >
            {sector.sector}
          </div>
          <div
            className="text-[9px] mt-0.5"
            style={{ fontFamily: 'var(--font-mono)', color: sector.color }}
          >
            {sector.etf}
          </div>
        </div>
        <div className="shrink-0">
          {pos
            ? <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--positive)' }} />
            : <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--negative)' }} />
          }
        </div>
      </div>

      <div
        className="relative z-10 text-[20px] font-bold tabular-nums leading-none"
        style={{ fontFamily: 'var(--font-mono)', color: changeColor }}
      >
        {formatPct(sector.changePct)}
      </div>
    </div>
  )
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({
  label,
  items,
  color,
  bg,
  border,
}: {
  label: string
  items: string[]
  color: string
  bg: string
  border: string
}) {
  return (
    <div
      className="border rounded-lg p-4 flex flex-col gap-2"
      style={{ borderColor: border, backgroundColor: bg }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.14em] font-semibold"
        style={{ fontFamily: 'var(--font-mono)', color }}
      >
        {label}
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[12px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Market Cycle Indicator ───────────────────────────────────────────────────

function MarketCycleIndicator({ sectors }: { sectors: SectorPerformance[] }) {
  const score = computeRiskScore(sectors)
  const clamped = Math.max(-3, Math.min(3, score))
  // Map score [-3, 3] to position [0%, 100%]
  const pct = ((clamped + 3) / 6) * 100

  let dotColor = 'var(--amber)'
  let label = 'NEUTRAL'
  let labelColor = 'var(--amber)'

  if (score > 0.5) {
    dotColor = 'var(--positive)'
    label = 'RISK-ON'
    labelColor = 'var(--positive)'
  } else if (score < -0.5) {
    dotColor = 'var(--negative)'
    label = 'RISK-OFF'
    labelColor = 'var(--negative)'
  }

  return (
    <div
      className="border rounded-lg p-5"
      style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.14em] mb-4 pb-2 border-b"
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-ghost)',
          borderColor: 'rgba(56,189,248,0.15)',
        }}
      >
        MARKET CYCLE INDICATOR
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--negative)' }}>RISK-OFF</span>
          <span style={{ color: labelColor }} className="font-bold tracking-widest">
            {label}
          </span>
          <span style={{ color: 'var(--positive)' }}>RISK-ON</span>
        </div>

        {/* Spectrum bar */}
        <div className="relative h-2 rounded-full overflow-visible" style={{ backgroundColor: 'var(--surface-2)' }}>
          {/* Gradient fill */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(to right, var(--negative), var(--amber), var(--positive))',
              opacity: 0.35,
            }}
          />
          {/* Dot indicator */}
          <div
            className="absolute top-1/2 w-4 h-4 rounded-full border-2 shadow-lg transition-all duration-700"
            style={{
              left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: dotColor,
              borderColor: 'var(--bg)',
              boxShadow: `0 0 12px ${dotColor}80`,
            }}
          />
        </div>

        <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Score: <span style={{ color: labelColor }} className="font-bold">{score >= 0 ? '+' : ''}{score.toFixed(2)}pp</span>
          {' '}· Growth sectors vs Defensive spread
        </p>
      </div>
    </div>
  )
}

// ─── AI Brief Panel ───────────────────────────────────────────────────────────

function AIMarkdown({ text, loading }: { text: string; loading: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <div className="text-sm leading-relaxed space-y-0.5" style={{ color: 'var(--text-muted)' }}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span
              key={i}
              className="font-bold block mt-4 first:mt-0 text-[13px]"
              style={{ color: 'var(--q2)', fontFamily: 'var(--font-bricolage)' }}
            >
              {part.slice(2, -2)}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
      {loading && (
        <span
          className="inline-block w-2 h-4 ml-0.5 align-middle animate-pulse rounded-sm"
          style={{ backgroundColor: 'var(--q2)' }}
        />
      )}
    </div>
  )
}

function AIBriefPanel({ sectors }: { sectors: SectorPerformance[] }) {
  const [brief, setBrief] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setBrief('')
    setGenerated(false)

    try {
      const res = await fetch('/api/sectors/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectors }),
      })

      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setBrief(prev => prev + decoder.decode(value, { stream: true }))
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }
      setGenerated(true)
    } catch {
      setBrief('Failed to generate briefing. Check your API connection.')
    } finally {
      setLoading(false)
    }
  }, [sectors])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.14em] mb-0.5"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            Q2 AI BRIEFING
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Live sector data → Claude analysis
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading || sectors.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: loading ? 'rgba(56,189,248,0.08)' : 'var(--q2)',
            color: loading ? 'var(--q2)' : '#050810',
            border: loading ? '1px solid rgba(56,189,248,0.25)' : 'none',
          }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Analysing...' : generated ? 'Refresh Brief' : 'Generate Q2 Brief'}
        </button>
      </div>

      {!brief && !loading && (
        <div
          className="border rounded-xl p-6 flex flex-col items-center gap-3 text-center"
          style={{
            borderColor: 'rgba(56,189,248,0.25)',
            backgroundColor: 'rgba(56,189,248,0.05)',
          }}
        >
          <Activity className="w-7 h-7" style={{ color: 'var(--q2)' }} />
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--q2)', fontFamily: 'var(--font-bricolage)' }}
            >
              Daily sector intelligence
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Claude reads {sectors.length} live sector performances
            </p>
          </div>
        </div>
      )}

      {(brief || loading) && (
        <div
          ref={scrollRef}
          className="border rounded-xl p-5 max-h-[480px] overflow-y-auto"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <AIMarkdown text={brief} loading={loading} />
        </div>
      )}

      {generated && (
        <p
          className="text-[9px] text-center"
          style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
        >
          ANALYTICAL COMMENTARY ONLY · NOT FINANCIAL ADVICE · FMP DATA
        </p>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SectorsClient({ data }: SectorsClientProps) {
  const sectors = data?.sectors ?? []
  const sortedSectors = [...sectors].sort((a, b) => b.changePct - a.changePct)
  const top3 = sortedSectors.slice(0, 3)
  const bottom3 = sortedSectors.slice(-3).reverse()
  const rotationTheme = getRotationTheme(sectors)

  // Bar chart data: vertical layout — already sorted descending
  const barData = sortedSectors.map(s => ({
    ...s,
    name: s.sector.length > 18 ? s.sector.replace(' Services', '').replace(' Cyclical', ' Cyc.').replace(' Defensive', ' Def.') : s.sector,
  }))

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded border font-semibold"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--q2)',
                borderColor: 'rgba(56,189,248,0.25)',
                backgroundColor: 'rgba(56,189,248,0.08)',
              }}
            >
              Q2 SECTOR
            </span>
          </div>
          <h1
            className="text-2xl font-black"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
          >
            Sector Rotation
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Q2 Sector layer · relative strength · rotation signals
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {data?.source === 'fmp' && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--positive)' }}
              />
              <span
                className="text-[10px]"
                style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}
              >
                LIVE
              </span>
            </div>
          )}
          {data?.source === 'fallback' && (
            <span
              className="text-[10px]"
              style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
            >
              FALLBACK
            </span>
          )}
          {data?.updatedAt && (
            <span
              className="text-[10px]"
              style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
            >
              {new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* ─── Section 1: Performance Heatmap ─────────────────────────────────── */}
      <section>
        <div
          className="text-[10px] uppercase tracking-[0.14em] mb-3 pb-2 border-b flex items-center gap-2"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-ghost)',
            borderColor: 'rgba(56,189,248,0.15)',
          }}
        >
          <Layers className="w-3 h-3" style={{ color: 'var(--q2)' }} />
          PERFORMANCE HEATMAP · TODAY
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {sortedSectors.map(sector => (
            <SectorCard key={sector.slug} sector={sector} />
          ))}
        </div>
      </section>

      {/* ─── Section 2: Bar Chart + Signals side-by-side on large screens ──── */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">

        {/* Bar Chart */}
        <section>
          <div
            className="text-[10px] uppercase tracking-[0.14em] mb-3 pb-2 border-b flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-ghost)',
              borderColor: 'rgba(56,189,248,0.15)',
            }}
          >
            <BarChart2 className="w-3 h-3" style={{ color: 'var(--q2)' }} />
            RANKED PERFORMANCE
          </div>

          <div
            className="border rounded-lg p-4"
            style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
          >
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  tick={{ fontSize: 10, fill: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<SectorTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <ReferenceLine x={0} stroke="var(--border-mid)" strokeDasharray="3 3" />
                <Bar dataKey="changePct" radius={[0, 3, 3, 0]} maxBarSize={22}>
                  {barData.map((entry) => (
                    <Cell
                      key={entry.slug}
                      fill={entry.changePct >= 0 ? entry.color : 'var(--negative)'}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Right column: Signals + Cycle */}
        <div className="space-y-4">

          {/* Section 3: Rotation Signals */}
          <section>
            <div
              className="text-[10px] uppercase tracking-[0.14em] mb-3 pb-2 border-b"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-ghost)',
                borderColor: 'rgba(56,189,248,0.15)',
              }}
            >
              ROTATION SIGNALS
            </div>

            <div className="space-y-2.5">
              <SignalCard
                label="LEADERS"
                items={top3.map(s => `${s.sector} (${formatPct(s.changePct)})`)}
                color="var(--positive)"
                bg="rgba(16,185,129,0.05)"
                border="rgba(16,185,129,0.2)"
              />
              <SignalCard
                label="LAGGARDS"
                items={bottom3.map(s => `${s.sector} (${formatPct(s.changePct)})`)}
                color="var(--negative)"
                bg="rgba(248,113,113,0.05)"
                border="rgba(248,113,113,0.2)"
              />

              {/* Rotation Theme */}
              <div
                className="border rounded-lg p-4 flex flex-col gap-2"
                style={{
                  borderColor: 'rgba(56,189,248,0.25)',
                  backgroundColor: 'rgba(56,189,248,0.05)',
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--q2)' }}
                >
                  ROTATION THEME
                </div>
                <div
                  className="text-[13px] font-bold"
                  style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--q2)' }}
                >
                  {rotationTheme.theme}
                </div>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {rotationTheme.description}
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Market Cycle Indicator */}
          <MarketCycleIndicator sectors={sectors} />
        </div>
      </div>

      {/* ─── Section 5: AI Q2 Brief ──────────────────────────────────────────── */}
      <section>
        <div
          className="text-[10px] uppercase tracking-[0.14em] mb-3 pb-2 border-b flex items-center gap-2"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-ghost)',
            borderColor: 'rgba(56,189,248,0.15)',
          }}
        >
          <Sparkles className="w-3 h-3" style={{ color: 'var(--q2)' }} />
          AI ANALYSIS
        </div>

        <div
          className="border rounded-xl p-5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <AIBriefPanel sectors={sectors} />
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 text-[10px] pt-2"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--q2)' }} />
        DATA: FINANCIAL MODELING PREP (FMP) · SECTOR ETFs · CACHED 30MIN
      </div>
    </div>
  )
}
