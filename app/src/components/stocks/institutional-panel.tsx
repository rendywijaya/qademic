'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Building2 } from 'lucide-react'

interface Holding {
  fund_name: string; quarter: string
  shares: number | null; value_usd: number | null
  change_shares: number | null; change_type: string | null
}

interface InstitutionalResponse {
  holdings: Holding[]
  source: string
}

function changeIcon(changeType: string | null) {
  if (!changeType) return <Minus className="w-3 h-3" style={{ color: '#9CA3AF' }} />
  const type = changeType.toLowerCase()
  if (type.includes('new')) return <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981', fontFamily: 'var(--font-mono)' }}>NEW</span>
  if (type.includes('increase')) return <TrendingUp className="w-3 h-3" style={{ color: '#10B981' }} />
  if (type.includes('reduc') || type.includes('decrease')) return <TrendingDown className="w-3 h-3" style={{ color: '#F87171' }} />
  if (type.includes('clos') || type.includes('sold')) return <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.15)', color: '#F87171', fontFamily: 'var(--font-mono)' }}>CLOSED</span>
  return <Minus className="w-3 h-3" style={{ color: '#9CA3AF' }} />
}

export default function InstitutionalPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<InstitutionalResponse | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/institutional?ticker=${ticker}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ holdings: [], source: 'error' }))
  }, [ticker])

  if (!data) {
    return <div className="h-32 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
  }

  if (data.holdings.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
        <Building2 className="w-6 h-6 mx-auto mb-2" style={{ color: '#6B7280' }} />
        <p className="text-xs" style={{ color: '#9CA3AF' }}>No institutional data yet.</p>
        <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>Requires FMP Premium for 13F holdings data. Run ingest-institutional cron.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 text-[9px] uppercase tracking-[0.1em] pb-1 mb-1 border-b"
        style={{ color: '#6B7280', fontFamily: 'var(--font-mono)', borderColor: 'var(--border)' }}>
        <span>FUND</span>
        <span className="text-right">SHARES</span>
        <span className="text-right">CHANGE</span>
      </div>
      {data.holdings.map((h, i) => (
        <div key={i} className="grid grid-cols-3 items-center py-1.5 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs font-semibold truncate pr-2" style={{ color: 'var(--text)' }}>{h.fund_name}</div>
          <div className="text-right text-[10px] tabular-nums" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
            {h.shares ? h.shares.toLocaleString() : '—'}
          </div>
          <div className="flex items-center justify-end gap-1">
            {changeIcon(h.change_type)}
            {h.change_shares && h.change_shares !== 0 && (
              <span className="text-[9px] tabular-nums" style={{ color: h.change_shares > 0 ? '#10B981' : '#F87171', fontFamily: 'var(--font-mono)' }}>
                {h.change_shares > 0 ? '+' : ''}{h.change_shares.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      ))}
      <div className="text-[9px] pt-1" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>
        As of {data.holdings[0]?.quarter ?? '—'} · Source: 13F filings
      </div>
    </div>
  )
}
