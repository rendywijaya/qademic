'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StockSignals {
  sma_20: number | null; sma_50: number | null; sma_200: number | null
  price: number | null
  price_vs_sma20: number | null; price_vs_sma50: number | null; price_vs_sma200: number | null
  momentum_1m: number | null; momentum_3m: number | null
  momentum_6m: number | null; momentum_12m: number | null
  rsi_14: number | null; atr_14: number | null
  volume_avg_20: number | null; volume_ratio: number | null
  quant_score: number | null
}

interface UniverseRanking {
  rsi_pct: number | null; momentum_3m_pct: number | null
  momentum_12m_pct: number | null; sector_mom_3m_pct: number | null
  setup_score_pct: number | null; sector: string | null
}

interface SignalsResponse {
  available: boolean
  signals?: StockSignals
  ranking?: UniverseRanking | null
}

function RSIGauge({ value }: { value: number }) {
  const color = value >= 70 ? '#F87171' : value <= 30 ? '#10B981' : '#F59E0B'
  const label = value >= 80 ? 'Overbought' : value >= 70 ? 'Elevated' : value <= 20 ? 'Oversold' : value <= 30 ? 'Cheap' : 'Healthy'
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[9px] uppercase tracking-[0.12em] mb-0.5" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>RSI (14)</div>
        <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color }}>
          {value}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color }}>{label}</div>
      </div>
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#1F2937" strokeWidth="6" />
          <circle cx="32" cy="32" r="26" fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={`${(value / 100) * 163.4} 163.4`}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
          style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      </div>
    </div>
  )
}

function MomentumRow({ label, value }: { label: string; value: number | null }) {
  if (value == null) return (
    <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span className="text-[10px]" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>—</span>
    </div>
  )
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums"
        style={{ color: up ? '#10B981' : '#F87171', fontFamily: 'var(--font-mono)' }}>
        <Icon className="w-3 h-3" />
        {up ? '+' : ''}{value.toFixed(1)}%
      </span>
    </div>
  )
}

function SMARow({ label, pctDiff }: { label: string; pctDiff: number | null }) {
  if (pctDiff == null) return null
  const up = pctDiff >= 0
  return (
    <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span className="flex items-center gap-1 text-[10px] tabular-nums font-semibold"
        style={{ color: up ? '#10B981' : '#F87171', fontFamily: 'var(--font-mono)' }}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? '+' : ''}{pctDiff.toFixed(1)}% {up ? 'above' : 'below'}
      </span>
    </div>
  )
}

function PctileBadge({ label, value, sector }: { label: string; value: number | null; sector?: string | null }) {
  if (value == null) return null
  const color = value >= 70 ? '#10B981' : value >= 40 ? '#F59E0B' : '#F87171'
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
      <div className="text-[9px] uppercase tracking-[0.1em] mb-1" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
        {label}{sector ? ` · ${sector}` : ''}
      </div>
      <div className="text-lg font-bold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>
        Top {100 - value}%
      </div>
      <div className="text-[9px]" style={{ color: '#6B7280' }}>of all stocks</div>
    </div>
  )
}

export default function QuantSignalsPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<SignalsResponse | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/signals?ticker=${ticker}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ available: false }))
  }, [ticker])

  if (!data) {
    return <div className="h-40 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
  }

  if (!data.available || !data.signals) {
    return (
      <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>Quant signals not yet computed.</p>
        <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>Run the nightly compute-signals pipeline to populate RSI, momentum, and trend analysis.</p>
      </div>
    )
  }

  const s = data.signals
  const r = data.ranking

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* RSI */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
        <div className="text-[9px] uppercase tracking-[0.12em] mb-3" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
          RSI OSCILLATOR
        </div>
        {s.rsi_14 != null ? <RSIGauge value={s.rsi_14} /> : (
          <div className="text-xs" style={{ color: '#6B7280' }}>RSI not available</div>
        )}
      </div>

      {/* Momentum */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
        <div className="text-[9px] uppercase tracking-[0.12em] mb-3" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
          PRICE MOMENTUM
        </div>
        <MomentumRow label="1 Month" value={s.momentum_1m} />
        <MomentumRow label="3 Month" value={s.momentum_3m} />
        <MomentumRow label="6 Month" value={s.momentum_6m} />
        <MomentumRow label="12 Month" value={s.momentum_12m} />
      </div>

      {/* Trend + Rankings */}
      <div className="space-y-3">
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="text-[9px] uppercase tracking-[0.12em] mb-3" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
            TREND POSITION
          </div>
          <SMARow label="vs SMA-20" pctDiff={s.price_vs_sma20} />
          <SMARow label="vs SMA-50" pctDiff={s.price_vs_sma50} />
          <SMARow label="vs SMA-200" pctDiff={s.price_vs_sma200} />
          {s.volume_ratio != null && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>Volume vs Avg</span>
              <span className="text-[10px] font-bold tabular-nums"
                style={{ color: s.volume_ratio > 1.5 ? '#F59E0B' : '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                {s.volume_ratio.toFixed(1)}x
              </span>
            </div>
          )}
        </div>

        {r && (
          <div className="grid grid-cols-2 gap-2">
            <PctileBadge label="Universe Rank" value={r.momentum_3m_pct} />
            <PctileBadge label="Sector Rank" value={r.sector_mom_3m_pct} sector={r.sector} />
          </div>
        )}
      </div>
    </div>
  )
}
