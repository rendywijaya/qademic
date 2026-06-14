'use client'

import { useState, useTransition } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { toggleWatchlist } from '@/app/actions/watchlist'

interface WatchlistToggleProps {
  ticker: string
  companyName: string
  initialWatched: boolean
}

export default function WatchlistToggle({ ticker, companyName, initialWatched }: WatchlistToggleProps) {
  const [watched, setWatched] = useState(initialWatched)
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleWatchlist(ticker, companyName, watched)
      if (result.success) setWatched(result.watched)
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-200"
      style={{
        borderColor: watched ? 'rgba(245,158,11,0.4)' : 'rgba(31,41,55,1)',
        backgroundColor: watched ? 'rgba(245,158,11,0.08)' : 'transparent',
        color: watched ? '#F59E0B' : '#9CA3AF',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Star
          className="w-3.5 h-3.5"
          fill={watched ? '#F59E0B' : 'none'}
        />
      )}
      {watched ? 'WATCHING' : 'WATCH'}
    </button>
  )
}
