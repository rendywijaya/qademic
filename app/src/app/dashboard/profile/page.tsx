'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/theme'
import { useRouter } from 'next/navigation'
import {
  User,
  Mail,
  Shield,
  Sun,
  Moon,
  LogOut,
  Check,
  Crown,
  Bell,
  Lock,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/button'

const plans = [
  { name: 'Free', price: '$0/mo', current: true, color: 'var(--text-muted)' },
  { name: 'Analyst', price: '$19/mo', current: false, color: 'var(--amber)' },
  { name: 'Pro', price: '$49/mo', current: false, color: '#A855F7' },
  { name: 'Fund', price: '$99/mo', current: false, color: 'var(--amber)' },
]

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="bg-transparent border th-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b th-border flex items-center gap-2">
        <Icon className="w-4 h-4 th-text-muted" />
        <span className="text-sm font-bold th-text">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function ProfilePage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    news: true,
    alerts: true,
  })

  useEffect(() => { setMounted(true) }, [])

  const handleLogout = async () => {
    setLogoutLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="text-xl font-black th-text mb-1">Profile & Settings</h1>
        <p className="text-sm th-text-muted">Manage your account, subscription, and preferences</p>
      </div>

      {/* Account card */}
      <div className="animate-fade-up-d1">
        <SectionCard title="Account Details" icon={User}>
          {/* Avatar row */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#FBBF24] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-[#F59E0B]/20">
              Q
            </div>
            <div>
              <div className="text-base font-bold th-text">Investor</div>
              <div className="text-sm th-text-muted flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                user@example.com
              </div>
              <div className="mt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide th-text-muted"
                  style={{ backgroundColor: 'rgba(156,163,175,0.15)', borderColor: 'rgba(156,163,175,0.25)' }}>
                  Free Plan
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <User className="w-3.5 h-3.5" />
              Edit Profile
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Change Password
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* Subscription */}
      <div className="animate-fade-up-d2">
        <SectionCard title="Subscription" icon={Crown}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="p-3 rounded-lg border text-center transition-all"
                style={{
                  borderColor: plan.current ? 'rgba(245,158,11,0.35)' : 'var(--border)',
                  backgroundColor: plan.current ? 'var(--amber-dim)' : 'var(--surface)',
                }}
              >
                {plan.current && (
                  <div className="text-[9px] font-bold mb-1 uppercase tracking-widest"
                    style={{ color: 'var(--amber)' }}>
                    Current
                  </div>
                )}
                <div className="text-sm font-bold th-text">{plan.name}</div>
                <div className="text-xs tabular-nums" style={{ color: plan.current ? plan.color : 'var(--text-ghost)' }}>
                  {plan.price}
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full gap-2 mb-2">
            <Crown className="w-4 h-4" />
            Upgrade to Analyst — $19/mo
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>
          <p className="text-center text-xs th-text-muted">
            Unlock full Academy + unlimited AI Screener
          </p>
        </SectionCard>
      </div>

      {/* Appearance */}
      <div className="animate-fade-up-d3">
        <SectionCard title="Appearance" icon={mounted && theme === 'dark' ? Moon : Sun}>
          {mounted && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'light' as const, label: 'Light', icon: Sun },
                { value: 'dark' as const, label: 'Dark', icon: Moon },
              ].map((option) => {
                const active = theme === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-lg border transition-all"
                    style={{
                      borderColor: active ? 'rgba(245,158,11,0.35)' : 'var(--border)',
                      backgroundColor: active ? 'var(--amber-dim)' : 'transparent',
                      color: active ? 'var(--amber)' : 'var(--text-muted)',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--text-ghost)'; e.currentTarget.style.color = 'var(--text-dim)' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' } }}
                  >
                    <option.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{option.label}</span>
                    {active && <Check className="w-3.5 h-3.5" />}
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Notifications */}
      <div className="animate-fade-up-d4">
        <SectionCard title="Notifications" icon={Bell}>
          <div className="space-y-4">
            {[
              { key: 'email' as const, label: 'Daily email digest', desc: 'Morning brief delivered to your inbox' },
              { key: 'news' as const, label: 'Breaking news alerts', desc: 'Macro and fundamental signals for your watchlist' },
              { key: 'alerts' as const, label: 'Insider and filing alerts', desc: '8-K filings, insider transactions, unusual options' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium th-text">{item.label}</div>
                  <div className="text-xs th-text-muted">{item.desc}</div>
                </div>
                <button
                  onClick={() => setNotifications((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  className="relative rounded-full transition-colors shrink-0"
                  style={{
                    height: '22px',
                    width: '42px',
                    backgroundColor: notifications[item.key] ? 'var(--amber)' : 'var(--border)',
                  }}
                >
                  <div
                    className="absolute top-0.5 rounded-full bg-white shadow-sm transition-all"
                    style={{
                      width: '18px',
                      height: '18px',
                      left: notifications[item.key] ? '22px' : '2px',
                    }}
                  />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Security / Logout */}
      <div className="animate-fade-up-d5">
        <SectionCard title="Security" icon={Shield}>
          <div className="space-y-3">
            <button
              className="w-full flex items-center justify-between p-3 rounded-lg border th-border transition-all text-left th-text"
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--text-ghost)'
                e.currentTarget.style.backgroundColor = 'var(--surface-2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}>
              <span className="text-sm">Change Password</span>
              <ChevronRight className="w-4 h-4 th-text-muted" />
            </button>

            <div className="pt-2">
              <Button
                variant="danger"
                onClick={handleLogout}
                loading={logoutLoading}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign out of Qademic
              </Button>
              <p className="text-xs th-text-muted mt-2">
                You&apos;ll be redirected to the login page.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
