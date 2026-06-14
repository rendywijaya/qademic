'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Crown,
  Check,
  X,
  Minus,
  Zap,
  BarChart2,
  Bell,
  Calendar,
  FileText,
  TrendingUp,
  Headphones,
  Star,
  ArrowRight,
  Settings,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import Button from '@/components/ui/button'
import type { Profile } from '@/lib/supabase/types'

type Tier = 'free' | 'growth' | 'pro'

interface BillingClientProps {
  userId: string
  email: string
  profile: Profile | null
}

type FeatureValue = boolean | string

interface Feature {
  label: string
  icon: React.ElementType
  free: FeatureValue
  growth: FeatureValue
  pro: FeatureValue
}

const FEATURES: Feature[] = [
  { label: 'Watchlist stocks', icon: BarChart2, free: '10', growth: 'Unlimited', pro: 'Unlimited' },
  { label: 'AI Chat messages/day', icon: Zap, free: '5 / day', growth: 'Unlimited', pro: 'Unlimited' },
  { label: 'Portfolio manager', icon: TrendingUp, free: false, growth: true, pro: true },
  { label: 'Price alerts', icon: Bell, free: false, growth: true, pro: true },
  { label: 'Earnings calendar', icon: Calendar, free: false, growth: true, pro: true },
  { label: 'Q5 Stock analysis', icon: Star, free: 'Basic', growth: 'Full', pro: 'Full' },
  { label: 'AI-generated reports', icon: FileText, free: false, growth: false, pro: true },
  { label: 'Backtesting engine', icon: BarChart2, free: false, growth: false, pro: true },
  { label: 'Priority support', icon: Headphones, free: false, growth: false, pro: true },
]

const PLAN_LABELS: Record<Tier, string> = {
  free: 'FREE',
  growth: 'GROWTH',
  pro: 'PRO',
}

const PLAN_COLORS: Record<Tier, string> = {
  free: 'var(--text-muted)',
  growth: 'var(--amber)',
  pro: '#A78BFA',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--positive)',
  trialing: 'var(--amber)',
  past_due: 'var(--negative)',
  cancelled: 'var(--text-muted)',
}

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <Check className="w-4 h-4" style={{ color: 'var(--positive)' }} />
      </div>
    )
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <Minus className="w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
      </div>
    )
  }
  return (
    <div
      className="text-center text-xs font-semibold"
      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
    >
      {value}
    </div>
  )
}

export default function BillingClient({ userId, email, profile }: BillingClientProps) {
  const searchParams = useSearchParams()
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [banner, setBanner] = useState<'success' | 'cancelled' | null>(null)

  const currentTier = (profile?.subscription_tier ?? 'free') as Tier
  const currentStatus = profile?.subscription_status ?? 'active'
  const isPaid = currentTier !== 'free'

  // Read stripe_customer_id from profile if it exists
  const stripeCustomerId =
    profile && 'stripe_customer_id' in profile
      ? (profile as Profile & { stripe_customer_id?: string }).stripe_customer_id
      : undefined

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setBanner('success')
      const t = setTimeout(() => setBanner(null), 5000)
      return () => clearTimeout(t)
    }
    if (searchParams.get('cancelled') === 'true') {
      setBanner('cancelled')
      const t = setTimeout(() => setBanner(null), 5000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  const handleUpgrade = async (tier: Tier) => {
    if (tier === 'free') return
    setLoadingTier(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, userId, email }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setLoadingTier(null)
    }
  }

  const handleManageBilling = async () => {
    if (!stripeCustomerId) return
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: stripeCustomerId }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Banner */}
      {banner && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium"
          style={{
            backgroundColor:
              banner === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)',
            borderColor:
              banner === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)',
            color: banner === 'success' ? 'var(--positive)' : 'var(--negative)',
          }}
        >
          {banner === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {banner === 'success'
            ? 'Subscription activated successfully. Welcome to Qademic!'
            : 'Checkout cancelled. No charges were made.'}
        </div>
      )}

      {/* Header */}
      <div>
        <h1
          className="text-xl font-black mb-1"
          style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
        >
          Billing & Plans
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Hedge fund thinking. Normal people. One platform.
        </p>
      </div>

      {/* Current plan banner */}
      <div
        className="rounded-lg border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          borderColor: isPaid ? 'rgba(245,158,11,0.25)' : 'var(--border)',
          backgroundColor: isPaid ? 'rgba(245,158,11,0.04)' : 'var(--surface)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: isPaid ? 'rgba(245,158,11,0.12)' : 'rgba(156,163,175,0.08)',
            }}
          >
            <Crown
              className="w-5 h-5"
              style={{ color: isPaid ? 'var(--amber)' : 'var(--text-muted)' }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-sm font-bold uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-mono)', color: PLAN_COLORS[currentTier] }}
              >
                {PLAN_LABELS[currentTier]}
              </span>
              {isPaid && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                  style={{
                    backgroundColor: `${STATUS_COLORS[currentStatus]}18`,
                    color: STATUS_COLORS[currentStatus] ?? 'var(--text-muted)',
                    border: `1px solid ${STATUS_COLORS[currentStatus] ?? 'var(--border)'}40`,
                  }}
                >
                  {currentStatus}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {currentTier === 'free'
                ? 'Basic access — upgrade to unlock the full platform'
                : 'Your subscription is managed through Stripe'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isPaid && (
            <Button onClick={() => handleUpgrade('growth')} loading={loadingTier === 'growth'} size="sm">
              <Zap className="w-3.5 h-3.5" />
              Upgrade to unlock everything
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
          {isPaid && stripeCustomerId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleManageBilling}
              loading={portalLoading}
            >
              <Settings className="w-3.5 h-3.5" />
              Manage Billing
            </Button>
          )}
        </div>
      </div>

      {/* Plan comparison table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
      >
        {/* Plan headers */}
        <div className="grid grid-cols-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="p-4 border-r" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-dim)' }}>
              Features
            </p>
          </div>

          {/* Free */}
          <PlanHeader
            name="Free"
            price="$0"
            period="/mo"
            tier="free"
            currentTier={currentTier}
            tag={null}
            accentColor="var(--text-muted)"
            onUpgrade={handleUpgrade}
            loading={loadingTier === 'free'}
          />

          {/* Growth */}
          <PlanHeader
            name="Growth"
            price="$9.99"
            period="/mo"
            tier="growth"
            currentTier={currentTier}
            tag="Most Popular"
            accentColor="var(--amber)"
            onUpgrade={handleUpgrade}
            loading={loadingTier === 'growth'}
          />

          {/* Pro */}
          <PlanHeader
            name="Pro"
            price="$29.99"
            period="/mo"
            tier="pro"
            currentTier={currentTier}
            tag={null}
            accentColor="#A78BFA"
            gradient
            onUpgrade={handleUpgrade}
            loading={loadingTier === 'pro'}
          />
        </div>

        {/* Feature rows */}
        {FEATURES.map((feature, i) => {
          const isLast = i === FEATURES.length - 1
          return (
            <div
              key={feature.label}
              className={`grid grid-cols-4 transition-colors ${!isLast ? 'border-b' : ''}`}
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Feature label */}
              <div
                className="p-3.5 flex items-center gap-2.5 border-r"
                style={{ borderColor: 'var(--border)' }}
              >
                <feature.icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-dim)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {feature.label}
                </span>
              </div>

              {/* Free */}
              <FeatureColumn value={feature.free} tier="free" currentTier={currentTier} />
              {/* Growth */}
              <FeatureColumn value={feature.growth} tier="growth" currentTier={currentTier} />
              {/* Pro */}
              <FeatureColumn value={feature.pro} tier="pro" currentTier={currentTier} gradient />
            </div>
          )
        })}
      </div>

      {/* Upgrade prompt for free users */}
      {!isPaid && (
        <div
          className="rounded-lg border p-6 text-center"
          style={{
            borderColor: 'rgba(245,158,11,0.2)',
            backgroundColor: 'rgba(245,158,11,0.03)',
          }}
        >
          <Crown className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--amber)' }} />
          <h3
            className="text-base font-bold mb-1"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
          >
            Ready to invest smarter?
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Growth starts at $9.99/mo. Cancel anytime.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button onClick={() => handleUpgrade('growth')} loading={loadingTier === 'growth'}>
              <Zap className="w-4 h-4" />
              Get Growth — $9.99/mo
            </Button>
            <Button
              variant="outline"
              onClick={() => handleUpgrade('pro')}
              loading={loadingTier === 'pro'}
            >
              <Crown className="w-4 h-4" />
              Get Pro — $29.99/mo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PlanHeaderProps {
  name: string
  price: string
  period: string
  tier: Tier
  currentTier: Tier
  tag: string | null
  accentColor: string
  gradient?: boolean
  onUpgrade: (tier: Tier) => void
  loading: boolean
}

function PlanHeader({
  name,
  price,
  period,
  tier,
  currentTier,
  tag,
  accentColor,
  gradient = false,
  onUpgrade,
  loading,
}: PlanHeaderProps) {
  const isCurrent = tier === currentTier
  const canUpgrade = tier !== 'free' && !isCurrent && currentTier !== 'pro'

  return (
    <div
      className="p-4 border-r last:border-r-0 flex flex-col gap-2 relative"
      style={{
        borderColor: 'var(--border)',
        backgroundColor:
          isCurrent
            ? 'rgba(245,158,11,0.04)'
            : gradient
            ? 'rgba(167,139,250,0.03)'
            : 'transparent',
        borderTopColor: isCurrent ? 'rgba(245,158,11,0.4)' : undefined,
      }}
    >
      {isCurrent && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: 'var(--amber)' }}
        />
      )}
      {tag && !isCurrent && (
        <span
          className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full self-start"
          style={{
            backgroundColor: 'rgba(245,158,11,0.12)',
            color: 'var(--amber)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          {tag}
        </span>
      )}
      {isCurrent && (
        <span
          className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full self-start"
          style={{
            backgroundColor: 'rgba(245,158,11,0.12)',
            color: 'var(--amber)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          Current
        </span>
      )}

      <div>
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: accentColor }}
        >
          {name}
        </p>
        <div className="flex items-baseline gap-0.5 mt-0.5">
          <span
            className="text-xl font-black tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
          >
            {price}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {period}
          </span>
        </div>
      </div>

      {canUpgrade && (
        <Button
          size="sm"
          variant={gradient ? 'outline' : 'primary'}
          onClick={() => onUpgrade(tier)}
          loading={loading}
          className="text-xs px-2 py-1 h-7"
          style={
            gradient
              ? {
                  borderColor: 'rgba(167,139,250,0.35)',
                  color: '#A78BFA',
                }
              : {}
          }
        >
          Upgrade
        </Button>
      )}
      {isCurrent && tier !== 'free' && (
        <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
          Active plan
        </span>
      )}
      {tier === 'free' && isCurrent && (
        <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
          No card needed
        </span>
      )}
    </div>
  )
}

interface FeatureColumnProps {
  value: FeatureValue
  tier: Tier
  currentTier: Tier
  gradient?: boolean
}

function FeatureColumn({ value, tier, currentTier, gradient = false }: FeatureColumnProps) {
  const isCurrent = tier === currentTier
  return (
    <div
      className="p-3.5 border-r last:border-r-0 flex items-center justify-center"
      style={{
        borderColor: 'var(--border)',
        backgroundColor:
          isCurrent
            ? 'rgba(245,158,11,0.03)'
            : gradient
            ? 'rgba(167,139,250,0.02)'
            : 'transparent',
      }}
    >
      <FeatureCell value={value} />
    </div>
  )
}
