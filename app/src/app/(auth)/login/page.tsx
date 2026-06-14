'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const terminalLines = [
  { symbol: 'S&P 500', price: '5,234.18', change: '▲ 0.82%', positive: true },
  { symbol: 'NASDAQ ', price: '16,421.30', change: '▲ 1.14%', positive: true },
  { symbol: 'BTC/USD', price: '67,420.00', change: '▼ 1.24%', positive: false },
  { symbol: 'GOLD   ', price: ' 2,341.50', change: '▲ 0.31%', positive: true },
  { symbol: 'VIX    ', price: '   14.20', change: '▼ 5.60%', positive: false },
]

const q5Layers = [
  { id: 'Q1', label: 'Macro',       color: '#A78BFA', score: 78 },
  { id: 'Q2', label: 'Sector',      color: '#38BDF8', score: 85 },
  { id: 'Q3', label: 'Fundamental', color: '#34D399', score: 91 },
  { id: 'Q4', label: 'Quant',       color: '#F59E0B', score: 67 },
  { id: 'Q5', label: 'Sentiment',   color: '#FB7185', score: 54 },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(authError.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen th-bg flex">
      {/* Left panel — terminal preview (intentionally always dark) */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 border-r overflow-hidden"
        style={{ backgroundColor: '#050810', borderColor: 'var(--border)' }}>
        {/* Background */}
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[120px] animate-glow"
          style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#F59E0B] flex items-center justify-center">
            <span className="text-[#050810] font-black text-sm" style={{ fontFamily: 'var(--font-bricolage)' }}>Q</span>
          </div>
          <span className="text-base font-bold">
            <span className="text-[#F59E0B]">Q</span>
            <span className="text-white">ademic</span>
          </span>
        </div>

        {/* Terminal widget */}
        <div className="relative z-10 space-y-4">
          <div className="rounded-lg border border-[rgba(245,158,11,0.25)] bg-[#0D1117] overflow-hidden"
            style={{ boxShadow: '0 0 40px rgba(245,158,11,0.08)' }}>
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1F2937] bg-[#050810]">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#F87171]/50" />
                <div className="w-2 h-2 rounded-full bg-[#F59E0B]/50" />
                <div className="w-2 h-2 rounded-full bg-[#34D399]/50" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-[10px] text-[#374151]" style={{ fontFamily: 'var(--font-mono)' }}>
                  MARKET TERMINAL — LIVE
                </span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse-dot" />
            </div>
            <div className="p-4">
              {/* Tickers */}
              <div className="space-y-2.5 mb-4">
                {terminalLines.map((line) => (
                  <div key={line.symbol} className="flex items-center justify-between">
                    <span className="text-[11px] text-[#4B5563]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {line.symbol}
                    </span>
                    <span className="text-[11px] text-[#F9FAFB] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                      {line.price}
                    </span>
                    <span className={`text-[11px] tabular-nums font-medium ${line.positive ? 'text-[#34D399]' : 'text-[#F87171]'}`}
                      style={{ fontFamily: 'var(--font-mono)' }}>
                      {line.change}
                    </span>
                  </div>
                ))}
              </div>
              {/* Divider */}
              <div className="border-t border-[#1F2937] mb-3" />
              {/* Q5 signals */}
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#374151] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                Q5 COMPOSITE
              </div>
              <div className="space-y-1.5">
                {q5Layers.map((layer) => (
                  <div key={layer.id} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold w-5" style={{ fontFamily: 'var(--font-mono)', color: layer.color }}>
                      {layer.id}
                    </span>
                    <div className="flex-1 h-1 bg-[#1F2937] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${layer.score}%`, backgroundColor: layer.color }} />
                    </div>
                    <span className="text-[10px] tabular-nums w-6 text-right" style={{ fontFamily: 'var(--font-mono)', color: layer.color }}>
                      {layer.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-px w-full" style={{ background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.4), transparent)' }} />
          </div>

          <div className="text-xs text-[#6B7280] italic">
            &ldquo;Qademic completely changed how I think about markets. The Q5 framework gave me a systematic edge.&rdquo;
          </div>
          <div>
            <div className="text-xs font-semibold text-[#F9FAFB]">Michael T.</div>
            <div className="text-[10px] text-[#4B5563]">Self-directed investor, 3 years</div>
          </div>
        </div>

        <p className="relative z-10 text-[10px] text-[#374151] uppercase tracking-[0.1em]"
          style={{ fontFamily: 'var(--font-mono)' }}>
          Hedge fund thinking for everyone.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(ellipse, rgba(167,139,250,0.04) 0%, transparent 70%)' }}
        />

        <div className="relative w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-[#F59E0B] flex items-center justify-center">
                <span className="text-[#050810] font-black text-sm" style={{ fontFamily: 'var(--font-bricolage)' }}>Q</span>
              </div>
              <span className="text-base font-bold">
                <span className="text-[#F59E0B]">Q</span>
                <span className="th-text">ademic</span>
              </span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold th-text mb-2">Welcome back</h1>
            <p className="text-sm th-text-muted">
              Sign in to continue your investing journey
            </p>
          </div>

          <div className="border th-border rounded-lg p-8 shadow-2xl shadow-black/40"
            style={{ backgroundColor: 'var(--surface)' }}>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
                autoComplete="email"
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 bottom-2.5 p-1 transition-colors th-text-ghost"
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-ghost)')}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-lg border text-xs" style={{
                  borderColor: 'rgba(248,113,113,0.3)',
                  backgroundColor: 'rgba(248,113,113,0.06)',
                  color: 'var(--negative)',
                }}>
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full gap-2 mt-2">
                Sign in to Qademic
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t th-border text-center">
              <span className="text-sm th-text-muted">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-semibold transition-colors"
                  style={{ color: 'var(--amber)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FBBF24')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--amber)')}>
                  Create one free
                </Link>
              </span>
            </div>
          </div>

          <p className="text-center text-[10px] th-text-ghost mt-6 uppercase tracking-[0.08em]"
            style={{ fontFamily: 'var(--font-mono)' }}>
            Educational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  )
}
