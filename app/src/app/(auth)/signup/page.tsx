'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const benefits = [
  'Master the Q5 investing framework',
  'AI-powered stock screener',
  'Q5-tagged market news feed',
  'Access Module 1 completely free',
  'No credit card required',
]

const q5Layers = [
  { id: 'Q1', label: 'Macro Analysis',       color: '#A78BFA', pct: 78 },
  { id: 'Q2', label: 'Sector Analysis',      color: '#38BDF8', pct: 85 },
  { id: 'Q3', label: 'Fundamental Analysis', color: '#34D399', pct: 91 },
  { id: 'Q4', label: 'Quantitative',         color: '#F59E0B', pct: 67 },
  { id: 'Q5', label: 'Sentiment',            color: '#FB7185', pct: 54 },
]

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })

      if (authError) {
        setError(authError.message)
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen th-bg flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-lg border flex items-center justify-center mx-auto mb-4"
            style={{ borderColor: 'rgba(52,211,153,0.25)', backgroundColor: 'rgba(52,211,153,0.08)' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--positive)' }} />
          </div>
          <h2 className="text-xl font-bold th-text mb-2">Account created!</h2>
          <p className="text-sm th-text-muted">Redirecting you to your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen th-bg flex">
      {/* Left — benefits panel (intentionally always dark, terminal aesthetic) */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 border-r overflow-hidden"
        style={{ backgroundColor: '#050810', borderColor: 'var(--border)' }}>
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

        {/* Content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-[#F9FAFB] mb-2">
              Everything you need to invest like a professional.
            </h2>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Join 10,000+ investors who use the Q5 framework to make better investment decisions.
            </p>
          </div>

          {/* Benefits */}
          <ul className="space-y-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <CheckCircle2 className="w-3 h-3 text-[#34D399]" />
                </div>
                <span className="text-sm text-[#9CA3AF]">{benefit}</span>
              </li>
            ))}
          </ul>

          {/* Q5 preview */}
          <div className="border rounded-lg p-4"
            style={{ borderColor: 'rgba(245,158,11,0.2)', backgroundColor: 'rgba(245,158,11,0.03)' }}>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#4B5563] mb-3"
              style={{ fontFamily: 'var(--font-mono)' }}>
              Q5 FRAMEWORK SIGNALS
            </div>
            <div className="space-y-2">
              {q5Layers.map((layer) => (
                <div key={layer.id} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold w-6" style={{ fontFamily: 'var(--font-mono)', color: layer.color }}>
                    {layer.id}
                  </span>
                  <span className="text-[10px] text-[#4B5563] w-28" style={{ fontFamily: 'var(--font-mono)' }}>
                    {layer.label}
                  </span>
                  <div className="flex-1 h-1 bg-[#1F2937] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${layer.pct}%`, backgroundColor: layer.color }}
                    />
                  </div>
                  <span className="text-[10px] text-[#4B5563] tabular-nums w-6 text-right"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    {layer.pct}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative z-10 text-[10px] text-[#374151] uppercase tracking-[0.1em]"
          style={{ fontFamily: 'var(--font-mono)' }}>
          Hedge fund thinking. Normal people. One platform.
        </p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(ellipse, rgba(52,211,153,0.04) 0%, transparent 70%)' }}
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
            <h1 className="text-2xl font-bold th-text mb-2">Create your account</h1>
            <p className="text-sm th-text-muted">
              Start learning the Q5 framework — free, no credit card required
            </p>
          </div>

          <div className="border th-border rounded-lg p-8 shadow-2xl shadow-black/40"
            style={{ backgroundColor: 'var(--surface)' }}>
            <form onSubmit={handleSignup} className="space-y-4">
              <Input
                label="Full name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<User className="w-4 h-4" />}
                required
                autoComplete="name"
              />

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
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />}
                  required
                  autoComplete="new-password"
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
                Create free account
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <p className="text-[10px] th-text-ghost text-center mt-4">
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>

            <div className="mt-6 pt-6 border-t th-border text-center">
              <span className="text-sm th-text-muted">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold transition-colors"
                  style={{ color: 'var(--amber)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FBBF24')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--amber)')}>
                  Sign in
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
