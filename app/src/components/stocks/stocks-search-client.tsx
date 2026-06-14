'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'

export default function StocksSearchClient() {
  const router = useRouter()
  const [input, setInput] = useState('')

  function go(ticker: string) {
    const t = ticker.trim().toUpperCase()
    if (t) router.push(`/dashboard/stocks/${t}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    go(input)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 th-text-ghost" />
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          placeholder="Enter ticker — AAPL, MSFT, NVDA, JNJ..."
          maxLength={10}
          autoFocus
          className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm font-semibold th-text bg-transparent focus:outline-none transition-colors"
          style={{
            borderColor: 'var(--border)',
            fontFamily: 'var(--font-mono)',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
      </div>
      <button
        type="submit"
        disabled={!input.trim()}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
        style={{ backgroundColor: 'var(--amber)', color: '#050810' }}>
        Analyse <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  )
}
