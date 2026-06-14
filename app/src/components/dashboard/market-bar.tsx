'use client'

import { useEffect, useState } from 'react'
import type { MarketItem } from '@/app/api/market-data/route'
import { marketData as fallbackData } from '@/lib/data/market-data'

function Ticker({ item }: { item: MarketItem }) {
  const positive = item.changePercent >= 0
  return (
    <div className="flex items-center gap-2.5 shrink-0 px-4 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em]"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}>
        {item.symbol}
      </span>
      <span className="text-[11px] font-semibold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
        {item.price}
      </span>
      <span className="text-[11px] font-medium tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: positive ? 'var(--positive)' : 'var(--negative)' }}>
        {positive ? '▲' : '▼'}{positive ? '+' : ''}{item.changePercent.toFixed(2)}%
      </span>
    </div>
  )
}

export default function MarketBar() {
  const [data, setData] = useState<MarketItem[]>(fallbackData)

  useEffect(() => {
    fetch('/api/market-data')
      .then(r => r.json())
      .then((live: MarketItem[]) => { if (live?.length) setData(live) })
      .catch(() => {})
  }, [])

  const doubled = [...data, ...data]

  return (
    <div className="w-full border-b th-border overflow-hidden h-9 flex items-center th-sidebar">
      <div className="flex overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap">
          {doubled.map((item, index) => (
            <div key={`${item.symbol}-${index}`} className="flex items-center">
              <Ticker item={item} />
              <div className="w-px h-3 th-bar-track" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
