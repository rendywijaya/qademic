'use client'

import { useState, useRef, useCallback } from 'react'
import type { Q5StockAnalysis } from '@/app/api/stocks/analysis/route'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import { Plus, X, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { gradeMeta } from '@/lib/grades'

// ─── Constants ────────────────────────────────────────────────────────────────

const Q_LAYERS = [
  { key: 'q1' as const, id: 'Q1', label: 'Macro',       color: '#A78BFA' },
  { key: 'q2' as const, id: 'Q2', label: 'Sector',      color: '#38BDF8' },
  { key: 'q3' as const, id: 'Q3', label: 'Fundamental', color: '#34D399' },
  { key: 'q4' as const, id: 'Q4', label: 'Quant',       color: '#F59E0B' },
  { key: 'q5' as const, id: 'Q5', label: 'Sentiment',   color: '#FB7185' },
  { key: 'q6' as const, id: 'Q6', label: 'Management',  color: '#E879F9' },
  { key: 'q7' as const, id: 'Q7', label: 'Catalyst',    color: '#F97316' },
]

const SCORE_COLOR = (s: number) => s >= 70 ? '#10B981' : s >= 50 ? '#F59E0B' : '#F87171'

function fmtMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toFixed(0)}`
}

function pct(v: number, decimals = 1): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColumnData {
  analysis: Q5StockAnalysis
  fundamentals: FMPFundamentals
}

type ColumnState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: ColumnData }

// ─── Winner highlight helpers ─────────────────────────────────────────────────

/** Returns the index of the best column for a metric, or null if tied / only 1 loaded */
function findWinner(values: (number | null)[], lowerIsBetter = false): number | null {
  const valid = values.filter((v): v is number => v !== null && !Number.isNaN(v))
  if (valid.length < 2) return null
  const best = lowerIsBetter ? Math.min(...valid) : Math.max(...valid)
  const count = valid.filter(v => v === best).length
  if (count > 1) return null // tie
  return values.indexOf(best)
}

function winnerStyle(isWinner: boolean): React.CSSProperties {
  if (!isWinner) return {}
  return {
    background: 'rgba(245,158,11,0.06)',
    borderColor: 'rgba(245,158,11,0.30)',
    boxShadow: '0 0 14px rgba(245,158,11,0.08)',
  }
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function ColumnSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header skeleton */}
      <div style={{ padding: '20px 16px', border: '1px solid #1F2937', borderRadius: 12, background: 'transparent' }}
        className="animate-pulse">
        <div style={{ height: 10, width: 56, borderRadius: 4, background: 'rgba(255,255,255,0.05)', marginBottom: 10 }} />
        <div style={{ height: 36, width: 100, borderRadius: 4, background: 'rgba(245,158,11,0.07)', marginBottom: 8 }} />
        <div style={{ height: 12, width: 140, borderRadius: 4, background: 'rgba(255,255,255,0.04)', marginBottom: 6 }} />
        <div style={{ height: 12, width: 80, borderRadius: 4, background: 'rgba(255,255,255,0.03)' }} />
      </div>
      {/* Score card skeleton */}
      <div style={{ padding: '20px 16px', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 12, background: 'rgba(245,158,11,0.02)' }}
        className="animate-pulse">
        <div style={{ margin: '0 auto', width: 80, height: 80, borderRadius: '50%', background: 'rgba(245,158,11,0.07)' }} />
        <div style={{ height: 12, width: 80, borderRadius: 4, background: 'rgba(255,255,255,0.04)', margin: '12px auto 0' }} />
      </div>
      {/* Q bars skeleton */}
      <div style={{ padding: '16px', border: '1px solid #1F2937', borderRadius: 12, background: 'transparent' }}
        className="animate-pulse">
        {Q_LAYERS.map(l => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 24, height: 18, borderRadius: 3, background: `${l.color}15` }} />
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Score ring (mini, for column header) ────────────────────────────────────

function MiniScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const R = size * 0.42
  const cx = size / 2
  const circumference = 2 * Math.PI * R
  const dash = (score / 100) * circumference
  const color = SCORE_COLOR(score)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
        <circle cx={cx} cy={cx} r={R} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {score}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563' }}>/100</span>
      </div>
    </div>
  )
}

// ─── Q bar (single layer bar) ────────────────────────────────────────────────

function QBar({ id, label, score, color, winner }: { id: string; label: string; score: number; color: string; winner?: boolean }) {
  // score is 0-5, display as percentage (×20)
  const pct100 = Math.min(100, Math.round(score * 20))
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6,
      padding: '5px 8px', borderRadius: 6,
      border: winner ? '1px solid rgba(245,158,11,0.20)' : '1px solid transparent',
      background: winner ? 'rgba(245,158,11,0.04)' : 'transparent',
      transition: 'all 0.2s ease',
    }}>
      <div style={{
        width: 22, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}15`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 800, color }}>{id}</span>
      </div>
      <span style={{ fontSize: 10, color: '#6B7280', width: 72, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{label}</span>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, background: color, opacity: winner ? 1 : 0.75,
          width: `${pct100}%`, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: winner ? color : '#6B7280',
        width: 22, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
      }}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}

// ─── Metric cell ──────────────────────────────────────────────────────────────

function MetricCell({
  label, value, sub, color, isWinner,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  isWinner?: boolean
}) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, border: '1px solid #1F2937',
      background: 'transparent', transition: 'all 0.2s ease',
      ...(isWinner ? winnerStyle(true) : {}),
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4B5563', marginTop: 3 }}>{sub}</div>
      )}
    </div>
  )
}

// ─── Loaded column ────────────────────────────────────────────────────────────

interface LoadedColumnProps {
  data: ColumnData
  qScoreWinners: (number | null)[]     // index per Q layer (0-6)
  metricWinners: Record<string, number | null>
  colIndex: number
  colCount: number
}

function LoadedColumn({ data, qScoreWinners, metricWinners, colIndex }: LoadedColumnProps) {
  const { analysis: a, fundamentals: f } = data
  const rec = gradeMeta(a.recommendation, a.setupScore)
  const setupScore = a.setupScore ?? Math.round(
    [a.q1, a.q2, a.q3, a.q4, a.q5].reduce((acc, q) => acc + (q?.score ?? 0), 0) / 5
  )
  const isSetupWinner = metricWinners.setupScore === colIndex
  const changePositive = f.change > 0
  const changeColor = f.change > 0 ? '#10B981' : f.change < 0 ? '#F87171' : '#9CA3AF'
  const ChangeIcon = changePositive ? TrendingUp : f.change < 0 ? TrendingDown : Minus

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── HEADER CARD ── */}
      <div style={{
        padding: '18px 16px', border: '1px solid #1F2937', borderRadius: 12, background: 'transparent',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Sector badge */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3,
            border: '1px solid rgba(56,189,248,0.25)', color: '#38BDF8', background: 'rgba(56,189,248,0.06)',
          }}>
            {f.sector}
          </span>
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 800, color: '#F59E0B',
          letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4,
        }}>
          {f.ticker}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: 1.3 }}>{f.name}</div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            ${f.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChangeIcon style={{ width: 13, height: 13, color: changeColor }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: changeColor, fontVariantNumeric: 'tabular-nums' }}>
            {f.change >= 0 ? '+' : ''}{f.change.toFixed(2)}%
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563' }}>TODAY</span>
        </div>

        {/* Mkt cap */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4B5563' }}>MKT CAP</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>
            {fmtMarketCap(f.marketCap)}
          </span>
        </div>

        {/* Link to full analysis */}
        <div style={{ marginTop: 10 }}>
          <Link href={`/dashboard/stocks/${f.ticker}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.08em', color: '#F59E0B',
              textDecoration: 'none',
            }}>
            FULL ANALYSIS <ArrowRight style={{ width: 10, height: 10 }} />
          </Link>
        </div>
      </div>

      {/* ── SETUP SCORE CARD ── */}
      <div style={{
        padding: '18px 16px', borderRadius: 12, textAlign: 'center',
        border: isSetupWinner ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(245,158,11,0.15)',
        background: isSetupWinner
          ? 'linear-gradient(160deg,rgba(245,158,11,0.08),rgba(245,158,11,0.03))'
          : 'linear-gradient(160deg,rgba(245,158,11,0.04),rgba(245,158,11,0.01))',
        boxShadow: isSetupWinner ? '0 0 18px rgba(245,158,11,0.09)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}>
        {isSetupWinner && (
          <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(90deg,transparent,#F59E0B,transparent)' }} />
        )}

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 10 }}>
          SETUP SCORE
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <MiniScoreRing score={setupScore} />
        </div>

        <div style={{ display: 'inline-flex' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            color: rec.color, background: rec.bg, border: `1px solid ${rec.border}`,
            padding: '3px 9px', borderRadius: 4,
          }}>
            {rec.label}
          </span>
        </div>

        {a.confidence !== undefined && (
          <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6B7280' }}>
            {a.confidence}% confidence
          </div>
        )}
      </div>

      {/* ── Q7 BARS ── */}
      <div style={{ padding: '14px 12px', border: '1px solid #1F2937', borderRadius: 12, background: 'transparent' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 10 }}>
          Q7 FRAMEWORK
        </div>
        {Q_LAYERS.map((l, li) => {
          const layerResult = a[l.key]
          if (!layerResult) return null
          const isWinner = qScoreWinners[li] === colIndex
          return (
            <QBar
              key={l.key}
              id={l.id}
              label={l.label}
              score={layerResult.score}
              color={l.color}
              winner={isWinner}
            />
          )
        })}
      </div>

      {/* ── Q7 ANALYSIS TEXT ── */}
      <div style={{ padding: '14px 12px', border: '1px solid #1F2937', borderRadius: 12, background: 'transparent' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 10 }}>
          LAYER INSIGHTS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Q_LAYERS.map(l => {
            const layerResult = a[l.key]
            if (!layerResult) return null
            return (
              <div key={l.key} style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <div style={{
                    width: 18, height: 14, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${l.color}15`, flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, fontWeight: 800, color: l.color }}>{l.id}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{layerResult.title}</span>
                </div>
                <p style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.65, margin: 0 }}>{layerResult.analysis}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── KEY METRICS ── */}
      <div style={{ padding: '14px 12px', border: '1px solid #1F2937', borderRadius: 12, background: 'transparent' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 10 }}>
          KEY METRICS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <MetricCell
            label="Rev Growth"
            value={pct(f.revenueGrowth)}
            color={f.revenueGrowth > 0 ? '#10B981' : '#F87171'}
            isWinner={metricWinners.revenueGrowth === colIndex}
          />
          <MetricCell
            label="Gross Margin"
            value={`${f.grossMargin.toFixed(1)}%`}
            color={f.grossMargin > 50 ? '#10B981' : f.grossMargin < 15 ? '#F87171' : undefined}
            isWinner={metricWinners.grossMargin === colIndex}
          />
          <MetricCell
            label="FCF Margin"
            value={`${f.fcfMargin.toFixed(1)}%`}
            color={f.fcfMargin > 0 ? '#10B981' : '#F87171'}
            isWinner={metricWinners.fcfMargin === colIndex}
          />
          <MetricCell
            label="P/E Ratio"
            value={f.pe > 0 ? `${f.pe.toFixed(1)}x` : '—'}
            color={f.pe > 0 && f.pe < 25 ? '#10B981' : f.pe > 50 ? '#F87171' : undefined}
            isWinner={metricWinners.pe === colIndex}
          />
          <MetricCell
            label="Debt / Equity"
            value={f.debtEquity > 0 ? `${f.debtEquity.toFixed(2)}x` : '—'}
            color={f.debtEquity < 0.5 ? '#10B981' : f.debtEquity > 3 ? '#F87171' : undefined}
            isWinner={metricWinners.debtEquity === colIndex}
          />
          <MetricCell
            label="ROE"
            value={`${f.roe.toFixed(1)}%`}
            color={f.roe > 20 ? '#10B981' : f.roe < 0 ? '#F87171' : undefined}
            isWinner={metricWinners.roe === colIndex}
          />
        </div>
      </div>

      {/* ── VERDICT ── */}
      <div style={{
        padding: '16px', borderRadius: 12,
        border: '1px solid rgba(245,158,11,0.20)',
        background: 'linear-gradient(135deg,rgba(245,158,11,0.04),transparent)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,rgba(245,158,11,0.5),transparent)' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#F59E0B', marginBottom: 8 }}>
          BOTTOM LINE
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.75, margin: 0 }}>{a.verdict}</p>
      </div>

    </div>
  )
}

// ─── Ticker input slot ────────────────────────────────────────────────────────

interface TickerSlotProps {
  value: string
  state: ColumnState
  placeholder: string
  onChangeValue: (v: string) => void
  onLoad: () => void
  onClear: () => void
}

function TickerSlot({ value, state, onChangeValue, onLoad, onClear }: TickerSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onLoad()
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChangeValue(e.target.value.toUpperCase().slice(0, 10))}
          onKeyDown={handleKey}
          placeholder="TICKER"
          spellCheck={false}
          style={{
            width: '100%', boxSizing: 'border-box',
            fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            background: 'var(--surface)', border: '1px solid #1F2937',
            borderRadius: 8, padding: '9px 12px',
            color: '#F59E0B', outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.4)' }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#1F2937' }}
        />
      </div>
      <button
        onClick={onLoad}
        disabled={state.status === 'loading' || !value.trim()}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
          background: value.trim() ? '#F59E0B' : 'rgba(245,158,11,0.08)',
          color: value.trim() ? '#050810' : '#4B5563',
          border: value.trim() ? '1px solid #F59E0B' : '1px solid rgba(245,158,11,0.15)',
          transition: 'all 0.15s ease',
          opacity: state.status === 'loading' ? 0.6 : 1,
        }}
      >
        {state.status === 'loading' ? '...' : 'LOAD'}
      </button>
      {(state.status === 'loaded' || state.status === 'error') && (
        <button
          onClick={onClear}
          title="Clear"
          style={{
            width: 34, height: 34, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid #1F2937', cursor: 'pointer',
            color: '#4B5563', flexShrink: 0, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#F87171'; (e.currentTarget as HTMLButtonElement).style.color = '#F87171' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1F2937'; (e.currentTarget as HTMLButtonElement).style.color = '#4B5563' }}
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  )
}

// ─── Empty slot placeholder ───────────────────────────────────────────────────

function EmptySlotContent() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 260, border: '1px dashed rgba(245,158,11,0.15)', borderRadius: 12,
      background: 'rgba(245,158,11,0.02)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.07)',
        border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}>
        <TrendingUp style={{ width: 18, height: 18, color: 'rgba(245,158,11,0.4)' }} />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', color: '#4B5563', textAlign: 'center', maxWidth: 140, lineHeight: 1.5 }}>
        Enter a ticker<br />to compare
      </div>
    </div>
  )
}

// ─── Error column content ─────────────────────────────────────────────────────

function ErrorContent({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 200, border: '1px solid rgba(248,113,113,0.20)', borderRadius: 12,
      background: 'rgba(248,113,113,0.03)', padding: 20,
    }}>
      <X style={{ width: 20, height: 20, color: '#F87171', marginBottom: 10 }} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#F87171', letterSpacing: '0.08em', marginBottom: 4 }}>
        LOAD FAILED
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', lineHeight: 1.5, maxWidth: 160 }}>{message}</div>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export default function CompareClient() {
  const MAX_COLS = 3

  const [inputs, setInputs] = useState<string[]>(['', ''])
  const [states, setStates] = useState<ColumnState[]>([{ status: 'empty' }, { status: 'empty' }])

  // Update a specific column's input value
  const setInput = useCallback((i: number, v: string) => {
    setInputs(prev => { const n = [...prev]; n[i] = v; return n })
  }, [])

  // Clear a column back to empty
  const clearColumn = useCallback((i: number) => {
    setInputs(prev => { const n = [...prev]; n[i] = ''; return n })
    setStates(prev => { const n = [...prev]; n[i] = { status: 'empty' }; return n })
  }, [])

  // Load a ticker into a column
  const loadTicker = useCallback(async (i: number) => {
    const ticker = inputs[i]?.trim().toUpperCase()
    if (!ticker) return

    // Set loading
    setStates(prev => { const n = [...prev]; n[i] = { status: 'loading' }; return n })

    try {
      // Fetch fundamentals first (fast), then analysis in parallel
      const [fundRes, analysisRes] = await Promise.all([
        fetch(`/api/fmp/fundamentals?tickers=${encodeURIComponent(ticker)}`),
        fetch(`/api/stocks/analysis?ticker=${encodeURIComponent(ticker)}`),
      ])

      if (!fundRes.ok) {
        throw new Error(`Fundamentals fetch failed (${fundRes.status})`)
      }

      const fundBody = await fundRes.json() as { data?: FMPFundamentals[]; error?: string }

      if (!analysisRes.ok) {
        throw new Error(`Analysis fetch failed (${analysisRes.status})`)
      }

      const analysisBody = await analysisRes.json() as Q5StockAnalysis & { error?: string }

      if (fundBody.error || !fundBody.data || fundBody.data.length === 0) {
        throw new Error(fundBody.error ?? 'No fundamentals data returned')
      }

      if (analysisBody.error) {
        throw new Error(analysisBody.error)
      }

      const fundamentals = fundBody.data[0] as FMPFundamentals
      if (fundamentals.source === 'fallback') {
        throw new Error(`"${ticker}" not found or invalid ticker`)
      }

      setStates(prev => {
        const n = [...prev]
        n[i] = { status: 'loaded', data: { analysis: analysisBody, fundamentals } }
        return n
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStates(prev => { const n = [...prev]; n[i] = { status: 'error', message }; return n })
    }
  }, [inputs])

  // Add a 3rd column
  function addColumn() {
    if (inputs.length >= MAX_COLS) return
    setInputs(prev => [...prev, ''])
    setStates(prev => [...prev, { status: 'empty' }])
  }

  // Remove the 3rd column
  function removeColumn() {
    if (inputs.length <= 2) return
    setInputs(prev => prev.slice(0, 2))
    setStates(prev => prev.slice(0, 2))
  }

  // ── Compute winners across loaded columns ──
  const loadedCols = states
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.status === 'loaded') as Array<{ s: Extract<ColumnState, { status: 'loaded' }>; i: number }>

  // Q score winners: for each layer, get scores across all loaded cols
  const qScoreWinners: (number | null)[] = Q_LAYERS.map((_l, li) => {
    const vals = states.map(s =>
      s.status === 'loaded' ? (s.data.analysis[Q_LAYERS[li]!.key]?.score ?? null) : null
    )
    return findWinner(vals, false)
  })

  // Metric winners
  function getMetricWinner(getter: (d: ColumnData) => number | null, lowerIsBetter = false): number | null {
    const vals = states.map(s => s.status === 'loaded' ? getter(s.data) : null)
    return findWinner(vals, lowerIsBetter)
  }

  const setupScores = states.map(s => s.status === 'loaded' ? (s.data.analysis.setupScore ?? null) : null)
  const metricWinners = {
    setupScore: findWinner(setupScores, false),
    revenueGrowth: getMetricWinner(d => d.fundamentals.revenueGrowth),
    grossMargin: getMetricWinner(d => d.fundamentals.grossMargin),
    fcfMargin: getMetricWinner(d => d.fundamentals.fcfMargin),
    pe: getMetricWinner(d => d.fundamentals.pe > 0 ? d.fundamentals.pe : null, true), // lower P/E is better
    debtEquity: getMetricWinner(d => d.fundamentals.debtEquity >= 0 ? d.fundamentals.debtEquity : null, true), // lower D/E is better
    roe: getMetricWinner(d => d.fundamentals.roe),
  }

  const colCount = inputs.length

  // Grid columns: on desktop n-up, on mobile stack
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
    alignItems: 'start',
  }

  // Suppress unused var warning
  void loadedCols

  return (
    <div>
      {/* ── Ticker input bar ── */}
      <div style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        marginBottom: 8,
      }}>
        {inputs.map((v, i) => (
          <TickerSlot
            key={i}
            value={v}
            state={states[i] ?? { status: 'empty' }}
            placeholder={i === 0 ? 'e.g. NVDA' : i === 1 ? 'e.g. AMD' : 'e.g. TSM'}
            onChangeValue={val => setInput(i, val)}
            onLoad={() => loadTicker(i)}
            onClear={() => clearColumn(i)}
          />
        ))}
      </div>

      {/* ── Add / Remove 3rd column ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        {inputs.length < MAX_COLS ? (
          <button
            onClick={addColumn}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
              padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(245,158,11,0.20)',
              color: '#F59E0B', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.07)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <Plus style={{ width: 10, height: 10 }} />
            ADD 3RD STOCK
          </button>
        ) : (
          <button
            onClick={removeColumn}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
              padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(248,113,113,0.20)',
              color: '#F87171', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.07)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <X style={{ width: 10, height: 10 }} />
            REMOVE 3RD STOCK
          </button>
        )}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(245,158,11,0.35)', border: '1px solid rgba(245,158,11,0.50)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563' }}>WINNER</span>
        </div>
      </div>

      {/* ── Column grid ── */}
      {/* Mobile: single col stacked, desktop: side-by-side */}
      <style>{`
        @media (max-width: 767px) {
          .compare-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div className="compare-grid" style={gridStyle}>
        {states.map((state, i) => {
          if (state.status === 'loading') {
            return (
              <div key={i}>
                <ColumnSkeleton />
              </div>
            )
          }

          if (state.status === 'error') {
            return (
              <div key={i}>
                <ErrorContent message={state.message} />
              </div>
            )
          }

          if (state.status === 'loaded') {
            return (
              <div key={i}>
                <LoadedColumn
                  data={state.data}
                  qScoreWinners={qScoreWinners}
                  metricWinners={metricWinners}
                  colIndex={i}
                  colCount={colCount}
                />
              </div>
            )
          }

          // Empty
          return (
            <div key={i}>
              <EmptySlotContent />
            </div>
          )
        })}
      </div>

      {/* Bottom note */}
      <div style={{
        marginTop: 28, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-mono)', fontSize: 8, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
        Q7 FRAMEWORK · DATA FROM FMP &amp; AI ANALYSIS · NOT FINANCIAL ADVICE
      </div>
    </div>
  )
}
