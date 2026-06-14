import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Hero from '@/components/landing/hero'
import Q7Section from '@/components/landing/q5-section'
import FeaturesSection from '@/components/landing/features-section'
import PricingSection from '@/components/landing/pricing-section'
import LandingNav from '@/components/landing/landing-nav'
import { QLogoInline } from '@/components/ui/logo'

export default function LandingPage() {
  return (
    <div className="min-h-screen th-bg">
      <LandingNav />

      <main className="pt-14">
        {/* Market data ticker strip */}
        <div className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="max-w-6xl mx-auto px-6 py-2 flex items-center gap-5 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}>
            {[
              { ticker: 'SPY', price: '580.42', change: '+0.82%', up: true },
              { ticker: 'QQQ', price: '502.18', change: '+1.24%', up: true },
              { ticker: 'IWM', price: '208.34', change: '-0.31%', up: false },
              { ticker: 'VIX', price: '14.8', change: '-2.1%', up: false },
              { ticker: '10Y', price: '4.31%', change: '+3bp', up: false },
              { ticker: 'DXY', price: '104.2', change: '-0.12%', up: false },
            ].map((item) => (
              <div key={item.ticker} className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] font-bold tracking-[0.1em]"
                  style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}>{item.ticker}</span>
                <span className="text-[11px] tabular-nums"
                  style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{item.price}</span>
                <span className="text-[9px] tabular-nums"
                  style={{ color: item.up ? 'var(--positive)' : 'var(--negative)', fontFamily: 'var(--font-mono)' }}>
                  {item.change}
                </span>
              </div>
            ))}
            <div className="hidden md:flex items-center gap-1.5 ml-auto pl-4 shrink-0 border-l"
              style={{ borderColor: 'var(--border)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--positive)' }} />
              <span className="text-[9px] whitespace-nowrap"
                style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}>
                MARKETS OPEN
              </span>
            </div>
          </div>
        </div>
        <Hero />
        <Q7Section />
        <FeaturesSection />
        <PricingSection />

        {/* Final CTA */}
        <section className="py-24 px-6 th-bg relative overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full blur-[80px] animate-glow"
            style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 70%)' }}
          />
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border mb-8 tracking-[0.08em]"
              style={{
                backgroundColor: 'var(--amber-dim)',
                borderColor: 'var(--amber-border)',
                color: 'var(--amber)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
              }}>
              GET STARTED TODAY
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 th-text">
              Ready to research like a professional?
            </h2>
            <p className="mb-10 leading-relaxed th-text-muted">
              Start free. Upgrade when you want the full platform.
              No credit card required.
            </p>
            <Link href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--amber)', color: '#050810', fontFamily: 'var(--font-bricolage)' }}>
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t th-border th-bg py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <QLogoInline iconSize={22} textClass="text-sm font-bold" />
            <div className="flex items-center gap-6">
              {['Framework', 'Features', 'Pricing'].map((link) => (
                <a key={link} href={`#${link.toLowerCase()}`}
                  className="text-xs transition-colors th-text-dim hover:th-text-muted">
                  {link}
                </a>
              ))}
              <Link href="/login" className="text-xs th-text-dim transition-colors">
                Sign in
              </Link>
            </div>
            <p className="text-xs th-text-ghost">
              © 2026 Qademic. For educational purposes only. Not financial advice.
            </p>
          </div>
        </footer>
      </main>
    </div>
  )
}
