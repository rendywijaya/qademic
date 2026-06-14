import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

const FMP_BASE = 'https://financialmodelingprep.com/stable'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectorPerformance {
  sector: string
  slug: string
  changePct: number
  color: string
  etf: string
}

export interface SectorData {
  sectors: SectorPerformance[]
  history: Array<{ date: string } & Record<string, number>>
  updatedAt: string
  source: 'fmp' | 'fallback'
}

// ─── Sector metadata map ──────────────────────────────────────────────────────

const SECTOR_META: Record<string, { slug: string; color: string; etf: string }> = {
  'Technology':             { slug: 'technology',            color: '#38BDF8', etf: 'XLK' },
  'Healthcare':             { slug: 'healthcare',            color: '#34D399', etf: 'XLV' },
  'Financials':             { slug: 'financials',            color: '#A78BFA', etf: 'XLF' },
  'Consumer Cyclical':      { slug: 'consumer-cyclical',     color: '#F59E0B', etf: 'XLY' },
  'Industrials':            { slug: 'industrials',           color: '#FB923C', etf: 'XLI' },
  'Communication Services': { slug: 'communication-services',color: '#FB7185', etf: 'XLC' },
  'Consumer Defensive':     { slug: 'consumer-defensive',    color: '#60A5FA', etf: 'XLP' },
  'Energy':                 { slug: 'energy',                color: '#FBBF24', etf: 'XLE' },
  'Real Estate':            { slug: 'real-estate',           color: '#4ADE80', etf: 'XLRE' },
  'Basic Materials':        { slug: 'basic-materials',       color: '#C084FC', etf: 'XLB' },
  'Utilities':              { slug: 'utilities',             color: '#94A3B8', etf: 'XLU' },
}

// ─── Fallback data ────────────────────────────────────────────────────────────

const FALLBACK: SectorData = {
  sectors: [
    { sector: 'Technology',             slug: 'technology',             changePct: 1.24,  color: '#38BDF8', etf: 'XLK' },
    { sector: 'Healthcare',             slug: 'healthcare',             changePct: -0.34, color: '#34D399', etf: 'XLV' },
    { sector: 'Financials',             slug: 'financials',             changePct: 0.87,  color: '#A78BFA', etf: 'XLF' },
    { sector: 'Consumer Cyclical',      slug: 'consumer-cyclical',      changePct: 0.43,  color: '#F59E0B', etf: 'XLY' },
    { sector: 'Industrials',            slug: 'industrials',            changePct: 0.12,  color: '#FB923C', etf: 'XLI' },
    { sector: 'Communication Services', slug: 'communication-services', changePct: 1.56,  color: '#FB7185', etf: 'XLC' },
    { sector: 'Consumer Defensive',     slug: 'consumer-defensive',     changePct: -0.21, color: '#60A5FA', etf: 'XLP' },
    { sector: 'Energy',                 slug: 'energy',                 changePct: -1.02, color: '#FBBF24', etf: 'XLE' },
    { sector: 'Real Estate',            slug: 'real-estate',            changePct: -0.67, color: '#4ADE80', etf: 'XLRE' },
    { sector: 'Basic Materials',        slug: 'basic-materials',        changePct: 0.29,  color: '#C084FC', etf: 'XLB' },
    { sector: 'Utilities',              slug: 'utilities',              changePct: -0.45, color: '#94A3B8', etf: 'XLU' },
  ],
  history: [],
  updatedAt: new Date().toISOString(),
  source: 'fallback',
}

// ─── FMP API types ────────────────────────────────────────────────────────────

interface FmpSectorItem {
  sector: string
  changesPercentage: string | number
}

interface FmpHistoricalItem {
  date: string
  sector: string
  changesPercentage: string | number
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchCurrentPerformance(): Promise<SectorPerformance[] | null> {
  const key = process.env.FMP_API_KEY
  if (!key) return null

  try {
    const url = `${FMP_BASE}/sectors-performance?apikey=${key}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null

    const raw = await res.json() as FmpSectorItem[]
    if (!Array.isArray(raw) || raw.length === 0) return null

    const sectors: SectorPerformance[] = raw
      .filter(item => SECTOR_META[item.sector])
      .map(item => {
        const meta = SECTOR_META[item.sector]
        const changePct = typeof item.changesPercentage === 'string'
          ? parseFloat(item.changesPercentage.replace('%', ''))
          : item.changesPercentage
        return {
          sector: item.sector,
          slug: meta.slug,
          changePct: isNaN(changePct) ? 0 : changePct,
          color: meta.color,
          etf: meta.etf,
        }
      })

    return sectors.length > 0 ? sectors : null
  } catch {
    return null
  }
}

async function fetchHistoricalPerformance(): Promise<Array<{ date: string } & Record<string, number>> | null> {
  const key = process.env.FMP_API_KEY
  if (!key) return null

  try {
    const url = `${FMP_BASE}/historical-sectors-performance?limit=30&apikey=${key}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null

    const raw = await res.json() as FmpHistoricalItem[]
    if (!Array.isArray(raw) || raw.length === 0) return null

    // Group by date
    const byDate: Record<string, Record<string, number>> = {}

    for (const item of raw) {
      if (!item.date) continue
      const meta = SECTOR_META[item.sector]
      if (!meta) continue

      if (!byDate[item.date]) byDate[item.date] = {}
      const pct = typeof item.changesPercentage === 'string'
        ? parseFloat(item.changesPercentage.replace('%', ''))
        : item.changesPercentage
      byDate[item.date][meta.slug] = isNaN(pct) ? 0 : pct
    }

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]): { date: string } & Record<string, number> => ({ date, ...values } as { date: string } & Record<string, number>))
  } catch {
    return null
  }
}

// ─── Cached fetcher (30 min TTL) ─────────────────────────────────────────────

const fetchSectorData = unstable_cache(
  async (): Promise<SectorData> => {
    const [sectors, history] = await Promise.all([
      fetchCurrentPerformance(),
      fetchHistoricalPerformance(),
    ])

    if (!sectors) return FALLBACK

    return {
      sectors,
      history: history ?? [],
      updatedAt: new Date().toISOString(),
      source: 'fmp',
    }
  },
  ['sector-data'],
  { revalidate: 1800 },
)

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const data = await fetchSectorData()
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  })
}
