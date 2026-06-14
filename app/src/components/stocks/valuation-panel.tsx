'use client'

import { useEffect, useRef, useState } from 'react'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'

// ── Valuation maths ────────────────────────────────────────────────────────────

interface ValuationResult {
  grahamDCF: number | null    // Benjamin Graham growth formula
  grahamNumber: number | null // √(22.5 × EPS × BVPS)
  pegFairValue: number | null // Earnings yield + PEG implied
  blendedFairValue: number    // Median of valid methods
  marginOfSafety: number      // % (positive = undervalued)
  verdict: 'DEEPLY_UNDERVALUED' | 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' | 'SIGNIFICANTLY_OVERVALUED'
  pegRatio: number | null
  intrinsicMethods: { name: string; value: number; upside: number }[]
}

function calcValuation(f: FMPFundamentals): ValuationResult {
  const price = f.price
  const pe = f.pe
  const g = Math.min(Math.max(f.revenueGrowth, 0), 25) // cap growth 0–25%

  // EPS from P/E
  const eps = pe > 0 ? price / pe : null

  // BVPS from ROE and EPS: ROE = EPS / BVPS → BVPS = EPS / (ROE/100)
  const bvps = (eps != null && f.roe > 2) ? eps / (f.roe / 100) : null

  // 1. Graham Growth Formula: IV = EPS × (8.5 + 2g) × 4.4 / AAA_yield
  //    Using 4.5% as long-run AAA bond yield approximation
  const grahamDCF = eps != null && eps > 0
    ? eps * (8.5 + 2 * g) * 4.4 / 4.5
    : null

  // 2. Graham Number: √(22.5 × EPS × BVPS)
  const grahamNumber = eps != null && eps > 0 && bvps != null && bvps > 0
    ? Math.sqrt(22.5 * eps * bvps)
    : null

  // 3. PEG-based fair value: Fair P/E = growth rate, so fair price = EPS × growth
  //    Industry shortcut: fair P/E ≈ 2× growth rate for growth stocks
  const pegFairValue = eps != null && eps > 0 && f.revenueGrowth > 3
    ? eps * Math.min(f.revenueGrowth * 1.5, 50) // PEG ≈ 1 at fair value
    : null

  const pegRatio = pe > 0 && f.revenueGrowth > 0
    ? pe / f.revenueGrowth
    : null

  // Blended — median of valid estimates
  const validEstimates = [grahamDCF, grahamNumber, pegFairValue].filter((v): v is number => v != null && v > 0)
  const sorted = [...validEstimates].sort((a, b) => a - b)
  const blendedFairValue = sorted.length > 0
    ? sorted.length === 1 ? sorted[0]!
      : sorted.length === 2 ? (sorted[0]! + sorted[1]!) / 2
      : sorted[1]!  // median of 3
    : price * 0.85  // fallback: slight discount if no data

  const marginOfSafety = ((blendedFairValue - price) / blendedFairValue) * 100

  let verdict: ValuationResult['verdict']
  if (marginOfSafety >= 30)        verdict = 'DEEPLY_UNDERVALUED'
  else if (marginOfSafety >= 12)   verdict = 'UNDERVALUED'
  else if (marginOfSafety >= -12)  verdict = 'FAIRLY_VALUED'
  else if (marginOfSafety >= -30)  verdict = 'OVERVALUED'
  else                             verdict = 'SIGNIFICANTLY_OVERVALUED'

  const intrinsicMethods: { name: string; value: number; upside: number }[] = []
  if (grahamDCF != null && grahamDCF > 0)
    intrinsicMethods.push({ name: 'Graham DCF', value: grahamDCF, upside: ((grahamDCF - price) / price) * 100 })
  if (grahamNumber != null && grahamNumber > 0)
    intrinsicMethods.push({ name: 'Graham Number', value: grahamNumber, upside: ((grahamNumber - price) / price) * 100 })
  if (pegFairValue != null && pegFairValue > 0)
    intrinsicMethods.push({ name: 'PEG Fair Value', value: pegFairValue, upside: ((pegFairValue - price) / price) * 100 })

  return { grahamDCF, grahamNumber, pegFairValue, blendedFairValue, marginOfSafety, verdict, pegRatio, intrinsicMethods }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return n >= 1000
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${n.toFixed(2)}`
}

const VERDICT_META: Record<ValuationResult['verdict'], { label: string; color: string; bg: string; border: string; description: string }> = {
  DEEPLY_UNDERVALUED:      { label: 'DEEPLY UNDERVALUED', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', description: 'Trading at a significant discount to intrinsic value. Classic value opportunity.' },
  UNDERVALUED:             { label: 'UNDERVALUED',        color: '#34D399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.25)', description: 'Below estimated fair value with meaningful margin of safety.' },
  FAIRLY_VALUED:           { label: 'FAIRLY VALUED',      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', description: 'Price approximates intrinsic value. Upside depends on execution.' },
  OVERVALUED:              { label: 'OVERVALUED',         color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', description: 'Trading at a premium to fundamentals. Risk/reward is unfavorable.' },
  SIGNIFICANTLY_OVERVALUED:{ label: 'SIGNIFICANTLY OVERVALUED', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', description: 'Substantial premium to intrinsic value. Priced for perfect execution.' },
}

// ── Price-vs-fair-value gauge (Canvas) ────────────────────────────────────────

function PriceGauge({ price, fairValue, min, max }: { price: number; fairValue: number; min: number; max: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)
  const [animP, setAnimP] = useState(0)

  useEffect(() => {
    setMounted(true)
    setTimeout(() => setAnimP(1), 80)
  }, [])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = cv.offsetWidth || 480, H = 90
    cv.width = W * dpr; cv.height = H * dpr
    cv.style.width = `${W}px`; cv.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    const PAD = 28, TRACK_Y = 52, TRACK_H = 8

    ctx.clearRect(0, 0, W, H)

    // Track background with zones
    const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
    grad.addColorStop(0,   'rgba(16,185,129,0.5)')
    grad.addColorStop(0.35,'rgba(16,185,129,0.3)')
    grad.addColorStop(0.5, 'rgba(245,158,11,0.4)')
    grad.addColorStop(0.65,'rgba(248,113,113,0.3)')
    grad.addColorStop(1,   'rgba(239,68,68,0.5)')
    ctx.beginPath()
    ctx.roundRect(PAD, TRACK_Y, W - PAD * 2, TRACK_H, 4)
    ctx.fillStyle = grad; ctx.fill()

    function toX(v: number) {
      return PAD + ((v - min) / (max - min)) * (W - PAD * 2)
    }

    // Fair value zone band
    const fvZoneW = Math.max(4, (max - min) * 0.08) // ±4% band
    const fvX = toX(fairValue)
    const bandW = (fvZoneW / (max - min)) * (W - PAD * 2) * animP
    ctx.beginPath()
    ctx.roundRect(fvX - bandW / 2, TRACK_Y - 2, bandW, TRACK_H + 4, 3)
    ctx.fillStyle = 'rgba(245,158,11,0.22)'; ctx.fill()
    ctx.strokeStyle = 'rgba(245,158,11,0.5)'; ctx.lineWidth = 1.2; ctx.stroke()

    // Fair value tick
    ctx.beginPath()
    ctx.moveTo(fvX, TRACK_Y - 8); ctx.lineTo(fvX, TRACK_Y + TRACK_H + 6)
    ctx.strokeStyle = 'rgba(245,158,11,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke()
    ctx.setLineDash([])

    // Price indicator (diamond)
    const px = toX(price) * animP + (toX(min) * (1 - animP))
    const priceColor = price <= fairValue ? '#10B981' : '#F87171'
    ctx.save()
    ctx.shadowColor = priceColor; ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(px, TRACK_Y - 7)
    ctx.lineTo(px + 6, TRACK_Y + TRACK_H / 2)
    ctx.lineTo(px, TRACK_Y + TRACK_H + 7)
    ctx.lineTo(px - 6, TRACK_Y + TRACK_H / 2)
    ctx.closePath()
    ctx.fillStyle = priceColor; ctx.fill()
    ctx.restore()

    // Labels
    ctx.fillStyle = '#9CA3AF'
    ctx.font = `600 9px 'JetBrains Mono', monospace`
    ctx.textAlign = 'left'
    ctx.fillText(fmtPrice(min), PAD, TRACK_Y - 12)
    ctx.textAlign = 'right'
    ctx.fillText(fmtPrice(max), W - PAD, TRACK_Y - 12)

    // Fair value label
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(245,158,11,0.9)'
    ctx.font = `700 9px 'JetBrains Mono', monospace`
    const fvLabelX = Math.max(fvX, PAD + 36)
    ctx.fillText('FAIR VALUE', fvLabelX, TRACK_Y + TRACK_H + 20)
    ctx.fillStyle = '#F59E0B'
    ctx.fillText(fmtPrice(fairValue), fvLabelX, TRACK_Y + TRACK_H + 32)

    // Price label
    const pLabelX = Math.min(Math.max(px, PAD + 24), W - PAD - 24)
    ctx.fillStyle = priceColor + 'CC'
    ctx.font = `600 9px 'JetBrains Mono', monospace`
    ctx.fillText('CURRENT', pLabelX, 14)
    ctx.fillStyle = priceColor
    ctx.font = `800 11px 'JetBrains Mono', monospace`
    ctx.fillText(fmtPrice(price), pLabelX, 27)

  }, [animP, price, fairValue, min, max, mounted])

  if (!mounted) return <div style={{ height: 90 }} />
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: 90 }} />
}

// ── Method row ────────────────────────────────────────────────────────────────

function MethodRow({ name, value, upside, delay }: { name: string; value: number; upside: number; delay: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.disconnect() }
    }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [delay])

  const isUp = upside >= 0
  const color = upside >= 12 ? '#10B981' : upside >= -12 ? '#F59E0B' : '#F87171'

  return (
    <div ref={ref} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
      borderBottom: '1px solid rgba(31,41,55,0.6)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateX(-10px)',
      transition: `opacity 0.4s ease ${delay}ms, transform 0.5s cubic-bezier(.34,1.56,.64,1) ${delay}ms`,
    }}>
      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {name}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: '#F9FAFB', minWidth: 80, textAlign: 'right' }}>
        {fmtPrice(value)}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color, minWidth: 70, textAlign: 'right',
        background: color + '12', border: `1px solid ${color}30`, borderRadius: 4, padding: '2px 7px',
      }}>
        {isUp ? '+' : ''}{upside.toFixed(1)}%
      </span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props { fundamentals: FMPFundamentals }

export default function ValuationPanel({ fundamentals: f }: Props) {
  const [revealed, setRevealed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { setRevealed(true); obs.disconnect() }
    }, { threshold: 0.08 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const v = calcValuation(f)
  const meta = VERDICT_META[v.verdict]

  // Gauge range: price ± 60%, centered on blended fair value
  const midpoint = (f.price + v.blendedFairValue) / 2
  const spread = Math.max(f.price, v.blendedFairValue) * 0.5
  const gaugeMin = Math.max(0, midpoint - spread)
  const gaugeMax = midpoint + spread

  const mosAbs = Math.abs(v.marginOfSafety)
  const mosLabel = v.marginOfSafety >= 0
    ? `${mosAbs.toFixed(0)}% MARGIN OF SAFETY`
    : `${mosAbs.toFixed(0)}% PREMIUM TO FAIR VALUE`

  return (
    <div ref={ref} style={{
      border: '1px solid #1F2937', borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,.2)',
      opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(20px)',
      transition: 'opacity 0.6s ease, transform 0.7s cubic-bezier(.34,1.56,.64,1)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid #1F2937', background: 'rgba(255,255,255,.015)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, color: '#F59E0B', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', padding: '3px 8px', borderRadius: 4 }}>
          VALUATION
        </span>
        <span style={{ fontFamily: 'var(--font-bricolage)', fontSize: 15, fontWeight: 700 }}>
          Intrinsic Value Analysis
        </span>

        {/* Verdict badge */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800,
            color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
            padding: '4px 10px', borderRadius: 5, letterSpacing: '0.08em',
          }}>
            {meta.label}
          </span>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* 2-col layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 24, marginBottom: 24 }}>

          {/* Left: gauge + methods */}
          <div>
            <PriceGauge price={f.price} fairValue={v.blendedFairValue} min={gaugeMin} max={gaugeMax} />

            {/* Method rows */}
            <div style={{ marginTop: 16 }}>
              {v.intrinsicMethods.map((m, i) => (
                <MethodRow key={m.name} name={m.name} value={m.value} upside={m.upside} delay={i * 90} />
              ))}
            </div>
          </div>

          {/* Right: margin of safety + quick stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* MoS ring-like number */}
            <div style={{ border: `1px solid ${meta.border}`, borderRadius: 12, padding: '16px 14px', background: meta.bg, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {v.marginOfSafety >= 0 ? 'Margin of Safety' : 'Premium to Fair'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 900, color: meta.color, lineHeight: 1 }}>
                {mosAbs.toFixed(0)}%
              </div>
              <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 10, color: '#6B7280', marginTop: 6 }}>
                {v.marginOfSafety >= 0 ? '↓ discount to fair value' : '↑ premium to fair value'}
              </div>
            </div>

            {/* Quick stats */}
            {[
              { label: 'P/E Ratio',   value: f.pe > 0 ? f.pe.toFixed(1) : '—',             color: f.pe > 0 && f.pe < 20 ? '#10B981' : f.pe > 40 ? '#F87171' : '#F9FAFB' },
              { label: 'PEG Ratio',   value: v.pegRatio != null ? v.pegRatio.toFixed(2) : '—', color: v.pegRatio != null && v.pegRatio < 1 ? '#10B981' : v.pegRatio != null && v.pegRatio > 2 ? '#F87171' : '#F9FAFB' },
              { label: 'Rev Growth',  value: f.revenueGrowth !== 0 ? `${f.revenueGrowth > 0 ? '+' : ''}${f.revenueGrowth.toFixed(1)}%` : '—', color: f.revenueGrowth > 10 ? '#10B981' : '#F9FAFB' },
              { label: 'Fair Value',  value: fmtPrice(v.blendedFairValue), color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #1F2937', borderRadius: 8, background: 'rgba(255,255,255,.018)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plain English interpretation */}
        <div style={{ border: `1px solid ${meta.border}`, borderRadius: 10, padding: '12px 16px', background: meta.bg }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 14, marginTop: 1 }}>
              {v.marginOfSafety >= 30 ? '💎' : v.marginOfSafety >= 12 ? '📈' : v.marginOfSafety >= -12 ? '⚖️' : v.marginOfSafety >= -30 ? '⚠️' : '🔴'}
            </span>
            <div>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 600, color: meta.color }}>
                {meta.description}
              </span>
              {v.marginOfSafety >= 0 ? (
                <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: '#9CA3AF' }}>
                  {' '}At ${f.price.toFixed(2)}, you're getting ${v.blendedFairValue.toFixed(0)} of value for every dollar invested — a {mosAbs.toFixed(0)}% discount to estimated fair value.
                </span>
              ) : (
                <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: '#9CA3AF' }}>
                  {' '}At ${f.price.toFixed(2)}, you're paying a {mosAbs.toFixed(0)}% premium over estimated fair value of ${v.blendedFairValue.toFixed(0)}.
                </span>
              )}
            </div>
          </div>
          <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4B5563', letterSpacing: '0.06em' }}>
            METHODOLOGY: GRAHAM GROWTH DCF · GRAHAM NUMBER · PEG FAIR VALUE — MEDIAN BLEND
          </div>
        </div>
      </div>
    </div>
  )
}
