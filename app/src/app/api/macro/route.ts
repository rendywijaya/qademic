import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCachedMacroSnapshot, writeMacroSnapshot } from '@/lib/supabase/cache'

// FRED API — completely free, no rate limits worth worrying about
// Series IDs: https://fred.stlouisfed.org/
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'
const FRED_KEY = process.env.FRED_API_KEY ?? 'abcdefghijklmnop' // placeholder — public test key works for low volume

export interface MacroIndicator {
  id: string
  label: string
  value: string
  previousValue: string
  change: string
  direction: 'up' | 'down' | 'flat'
  unit: string
  description: string
  q5Layer: 'Q1 Macro'
  date: string
}

export interface MacroData {
  indicators: MacroIndicator[]
  updatedAt: string
  source: 'fred' | 'fallback' | 'cache'
}

const SERIES = [
  { id: 'FEDFUNDS',  label: 'Fed Funds Rate',   unit: '%',  desc: 'Federal Reserve target interest rate' },
  { id: 'CPIAUCSL',  label: 'CPI Inflation',    unit: '%',  desc: 'Consumer Price Index YoY — cost of living' },
  { id: 'UNRATE',    label: 'Unemployment',     unit: '%',  desc: 'U.S. unemployment rate' },
  { id: 'GDP',       label: 'GDP Growth',       unit: '$B', desc: 'U.S. Gross Domestic Product (billions)' },
  { id: 'DGS10',     label: '10Y Treasury',     unit: '%',  desc: '10-year U.S. Treasury yield' },
  { id: 'T10Y2Y',    label: 'Yield Curve',      unit: '%',  desc: '10Y minus 2Y spread — inversion = recession signal' },
]

async function fetchSeries(seriesId: string): Promise<{ value: number; date: string; prevValue: number } | null> {
  try {
    const url = new URL(FRED_BASE)
    url.searchParams.set('series_id', seriesId)
    url.searchParams.set('api_key', FRED_KEY)
    url.searchParams.set('file_type', 'json')
    url.searchParams.set('limit', '3')
    url.searchParams.set('sort_order', 'desc')

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return null

    const data = await res.json() as {
      observations?: Array<{ value: string; date: string }>
    }

    const obs = data.observations?.filter(o => o.value !== '.')
    if (!obs || obs.length < 2) return null

    return {
      value: parseFloat(obs[0].value),
      date: obs[0].date,
      prevValue: parseFloat(obs[1].value),
    }
  } catch {
    return null
  }
}

const FALLBACK: MacroData = {
  updatedAt: new Date().toISOString(),
  source: 'fallback',
  indicators: [
    { id: 'FEDFUNDS', label: 'Fed Funds Rate', value: '5.33', previousValue: '5.33', change: '0.00', direction: 'flat', unit: '%', description: 'Federal Reserve target interest rate', q5Layer: 'Q1 Macro', date: '2024-11-01' },
    { id: 'CPIAUCSL', label: 'CPI Inflation',  value: '2.7',  previousValue: '2.6',  change: '+0.1', direction: 'up',   unit: '%', description: 'Consumer Price Index YoY', q5Layer: 'Q1 Macro', date: '2024-11-01' },
    { id: 'UNRATE',   label: 'Unemployment',   value: '4.2',  previousValue: '4.1',  change: '+0.1', direction: 'up',   unit: '%', description: 'U.S. unemployment rate', q5Layer: 'Q1 Macro', date: '2024-11-01' },
    { id: 'DGS10',    label: '10Y Treasury',   value: '4.42', previousValue: '4.35', change: '+0.07',direction: 'up',   unit: '%', description: '10-year U.S. Treasury yield', q5Layer: 'Q1 Macro', date: '2024-11-01' },
    { id: 'T10Y2Y',   label: 'Yield Curve',    value: '-0.12',previousValue: '-0.25',change: '+0.13',direction: 'up',   unit: '%', description: '10Y minus 2Y spread', q5Layer: 'Q1 Macro', date: '2024-11-01' },
  ],
}

function snapshotToMacroData(rows: Array<Record<string, unknown>>): MacroData {
  const indicators: MacroIndicator[] = rows.map(r => ({
    id: r.indicator_id as string,
    label: r.label as string,
    value: r.value as string,
    previousValue: r.previous_value as string,
    change: r.change as string,
    direction: r.direction as 'up' | 'down' | 'flat',
    unit: r.unit as string,
    description: r.description as string,
    q5Layer: 'Q1 Macro',
    date: r.series_date as string,
  }))
  return { indicators, updatedAt: new Date().toISOString(), source: 'cache' }
}

async function fetchLiveMacro(): Promise<MacroData> {
  const results = await Promise.all(SERIES.map(s => fetchSeries(s.id)))

  const indicators: MacroIndicator[] = []
  const writeRows: Array<Record<string, string>> = []
  let anySuccess = false

  results.forEach((result, i) => {
    const meta = SERIES[i]
    if (!result) return

    anySuccess = true
    const delta = result.value - result.prevValue
    const direction: 'up' | 'down' | 'flat' =
      Math.abs(delta) < 0.001 ? 'flat' : delta > 0 ? 'up' : 'down'
    const changeStr = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)

    const formatted =
      meta.id === 'GDP'
        ? `$${(result.value / 1000).toFixed(1)}T`
        : result.value.toFixed(meta.unit === '$B' ? 0 : 2)

    const prevFormatted =
      meta.id === 'GDP'
        ? `$${(result.prevValue / 1000).toFixed(1)}T`
        : result.prevValue.toFixed(meta.unit === '$B' ? 0 : 2)

    indicators.push({
      id: meta.id,
      label: meta.label,
      value: formatted,
      previousValue: prevFormatted,
      change: changeStr,
      direction,
      unit: meta.id === 'GDP' ? 'T' : meta.unit,
      description: meta.desc,
      q5Layer: 'Q1 Macro',
      date: result.date,
    })

    writeRows.push({
      indicator_id: meta.id,
      label: meta.label,
      value: formatted,
      previous_value: prevFormatted,
      change: changeStr,
      direction,
      unit: meta.id === 'GDP' ? 'T' : meta.unit,
      description: meta.desc,
      series_date: result.date,
    })
  })

  if (!anySuccess || indicators.length === 0) return FALLBACK

  // Write to DB in background
  writeMacroSnapshot(writeRows).catch(() => undefined)

  return { indicators, updatedAt: new Date().toISOString(), source: 'fred' }
}

export async function GET() {
  // Try DB cache first
  try {
    const supabase = await createClient()
    const cached = await getCachedMacroSnapshot(supabase)
    if (cached) {
      return NextResponse.json(snapshotToMacroData(cached), {
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
      })
    }
  } catch {
    // Fall through to live fetch
  }

  const data = await fetchLiveMacro()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  })
}
