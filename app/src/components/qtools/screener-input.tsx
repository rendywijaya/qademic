'use client'

import { useState } from 'react'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/button'

const suggestedPrompts = [
  'Growth stocks under $50',
  'Dividend payers > 4%',
  'AI sector leaders',
  'Value stocks PE < 15',
  'High FCF margins',
]

const exampleQueries = [
  'Find profitable tech stocks with PE under 20 and revenue growth above 15%',
  'Show me semiconductor companies with strong free cash flow margins',
  'High growth software companies trading at reasonable valuations',
  'Consumer discretionary stocks with low debt and expanding margins',
]

interface ScreenerInputProps {
  onSearch: (query: string) => void
  isLoading: boolean
}

export default function ScreenerInput({ onSearch, isLoading }: ScreenerInputProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) onSearch(query)
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <div className="absolute left-4 top-4 th-text-ghost">
            <Sparkles className="w-5 h-5" />
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: Find profitable tech stocks with PE under 20 and revenue growth over 15%"
            rows={3}
            className="w-full border rounded-lg pl-12 pr-12 py-4 text-sm placeholder:th-text-ghost focus:outline-none resize-none transition-all th-input"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--amber-dim)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="absolute right-3 top-3 p-1 rounded-md transition-colors th-text-ghost hover:th-text-muted">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-[10px] uppercase tracking-[0.08em] th-text-ghost"
            style={{ fontFamily: 'var(--font-mono)' }}>
            AI-powered screen across 5,000+ stocks
          </div>
          <Button type="submit" loading={isLoading} disabled={!query.trim() || isLoading} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Run Screener
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2 th-text-ghost"
          style={{ fontFamily: 'var(--font-mono)' }}>
          Quick filters
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestedPrompts.map((prompt) => (
            <button key={prompt} onClick={() => setQuery(prompt)}
              className="text-[10px] px-3 py-1.5 rounded-md border transition-all uppercase tracking-[0.06em] th-text-dim"
              style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--amber)'
                e.currentTarget.style.borderColor = 'var(--amber-border)'
                e.currentTarget.style.backgroundColor = 'var(--amber-dim)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-dim)'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}>
              {prompt}
            </button>
          ))}
        </div>

        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2 th-text-ghost"
          style={{ fontFamily: 'var(--font-mono)' }}>
          Example queries
        </div>
        <div className="space-y-1.5">
          {exampleQueries.map((example, i) => (
            <button key={i} onClick={() => setQuery(example)}
              className="w-full text-left text-xs px-3 py-2.5 rounded-lg border transition-all th-text-dim"
              style={{ borderColor: 'var(--border)' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text)'
                e.currentTarget.style.borderColor = 'var(--amber-border)'
                e.currentTarget.style.backgroundColor = 'var(--amber-dim)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-dim)'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}>
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
