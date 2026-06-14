'use client'

import { useState, useCallback, useRef } from 'react'
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, Activity } from 'lucide-react'
import type { MacroData, MacroIndicator } from '@/app/api/macro/route'
import type { MarketItem } from '@/app/api/market-data/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MacroClientProps {
  macro: MacroData | null
  market: MarketItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function directionColor(d: 'up' | 'down' | 'flat', invertBad = false): string {
  if (d === 'flat') return 'var(--text-muted)'
  const isGood = invertBad ? d === 'down' : d === 'up'
  return isGood ? 'var(--positive)' : 'var(--negative)'
}

// For macro indicators, "up" is good or bad depends on the metric
const INVERT_BAD: Record<string, boolean> = {
  CPIAUCSL: true,  // higher inflation = bad
  UNRATE: true,    // higher unemployment = bad
  T10Y2Y: false,   // more positive = good (less inverted)
}

function indicatorMeaning(id: string, value: string): string {
  const v = parseFloat(value)
  switch (id) {
    case 'FEDFUNDS':
      return v >= 5 ? 'Restrictive — high cost of capital' : v >= 3 ? 'Moderately tight' : 'Accommodative'
    case 'CPIAUCSL':
      return v <= 2 ? 'At Fed target — ideal' : v <= 3.5 ? 'Slightly elevated' : v <= 5 ? 'Above target — Fed watching' : 'High — pressure on cuts'
    case 'UNRATE':
      return v <= 4 ? 'Full employment' : v <= 5 ? 'Slightly elevated' : 'Softening labour market'
    case 'GDP':
      return 'Annualised U.S. output'
    case 'DGS10':
      return v >= 5 ? 'Elevated — risk-off pressure' : v >= 4 ? 'Elevated but manageable' : 'Low — risk-on supportive'
    case 'T10Y2Y':
      return v < -0.5 ? 'Deep inversion — strong recession signal' : v < 0 ? 'Inverted — watch closely' : v < 0.5 ? 'Near flat — normalising' : 'Positive — normal curve'
    default:
      return ''
  }
}

// ─── Yield Curve SVG ─────────────────────────────────────────────────────────

function YieldCurveViz({ spread }: { spread: number }) {
  const isInverted = spread < 0
  // Simplified 4-point curve: 2Y, 5Y, 10Y, 30Y
  // We only have the 10Y-2Y spread, so we approximate
  const base = 4.5
  const two = base - spread / 2
  const five = base + spread * 0.2
  const ten = base + spread / 2
  const thirty = ten + Math.abs(spread) * 0.3 + 0.4

  const maturity = [two, five, ten, thirty]
  const labels = ['2Y', '5Y', '10Y', '30Y']

  const minY = Math.min(...maturity) - 0.2
  const maxY = Math.max(...maturity) + 0.2
  const range = maxY - minY || 1

  const W = 220
  const H = 90
  const PAD = { t: 10, b: 24, l: 32, r: 10 }
  const xs = [0, 1, 2, 3].map(i => PAD.l + (i / 3) * (W - PAD.l - PAD.r))
  const ys = maturity.map(v => PAD.t + ((maxY - v) / range) * (H - PAD.t - PAD.b))

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const lineColor = isInverted ? '#F87171' : '#10B981'

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
        >
          YIELD CURVE
        </span>
        {isInverted && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--negative-dim)',
              color: 'var(--negative)',
              border: '1px solid rgba(248,113,113,0.25)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            INVERTED
          </span>
        )}
      </div>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[0, 1, 2].map(i => {
          const y = PAD.t + (i / 2) * (H - PAD.t - PAD.b)
          const val = (maxY - (i / 2) * range).toFixed(1)
          return (
            <g key={i}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="8" fill="var(--text-ghost)"
                fontFamily="var(--font-mono)">{val}%</text>
            </g>
          )
        })}
        {/* Zero line if inverted */}
        {isInverted && (
          <line
            x1={PAD.l} x2={W - PAD.r}
            y1={PAD.t + ((maxY - 0) / range) * (H - PAD.t - PAD.b)}
            y2={PAD.t + ((maxY - 0) / range) * (H - PAD.t - PAD.b)}
            stroke="rgba(248,113,113,0.3)" strokeWidth="1" strokeDasharray="3,2"
          />
        )}
        {/* Curve */}
        <path d={path} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="3" fill={lineColor} />
        ))}
        {/* X labels */}
        {xs.map((x, i) => (
          <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--text-ghost)"
            fontFamily="var(--font-mono)">{labels[i]}</text>
        ))}
      </svg>
      <p className="text-[10px] mt-2" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
        10Y–2Y spread: <span style={{ color: isInverted ? 'var(--negative)' : 'var(--positive)', fontWeight: 700 }}>
          {spread >= 0 ? '+' : ''}{spread.toFixed(2)}%
        </span>
        {isInverted ? ' · Historically precedes recession 12–18mo out' : ' · Normal — expansionary signal'}
      </p>
    </div>
  )
}

// ─── Indicator Card ───────────────────────────────────────────────────────────

function IndicatorCard({ ind }: { ind: MacroIndicator }) {
  const invertBad = INVERT_BAD[ind.id] ?? false
  const vColor = ind.direction === 'flat' ? 'var(--text)' : directionColor(ind.direction, invertBad)
  const DirIcon = ind.direction === 'up' ? TrendingUp : ind.direction === 'down' ? TrendingDown : Minus

  return (
    <div
      className="border rounded-xl p-4 flex flex-col gap-2"
      style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.12em] mb-0.5"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            {ind.label}
          </div>
          <div
            className="text-2xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: vColor }}
          >
            {ind.value}{ind.unit === '%' ? '%' : ''}
          </div>
        </div>
        <DirIcon className="w-4 h-4 mt-1 shrink-0" style={{ color: vColor }} />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="text-[10px] tabular-nums font-semibold"
          style={{ fontFamily: 'var(--font-mono)', color: vColor }}
        >
          {ind.change.startsWith('-') ? ind.change : `+${ind.change}`}{ind.unit === '%' ? 'pp' : ''}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
          vs prev {ind.previousValue}{ind.unit === '%' ? '%' : ''}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {indicatorMeaning(ind.id, ind.value)}
      </p>

      <div
        className="text-[9px] mt-auto pt-1"
        style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
      >
        FRED · {ind.date}
      </div>
    </div>
  )
}

// ─── Market Ticker Strip ──────────────────────────────────────────────────────

function MarketStrip({ items }: { items: MarketItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {items.map(item => {
        const pos = item.changePercent >= 0
        const pColor = pos ? 'var(--positive)' : 'var(--negative)'
        const pBg = pos ? 'var(--positive-dim)' : 'var(--negative-dim)'
        return (
          <div
            key={item.symbol}
            className="border rounded-lg px-3.5 py-2.5 flex flex-col gap-0.5 shrink-0 min-w-[100px]"
            style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
          >
            <div className="flex items-center gap-2 justify-between">
              <span
                className="text-[10px] font-black"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
              >
                {item.symbol}
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded tabular-nums"
                style={{ backgroundColor: pBg, color: pColor, fontFamily: 'var(--font-mono)' }}
              >
                {pos ? '+' : ''}{item.changePercent.toFixed(2)}%
              </span>
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
            >
              {item.price}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>
              {item.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── AI Brief Panel ───────────────────────────────────────────────────────────

function AIBriefPanel({ macro, market }: { macro: MacroData | null; market: MarketItem[] }) {
  const [brief, setBrief] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const generate = useCallback(async () => {
    if (!macro) return
    setLoading(true)
    setBrief('')
    setGenerated(false)

    try {
      const res = await fetch('/api/macro/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicators: macro.indicators, market }),
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
  }, [macro, market])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.14em] mb-0.5"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            Q1 AI BRIEFING
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Live macro data → Claude analysis
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading || !macro}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all shrink-0"
          style={{
            backgroundColor: loading ? 'var(--amber-dim)' : 'var(--amber)',
            color: loading ? 'var(--amber)' : '#050810',
            border: loading ? '1px solid var(--amber-border)' : 'none',
          }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Analysing...' : generated ? 'Refresh' : 'Brief Me'}
        </button>
      </div>

      {!brief && !loading && (
        <div
          className="border rounded-xl p-6 flex flex-col items-center gap-3 text-center"
          style={{ borderColor: 'var(--amber-border)', backgroundColor: 'var(--amber-dim)' }}
        >
          <Activity className="w-7 h-7" style={{ color: 'var(--amber)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--amber)', fontFamily: 'var(--font-bricolage)' }}>
              Daily macro intelligence
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Claude reads {macro?.indicators.length ?? 0} live FRED indicators + markets
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
          ANALYTICAL COMMENTARY ONLY · NOT FINANCIAL ADVICE · FRED DATA {macro?.updatedAt ? new Date(macro.updatedAt).toLocaleDateString() : ''}
        </p>
      )}
    </div>
  )
}

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
              style={{ color: 'var(--amber)', fontFamily: 'var(--font-bricolage)' }}
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
          style={{ backgroundColor: 'var(--amber)' }}
        />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const INDICATOR_GROUPS = {
  rates: ['FEDFUNDS', 'DGS10', 'T10Y2Y'],
  economy: ['CPIAUCSL', 'GDP', 'UNRATE'],
}

export default function MacroClient({ macro, market }: MacroClientProps) {
  const rateIndicators = macro?.indicators.filter(i => INDICATOR_GROUPS.rates.includes(i.id)) ?? []
  const econIndicators = macro?.indicators.filter(i => INDICATOR_GROUPS.economy.includes(i.id)) ?? []
  const spreadInd = macro?.indicators.find(i => i.id === 'T10Y2Y')
  const spread = spreadInd ? parseFloat(spreadInd.value) : 0.3

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded border font-semibold"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--q1)',
                borderColor: 'rgba(167,139,250,0.25)',
                backgroundColor: 'rgba(167,139,250,0.08)',
              }}
            >
              Q1 MACRO
            </span>
          </div>
          <h1
            className="text-2xl font-black"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
          >
            Macro Intelligence
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Live FRED data · Rates, inflation, growth, yield curve
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {macro?.source === 'fred' && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--positive)' }} />
              <span className="text-[10px]" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}>
                LIVE FRED
              </span>
            </div>
          )}
          {macro?.source === 'fallback' && (
            <span className="text-[10px]" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
              FALLBACK DATA
            </span>
          )}
        </div>
      </div>

      {/* Market Pulse strip */}
      {market.length > 0 && (
        <section>
          <div
            className="text-[10px] uppercase tracking-[0.14em] mb-3"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            MARKET PULSE
          </div>
          <MarketStrip items={market} />
        </section>
      )}

      {/* Main grid: indicators + AI brief */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Left: indicators */}
        <div className="space-y-6">
          {/* Rate Environment */}
          <section>
            <div
              className="text-[10px] uppercase tracking-[0.14em] mb-3 pb-2 border-b"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-ghost)',
                borderColor: 'rgba(167,139,250,0.15)',
              }}
            >
              RATE ENVIRONMENT
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {rateIndicators.length > 0
                ? rateIndicators.map(ind => <IndicatorCard key={ind.id} ind={ind} />)
                : [1, 2, 3].map(i => <SkeletonCard key={i} />)
              }
            </div>
          </section>

          {/* Economy */}
          <section>
            <div
              className="text-[10px] uppercase tracking-[0.14em] mb-3 pb-2 border-b"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-ghost)',
                borderColor: 'rgba(167,139,250,0.15)',
              }}
            >
              ECONOMIC CONDITIONS
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {econIndicators.length > 0
                ? econIndicators.map(ind => <IndicatorCard key={ind.id} ind={ind} />)
                : [1, 2, 3].map(i => <SkeletonCard key={i} />)
              }
            </div>
          </section>

          {/* Yield curve */}
          <section>
            <div
              className="text-[10px] uppercase tracking-[0.14em] mb-3 pb-2 border-b"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-ghost)',
                borderColor: 'rgba(167,139,250,0.15)',
              }}
            >
              YIELD CURVE VISUALISER
            </div>
            <div
              className="border rounded-xl p-5"
              style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
            >
              <YieldCurveViz spread={spread} />
            </div>
          </section>
        </div>

        {/* Right: AI brief */}
        <div
          className="border rounded-xl p-5 self-start sticky top-6"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <AIBriefPanel macro={macro} market={market} />
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-2 text-[10px] pt-2"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--q1)' }} />
        DATA: FEDERAL RESERVE BANK (FRED) · ALPHA VANTAGE · COINGECKO · CACHED 24H
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      className="border rounded-xl p-4 animate-pulse space-y-2"
      style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
    >
      <div className="h-2 rounded w-1/2" style={{ backgroundColor: 'var(--surface-2)' }} />
      <div className="h-7 rounded w-2/3" style={{ backgroundColor: 'var(--surface-2)' }} />
      <div className="h-2 rounded w-3/4" style={{ backgroundColor: 'var(--surface-2)' }} />
    </div>
  )
}
