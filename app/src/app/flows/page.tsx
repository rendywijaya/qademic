import type { Metadata } from 'next'
import FlowsClient from '@/components/flows/flows-client'
import type { SectorData } from '@/app/api/sectors/route'
import type { MacroData } from '@/app/api/macro/route'
import type { MarketItem } from '@/app/api/market-data/route'
import type { SectorRotation } from '@/app/api/rotation/route'

interface RotationData {
  sectors: SectorRotation[]
  asOf: string | null
}

export const metadata: Metadata = {
  title: 'Capital Flows & Sector Rotation — Qademic',
  description:
    'Live macro dashboard showing where global money is moving. Sector rotation heatmap, market pulse, and Fed/FRED macro signals. Updated daily at market close.',
}

// Revalidate every 30 minutes — matches the underlying API caches
export const revalidate = 1800

async function fetchSectorData(): Promise<SectorData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/sectors`, {
      next: { revalidate: 1800 },
    })
    if (!res.ok) return null
    return (await res.json()) as SectorData
  } catch {
    return null
  }
}

async function fetchMacroData(): Promise<MacroData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/macro`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    return (await res.json()) as MacroData
  } catch {
    return null
  }
}

async function fetchMarketData(): Promise<MarketItem[] | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/market-data`, {
      next: { revalidate: 1800 },
    })
    if (!res.ok) return null
    return (await res.json()) as MarketItem[]
  } catch {
    return null
  }
}

async function fetchRotationData(): Promise<RotationData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/rotation`, {
      next: { revalidate: 1800 },
    })
    if (!res.ok) return null
    return (await res.json()) as RotationData
  } catch {
    return null
  }
}

export default async function FlowsPage() {
  const [sectorData, macroData, marketData, rotationData] = await Promise.all([
    fetchSectorData(),
    fetchMacroData(),
    fetchMarketData(),
    fetchRotationData(),
  ])

  return (
    <FlowsClient
      sectorData={sectorData}
      macroData={macroData}
      marketData={marketData}
      rotationData={rotationData}
    />
  )
}
