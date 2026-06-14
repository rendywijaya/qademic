'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { QLogoInline } from '@/components/ui/logo'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Search, Newspaper, User, Sun, Moon, Star,
  TrendingUp, BarChart3, Bell, Calendar, CreditCard, Globe, Settings,
  LogOut, Shield, Crosshair, Layers, UserSearch, ArrowRight,
  BrainCircuit, Radar, GitCompare, Activity, ScrollText, BookOpen,
  Waves, Sparkles,
} from 'lucide-react'

const NAV = [
  {
    label: 'HOME',
    items: [
      { href: '/dashboard',              label: 'Dashboard',    icon: LayoutDashboard, exact: true },
      { href: '/dashboard/today',        label: 'Today / Learn', icon: Sparkles, color: '#F59E0B' },
      { href: '/dashboard/watchlist',    label: 'Watchlist',    icon: Star },
      { href: '/dashboard/alerts',       label: 'Alerts',       icon: Bell },
    ],
  },
  {
    label: 'RESEARCH',
    items: [
      { href: '/dashboard/stocks',           label: 'Stocks',   icon: TrendingUp },
      { href: '/dashboard/compare',          label: 'Compare',  icon: GitCompare },
      { href: '/dashboard/qtools/screener',  label: 'Screener', icon: Search },
      { href: '/dashboard/earnings',         label: 'Earnings', icon: Calendar },
    ],
  },
  {
    label: 'MARKET SIGNALS',
    items: [
      { href: '/dashboard/markets',  label: 'Markets',       icon: Globe,      color: '#A78BFA' },
      { href: '/dashboard/waves',    label: 'Waves',         icon: Waves,      color: '#38BDF8' },
      { href: '/flows',              label: 'Capital Flows', icon: Activity,   color: '#34D399' },
      { href: '/dashboard/insider',  label: 'Smart Money',   icon: UserSearch, color: '#FB7185' },
    ],
  },
  {
    label: 'PORTFOLIO',
    items: [
      { href: '/dashboard/theses',       label: 'Theses',           icon: Crosshair, color: '#F59E0B' },
      { href: '/dashboard/journal',      label: 'Journal',          icon: ScrollText },
      { href: '/dashboard/portfolio',    label: 'Portfolio & Risk', icon: BarChart3 },
    ],
  },
  {
    label: 'PROOF',
    items: [
      { href: '/methodology', label: 'Methodology', icon: BookOpen, color: '#F59E0B' },
    ],
  },
]

const BOTTOM = [
  { href: '/dashboard/billing',  label: 'Billing',  icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/profile',  label: 'Profile',  icon: User },
]

function StockSearch() {
  const router = useRouter()
  const [val, setVal] = useState('')

  function go(e: React.FormEvent) {
    e.preventDefault()
    const t = val.trim().toUpperCase()
    if (t) { router.push(`/dashboard/stocks/${t}`); setVal('') }
  }

  return (
    <form onSubmit={go} className="px-3 pb-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: 'var(--text-ghost)' }} />
        <input
          value={val}
          onChange={e => setVal(e.target.value.toUpperCase())}
          placeholder="Search ticker…"
          maxLength={10}
          className="w-full pl-7 pr-7 py-2 rounded-lg text-[12px] font-bold focus:outline-none transition-all"
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.backgroundColor = 'var(--surface)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--surface-2)' }}
        />
        {val && (
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2">
            <ArrowRight className="w-3 h-3" style={{ color: 'var(--amber)' }} />
          </button>
        )}
      </div>
    </form>
  )
}

function AdminLink() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    const check = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data } = await sb.from('profiles').select('is_admin').eq('id', user.id).single()
      setIsAdmin((data as { is_admin?: boolean } | null)?.is_admin ?? false)
    }
    check().catch(() => undefined)
  }, [])
  if (!isAdmin) return null
  const active = pathname.startsWith('/admin')
  return (
    <Link href="/admin"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
      style={active ? { backgroundColor: 'var(--amber-dim)', color: 'var(--amber)' } : { color: 'var(--text-dim)' }}>
      <Shield className="w-4 h-4 shrink-0" style={{ color: active ? 'var(--amber)' : 'var(--text-ghost)' }} />
      <span>Admin</span>
    </Link>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  const isDark = theme === 'dark'
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.14em] th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
        {isDark ? 'DARK' : 'LIGHT'}
      </span>
      <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="relative flex items-center w-10 h-5 rounded-full border transition-all"
        style={{ backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(180,83,9,0.10)', borderColor: isDark ? 'rgba(245,158,11,0.3)' : 'rgba(180,83,9,0.25)' }}>
        <Moon className="absolute left-1 w-2.5 h-2.5 th-text-ghost" />
        <Sun className="absolute right-1 w-2.5 h-2.5 th-text-ghost" />
        <div className="absolute w-4 h-4 rounded-full transition-all shadow-sm flex items-center justify-center"
          style={{ left: isDark ? '1px' : 'calc(100% - 17px)', backgroundColor: 'var(--amber)' }}>
          {isDark ? <Moon className="w-2 h-2" style={{ color: '#050810' }} /> : <Sun className="w-2 h-2" style={{ color: '#fff' }} />}
        </div>
      </button>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string, exact?: boolean) => {
    if (!href) return false
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const handleSignOut = useCallback(async () => {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login')
  }, [router])

  return (
    <aside className="hidden lg:flex flex-col w-56 h-screen th-sidebar border-r th-border fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex items-center px-4 h-12 border-b th-border shrink-0">
        <QLogoInline iconSize={26} textClass="text-sm font-bold" />
      </div>

      {/* Search */}
      <div className="pt-3">
        <StockSearch />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 overflow-y-auto min-h-0 space-y-4 pb-4">
        {NAV.map((section) => (
          <div key={section.label}>
            <div className="px-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
                {section.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, (item as { exact?: boolean }).exact)
                const isSoon = (item as { soon?: boolean }).soon
                const color = (item as { color?: string }).color

                if (isSoon) return (
                  <div key={item.label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg opacity-35 cursor-not-allowed select-none">
                    <item.icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-ghost)' }} />
                    <span className="flex-1 text-[12px] th-text-dim">{item.label}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                      SOON
                    </span>
                  </div>
                )

                return (
                  <Link key={item.href} href={item.href}
                    className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-150')}
                    style={active
                      ? { backgroundColor: 'var(--amber-dim)', color: 'var(--amber)', borderRight: '2px solid var(--amber)' }
                      : { color: 'var(--text-dim)' }}>
                    <item.icon className="w-3.5 h-3.5 shrink-0"
                      style={{ color: active ? 'var(--amber)' : (color ?? 'var(--text-ghost)') }} />
                    <span style={{ color: active ? 'var(--amber)' : undefined }}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-2 border-t th-border space-y-0.5 shrink-0">
        {BOTTOM.map((item) => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium"
              style={active ? { backgroundColor: 'var(--amber-dim)', color: 'var(--amber)' } : { color: 'var(--text-dim)' }}>
              <item.icon className="w-3.5 h-3.5 shrink-0" style={{ color: active ? 'var(--amber)' : 'var(--text-ghost)' }} />
              {item.label}
            </Link>
          )
        })}
        <AdminLink />
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--negative)'; e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
          <LogOut className="w-3.5 h-3.5 shrink-0" style={{ color: 'currentColor' }} />
          Sign Out
        </button>
        <div className="border-t th-border mt-1 pt-1">
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1.5 mt-0.5">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ backgroundColor: 'var(--amber)', color: '#050810' }}>Q</div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold th-text truncate">Investor</div>
            <div className="text-[9px] th-text-ghost truncate" style={{ fontFamily: 'var(--font-mono)' }}>FREE PLAN</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
