import type { Metadata } from 'next'
import CompareClient from '@/components/stocks/compare-client'
import { GitCompare } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Compare Stocks — Qademic',
  description: 'Side-by-side Q7 Framework comparison of 2–3 stocks.',
}

export default function ComparePage() {
  return (
    <div className="animate-fade-up" style={{ maxWidth: '100%', paddingBottom: 80 }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', flexShrink: 0,
          }}>
            <GitCompare style={{ width: 16, height: 16, color: '#F59E0B' }} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-bricolage)', fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
            Compare Stocks
          </h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 42 }}>
          Side-by-side Q7 Framework analysis. Load 2–3 tickers to compare setup scores, layer scores, and key metrics.
        </p>
      </div>

      <CompareClient />
    </div>
  )
}
