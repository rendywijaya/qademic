import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import { formatCurrency } from '@/lib/utils'

function Metric({ label, value, sub, color }: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-lg border p-4 transition-all duration-200 hover:border-[rgba(245,158,11,0.25)]"
      style={{ borderColor: 'rgba(31,41,55,1)', backgroundColor: 'transparent' }}>
      <div className="text-[10px] uppercase tracking-[0.12em] mb-2 th-text-ghost"
        style={{ fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: color ?? 'var(--text)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] mt-1 th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function signColor(v: number, invert = false) {
  const positive = invert ? v < 0 : v > 0
  if (positive) return 'var(--positive)'
  if (v < 0) return 'var(--negative)'
  return 'var(--text)'
}

export default function FundamentalsGrid({ data }: { data: FMPFundamentals }) {
  const metrics = [
    {
      label: 'P/E Ratio',
      value: data.pe > 0 ? `${data.pe.toFixed(1)}x` : '—',
      sub: data.pe > 0 ? (data.pe < 15 ? 'Value territory' : data.pe > 35 ? 'Premium valuation' : 'Market-rate') : 'Negative earnings',
      color: data.pe > 0 && data.pe < 25 ? 'var(--positive)' : data.pe > 40 ? 'var(--negative)' : 'var(--text)',
    },
    {
      label: 'Revenue Growth',
      value: `${data.revenueGrowth >= 0 ? '+' : ''}${data.revenueGrowth.toFixed(1)}%`,
      sub: 'Year-over-year',
      color: signColor(data.revenueGrowth),
    },
    {
      label: 'Gross Margin',
      value: `${data.grossMargin.toFixed(1)}%`,
      sub: data.grossMargin > 60 ? 'High-quality business' : data.grossMargin > 30 ? 'Healthy margins' : 'Thin margins',
      color: data.grossMargin > 50 ? 'var(--positive)' : data.grossMargin < 15 ? 'var(--negative)' : 'var(--text)',
    },
    {
      label: 'FCF Margin',
      value: `${data.fcfMargin.toFixed(1)}%`,
      sub: 'Free cash flow / revenue',
      color: signColor(data.fcfMargin),
    },
    {
      label: 'Return on Equity',
      value: `${data.roe.toFixed(1)}%`,
      sub: data.roe > 20 ? 'Excellent capital efficiency' : data.roe > 10 ? 'Good' : 'Below average',
      color: data.roe > 20 ? 'var(--positive)' : data.roe < 0 ? 'var(--negative)' : 'var(--text)',
    },
    {
      label: 'Debt / Equity',
      value: data.debtEquity > 0 ? `${data.debtEquity.toFixed(2)}x` : '—',
      sub: data.debtEquity < 0.5 ? 'Low leverage' : data.debtEquity > 2 ? 'High leverage' : 'Moderate leverage',
      color: data.debtEquity < 0.5 ? 'var(--positive)' : data.debtEquity > 3 ? 'var(--negative)' : 'var(--text)',
    },
    {
      label: 'Market Cap',
      value: formatCurrency(data.marketCap, true),
      sub: data.marketCap > 200e9 ? 'Mega-cap' : data.marketCap > 10e9 ? 'Large-cap' : data.marketCap > 2e9 ? 'Mid-cap' : 'Small-cap',
    },
    {
      label: 'Dividend Yield',
      value: data.dividendYield > 0 ? `${data.dividendYield.toFixed(2)}%` : '—',
      sub: data.dividendYield > 0 ? 'Annual yield' : 'No dividend',
      color: data.dividendYield > 3 ? 'var(--positive)' : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <Metric key={m.label} {...m} />
      ))}
    </div>
  )
}
