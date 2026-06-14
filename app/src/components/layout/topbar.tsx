'use client'

import { useTheme } from '@/lib/theme'
import { useEffect, useState } from 'react'
import { Bell, Sun, Moon } from 'lucide-react'
import { QLogoInline, QMark } from '@/components/ui/logo'

function ThemeBtn() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 rounded-lg transition-colors"
      style={{ color: 'var(--text-ghost)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-ghost)')}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

export default function Topbar() {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 th-sidebar backdrop-blur-md border-b th-border flex items-center px-4 gap-3">
      <div className="flex-1">
        <QLogoInline iconSize={26} textClass="text-sm font-bold" />
      </div>
      <div className="flex items-center gap-1">
        <ThemeBtn />
        <button className="relative p-2 rounded-lg transition-colors" style={{ color: 'var(--text-ghost)' }}>
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--amber)' }} />
        </button>
      </div>
    </header>
  )
}

export function DashboardTopbar() {
  return (
    <header className="hidden lg:flex fixed top-0 left-64 right-0 z-20 h-14 th-bg backdrop-blur-md border-b th-border items-center px-6 gap-4"
      style={{ backgroundColor: 'var(--bg)', opacity: 0.95 }}>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg transition-colors" style={{ color: 'var(--text-ghost)' }}>
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--amber)' }} />
        </button>
        <QMark size={28} />
      </div>
    </header>
  )
}
