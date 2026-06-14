'use client'

import Link from 'next/link'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { useState } from 'react'

const Q7_SCORES = [
  { id: 'Q1', label: 'Macro',        score: 4.1, color: '#A78BFA' },
  { id: 'Q2', label: 'Sector',       score: 3.8, color: '#38BDF8' },
  { id: 'Q3', label: 'Fundamental',  score: 5.0, color: '#34D399' },
  { id: 'Q4', label: 'Quant',        score: 4.2, color: '#F59E0B' },
  { id: 'Q5', label: 'Sentiment',    score: 4.0, color: '#FB7185' },
  { id: 'Q6', label: 'Management',   score: 4.5, color: '#E879F9' },
  { id: 'Q7', label: 'Catalyst',     score: 3.5, color: '#F97316' },
]

export default function Hero() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) setSubmitted(true)
  }

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden th-bg">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-[140px]"
          style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 65%)' }} />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(ellipse, rgba(167,139,250,0.05) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full pt-20 pb-16">
        <div className="grid lg:grid-cols-[1fr_460px] gap-12 xl:gap-20 items-center">

          {/* Left — copy */}
          <div>
            <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded border mb-8"
              style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--amber)' }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                HEDGE FUND INTELLIGENCE FOR SERIOUS INVESTORS
              </span>
            </div>

            <h1 className="animate-fade-up-d1 font-extrabold tracking-tight leading-[0.92] mb-7 th-text"
              style={{ fontFamily: 'var(--font-bricolage)', fontSize: 'clamp(3rem, 7vw, 5.5rem)' }}>
              Hedge fund
              <br />
              <span style={{ color: 'var(--amber)' }}>thinking.</span>
              <br />
              $25 a month.
            </h1>

            <p className="animate-fade-up-d2 leading-relaxed mb-4 max-w-md th-text-dim"
              style={{ fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)' }}>
              The investment research platform for serious retail investors.
              Every signal, every filing, every institutional move — synthesised
              through one structured framework. Pre-computed nightly. Delivered proactively.
              Backtestable in plain language.
            </p>

            <p className="animate-fade-up-d2 text-sm mb-10 th-text-ghost"
              style={{ fontFamily: 'var(--font-mono)' }}>
              One platform. Replaces five tools. Costs less than all of them combined.
            </p>

            {submitted ? (
              <div className="animate-fade-up flex items-center gap-3 px-5 py-4 rounded-lg border mb-10"
                style={{ borderColor: 'rgba(52,211,153,0.3)', backgroundColor: 'rgba(52,211,153,0.06)' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--positive)' }} />
                <span className="text-sm" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}>
                  You are on the list. We will be in touch.
                </span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="animate-fade-up-d3 mb-10">
                <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-3 rounded-lg border text-sm outline-none transition-all"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber-border)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--amber-dim)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  <button type="submit"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: 'var(--amber)', color: '#050810', fontFamily: 'var(--font-bricolage)' }}>
                    Get early access <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] mt-2.5 th-text-ghost" style={{ fontFamily: 'var(--font-mono)' }}>
                  FREE PLAN AVAILABLE · NO CREDIT CARD · 60 SECOND SETUP
                </p>
              </form>
            )}

            <div className="animate-fade-up-d4">
              <Link href="/login" className="text-sm th-text-dim hover:th-text-muted transition-colors">
                Already have an account? <span style={{ color: 'var(--amber)' }}>Sign in</span>
              </Link>
            </div>
          </div>

          {/* Right — Setup Score demo card */}
          <div className="animate-fade-up-d5 relative">
            <div className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />

            <div className="relative rounded-xl border overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #0D1117 0%, #050810 100%)',
                borderColor: 'rgba(245,158,11,0.2)',
                boxShadow: '0 0 0 1px rgba(245,158,11,0.06), 0 30px 80px rgba(0,0,0,0.4)',
              }}>

              {/* Chrome */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #1F2937' }}>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'rgba(248,113,113,0.5)' }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.5)' }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'rgba(52,211,153,0.5)' }} />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[10px]" style={{ color: '#374151', fontFamily: 'var(--font-mono)' }}>
                    app.qademic.com
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#34D399' }} />
                  <span className="text-[9px]" style={{ color: '#34D399', fontFamily: 'var(--font-mono)' }}>LIVE</span>
                </div>
              </div>

              {/* Setup Score block */}
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #1F2937' }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.12em] mb-1" style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}>PRICE</div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>$142.80</div>
                    <div className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: '#34D399', fontFamily: 'var(--font-mono)' }}>
                      <TrendingUp className="w-3 h-3" /> +1.8% today
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.12em] mb-1" style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}>SETUP SCORE</div>
                    <div className="text-3xl font-bold tabular-nums" style={{ color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>87</div>
                    <div className="text-[9px]" style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}>/100 · 92nd percentile</div>
                    <div className="text-[9px] font-semibold mt-0.5" style={{ color: '#34D399', fontFamily: 'var(--font-mono)' }}>STRONG SETUP</div>
                  </div>
                </div>
                <div className="text-[9px] px-2.5 py-1.5 rounded" style={{ backgroundColor: 'rgba(245,158,11,0.06)', color: '#6B7280', fontFamily: 'var(--font-mono)', border: '1px solid rgba(245,158,11,0.12)' }}>
                  Seven dimensions · One score · Everything you need before you decide
                </div>
              </div>

              {/* 7 pillars */}
              <div className="px-5 py-4">
                <div className="text-[9px] uppercase tracking-[0.12em] mb-3" style={{ color: '#374151', fontFamily: 'var(--font-mono)' }}>FULL ANALYSIS · 7 PILLARS</div>
                <div className="space-y-2">
                  {Q7_SCORES.map(layer => (
                    <div key={layer.id} className="flex items-center gap-2">
                      <span className="text-[9px] font-bold w-5 shrink-0" style={{ color: layer.color, fontFamily: 'var(--font-mono)' }}>{layer.id}</span>
                      <span className="text-[9px] w-20 shrink-0" style={{ color: '#4B5563', fontFamily: 'var(--font-mono)' }}>{layer.label}</span>
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#1A2332' }}>
                        <div className="h-full rounded-full animate-expand-bar"
                          style={{ width: `${(layer.score / 5) * 100}%`, backgroundColor: layer.color }} />
                      </div>
                      <span className="text-[9px] tabular-nums w-6 text-right" style={{ color: layer.color, fontFamily: 'var(--font-mono)' }}>{layer.score}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #1A2332' }}>
                  <span className="text-[9px]" style={{ color: '#374151', fontFamily: 'var(--font-mono)' }}>EARNINGS IN 6 DAYS · IMPLIED MOVE 8.3%</span>
                  <span className="text-[9px] font-bold" style={{ color: '#34D399', fontFamily: 'var(--font-mono)' }}>3 INSIDERS BOUGHT</span>
                </div>
              </div>

              <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.5), transparent)' }} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes expand-bar { from { width: 0 } }
        .animate-expand-bar { animation: expand-bar 1.2s cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0.8s; }
      `}</style>
    </section>
  )
}
