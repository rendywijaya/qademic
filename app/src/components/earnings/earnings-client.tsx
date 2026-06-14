'use client'

import { useState } from 'react'
import { Calendar, TrendingUp, TrendingDown, Clock, ChevronRight, AlertCircle } from 'lucide-react'
import type { EarningsEvent } from '@/app/api/earnings/route'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'recent'

interface EarningsClientProps {
  userEvents: EarningsEvent[]
  marketEvents: EarningsEvent[]
  hasTickers: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BUCKET_LABELS = ['This Week', 'Next Week', 'In 2 Weeks', 'Later'] as const
type BucketLabel = (typeof BUCKET_LABELS)[number]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekBucket(dateStr: string): BucketLabel {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 7) return 'This Week'
  if (diffDays <= 14) return 'Next Week'
  if (diffDays <= 21) return 'In 2 Weeks'
  return 'Later'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatEPS(val: number | null): string {
  if (val === null) return '—'
  return `$${val.toFixed(2)}`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TickerAvatar({ ticker }: { ticker: string }) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: 'var(--amber-dim)', border: '1px solid var(--amber-border)' }}
    >
      <span
        className="text-[10px] font-black"
        style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}
      >
        {ticker.slice(0, 3)}
      </span>
    </div>
  )
}

function SurpriseBadge({ surprisePct }: { surprisePct: number | null }) {
  if (surprisePct === null) return null
  const isBeat = surprisePct >= 0
  const label = isBeat
    ? `+${surprisePct.toFixed(1)}% beat`
    : `${surprisePct.toFixed(1)}% miss`

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tabular-nums"
      style={{
        color: isBeat ? 'var(--positive)' : 'var(--negative)',
        backgroundColor: isBeat ? 'var(--positive-dim)' : 'var(--negative-dim)',
        border: `1px solid ${isBeat ? 'rgba(16,185,129,0.25)' : 'rgba(248,113,113,0.25)'}`,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {isBeat ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {label}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.14em] mb-3 mt-5 first:mt-0"
      style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
    >
      {children}
    </div>
  )
}

function UpcomingEventCard({ event }: { event: EarningsEvent }) {
  return (
    <Link href={`/dashboard/stocks/${event.ticker}`} className="block group">
      <div
        className="flex items-center gap-3 px-4 py-3.5 transition-all duration-150"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <TickerAvatar ticker={event.ticker} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-black"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
            >
              {event.ticker}
            </span>
            {event.companyName && event.companyName !== event.ticker && (
              <span
                className="text-xs truncate"
                style={{ color: 'var(--text-dim)', maxWidth: '200px' }}
              >
                {event.companyName}
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-1.5 mt-0.5 text-[11px]"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            <Clock className="w-3 h-3" />
            {formatDate(event.date)}
            {event.epsEstimate !== null && (
              <>
                <span style={{ color: 'var(--text-ghost)' }}>·</span>
                <span>Est. EPS {formatEPS(event.epsEstimate)}</span>
              </>
            )}
          </div>
        </div>

        <ChevronRight
          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-ghost)' }}
        />
      </div>
    </Link>
  )
}

function RecentEventCard({ event }: { event: EarningsEvent }) {
  return (
    <Link href={`/dashboard/stocks/${event.ticker}`} className="block group">
      <div
        className="flex items-center gap-3 px-4 py-3.5 transition-all duration-150"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <TickerAvatar ticker={event.ticker} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-black"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
            >
              {event.ticker}
            </span>
            <SurpriseBadge surprisePct={event.surprisePct} />
          </div>
          <div
            className="flex items-center gap-3 mt-1 text-[11px] tabular-nums"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            <span>{formatDate(event.date)}</span>
            {event.epsActual !== null && (
              <span>
                EPS{' '}
                <span style={{ color: 'var(--text)' }}>{formatEPS(event.epsActual)}</span>
                {event.epsEstimate !== null && (
                  <span style={{ color: 'var(--text-ghost)' }}>
                    {' '}/ est {formatEPS(event.epsEstimate)}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <ChevronRight
          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-ghost)' }}
        />
      </div>
    </Link>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'var(--amber-dim)', border: '1px solid var(--amber-border)' }}
      >
        <Calendar className="w-6 h-6" style={{ color: 'var(--amber)' }} />
      </div>
      <div className="text-center space-y-1.5">
        <p
          className="text-sm font-semibold"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-bricolage)' }}
        >
          No earnings to show
        </p>
        <p
          className="text-xs max-w-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {message}
        </p>
      </div>
      <Link
        href="/dashboard/watchlist"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
        style={{ backgroundColor: 'var(--amber)', color: '#050810' }}
      >
        Manage Watchlist
      </Link>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EarningsClient({
  userEvents,
  marketEvents,
  hasTickers,
}: EarningsClientProps) {
  const [tab, setTab] = useState<Tab>('upcoming')

  const upcomingUser = userEvents
    .filter((e) => e.isUpcoming)
    .sort((a, b) => a.date.localeCompare(b.date))

  const recentUser = userEvents
    .filter((e) => !e.isUpcoming)
    .sort((a, b) => b.date.localeCompare(a.date))

  const upcomingMarket = marketEvents
    .filter((e) => e.isUpcoming)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 20)

  // Group upcoming by bucket
  const bucketed = BUCKET_LABELS.reduce<Record<BucketLabel, EarningsEvent[]>>(
    (acc, label) => {
      acc[label] = upcomingUser.filter((e) => getWeekBucket(e.date) === label)
      return acc
    },
    { 'This Week': [], 'Next Week': [], 'In 2 Weeks': [], Later: [] }
  )

  const hasAnyUpcoming = upcomingUser.length > 0
  const hasAnyRecent = recentUser.length > 0

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-black"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-bricolage)' }}
        >
          Earnings Calendar
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--text-muted)' }}
        >
          Track upcoming reports and past results from your portfolio and watchlist.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-lg w-fit"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {(
          [
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'recent', label: 'Recent Results' },
          ] as { id: Tab; label: string }[]
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-150"
            style={{
              fontFamily: 'var(--font-mono)',
              backgroundColor: tab === id ? 'var(--surface-2)' : 'transparent',
              color: tab === id ? 'var(--amber)' : 'var(--text-muted)',
              border: tab === id ? '1px solid var(--amber-border)' : '1px solid transparent',
            }}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Upcoming tab */}
      {tab === 'upcoming' && (
        <div className="space-y-6">
          {/* User holdings section */}
          {!hasTickers ? (
            <EmptyState message="Add stocks to your watchlist to track their earnings." />
          ) : !hasAnyUpcoming ? (
            <div
              className="rounded-lg border px-4 py-4 flex items-start gap-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--text-ghost)' }} />
              <p
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                No upcoming earnings in the next 90 days for your holdings. Check back closer to each company&apos;s reporting window.
              </p>
            </div>
          ) : (
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* My Holdings header */}
              <div
                className="px-4 py-2.5 border-b"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                <span
                  className="text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
                >
                  My Holdings
                </span>
              </div>

              <div>
                {BUCKET_LABELS.map((bucket) => {
                  const events = bucketed[bucket]
                  if (events.length === 0) return null
                  return (
                    <div key={bucket}>
                      <div
                        className="px-4 pt-3 pb-1"
                        style={{ backgroundColor: 'var(--surface)' }}
                      >
                        <span
                          className="text-[10px] uppercase tracking-[0.14em]"
                          style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
                        >
                          {bucket}
                        </span>
                      </div>
                      {events.map((ev) => (
                        <UpcomingEventCard key={`${ev.ticker}-${ev.date}`} event={ev} />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Broader Market section */}
          {upcomingMarket.length > 0 && (
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="px-4 py-2.5 border-b"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                <span
                  className="text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
                >
                  Broader Market
                </span>
              </div>
              <div>
                {upcomingMarket.map((ev) => (
                  <UpcomingEventCard key={`${ev.ticker}-${ev.date}`} event={ev} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Results tab */}
      {tab === 'recent' && (
        <div>
          {!hasTickers ? (
            <EmptyState message="Add stocks to your watchlist to track their earnings." />
          ) : !hasAnyRecent ? (
            <div
              className="rounded-lg border px-4 py-4 flex items-start gap-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--text-ghost)' }} />
              <p
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                No earnings results in the last 60 days for your holdings.
              </p>
            </div>
          ) : (
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="px-4 py-2.5 border-b"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                <span
                  className="text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
                >
                  Recent Earnings — Last 60 Days
                </span>
              </div>
              <div>
                {recentUser.map((ev) => (
                  <RecentEventCard key={`${ev.ticker}-${ev.date}`} event={ev} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center gap-2 pt-1 text-[10px]"
        style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--amber)' }} />
        EARNINGS DATA VIA FINNHUB · UPCOMING 90 DAYS · PAST 60 DAYS
      </div>
    </div>
  )
}
