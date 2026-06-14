'use client'

import { useState, useEffect, useCallback } from 'react'
import { Newspaper, RefreshCw, Loader2 } from 'lucide-react'
import { newsData, type Q5Layer } from '@/lib/data/news-data'
import type { LiveNewsItem } from '@/app/api/news/route'
import NewsCard from '@/components/news/news-card'
import Q5FilterTabs from '@/components/news/q5-filter-tabs'

type FilterTab = 'All' | Q5Layer

// Convert live news to the shape NewsCard already expects
function liveToCard(item: LiveNewsItem) {
  const gradients: Record<Q5Layer, string> = {
    'Q1 Macro': 'from-purple-600 to-blue-700',
    'Q2 Sector': 'from-blue-600 to-cyan-600',
    'Q3 Fundamental': 'from-emerald-600 to-teal-600',
    'Q4 Quant': 'from-amber-500 to-orange-600',
    'Q5 Sentiment': 'from-rose-600 to-pink-600',
  }
  return {
    id: item.id,
    headline: item.headline,
    source: item.source,
    publishedAt: new Date(item.publishedAt),
    layer: item.layer,
    aiSummary: item.aiSummary,
    url: item.url,
    imageGradient: gradients[item.layer] ?? 'from-gray-600 to-gray-700',
    sentimentScore: item.sentimentScore,
    sentimentLabel: item.sentimentLabel,
  }
}

export default function NewsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All')
  const [articles, setArticles] = useState(newsData)
  const [isLive, setIsLive] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadLiveNews = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/news')
      const live = await res.json() as LiveNewsItem[]
      if (live?.length) {
        setArticles(live.map(liveToCard))
        setIsLive(true)
      }
    } catch {
      // keep static fallback
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => { loadLiveNews() }, [loadLiveNews])

  const filtered =
    activeFilter === 'All'
      ? articles
      : articles.filter((item) => item.layer === activeFilter)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border flex items-center justify-center"
              style={{ backgroundColor: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.2)' }}>
              <Newspaper className="w-4 h-4" style={{ color: 'var(--positive)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold th-text">Market Intelligence</h1>
              <p className="text-xs th-text-muted">AI-summarized news tagged by Q-layer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-1.5 text-[10px] border px-2.5 py-1.5 rounded-md uppercase tracking-[0.08em] transition-colors"
              style={{
                fontFamily: 'var(--font-mono)',
                color: isLive ? '#34D399' : 'var(--text-ghost)',
                borderColor: isLive ? 'rgba(52,211,153,0.2)' : 'var(--border)',
                backgroundColor: isLive ? 'rgba(52,211,153,0.06)' : 'transparent',
              }}>
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isLive ? '#34D399' : 'var(--border)' }} />
              {isLive ? 'LIVE' : 'CACHED'}
            </div>
            <button
              onClick={loadLiveNews}
              disabled={isRefreshing}
              className="p-2 rounded-lg border th-border bg-transparent th-text-ghost transition-all disabled:opacity-50"
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-ghost)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
              {isRefreshing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />
              }
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border flex items-start gap-3"
          style={{ borderColor: 'rgba(245,158,11,0.15)', backgroundColor: 'rgba(245,158,11,0.04)' }}>
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 animate-pulse-dot"
            style={{ backgroundColor: 'var(--amber)' }} />
          <p className="text-xs th-text-muted leading-relaxed">
            Every news item is automatically classified to the relevant{' '}
            <strong className="th-text">Q-layer</strong> — so you always know whether you&apos;re reading a macro signal, sector development, fundamental update, quant data point, or sentiment indicator.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="animate-fade-up-d1">
        <Q5FilterTabs active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* Count */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] th-text-ghost uppercase tracking-[0.08em]"
          style={{ fontFamily: 'var(--font-mono)' }}>
          Showing{' '}
          <span className="th-text font-semibold tabular-nums">{filtered.length}</span>
          {' '}articles
        </span>
        {activeFilter !== 'All' && (
          <button
            onClick={() => setActiveFilter('All')}
            className="text-[10px] transition-colors uppercase tracking-[0.06em]"
            style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FBBF24')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--amber)')}>
            Clear filter
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="animate-fade-up-d2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 rounded-lg border th-border flex items-center justify-center mx-auto mb-3">
              <Newspaper className="w-5 h-5 th-text-ghost" />
            </div>
            <p className="text-sm th-text-muted">No news for this filter yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {filtered.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
