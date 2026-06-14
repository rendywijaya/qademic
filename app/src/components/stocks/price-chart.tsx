'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

type Timeframe = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'
const TF_OPTIONS: Timeframe[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL']

interface ChartPoint { date: string; close: number; volume: number }
interface ChartData { data: ChartPoint[]; source: string }

function formatDate(date: string, tf: Timeframe): string {
  const d = new Date(date)
  if (tf === '1W') return d.toLocaleDateString('en-US', { weekday: 'short' })
  if (tf === '1M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: ChartPoint }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]
  return (
    <div className="border rounded-md px-3 py-2 text-xs"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>
      <div style={{ color: '#9CA3AF' }}>{point.payload.date}</div>
      <div className="font-bold" style={{ color: '#F59E0B' }}>${point.value.toFixed(2)}</div>
    </div>
  )
}

export default function PriceChart({ ticker }: { ticker: string }) {
  const [tf, setTf] = useState<Timeframe>('1Y')
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stocks/chart?ticker=${ticker}&tf=${tf}`)
      .then(r => r.json())
      .then(d => { setChartData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker, tf])

  const points = chartData?.data ?? []
  const firstPrice = points[0]?.close ?? 0
  const lastPrice = points[points.length - 1]?.close ?? 0
  const pctChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0
  const isUp = pctChange >= 0
  const lineColor = isUp ? '#10B981' : '#F87171'

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-5 w-24 rounded animate-pulse" style={{ backgroundColor: '#1F2937' }} />
          ) : points.length > 0 ? (
            <>
              <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                ${lastPrice.toFixed(2)}
              </span>
              <span className="flex items-center gap-1 text-sm tabular-nums font-semibold"
                style={{ color: lineColor, fontFamily: 'var(--font-mono)' }}>
                {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isUp ? '+' : ''}{pctChange.toFixed(2)}% ({tf})
              </span>
            </>
          ) : (
            <span className="text-xs" style={{ color: '#9CA3AF' }}>No price data — run ingest-ohlcv pipeline</span>
          )}
        </div>
        {/* Timeframe tabs */}
        <div className="flex items-center gap-0.5 rounded-md p-0.5 border" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(0,0,0,0.3)' }}>
          {TF_OPTIONS.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className="text-[10px] px-2.5 py-1 rounded font-bold transition-all"
              style={{
                fontFamily: 'var(--font-mono)',
                backgroundColor: tf === t ? '#F59E0B' : 'transparent',
                color: tf === t ? '#050810' : '#9CA3AF',
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-52 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
      ) : points.length > 0 ? (
        <div style={{ height: 208 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDate(v as string, tf)}
                tick={{ fill: '#6B7280', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#6B7280', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={1.5}
                fill={`url(#grad-${ticker})`}
                dot={false}
                activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-52 rounded-lg border flex items-center justify-center"
          style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#9CA3AF' }}>No chart data yet</div>
            <div className="text-[10px]" style={{ color: '#6B7280' }}>Run ingest-ohlcv pipeline to populate</div>
          </div>
        </div>
      )}
    </div>
  )
}
