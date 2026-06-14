'use client'

import { useEffect, useRef, useState } from 'react'
import type { Q5StockAnalysis, Q5LayerResult } from '@/app/api/stocks/analysis/route'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import { gradeMeta } from '@/lib/grades'
import FundamentalsGrid from './fundamentals-grid'
import ShortInterestPanel from './short-interest-panel'
import EarningsModelPanel from './earnings-model-panel'
import InsiderPanel from '@/components/insider/insider-stock-panel'
import PriceChart from './price-chart'
import QuantSignalsPanel from './quant-signals-panel'
import InstitutionalPanel from './institutional-panel'
import ManagementPanel from './management-panel'
import DividendPanel from './dividend-panel'
import StockKnowledgeGraph from './stock-knowledge-graph'
import BusinessFlowCanvas from './business-flow-canvas'
import BusinessExplainerPanel from './business-explainer-panel'
import IsoFinancialBars from './iso-financial-bars'

const Q_LAYERS = [
  { key: 'q1' as const, id: 'Q1', label: 'Macro',           color: '#A78BFA', desc: 'Is the overall market environment working for or against this position?' },
  { key: 'q2' as const, id: 'Q2', label: 'Sector',          color: '#38BDF8', desc: 'Is this sector in favour, and is money rotating in?' },
  { key: 'q3' as const, id: 'Q3', label: 'Fundamental',     color: '#34D399', desc: 'Is this actually a good business, and is it getting better?' },
  { key: 'q4' as const, id: 'Q4', label: 'Quant',           color: '#F59E0B', desc: 'Is the market agreeing with the thesis, or fighting it?' },
  { key: 'q5' as const, id: 'Q5', label: 'Sentiment',       color: '#FB7185', desc: 'What are the people who know most doing with their own money?' },
  { key: 'q6' as const, id: 'Q6', label: 'Management',      color: '#E879F9', desc: 'Is the team building a durable business or destroying capital?' },
  { key: 'q7' as const, id: 'Q7', label: 'Catalyst',        color: '#F97316', desc: 'When will the market actually react to this thesis?' },
]

// Per-stock composite = the 5 company pillars ONLY. Q1 Macro + Q2 Sector are market
// context (identical for every stock) — they gate exposure, they don't score the stock.
const STOCK_LAYERS = Q_LAYERS.filter(l => l.key !== 'q1' && l.key !== 'q2')
const CONTEXT_LAYERS = Q_LAYERS.filter(l => l.key === 'q1' || l.key === 'q2')

type QKey = (typeof Q_LAYERS)[number]['key']
function pillarScore(a: Q5StockAnalysis, key: QKey): number | null {
  const v = a[key]?.score
  return typeof v === 'number' ? v : null
}
// Composite is ALWAYS recomputed from the displayed company pillars (Q3–Q7) so it can
// never disagree with the bars. (The server's stored setup_score came from the nightly
// cron's older formula and could mismatch.) Falls back to the server value only if no
// pillar has data. Missing pillars are excluded — never fabricated as 50.
function setupOf(a: Q5StockAnalysis): number {
  const present = STOCK_LAYERS.map(l => pillarScore(a, l.key)).filter((v): v is number => v != null)
  if (present.length) return Math.round(present.reduce((s, x) => s + x, 0) / present.length)
  return typeof a.setupScore === 'number' ? a.setupScore : 0
}

// ─── Score Ring SVG ──────────────────────────────────────────────────────────

function ScoreRing({ score, size = 108 }: { score: number; size?: number }) {
  const R = size * 0.43
  const cx = size / 2
  const circumference = 2 * Math.PI * R
  const dash = (score / 100) * circumference
  const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F87171'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={7} />
        <circle cx={cx} cy={cx} r={R} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: size > 90 ? 30 : 20, fontWeight: 800, color, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4B5563' }}>/100</span>
      </div>
    </div>
  )
}

// ─── Q7 Heptagon ─────────────────────────────────────────────────────────────

const PENT_SIZE = 200
const PENT_CX = PENT_SIZE / 2
const PENT_CY = PENT_SIZE / 2
const PENT_R = 70

function polyPoint(i: number, dist: number, n: number) {
  const a = (i * 2 * Math.PI) / n - Math.PI / 2
  return { x: PENT_CX + dist * Math.cos(a), y: PENT_CY + dist * Math.sin(a) }
}

function polyPath(scores: number[], r: number, n: number) {
  return scores.map((s, i) => {
    const p = polyPoint(i, (s / 100) * r, n)
    return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ') + 'Z'
}

function ringPolyPath(pct: number, n: number) {
  const dist = (pct / 100) * PENT_R
  return Array.from({ length: n }, (_, i) => {
    const p = polyPoint(i, dist, n)
    return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ') + 'Z'
}

function Q7Heptagon({ scores, layers }: { scores: number[]; layers: typeof Q_LAYERS }) {
  const n = scores.length

  return (
    <svg width={PENT_SIZE} height={PENT_SIZE} viewBox={`0 0 ${PENT_SIZE} ${PENT_SIZE}`}>
      <defs>
        <radialGradient id="heptFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.06" />
        </radialGradient>
      </defs>
      {[25, 50, 75, 100].map(pct => (
        <path key={pct} d={ringPolyPath(pct, n)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {layers.slice(0, n).map((l, i) => {
        const outer = polyPoint(i, PENT_R, n)
        return <line key={i} x1={PENT_CX} y1={PENT_CY} x2={outer.x} y2={outer.y} stroke={l.color} strokeWidth={1} strokeOpacity={0.25} />
      })}
      <path d={polyPath(scores, PENT_R, n)} fill="url(#heptFill)" stroke="rgba(245,158,11,0.6)" strokeWidth={1.5} />
      {scores.map((s, i) => {
        const p = polyPoint(i, (s / 100) * PENT_R, n)
        return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={layers[i]?.color ?? '#F59E0B'} stroke="#050810" strokeWidth={1.5} />
      })}
      {layers.slice(0, n).map((l, i) => {
        const p = polyPoint(i, PENT_R + 18, n)
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fontWeight={800} fill={l.color} style={{ fontFamily: 'var(--font-mono)' }}>
            {l.id}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Score bar row (animates 0→score on viewport entry) ─────────────────────

function QBarRow({ id, label, score, color, labelWidth = 86, context = false }: { id: string; label: string; score: number | null; color: string; labelWidth?: number; context?: boolean }) {
  const [w, setW] = useState(0)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rowRef.current
    if (!el || score == null) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setW(score), 60); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [score])

  const dim = context || score == null
  return (
    <div ref={rowRef} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, opacity: dim ? 0.6 : 1 }}>
      <div style={{
        width: 26, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: `${color}12`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, color }}>{id}</span>
      </div>
      <span style={{ fontSize: 11, color: '#9CA3AF', width: labelWidth, flexShrink: 0 }}>
        {label}{context && <span style={{ color: '#4B5563', fontSize: 9 }}> · context</span>}
      </span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${w}%`, backgroundColor: color, opacity: 0.85, transition: 'width 1.3s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color, width: 26, textAlign: 'right', flexShrink: 0 }}>{score == null ? '—' : score}</span>
    </div>
  )
}

// ─── Setup Score card (hero right column) ────────────────────────────────────

function SetupScoreCard({ analysis }: { analysis: Q5StockAnalysis }) {
  const setupScore = setupOf(analysis)
  const rec = gradeMeta(analysis.recommendation, setupScore)
  const methodLabel = analysis.scoreMethod === 'ai' ? 'AI' : analysis.scoreMethod === 'hybrid' ? 'AI+ALGO' : 'ALGO'

  return (
    <div style={{
      border: '1px solid rgba(245,158,11,0.25)',
      background: 'linear-gradient(160deg,rgba(245,158,11,0.06),rgba(245,158,11,0.02))',
      borderRadius: 16, padding: '20px 16px', textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      {/* top glow line */}
      <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(90deg,transparent,#F59E0B,transparent)' }} />

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 10 }}>
        SETUP SCORE
      </div>

      <ScoreRing score={setupScore} size={108} />

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#6B7280', marginTop: 4 }}>
        avg of {STOCK_LAYERS.length} company pillars
      </div>

      <div style={{ margin: '10px 0 4px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: rec.color, background: rec.bg, border: `1px solid ${rec.border}`,
          padding: '4px 10px', borderRadius: 5, display: 'inline-block',
        }}>{rec.label}</span>
      </div>

      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
        {analysis.confidence}% confidence
      </div>

      {/* Company pillars — these average into the score */}
      <div style={{ textAlign: 'left' }}>
        {STOCK_LAYERS.map(l => (
          <QBarRow key={l.key} id={l.id} label={l.label} score={pillarScore(analysis, l.key)} color={l.color} />
        ))}
      </div>

      {/* Market context — NOT scored into the stock */}
      <div style={{ textAlign: 'left', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(245,158,11,0.1)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 8 }}>
          Market context · gates exposure, not scored
        </div>
        {CONTEXT_LAYERS.map(l => (
          <QBarRow key={l.key} id={l.id} label={l.label} score={pillarScore(analysis, l.key)} color={l.color} context />
        ))}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(245,158,11,0.12)', textAlign: 'right' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563', background: 'rgba(245,158,11,0.06)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(245,158,11,0.15)' }}>
          {methodLabel}
        </span>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ id, color, title, desc, score }: { id: string; color: string; title: string; desc: string; score?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: `${color}12`, border: `1px solid ${color}25`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, color }}>{id}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-bricolage)', fontSize: 17, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{desc}</div>
      </div>
      {score !== undefined && (
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4B5563' }}>/100</div>
        </div>
      )}
    </div>
  )
}

// ─── Narrative block with word-reveal headline ────────────────────────────────

function Narrative({ result }: { result?: Q5LayerResult }) {
  const headRef = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = headRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { setRevealed(true); obs.disconnect() }
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // A pillar exists only when its data source did — render nothing rather than a fabricated card.
  if (!result) return null

  const words = result.title.split(' ')

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 18, background: 'rgba(255,255,255,0.015)', position: 'relative' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 8 }}>
        ANALYSIS
      </div>
      {/* Word-by-word headline reveal */}
      <div ref={headRef} style={{ fontFamily: 'var(--font-bricolage)', fontSize: 16, fontWeight: 700, lineHeight: 1.35, marginBottom: 10, color: 'var(--text)', minHeight: 24 }}>
        {words.map((w, i) => (
          <span key={i} style={{
            display: 'inline-block', marginRight: 5,
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'none' : 'translateY(14px)',
            transition: `opacity 0.4s ease ${i * 60}ms, transform 0.5s cubic-bezier(.34,1.56,.64,1) ${i * 60}ms`,
          }}>{w}</span>
        ))}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: '#9CA3AF' }}>{result.analysis}</p>
    </div>
  )
}

// ─── Full score breakdown card ────────────────────────────────────────────────

function FullScoreBreakdown({ analysis }: { analysis: Q5StockAnalysis }) {
  const setupScore = setupOf(analysis)
  // radar uses the 5 company pillars only (the ones that form the composite)
  const radarScores = STOCK_LAYERS.map(l => pillarScore(analysis, l.key) ?? 0)

  return (
    <div style={{
      display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap',
      padding: 24, background: 'rgba(245,158,11,0.02)', border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: 16, marginBottom: 44,
    }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 14 }}>
          Company pillars · averaged into the score
        </div>
        {STOCK_LAYERS.map(l => (
          <QBarRow key={l.key} id={l.id} label={l.label} score={pillarScore(analysis, l.key)} color={l.color} labelWidth={110} />
        ))}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 8 }}>
            Market context · not scored into the stock
          </div>
          {CONTEXT_LAYERS.map(l => (
            <QBarRow key={l.key} id={l.id} label={l.label} score={pillarScore(analysis, l.key)} color={l.color} labelWidth={110} context />
          ))}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <Q7Heptagon scores={radarScores} layers={STOCK_LAYERS} />
        <div style={{ textAlign: 'center', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6B7280' }}>
          Setup Score <span style={{ color: 'var(--amber)', fontWeight: 800 }}>{setupScore}</span>/100
        </div>
        <div style={{ textAlign: 'center', marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#4B5563' }}>
          = mean of Q3–Q7
        </div>
      </div>
    </div>
  )
}

// ─── Bottom verdict card ──────────────────────────────────────────────────────

function VerdictCard({ analysis }: { analysis: Q5StockAnalysis }) {
  const setupScore = setupOf(analysis)
  const rec = gradeMeta(analysis.recommendation, setupScore)

  return (
    <div style={{
      border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: 28,
      background: 'linear-gradient(135deg,rgba(245,158,11,0.05),rgba(245,158,11,0.01))',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,var(--amber),rgba(245,158,11,0))' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 68, height: 68, borderRadius: '50%', border: '2px solid var(--amber)',
          background: 'var(--amber-dim)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--amber)', lineHeight: 1 }}>{setupScore}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563' }}>/100</span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-bricolage)', fontSize: 26, fontWeight: 800, color: rec.color, lineHeight: 1.1 }}>
            {rec.label}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            {analysis.confidence}% confidence · Q7 Framework
          </div>
        </div>
      </div>

      <div style={{ borderLeft: '3px solid var(--amber)', padding: '14px 18px', background: 'rgba(255,255,255,0.02)', borderRadius: '0 10px 10px 0' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 8 }}>
          BOTTOM LINE
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.75, color: '#9CA3AF' }}>{analysis.verdict}</p>
      </div>
    </div>
  )
}

// ─── Scroll-triggered section reveal ─────────────────────────────────────────

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(18px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-8">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28, alignItems: 'start' }}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-20 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <div className="h-12 w-32 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <div className="h-4 w-48 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        </div>
        <div className="h-64 rounded-2xl animate-pulse" style={{ backgroundColor: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }} />
      </div>
      {Q_LAYERS.map(l => (
        <div key={l.key} className="space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b th-border">
            <div className="w-8 h-8 rounded-lg animate-pulse" style={{ backgroundColor: `${l.color}15` }} />
            <div className="space-y-1">
              <div className="h-3 w-28 rounded animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
              <div className="h-2 w-44 rounded animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }} />
            </div>
          </div>
          <div className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }} />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  fundamentals: FMPFundamentals
}

export default function Q7StockAnalysis({ fundamentals: f }: Props) {
  const [analysis, setAnalysis] = useState<Q5StockAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams({
      ticker: f.ticker, name: f.name, sector: f.sector, industry: f.industry,
      price: String(f.price), change: String(f.change), marketCap: String(f.marketCap),
      pe: String(f.pe), revenueGrowth: String(f.revenueGrowth), grossMargin: String(f.grossMargin),
      fcfMargin: String(f.fcfMargin), roe: String(f.roe), debtEquity: String(f.debtEquity),
      dividendYield: String(f.dividendYield), score: String(f.score),
    })
    fetch(`/api/stocks/analysis?${params}`)
      .then(r => r.json())
      .then((data: Q5StockAnalysis) => { setAnalysis(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [f])

  if (loading) return <Skeleton />
  if (error || !analysis) return (
    <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--border)' }}>
      <p className="text-sm" style={{ color: '#6B7280' }}>Analysis unavailable. Check API configuration.</p>
    </div>
  )

  return (
    <div className="space-y-10">

      {/* PRICE CHART */}
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 14 }}>
          PRICE HISTORY · {f.ticker}
        </div>
        <PriceChart ticker={f.ticker} />
      </div>

      {/* COMPREHENSIVE BUSINESS BREAKDOWN — what they do, how they earn, value chain, bull/bear */}
      <AnimatedSection>
        <BusinessExplainerPanel fundamentals={f} />
      </AnimatedSection>

      {/* BUSINESS FLOW — how company makes money */}
      <AnimatedSection>
        <BusinessFlowCanvas fundamentals={f} />
      </AnimatedSection>

      {/* 3D KNOWLEDGE GRAPH — Obsidian style */}
      <AnimatedSection>
        <StockKnowledgeGraph
          ticker={f.ticker}
          analysis={analysis}
          setupScore={analysis.setupScore ?? 0}
          fundamentals={f}
        />
      </AnimatedSection>

      {/* FULL Q7 BREAKDOWN (heptagon + all 7 bars) */}
      <AnimatedSection>
        <FullScoreBreakdown analysis={analysis} />
      </AnimatedSection>

      {/* ─── Q1 MACRO ─── */}
      <AnimatedSection>
        <section>
          <SectionHead id="Q1" color="#A78BFA" title="Macro Environment" score={analysis.q1?.score}
            desc="Is the overall market environment working for or against this position?" />
          <Narrative result={analysis.q1} />
        </section>
      </AnimatedSection>

      {/* ─── Q2 SECTOR ─── */}
      <AnimatedSection>
        <section>
          <SectionHead id="Q2" color="#38BDF8" title="Sector Dynamics" score={analysis.q2?.score}
            desc={`Is ${f.sector} in favour? Is institutional money rotating in or out?`} />
          <Narrative result={analysis.q2} />
        </section>
      </AnimatedSection>

      {/* ─── Q3 FUNDAMENTAL ─── */}
      <AnimatedSection>
        <section>
          <SectionHead id="Q3" color="#34D399" title="Fundamental Quality" score={analysis.q3?.score}
            desc="Is this actually a good business, and is it getting better or worse?" />
          <div className="mb-5"><IsoFinancialBars fundamentals={f} /></div>
          <div className="mb-4"><FundamentalsGrid data={f} /></div>
          <Narrative result={analysis.q3} />
        </section>
      </AnimatedSection>

      {/* ─── DIVIDEND (if applicable) ─── */}
      {f.dividendYield > 0 && (
        <AnimatedSection>
          <section>
            <SectionHead id="DIV" color="#10B981" title="Dividend" desc="Income quality, payout sustainability, and dividend history." />
            <DividendPanel ticker={f.ticker} />
          </section>
        </AnimatedSection>
      )}

      {/* ─── Q4 QUANT ─── */}
      <AnimatedSection>
        <section>
          <SectionHead id="Q4" color="#F59E0B" title="Quant &amp; Short Interest" score={analysis.q4?.score}
            desc="Is the market agreeing with the thesis, or is momentum fighting it?" />
          <div className="space-y-4 mb-4">
            <QuantSignalsPanel ticker={f.ticker} />
            <ShortInterestPanel ticker={f.ticker} />
          </div>
          <Narrative result={analysis.q4} />
        </section>
      </AnimatedSection>

      {/* ─── Q5 SENTIMENT ─── */}
      <AnimatedSection>
        <section>
          <SectionHead id="Q5" color="#FB7185" title="Insider &amp; Sentiment" score={analysis.q5?.score}
            desc="What are the people who know this company best doing with their own money?" />
          <div className="space-y-4 mb-4">
            <InsiderPanel ticker={f.ticker} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 12 }}>
                INSTITUTIONAL HOLDINGS · 13F
              </div>
              <InstitutionalPanel ticker={f.ticker} />
            </div>
          </div>
          <Narrative result={analysis.q5} />
        </section>
      </AnimatedSection>

      {/* ─── Q6 MANAGEMENT ─── */}
      <AnimatedSection>
        <section>
          <SectionHead id="Q6" color="#E879F9" title="Management Quality" score={analysis.q6?.score}
            desc="Would you trust this team with your money for ten years? ROIC, capital allocation, conviction." />
          <div className="mb-4"><ManagementPanel ticker={f.ticker} /></div>
          {analysis.q6 && <Narrative result={analysis.q6} />}
        </section>
      </AnimatedSection>

      {/* ─── Q7 CATALYST ─── */}
      <AnimatedSection>
        <section>
          <SectionHead id="Q7" color="#F97316" title="Catalyst &amp; Earnings" score={analysis.q7?.score}
            desc="Even if everything else is right, when will the market actually react?" />
          <div className="space-y-6 mb-4">
            <EarningsModelPanel ticker={f.ticker} />
          </div>
          {analysis.q7 && <Narrative result={analysis.q7} />}
        </section>
      </AnimatedSection>

      {/* ─── BOTTOM VERDICT ─── */}
      <AnimatedSection>
        <VerdictCard analysis={analysis} />
      </AnimatedSection>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 600, color: '#4B5563', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--amber)', flexShrink: 0 }} />
        Q7 FRAMEWORK · ALGORITHMIC SCORING · AI NARRATIVE ON TRIGGERS · REFRESHED DAILY
        {analysis.fromCache && (
          <span style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: 3, backgroundColor: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.15)' }}>
            CACHED
          </span>
        )}
      </div>

    </div>
  )
}
