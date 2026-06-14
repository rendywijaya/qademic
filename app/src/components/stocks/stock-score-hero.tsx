'use client'

import { useEffect, useState } from 'react'
import type { Q5StockAnalysis } from '@/app/api/stocks/analysis/route'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import { gradeMeta } from '@/lib/grades'

const Q_LAYERS = [
  { key: 'q1' as const, id: 'Q1', label: 'Macro',       color: '#A78BFA' },
  { key: 'q2' as const, id: 'Q2', label: 'Sector',      color: '#38BDF8' },
  { key: 'q3' as const, id: 'Q3', label: 'Fundamental', color: '#34D399' },
  { key: 'q4' as const, id: 'Q4', label: 'Quant',       color: '#F59E0B' },
  { key: 'q5' as const, id: 'Q5', label: 'Sentiment',   color: '#FB7185' },
  { key: 'q6' as const, id: 'Q6', label: 'Management',  color: '#E879F9' },
  { key: 'q7' as const, id: 'Q7', label: 'Catalyst',    color: '#F97316' },
]
// Composite = the 5 company pillars only. Q1 Macro + Q2 Sector are market context.
const STOCK_LAYERS = Q_LAYERS.filter(l => l.key !== 'q1' && l.key !== 'q2')
const CONTEXT_LAYERS = Q_LAYERS.filter(l => l.key === 'q1' || l.key === 'q2')

function ScoreRing({ score }: { score: number }) {
  const R = 46, cx = 54
  const circumference = 2 * Math.PI * R
  const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F87171'
  const dash = (score / 100) * circumference

  return (
    <div style={{ position: 'relative', width: 108, height: 108, flexShrink: 0 }}>
      <svg width={108} height={108} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={7} />
        <circle cx={cx} cy={cx} r={R} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4B5563' }}>/100</span>
      </div>
    </div>
  )
}

// Bar that animates from 0 → score on mount
function AnimatedBar({ score, color, mounted }: { score: number; color: string; mounted: boolean }) {
  return (
    <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 2, backgroundColor: color, opacity: 0.85,
        width: mounted ? `${score}%` : '0%',
        transition: mounted ? 'width 1.3s cubic-bezier(0.4,0,0.2,1)' : 'none',
      }} />
    </div>
  )
}

// Skeleton while loading
function ScoreSkeleton() {
  return (
    <div style={{
      border: '1px solid rgba(245,158,11,0.15)', borderRadius: 16, padding: '20px 16px',
      background: 'linear-gradient(160deg,rgba(245,158,11,0.04),rgba(245,158,11,0.01))',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.3),transparent)' }} />
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 10 }}>SETUP SCORE</div>
        <div style={{ width: 108, height: 108, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.04)', margin: '0 auto 12px', animation: 'pulse 2s infinite' }} />
        <div style={{ height: 20, width: 80, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, margin: '0 auto 14px' }} />
      </div>
      {[1,2,3,4,5,6,7].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 26, height: 20, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <div style={{ width: 86, height: 10, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.04)' }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.04)' }} />
          <div style={{ width: 26, height: 10, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.04)' }} />
        </div>
      ))}
    </div>
  )
}

interface Props {
  fundamentals: FMPFundamentals
}

export default function StockScoreHero({ fundamentals: f }: Props) {
  const [analysis, setAnalysis] = useState<Q5StockAnalysis | null>(null)
  const [mounted, setMounted] = useState(false)

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
      .then((data: Q5StockAnalysis) => {
        setAnalysis(data)
        // Brief delay so CSS transition fires after render
        setTimeout(() => setMounted(true), 60)
      })
      .catch(() => undefined)
  }, [f])

  if (!analysis) return <ScoreSkeleton />

  // Composite is ALWAYS recomputed from the displayed company pillars (Q3–Q7) so the
  // number can never disagree with the bars. Missing pillars are excluded, not faked as 50.
  const stockPresent = STOCK_LAYERS
    .map(l => analysis[l.key]?.score)
    .filter((v): v is number => typeof v === 'number')
  const setupScore = stockPresent.length ? Math.round(stockPresent.reduce((a, b) => a + b, 0) / stockPresent.length) : 0
  const rec = gradeMeta(analysis.recommendation, setupScore)
  const scoreOf = (key: typeof Q_LAYERS[number]['key']): number | null => {
    const v = analysis[key]?.score
    return typeof v === 'number' ? v : null
  }

  return (
    <div style={{
      border: '1px solid rgba(245,158,11,0.25)',
      background: 'linear-gradient(160deg,rgba(245,158,11,0.06),rgba(245,158,11,0.02))',
      borderRadius: 16, padding: '20px 16px', position: 'relative', overflow: 'hidden',
    }}>
      {/* top glow line */}
      <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(90deg,transparent,#F59E0B,transparent)' }} />

      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 10 }}>
          SETUP SCORE
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <ScoreRing score={setupScore} />
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: rec.color, background: rec.bg, border: `1px solid ${rec.border}`,
          padding: '4px 10px', borderRadius: 5, display: 'inline-block', marginBottom: 6,
        }}>{rec.label}</span>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#6B7280', marginTop: 2 }}>
          avg of {STOCK_LAYERS.length} company pillars · {analysis.confidence}% confidence
        </div>
      </div>

      {/* Company pillars (Q3–Q7) — these average into the score */}
      <div>
        {STOCK_LAYERS.map((l) => {
          const s = scoreOf(l.key)
          return (
            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <div style={{ width: 26, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${l.color}12`, flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 800, color: l.color }}>{l.id}</span>
              </div>
              <span style={{ fontSize: 10, color: '#9CA3AF', width: 74, flexShrink: 0 }}>{l.label}</span>
              <AnimatedBar score={s ?? 0} color={l.color} mounted={mounted} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: s == null ? '#4B5563' : l.color, width: 22, textAlign: 'right', flexShrink: 0 }}>{s == null ? '—' : s}</span>
            </div>
          )
        })}
      </div>

      {/* Market context (Q1/Q2) — NOT scored into the stock */}
      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid rgba(245,158,11,0.1)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 7 }}>
          Market context · not scored
        </div>
        {CONTEXT_LAYERS.map((l) => {
          const s = scoreOf(l.key)
          return (
            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, opacity: 0.6 }}>
              <div style={{ width: 26, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${l.color}12`, flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 800, color: l.color }}>{l.id}</span>
              </div>
              <span style={{ fontSize: 10, color: '#9CA3AF', width: 74, flexShrink: 0 }}>{l.label}</span>
              <AnimatedBar score={s ?? 0} color={l.color} mounted={mounted} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: s == null ? '#4B5563' : l.color, width: 22, textAlign: 'right', flexShrink: 0 }}>{s == null ? '—' : s}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
