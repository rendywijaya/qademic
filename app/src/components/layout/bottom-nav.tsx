'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BarChart3, TrendingUp, MoreHorizontal, X,
  Star, Bell, Calendar, Globe, Search, Newspaper,
  UserSearch, Crosshair, ScrollText, BookOpen,
} from 'lucide-react'

const primary = [
  { href: '/dashboard',           label: 'Home',      icon: LayoutDashboard, exact: true },
  { href: '/dashboard/stocks',    label: 'Stocks',    icon: TrendingUp },
  { href: '/dashboard/alerts',    label: 'Alerts',    icon: Bell },
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: BarChart3 },
]

const more = [
  { href: '/dashboard/theses',          label: 'Theses',     icon: Crosshair },
  { href: '/dashboard/journal',         label: 'Journal',    icon: ScrollText },
  { href: '/methodology',               label: 'Proof',      icon: BookOpen },
  { href: '/dashboard/watchlist',        label: 'Watchlist',  icon: Star },
  { href: '/dashboard/qtools/screener', label: 'Screener',   icon: Search },
  { href: '/dashboard/earnings',        label: 'Earnings',   icon: Calendar },
  { href: '/dashboard/markets',         label: 'Markets',    icon: Globe },
  { href: '/dashboard/insider',         label: 'Insider',    icon: UserSearch },
  { href: '/dashboard/news',            label: 'News',       icon: Newspaper },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  const isActive = (href: string, exact?: boolean) => exact ? pathname === href : pathname.startsWith(href)
  const anyMoreActive = more.some(i => isActive(i.href))

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 backdrop-blur-md border-t th-border flex items-center"
        style={{ backgroundColor: 'rgba(5,8,16,0.97)' }}>
        {primary.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center gap-1 py-2 relative"
              style={{ color: active ? 'var(--amber)' : 'var(--text-ghost)' }}>
              {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full" style={{ backgroundColor: 'var(--amber)' }} />}
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>{item.label}</span>
            </Link>
          )
        })}
        <button onClick={() => setShowMore(true)}
          className="flex-1 flex flex-col items-center gap-1 py-2 relative"
          style={{ color: anyMoreActive ? 'var(--amber)' : 'var(--text-ghost)' }}>
          {anyMoreActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full" style={{ backgroundColor: 'var(--amber)' }} />}
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>More</span>
        </button>
      </nav>

      {showMore && (
        <>
          <div className="lg:hidden fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowMore(false)} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-x"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <span className="text-[10px] uppercase tracking-[0.14em]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}>ALL FEATURES</span>
              <button onClick={() => setShowMore(false)} style={{ color: 'var(--text-ghost)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-4 gap-1 px-3 pb-8">
              {more.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setShowMore(false)}
                    className={cn('flex flex-col items-center gap-2 py-3 rounded-xl')}
                    style={{ backgroundColor: active ? 'var(--amber-dim)' : 'transparent', color: active ? 'var(--amber)' : 'var(--text-dim)' }}>
                    <item.icon className="w-5 h-5" />
                    <span className="text-[9px] font-medium text-center" style={{ fontFamily: 'var(--font-mono)' }}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
