'use client'

import { type NewsItem } from '@/lib/data/news-data'
import { Q5Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/utils'
import { ExternalLink, Sparkles } from 'lucide-react'

interface NewsCardProps {
  item: NewsItem
}

function SentimentBadge({
  score,
  label,
}: {
  score: number
  label?: 'bullish' | 'bearish' | 'neutral'
}) {
  const resolved = label ?? (score > 30 ? 'bullish' : score < -30 ? 'bearish' : 'neutral')
  const config = {
    bullish: {
      color: 'var(--positive)',
      bg: 'rgba(16,185,129,0.08)',
      prefix: '▲',
    },
    bearish: {
      color: 'var(--negative)',
      bg: 'rgba(248,113,113,0.08)',
      prefix: '▼',
    },
    neutral: {
      color: 'var(--text-ghost)',
      bg: 'transparent',
      prefix: '–',
    },
  }[resolved]

  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em]"
      style={{
        color: config.color,
        backgroundColor: config.bg,
        fontFamily: 'var(--font-mono)',
      }}>
      {config.prefix} {resolved.toUpperCase()}
      {resolved !== 'neutral' && (
        <span className="ml-0.5 tabular-nums">
          {score > 0 ? '+' : ''}{score}
        </span>
      )}
    </span>
  )
}

const q5Colors: Record<string, string> = {
  'Q1 Macro':       '#A78BFA',
  'Q2 Sector':      '#38BDF8',
  'Q3 Fundamental': '#34D399',
  'Q4 Quant':       '#F59E0B',
  'Q5 Sentiment':   '#FB7185',
}

export default function NewsCard({ item }: NewsCardProps) {
  const accentColor = q5Colors[item.layer] || '#F59E0B'

  return (
    <article className="group rounded-lg border th-border bg-transparent overflow-hidden card-hover transition-all duration-200"
      style={{ borderLeft: `3px solid ${accentColor}` }}>

      <div className="p-5">
        {/* Source + time + sentiment header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <Q5Badge layer={item.layer} />
          <div className="flex items-center gap-2 shrink-0">
            {item.sentimentScore !== undefined && (
              <SentimentBadge score={item.sentimentScore} label={item.sentimentLabel} />
            )}
            <div className="flex items-center gap-1.5 text-[10px] th-text-ghost"
              style={{ fontFamily: 'var(--font-mono)' }}>
              <span>{item.source}</span>
              <span>·</span>
              <span>{timeAgo(item.publishedAt)}</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h3 className="text-sm font-semibold leading-snug mb-3 th-text transition-colors"
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}>
          {item.headline}
        </h3>

        {/* AI Summary */}
        <div className="p-3 rounded-md border mb-3 th-border" style={{ backgroundColor: 'var(--surface)' }}>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold mb-1.5 uppercase tracking-[0.08em]"
            style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
            <Sparkles className="w-3 h-3" />
            AI SUMMARY
          </div>
          <p className="text-xs leading-relaxed line-clamp-3 th-text-muted">
            {item.aiSummary}
          </p>
        </div>

        <a
          href={item.url}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold transition-colors uppercase tracking-[0.06em]"
          style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FBBF24')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--amber)')}>
          Read full article
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </article>
  )
}
