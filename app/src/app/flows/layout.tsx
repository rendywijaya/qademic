import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { QLogoInline } from '@/components/ui/logo'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Capital Flows & Sector Rotation — Qademic',
  description:
    'Live macro dashboard showing where global money is moving. Sector rotation heatmap, market pulse, and Fed/FRED macro signals. Updated daily at market close.',
  openGraph: {
    title: 'Capital Flows & Sector Rotation — Qademic',
    description: 'Where global money is moving today. Sector rotation heatmap, market pulse, and macro signals dashboard.',
    url: 'https://qademic.com/flows',
    siteName: 'Qademic',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Capital Flows & Sector Rotation — Qademic',
    description: 'Where global money is moving today.',
  },
}

async function getIsLoggedIn(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return !!data.user
  } catch {
    return false
  }
}

export default async function FlowsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isLoggedIn = await getIsLoggedIn()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#050810' }}>
      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center px-4 md:px-6 gap-4 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(5,8,16,0.92)',
          borderColor: '#1F2937',
        }}
      >
        <Link href="/" className="shrink-0">
          <QLogoInline iconSize={24} textClass="text-sm font-bold" />
        </Link>

        <div className="flex-1" />

        {/* Public badge */}
        <span
          className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase px-2.5 py-1 rounded border"
          style={{
            color: '#10B981',
            borderColor: 'rgba(16,185,129,0.25)',
            backgroundColor: 'rgba(16,185,129,0.06)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          Public
        </span>

        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
            style={{
              color: '#F59E0B',
              borderColor: 'rgba(245,158,11,0.25)',
              backgroundColor: 'rgba(245,158,11,0.06)',
            }}
          >
            <ArrowLeft className="w-3 h-3" />
            Dashboard
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
            style={{
              color: '#F9FAFB',
              borderColor: '#1F2937',
              backgroundColor: '#0D1117',
            }}
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">Full Platform</span>
            <span className="sm:hidden">Login</span>
          </Link>
        )}
      </header>

      {/* Page content — padded for fixed header */}
      <div className="pt-12">{children}</div>
    </div>
  )
}
