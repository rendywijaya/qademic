'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Shield, AlertTriangle, CheckCircle } from 'lucide-react'

interface ManagementScore {
  ceo_name: string | null; is_founder_led: boolean | null
  insider_ownership_pct: number | null
  roic_1yr: number | null; roic_3yr_avg: number | null; roic_5yr_avg: number | null
  roic_trend: string | null; fcf_conversion: number | null; debt_trend: string | null
  capital_alloc_score: number | null; mgmt_score: number | null
}

interface ForensicSignals {
  accruals_ratio: number | null; accruals_flag: boolean | null
  gross_margin_delta: number | null; gross_margin_flag: boolean | null
  beneish_m_score: number | null; beneish_flag: boolean | null
  overall_flag: string | null; forensic_score: number | null
}

interface ManagementResponse {
  available: boolean
  management?: ManagementScore
  forensic?: ForensicSignals | null
}

function TrendIcon({ trend }: { trend: string | null }) {
  if (!trend) return <Minus className="w-3 h-3" style={{ color: '#6B7280' }} />
  if (trend === 'improving') return <TrendingUp className="w-3 h-3" style={{ color: '#10B981' }} />
  if (trend === 'deteriorating') return <TrendingDown className="w-3 h-3" style={{ color: '#F87171' }} />
  return <Minus className="w-3 h-3" style={{ color: '#F59E0B' }} />
}

function MetricRow({ label, value, suffix = '', positive, neutral }: {
  label: string; value: number | null; suffix?: string; positive?: number; neutral?: number
}) {
  let color = '#9CA3AF'
  if (value != null) {
    if (positive != null && value >= positive) color = '#10B981'
    else if (neutral != null && value >= neutral) color = '#F59E0B'
    else if (value != null) color = '#F87171'
  }
  return (
    <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span className="text-[10px] font-bold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {value != null ? `${value.toFixed(1)}${suffix}` : '—'}
      </span>
    </div>
  )
}

function ForensicFlag({ signals }: { signals: ForensicSignals }) {
  const flagConfig = {
    clean:   { icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', label: 'Earnings quality: Clean' },
    watch:   { icon: Shield,       color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Earnings quality: Watch' },
    warning: { icon: AlertTriangle, color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', label: 'Earnings quality: Warning' },
  }
  const cfg = flagConfig[signals.overall_flag as keyof typeof flagConfig] ?? flagConfig.clean
  const Icon = cfg.icon
  return (
    <div className="rounded-lg border p-3" style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        <span className="text-[10px] font-bold" style={{ color: cfg.color, fontFamily: 'var(--font-mono)' }}>{cfg.label}</span>
        {signals.forensic_score != null && (
          <span className="ml-auto text-[10px] tabular-nums font-bold" style={{ color: cfg.color, fontFamily: 'var(--font-mono)' }}>
            {signals.forensic_score}/100
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {signals.accruals_flag && (
          <div className="text-[10px]" style={{ color: '#F87171' }}>
            ⚠ High accruals ratio ({signals.accruals_ratio?.toFixed(1)}%) — earnings may be inflated vs cash
          </div>
        )}
        {signals.gross_margin_flag && (
          <div className="text-[10px]" style={{ color: '#F87171' }}>
            ⚠ Gross margin declining ({signals.gross_margin_delta?.toFixed(0)}bps YoY)
          </div>
        )}
        {signals.beneish_flag && (
          <div className="text-[10px]" style={{ color: '#F87171' }}>
            ⚠ Beneish M-Score elevated ({signals.beneish_m_score?.toFixed(2)}) — possible earnings manipulation
          </div>
        )}
        {!signals.accruals_flag && !signals.gross_margin_flag && !signals.beneish_flag && (
          <div className="text-[10px]" style={{ color: '#10B981' }}>No forensic red flags detected.</div>
        )}
      </div>
    </div>
  )
}

export default function ManagementPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<ManagementResponse | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/management?ticker=${ticker}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ available: false }))
  }, [ticker])

  if (!data) {
    return <div className="h-40 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
  }

  if (!data.available || !data.management) {
    return (
      <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
        <Shield className="w-6 h-6 mx-auto mb-2" style={{ color: '#6B7280' }} />
        <p className="text-xs" style={{ color: '#9CA3AF' }}>Management data not yet computed.</p>
        <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>Run the nightly compute-signals pipeline to populate Q6 scoring.</p>
      </div>
    )
  }

  const m = data.management
  const mgmtScore = m.mgmt_score
  const scoreColor = mgmtScore == null ? '#9CA3AF' : mgmtScore >= 70 ? '#10B981' : mgmtScore >= 50 ? '#F59E0B' : '#F87171'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {m.ceo_name && (
            <div className="text-sm font-bold mb-0.5" style={{ color: 'var(--text)' }}>{m.ceo_name}</div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: '#9CA3AF' }}>CEO</span>
            {m.is_founder_led && (
              <span className="text-[9px] px-2 py-0.5 rounded border font-semibold"
                style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.2)', fontFamily: 'var(--font-mono)' }}>
                FOUNDER-LED
              </span>
            )}
          </div>
        </div>
        {mgmtScore != null && (
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: scoreColor }}>
              {mgmtScore}
            </div>
            <div className="text-[9px]" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>Q6 SCORE /100</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Capital Allocation */}
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="text-[9px] uppercase tracking-[0.1em] mb-2" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
            CAPITAL ALLOCATION
          </div>
          <MetricRow label="ROIC (1yr)" value={m.roic_1yr} suffix="%" positive={20} neutral={10} />
          <MetricRow label="ROIC (3yr avg)" value={m.roic_3yr_avg} suffix="%" positive={20} neutral={10} />
          <MetricRow label="ROIC (5yr avg)" value={m.roic_5yr_avg} suffix="%" positive={20} neutral={10} />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>ROIC Trend</span>
            <span className="flex items-center gap-1 text-[10px] capitalize"
              style={{ color: m.roic_trend === 'improving' ? '#10B981' : m.roic_trend === 'deteriorating' ? '#F87171' : '#F59E0B', fontFamily: 'var(--font-mono)' }}>
              <TrendIcon trend={m.roic_trend ?? null} />
              {m.roic_trend ?? '—'}
            </span>
          </div>
        </div>

        {/* Financial Health */}
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="text-[9px] uppercase tracking-[0.1em] mb-2" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
            FINANCIAL STEWARDSHIP
          </div>
          <MetricRow label="FCF Conversion" value={m.fcf_conversion} suffix="%" positive={90} neutral={60} />
          {m.insider_ownership_pct != null && (
            <MetricRow label="Insider Ownership" value={m.insider_ownership_pct} suffix="%" positive={10} neutral={3} />
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>Debt Trend</span>
            <span className="flex items-center gap-1 text-[10px] capitalize"
              style={{ color: m.debt_trend === 'improving' ? '#10B981' : m.debt_trend === 'deteriorating' ? '#F87171' : '#F59E0B', fontFamily: 'var(--font-mono)' }}>
              <TrendIcon trend={m.debt_trend ?? null} />
              {m.debt_trend ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Forensic signals */}
      {data.forensic && <ForensicFlag signals={data.forensic} />}
    </div>
  )
}
