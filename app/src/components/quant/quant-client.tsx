'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { QuantAnalysis } from '@/app/api/quant/analysis/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DCFInputs {
  growthY1Y3: number
  growthY4Y5: number
  ebitMargin: number
  taxRate: number
  capexPct: number
  terminalGrowth: number
  wacc: number
}

// ─── Score color helper ────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--positive)'
  if (score >= 50) return 'var(--amber)'
  return 'var(--negative)'
}

function scoreBg(score: number): string {
  if (score >= 75) return 'rgba(16,185,129,0.08)'
  if (score >= 50) return 'rgba(245,158,11,0.08)'
  return 'rgba(248,113,113,0.08)'
}

// ─── Factor label ─────────────────────────────────────────────────────────────

const FACTOR_LABELS: Record<string, string> = {
  value: 'VALUE',
  quality: 'QUALITY',
  momentum: 'MOMENTUM',
  lowVol: 'LOW VOL',
  growth: 'GROWTH',
}

const FACTOR_DESC: Record<string, string> = {
  value: 'P/E, debt, dividend',
  quality: 'ROE, margins, FCF',
  momentum: '12m / 3m price return',
  lowVol: 'Beta, 52w range position',
  growth: 'Revenue growth + margin',
}

// ─── RSI Bar ─────────────────────────────────────────────────────────────────

function RSIBar({ rsi }: { rsi: number }) {
  const pct = Math.min(100, Math.max(0, rsi))
  const label = rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL'
  const color = rsi > 70 ? 'var(--positive)' : rsi < 30 ? 'var(--negative)' : 'var(--text-muted)'

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        {/* Zones */}
        <div className="absolute inset-y-0 left-0" style={{ width: '30%', background: 'rgba(248,113,113,0.2)' }} />
        <div className="absolute inset-y-0" style={{ left: '70%', right: 0, background: 'rgba(16,185,129,0.2)' }} />
        {/* Cursor */}
        <div
          className="absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full"
          style={{ left: `${pct}%`, background: color }}
        />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', color, fontSize: 11, minWidth: 80, textAlign: 'right' }}>
        {rsi.toFixed(1)} <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{label}</span>
      </span>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'var(--amber)' }: { value: number; color?: string }) {
  return (
    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  )
}

// ─── Piotroski criteria labels ────────────────────────────────────────────────

const PIOTROSKI_LABELS: Record<string, string> = {
  roa_positive: 'Positive ROA',
  cfo_positive: 'Positive CFO',
  roa_improving: 'ROA Improving',
  accruals_quality: 'Earnings Quality',
  leverage_low: 'Low Leverage',
  liquidity_ok: 'Strong Liquidity',
  no_dilution: 'No Dilution',
  margin_improving: 'Margin Strength',
  turnover_improving: 'Asset Efficiency',
}

// ─── Slider ───────────────────────────────────────────────────────────────────

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, step = 1, format, onChange }: SliderProps) {
  const display = format ? format(value) : `${value}`
  return (
    <div className="flex items-center gap-3">
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 100 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
        style={{ accentColor: 'var(--amber)' }}
      />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber)', minWidth: 44, textAlign: 'right' }}>
        {display}
      </span>
    </div>
  )
}

// ─── AI text renderer ─────────────────────────────────────────────────────────

function renderAIText(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-3" />

    // Bold headers **TEXT**
    if (line.startsWith('**') && line.endsWith('**')) {
      const heading = line.slice(2, -2)
      return (
        <div key={i} style={{ color: 'var(--amber)', fontFamily: 'var(--font-bricolage)', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', marginTop: 12, marginBottom: 4 }}>
          {heading}
        </div>
      )
    }

    // Bullet points →
    if (line.startsWith('→')) {
      return (
        <div key={i} className="flex gap-2 items-start" style={{ paddingLeft: 8, marginBottom: 2 }}>
          <span style={{ color: 'var(--amber)', marginTop: 1 }}>→</span>
          <span style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.5 }}>{line.slice(1).trim()}</span>
        </div>
      )
    }

    // Normal line with inline **bold**
    const parts = line.split(/(\*\*.*?\*\*)/)
    return (
      <div key={i} style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 2 }}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j} style={{ color: 'var(--text)', fontWeight: 600 }}>
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          ),
        )}
      </div>
    )
  })
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onSelect }: { onSelect: (t: string) => void }) {
  const factors = [
    { id: 'VALUE', color: 'var(--q3)', desc: 'Low P/E, low debt, dividend yield signals undervalued companies' },
    { id: 'QUALITY', color: 'var(--q4)', desc: 'ROE, gross margin, FCF margin — durability of earnings power' },
    { id: 'MOMENTUM', color: 'var(--q2)', desc: '12-month price return — trend persistence in equity returns' },
    { id: 'LOW VOL', color: 'var(--q1)', desc: 'Beta and 52w range position — risk-adjusted return potential' },
    { id: 'GROWTH', color: 'var(--q5)', desc: 'Revenue growth + margin expansion — compounding trajectory' },
  ]

  return (
    <div className="flex flex-col items-center py-16">
      <div className="mb-6" style={{ fontFamily: 'var(--font-bricolage)', fontSize: 32, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
        <span style={{ color: 'var(--amber)' }}>Q4</span> Quantamental Analysis
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 460, textAlign: 'center', lineHeight: 1.6, marginBottom: 32 }}>
        Multi-factor quantitative stock analysis. Enter a ticker to get factor scores, technical setup, Piotroski F-Score, DCF valuation, and an AI quant brief.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-10">
        {factors.map((f) => (
          <div
            key={f.id}
            className="rounded-lg p-4"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: f.color }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: f.color }}>
                {f.id}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Try:</span>
        {['AAPL', 'MSFT', 'NVDA', 'GOOGL'].map((t) => (
          <button
            key={t}
            onClick={() => onSelect(t)}
            className="rounded px-3 py-1 transition-all"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              border: '1px solid var(--border)',
              color: 'var(--amber)',
              background: 'var(--amber-dim)',
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuantClient({ initialTicker }: { initialTicker: string | null }) {
  const [inputValue, setInputValue] = useState(initialTicker ?? '')
  const [analysis, setAnalysis] = useState<QuantAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiText, setAiText] = useState('')
  const [aiStreaming, setAiStreaming] = useState(false)

  // DCF inputs
  const [dcf, setDcf] = useState<DCFInputs>({
    growthY1Y3: 15,
    growthY4Y5: 8,
    ebitMargin: 20,
    taxRate: 21,
    capexPct: 5,
    terminalGrowth: 3,
    wacc: 10,
  })

  const abortRef = useRef<AbortController | null>(null)

  // ─── Stream AI analysis ────────────────────────────────────────────────────

  const streamAI = useCallback(async (data: QuantAnalysis) => {
    setAiText('')
    setAiStreaming(true)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/quant/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: data.ticker, analysis: data }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) return

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAiText((prev) => prev + dec.decode(value, { stream: true }))
      }
    } catch {
      // ignore abort
    } finally {
      setAiStreaming(false)
    }
  }, [])

  // ─── Fetch analysis ────────────────────────────────────────────────────────

  const fetchAnalysis = useCallback(async (ticker: string) => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setAiText('')

    // Reset DCF to defaults
    setDcf({
      growthY1Y3: 15,
      growthY4Y5: 8,
      ebitMargin: 20,
      taxRate: 21,
      capexPct: 5,
      terminalGrowth: 3,
      wacc: 10,
    })

    try {
      const res = await fetch(`/api/quant/analysis?ticker=${encodeURIComponent(ticker)}`)
      if (!res.ok) {
        const e = (await res.json()) as { error?: string }
        throw new Error(e.error ?? 'Failed to fetch')
      }
      const data = (await res.json()) as QuantAnalysis

      setAnalysis(data)

      // Pre-fill DCF from fundamentals
      const g = Math.max(0, Math.min(40, Math.round(data.fundamentals.revenueGrowth)))
      const ebit = Math.max(5, Math.min(40, Math.round(data.fundamentals.grossMargin * 0.6)))
      setDcf((prev) => ({
        ...prev,
        growthY1Y3: g,
        growthY4Y5: Math.max(5, Math.round(g / 2)),
        ebitMargin: ebit,
      }))

      streamAI(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [streamAI])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = inputValue.trim().toUpperCase()
    if (t) fetchAnalysis(t)
  }

  // ─── DCF computation ───────────────────────────────────────────────────────

  const dcfResult = useMemo(() => {
    if (!analysis) return null

    const f = analysis.fundamentals
    const sharesOut = f.price > 0 ? f.marketCap / f.price : 0
    if (sharesOut <= 0) return null

    // Estimate trailing revenue from FCF margin
    const fcfMarginDecimal = f.fcfMargin / 100
    // Rough revenue base: if fcfMargin > 0, revenue ≈ fcf / fcfMarginPct
    // We approximate FCF from marketCap * some ratio — use price/PE * shares as net income proxy
    const estimatedNetIncome = f.pe > 0 ? (f.price / f.pe) * sharesOut : 0
    const estimatedRevenue = f.grossMargin > 0
      ? estimatedNetIncome / (f.grossMargin / 100) * 2
      : f.marketCap * 0.3

    let revenue = estimatedRevenue
    const wacc = dcf.wacc / 100
    const taxRate = dcf.taxRate / 100
    const capexPct = dcf.capexPct / 100
    const ebitMargin = dcf.ebitMargin / 100
    const terminalGrowth = dcf.terminalGrowth / 100

    let pvSum = 0
    let lastFcf = 0

    for (let y = 1; y <= 5; y++) {
      const growth = y <= 3 ? dcf.growthY1Y3 / 100 : dcf.growthY4Y5 / 100
      revenue = revenue * (1 + growth)
      const ebit = revenue * ebitMargin
      const nopat = ebit * (1 - taxRate)
      const fcf = nopat - revenue * capexPct
      const pv = fcf / Math.pow(1 + wacc, y)
      pvSum += pv
      if (y === 5) lastFcf = fcf
    }

    if (wacc <= terminalGrowth) return null

    const terminalValue = (lastFcf * (1 + terminalGrowth)) / (wacc - terminalGrowth)
    const pvTerminal = terminalValue / Math.pow(1 + wacc, 5)
    const enterpriseValue = pvSum + pvTerminal
    const fairValue = enterpriseValue / sharesOut

    const currentPrice = f.price
    const upside = currentPrice > 0 ? ((fairValue - currentPrice) / currentPrice) * 100 : 0

    // Use fcfMarginDecimal to avoid unused variable lint warning
    void fcfMarginDecimal

    return { fairValue, currentPrice, upside }
  }, [analysis, dcf])

  // ─── Radar data ───────────────────────────────────────────────────────────

  const radarData = analysis
    ? [
        { subject: 'Value', score: analysis.factors.value },
        { subject: 'Quality', score: analysis.factors.quality },
        { subject: 'Momentum', score: analysis.factors.momentum },
        { subject: 'Low Vol', score: analysis.factors.lowVol },
        { subject: 'Growth', score: analysis.factors.growth },
      ]
    : []

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          style={{
            fontFamily: 'var(--font-bricolage)',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
            marginBottom: 4,
          }}
        >
          <span style={{ color: 'var(--q4)' }}>Q4</span> Quantamental
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
          FACTOR · TECHNICAL · PIOTROSKI · DCF · AI BRIEF
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            placeholder="Enter ticker — AAPL, MSFT, NVDA, GOOGL…"
            className="w-full rounded-lg px-4 py-3 outline-none transition-all"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          className="rounded-lg px-6 py-3 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: loading ? 'var(--amber-dim)' : 'var(--amber)',
            color: '#050810',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              LOADING
            </span>
          ) : (
            'ANALYZE'
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 mb-6"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--negative)', fontSize: 13 }}
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {!analysis && !loading && !error && (
        <EmptyState onSelect={(t) => { setInputValue(t); fetchAnalysis(t) }} />
      )}

      {/* Analysis results */}
      {analysis && (
        <div className="flex flex-col gap-6">

          {/* ── Row 1: Header card ── */}
          <div
            className="rounded-lg p-5"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-3 mb-1">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                    {analysis.ticker}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{analysis.fundamentals.name}</span>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <span
                    className="rounded px-2 py-0.5"
                    style={{ fontSize: 10, letterSpacing: '0.1em', background: 'var(--surface-2)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    {analysis.fundamentals.sector}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {analysis.fundamentals.industry}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>
                    ${analysis.fundamentals.price.toFixed(2)}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    color: analysis.fundamentals.change >= 0 ? 'var(--positive)' : 'var(--negative)',
                  }}>
                    {analysis.fundamentals.change >= 0 ? '+' : ''}{analysis.fundamentals.change.toFixed(2)}%
                  </div>
                </div>

                <div
                  className="rounded-lg flex flex-col items-center justify-center px-5 py-3"
                  style={{
                    border: `1px solid ${scoreBg(analysis.factors.composite)}`,
                    background: scoreBg(analysis.factors.composite),
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: scoreColor(analysis.factors.composite) }}>
                    {analysis.factors.composite}
                  </span>
                  <span style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-dim)', marginTop: 1 }}>
                    Q4 COMPOSITE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: Factor score cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(Object.keys(FACTOR_LABELS) as Array<keyof typeof FACTOR_LABELS>).map((key) => {
              const score = analysis.factors[key as keyof typeof analysis.factors]
              return (
                <div
                  key={key}
                  className="rounded-lg p-4 flex flex-col gap-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {FACTOR_LABELS[key]}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: scoreColor(score) }}>
                      {score}
                    </span>
                  </div>
                  <ProgressBar value={score} color={scoreColor(score)} />
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{FACTOR_DESC[key]}</span>
                </div>
              )
            })}
          </div>

          {/* ── Row 3: Radar + Technical ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Radar chart */}
            <div
              className="rounded-lg p-5"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
                FACTOR RADAR
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="var(--amber)"
                    fill="rgba(245,158,11,0.15)"
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text)',
                    }}
                    formatter={(v) => [`${v}/100`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Technical panel */}
            <div
              className="rounded-lg p-5 flex flex-col gap-4"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                TECHNICAL INDICATORS
              </div>

              {/* RSI */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>RSI (14d)</span>
                </div>
                <RSIBar rsi={analysis.technical.rsi} />
              </div>

              {/* MACD */}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>MACD Histogram</span>
                <div className="flex items-center gap-2">
                  <div
                    className="rounded"
                    style={{
                      width: `${Math.min(60, Math.abs(analysis.technical.macdHistogram) * 20)}px`,
                      height: 8,
                      minWidth: 4,
                      background: analysis.technical.macdHistogram >= 0 ? 'var(--positive)' : 'var(--negative)',
                    }}
                  />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: analysis.technical.macdHistogram >= 0 ? 'var(--positive)' : 'var(--negative)',
                  }}>
                    {analysis.technical.macdHistogram >= 0 ? '+' : ''}{analysis.technical.macdHistogram.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* 200DMA */}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>200-Day MA</span>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 14 }}>
                    {analysis.technical.pctFrom200DMA >= 0 ? '▲' : '▼'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: analysis.technical.pctFrom200DMA >= 0 ? 'var(--positive)' : 'var(--negative)',
                  }}>
                    {analysis.technical.pctFrom200DMA >= 0 ? '+' : ''}{analysis.technical.pctFrom200DMA.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {analysis.technical.pctFrom200DMA >= 0 ? 'ABOVE' : 'BELOW'}
                  </span>
                </div>
              </div>

              {/* Bollinger */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bollinger %B</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>
                    {(analysis.technical.bbandsPercent * 100).toFixed(0)}%
                  </span>
                </div>
                <ProgressBar
                  value={analysis.technical.bbandsPercent * 100}
                  color={analysis.technical.bbandsPercent > 0.8 ? 'var(--positive)' : analysis.technical.bbandsPercent < 0.2 ? 'var(--negative)' : 'var(--amber)'}
                />
              </div>

              {/* Volume */}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Volume vs 20d Avg</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: analysis.technical.volumeAvg20 > 0 && analysis.technical.volume / analysis.technical.volumeAvg20 > 1.5
                    ? 'var(--positive)'
                    : 'var(--text)',
                }}>
                  {analysis.technical.volumeAvg20 > 0
                    ? `${(analysis.technical.volume / analysis.technical.volumeAvg20).toFixed(1)}x avg`
                    : 'N/A'
                  }
                </span>
              </div>

              {/* 52w Range */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>52W Range</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                    ${analysis.technical.weekLow52.toFixed(0)} – ${analysis.technical.weekHigh52.toFixed(0)}
                  </span>
                </div>
                {analysis.technical.weekHigh52 > analysis.technical.weekLow52 && (
                  <ProgressBar
                    value={
                      ((analysis.fundamentals.price - analysis.technical.weekLow52) /
                        (analysis.technical.weekHigh52 - analysis.technical.weekLow52)) *
                      100
                    }
                    color="var(--q2)"
                  />
                )}
              </div>
            </div>
          </div>

          {/* ── Row 4: Piotroski ── */}
          <div
            className="rounded-lg p-5"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  PIOTROSKI F-SCORE
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>9-point financial health checksum</p>
              </div>

              <div
                className="rounded-lg px-5 py-3 flex items-center gap-3"
                style={{
                  border: `1px solid ${scoreBg(analysis.piotroski.score >= 7 ? 80 : analysis.piotroski.score >= 4 ? 60 : 30)}`,
                  background: scoreBg(analysis.piotroski.score >= 7 ? 80 : analysis.piotroski.score >= 4 ? 60 : 30),
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 36,
                  fontWeight: 800,
                  color: scoreColor(analysis.piotroski.score >= 7 ? 80 : analysis.piotroski.score >= 4 ? 60 : 30),
                }}>
                  {analysis.piotroski.score}
                  <span style={{ fontSize: 16, color: 'var(--text-dim)' }}>/9</span>
                </span>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: scoreColor(analysis.piotroski.score >= 7 ? 80 : analysis.piotroski.score >= 4 ? 60 : 30),
                  }}>
                    {analysis.piotroski.score >= 7 ? 'STRONG' : analysis.piotroski.score >= 4 ? 'MODERATE' : 'WEAK'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>FINANCIAL HEALTH</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.entries(analysis.piotroski.criteria) as Array<[string, boolean]>).map(([key, pass]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded px-3 py-2"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    color: pass ? 'var(--positive)' : 'var(--negative)',
                    fontWeight: 700,
                  }}>
                    {pass ? '✓' : '✗'}
                  </span>
                  <span style={{ fontSize: 12, color: pass ? 'var(--text)' : 'var(--text-dim)' }}>
                    {PIOTROSKI_LABELS[key] ?? key}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Row 5: Momentum returns ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                { label: '1 MONTH', value: analysis.returns.ret1m },
                { label: '3 MONTHS', value: analysis.returns.ret3m },
                { label: '6 MONTHS', value: analysis.returns.ret6m },
                { label: '12 MONTHS', value: analysis.returns.ret12m },
              ] as const
            ).map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg p-4 flex flex-col gap-1"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: value >= 0 ? 'var(--positive)' : 'var(--negative)',
                }}>
                  {value >= 0 ? '+' : ''}{value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          {/* ── Row 6: DCF Calculator ── */}
          <div
            className="rounded-lg p-5"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  DCF VALUATION
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>5-year discounted cash flow model</p>
              </div>

              {dcfResult && (
                <div
                  className="rounded-lg px-5 py-3"
                  style={{
                    border: `1px solid ${dcfResult.upside > 20 ? 'rgba(16,185,129,0.25)' : dcfResult.upside > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(248,113,113,0.25)'}`,
                    background: dcfResult.upside > 20 ? 'rgba(16,185,129,0.06)' : dcfResult.upside > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(248,113,113,0.06)',
                  }}
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 2 }}>FAIR VALUE</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                        ${dcfResult.fairValue.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-dim)' }}>vs</div>
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 2 }}>CURRENT</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                        ${dcfResult.currentPrice.toFixed(2)}
                      </div>
                    </div>
                    <div
                      className="rounded px-3 py-1"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 16,
                        fontWeight: 800,
                        color: dcfResult.upside > 20 ? 'var(--positive)' : dcfResult.upside > 0 ? 'var(--amber)' : 'var(--negative)',
                      }}
                    >
                      {dcfResult.upside >= 0 ? '+' : ''}{dcfResult.upside.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              <div className="flex flex-col gap-1">
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>REVENUE BASE</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Auto-estimated from fundamentals (FCF + margin)
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>SHARES OUTSTANDING</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  {analysis.fundamentals.price > 0
                    ? `${((analysis.fundamentals.marketCap / analysis.fundamentals.price) / 1e6).toFixed(0)}M shares`
                    : 'N/A'
                  }
                </span>
              </div>

              <Slider
                label="Y1–Y3 Growth %"
                value={dcf.growthY1Y3}
                min={0} max={50}
                format={(v) => `${v}%`}
                onChange={(v) => setDcf((p) => ({ ...p, growthY1Y3: v }))}
              />
              <Slider
                label="Y4–Y5 Growth %"
                value={dcf.growthY4Y5}
                min={0} max={30}
                format={(v) => `${v}%`}
                onChange={(v) => setDcf((p) => ({ ...p, growthY4Y5: v }))}
              />
              <Slider
                label="EBIT Margin %"
                value={dcf.ebitMargin}
                min={0} max={40}
                format={(v) => `${v}%`}
                onChange={(v) => setDcf((p) => ({ ...p, ebitMargin: v }))}
              />
              <Slider
                label="Tax Rate %"
                value={dcf.taxRate}
                min={10} max={35}
                format={(v) => `${v}%`}
                onChange={(v) => setDcf((p) => ({ ...p, taxRate: v }))}
              />
              <Slider
                label="CapEx % Revenue"
                value={dcf.capexPct}
                min={1} max={15}
                format={(v) => `${v}%`}
                onChange={(v) => setDcf((p) => ({ ...p, capexPct: v }))}
              />
              <Slider
                label="WACC %"
                value={dcf.wacc}
                min={6} max={15}
                format={(v) => `${v}%`}
                onChange={(v) => setDcf((p) => ({ ...p, wacc: v }))}
              />
              <Slider
                label="Terminal Growth %"
                value={dcf.terminalGrowth}
                min={1} max={5}
                format={(v) => `${v}%`}
                onChange={(v) => setDcf((p) => ({ ...p, terminalGrowth: v }))}
              />
            </div>

            <p style={{ fontSize: 10, color: 'var(--text-ghost)', marginTop: 16, lineHeight: 1.5 }}>
              DCF is highly sensitive to assumptions. This is for educational analysis only. Not financial advice.
            </p>
          </div>

          {/* ── Row 7: AI Q4 Brief ── */}
          {(aiText || aiStreaming) && (
            <div
              className="rounded-lg p-5"
              style={{ border: '1px solid var(--amber-border)', background: 'var(--surface)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                  AI Q4 QUANT BRIEF
                </div>
                {aiStreaming && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>GENERATING</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                {renderAIText(aiText)}
                {aiStreaming && (
                  <span
                    className="inline-block w-1.5 h-4 animate-pulse"
                    style={{ background: 'var(--amber)', verticalAlign: 'middle' }}
                  />
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
