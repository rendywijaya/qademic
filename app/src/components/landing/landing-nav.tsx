'use client'

import Link from 'next/link'
import { ArrowRight, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useEffect, useState } from 'react'
import { QLogoInline } from '@/components/ui/logo'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 rounded-lg transition-colors"
      style={{ color: 'var(--text-dim)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

export default function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 backdrop-blur-md border-b th-border"
      style={{ backgroundColor: 'var(--bg)', opacity: 0.96 }}>
      <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/">
          <QLogoInline iconSize={28} textClass="text-sm font-bold tracking-tight" />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {[
            { href: '#q5-framework', label: 'Framework' },
            { href: '#features', label: 'Features' },
            { href: '#pricing', label: 'Pricing' },
            { href: '/methodology', label: 'Methodology' },
            { href: '/flows', label: 'Flows' },
          ].map((link) => (
            <a key={link.href} href={link.href}
              className="text-sm transition-colors"
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login"
            className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={undefined}
          >
            Sign in
          </Link>
          <Link href="/signup"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--amber)', color: '#050810' }}>
            Get started
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
