import { NextResponse } from 'next/server'
import { writeMacroSnapshot } from '@/lib/supabase/cache'

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'
const FRED_KEY = process.env.FRED_API_KEY ?? 'abcdefghijklmnop'

const SERIES = [
  { id: 'FEDFUNDS',  label: 'Fed Funds Rate',   unit: '%',  desc: 'Federal Reserve target interest rate' },
  { id: 'CPIAUCSL',  label: 'CPI Inflation',    unit: '%',  desc: 'Consumer Price Index YoY — cost of living' },
  { id: 'UNRATE',    label: 'Unemployment',     unit: '%',  desc: 'U.S. unemployment rate' },
  { id: 'GDP',       label: 'GDP Growth',       unit: '$B', desc: 'U.S. Gross Domestic Product (billions)' },
  { id: 'DGS10',     label: '10Y Treasury',     unit: '%',  desc: '10-year U.S. Treasury yield' },
  { id: 'T10Y2Y',    label: 'Yield Curve',      unit: '%',  desc: '10Y minus 2Y spread — inversion = recession signal' },
  { id: 'VIXCLS',       label: 'VIX',              unit: '',   desc: 'CBOE volatility index — market fear gauge (regime input)' },
  { id: 'BAMLH0A0HYM2', label: 'HY Credit Spread', unit: '%',  desc: 'High-yield OAS — credit stress gauge (regime input)' },
]

async function fetchSeries(
  seriesId: string,
): Promise<{ value: number; date: string; prevValue: number } | null> {
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

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await Promise.all(SERIES.map(s => fetchSeries(s.id)))

  const rows: Array<Record<string, string>> = []

  results.forEach((result, i) => {
    const meta = SERIES[i]
    if (!result) return

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

    rows.push({
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

  if (rows.length > 0) {
    await writeMacroSnapshot(rows)
  }

  return NextResponse.json({ ok: true, updated: rows.length })
}
