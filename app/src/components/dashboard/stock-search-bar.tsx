'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'

export default function StockSearchBar() {
  const router = useRouter()
  const [val, setVal] = useState('')

  function go(e: React.FormEvent) {
    e.preventDefault()
    const t = val.trim().toUpperCase()
    if (t) { router.push(`/dashboard/stocks/${t}`); setVal('') }
  }

  return (
    <form onSubmit={go} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: 'var(--text-ghost)' }} />
        <input
          value={val}
          onChange={e => setVal(e.target.value.toUpperCase())}
          placeholder="Enter ticker — e.g. AAPL, MSFT, NVDA…"
          maxLength={10}
          className="w-full pl-10 pr-4 py-3 rounded-lg border text-sm font-bold focus:outline-none transition-all"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
      </div>
      <button
        type="submit"
        disabled={!val.trim()}
        className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
        style={{ backgroundColor: 'var(--amber)', color: '#050810' }}>
        <span className="hidden sm:inline">Analyse</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  )
}
