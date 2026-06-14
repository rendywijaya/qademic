'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { createClient } from '@/lib/supabase/client'
import { saveProfile, saveUserSettings } from '@/app/actions/settings'
import type { Profile, UserSettings } from '@/lib/supabase/types'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import {
  User,
  Mail,
  Bell,
  Shield,
  Sun,
  Moon,
  LogOut,
  Check,
  X,
  Loader2,
  TrendingUp,
  BarChart2,
  Cpu,
  Layers,
  Rocket,
  Scale,
  ShieldCheck,
  Crown,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SettingsClientProps {
  email: string
  profile: Profile
  settings: Omit<UserSettings, 'user_id' | 'updated_at'>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ─── Save button with state feedback ─────────────────────────────────────────

function SaveButton({
  state,
  onClick,
}: {
  state: SaveState
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={state === 'saving'}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40"
      style={{
        backgroundColor:
          state === 'saved'
            ? 'rgba(16,185,129,0.12)'
            : state === 'error'
            ? 'rgba(248,113,113,0.12)'
            : '#F59E0B',
        color:
          state === 'saved'
            ? '#10B981'
            : state === 'error'
            ? '#F87171'
            : '#050810',
        border:
          state === 'saved'
            ? '1px solid rgba(16,185,129,0.3)'
            : state === 'error'
            ? '1px solid rgba(248,113,113,0.3)'
            : 'none',
        opacity: state === 'saving' ? 0.7 : 1,
      }}
    >
      {state === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {state === 'saved' && <Check className="w-3.5 h-3.5" />}
      {state === 'error' && <X className="w-3.5 h-3.5" />}
      {state === 'idle' && null}
      <span>
        {state === 'saving'
          ? 'Saving...'
          : state === 'saved'
          ? 'Saved!'
          : state === 'error'
          ? 'Failed — try again'
          : 'Save Changes'}
      </span>
    </button>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  id,
  title,
  icon: Icon,
  label,
  children,
}: {
  id: string
  title: string
  icon: React.ElementType
  label?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="bg-transparent border border-[#1F2937] rounded-lg overflow-hidden transition-all duration-200"
    >
      <div className="px-5 py-4 border-b border-[#1F2937] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <h2
              className="text-sm font-bold"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-bricolage, sans-serif)' }}
            >
              {title}
            </h2>
          </div>
        </div>
        {label && (
          <span
            className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border"
            style={{
              color: 'var(--text-muted)',
              borderColor: 'var(--border)',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {label}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// ─── Field label ──────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5"
      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}
    >
      {children}
    </label>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {label}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40"
        style={{
          height: '22px',
          width: '42px',
          backgroundColor: checked ? 'var(--amber)' : 'var(--border)',
        }}
      >
        <div
          className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all duration-200"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  )
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

const tierMeta: Record<
  Profile['subscription_tier'],
  { label: string; color: string; bg: string; border: string }
> = {
  free: {
    label: 'FREE',
    color: 'var(--text-muted)',
    bg: 'rgba(156,163,175,0.08)',
    border: 'rgba(156,163,175,0.2)',
  },
  growth: {
    label: 'GROWTH',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
  },
  pro: {
    label: 'PRO',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.25)',
  },
  teams: {
    label: 'TEAMS',
    color: '#38BDF8',
    bg: 'rgba(56,189,248,0.08)',
    border: 'rgba(56,189,248,0.25)',
  },
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsClient({
  email,
  profile,
  settings,
}: SettingsClientProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [, startTransition] = useTransition()

  // ── Profile state ──
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [username, setUsername] = useState(profile.username ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [profileSave, setProfileSave] = useState<SaveState>('idle')

  // ── Investment preferences state ──
  const [riskTolerance, setRiskTolerance] = useState<UserSettings['risk_tolerance']>(
    settings.risk_tolerance
  )
  const [investmentStyle, setInvestmentStyle] = useState<UserSettings['investment_style']>(
    settings.investment_style
  )
  const [investSave, setInvestSave] = useState<SaveState>('idle')

  // ── Notifications state ──
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    settings.notifications_enabled
  )
  const [emailDigest, setEmailDigest] = useState(settings.email_digest)
  const [notifSave, setNotifSave] = useState<SaveState>('idle')

  // ── Logout ──
  const [loggingOut, setLoggingOut] = useState(false)

  // ── Helpers ──
  function withSaveState(
    setter: (s: SaveState) => void,
    action: () => Promise<{ success: boolean; error?: string }>
  ) {
    setter('saving')
    startTransition(async () => {
      try {
        const res = await action()
        if (res.success) {
          setter('saved')
          setTimeout(() => setter('idle'), 2000)
        } else {
          setter('error')
          setTimeout(() => setter('idle'), 2500)
        }
      } catch {
        setter('error')
        setTimeout(() => setter('idle'), 2500)
      }
    })
  }

  const handleProfileSave = () =>
    withSaveState(setProfileSave, () =>
      saveProfile({ full_name: fullName, username, bio })
    )

  const handleInvestSave = () =>
    withSaveState(setInvestSave, () =>
      saveUserSettings({
        notifications_enabled: notificationsEnabled,
        email_digest: emailDigest,
        risk_tolerance: riskTolerance,
        investment_style: investmentStyle,
      })
    )

  const handleNotifSave = () =>
    withSaveState(setNotifSave, () =>
      saveUserSettings({
        notifications_enabled: notificationsEnabled,
        email_digest: emailDigest,
        risk_tolerance: riskTolerance,
        investment_style: investmentStyle,
      })
    )

  const handleSignOut = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tier = tierMeta[profile.subscription_tier]

  // ── Avatar initials ──
  const initials = (
    (fullName || profile.full_name || email || 'Q')
      .trim()
      .charAt(0)
      .toUpperCase()
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-3 mb-1">
          <span
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono, monospace)' }}
          >
            ACCOUNT
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <h1
          className="text-xl font-black"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-bricolage, sans-serif)' }}
        >
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Manage your profile, preferences, and account
        </p>
      </div>

      {/* ── A. Profile ─────────────────────────────────────────── */}
      <div className="animate-fade-up-d1">
        <Section id="profile" title="Profile" icon={User}>
          <div className="space-y-5">
            {/* Avatar + email row */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-black shrink-0"
                style={{
                  backgroundColor: 'var(--amber)',
                  color: '#050810',
                  fontFamily: 'var(--font-bricolage, sans-serif)',
                }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--text)' }}
                >
                  {fullName || 'Your Name'}
                </div>
                <div
                  className="text-xs flex items-center gap-1.5 mt-0.5 truncate"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Mail className="w-3 h-3 shrink-0" />
                  {email}
                </div>
                <div className="mt-1.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{
                      color: tier.color,
                      backgroundColor: tier.bg,
                      border: `1px solid ${tier.border}`,
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  >
                    {tier.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <FieldLabel>Full Name</FieldLabel>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  maxLength={60}
                />
              </div>

              <div>
                <FieldLabel>Username</FieldLabel>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}
                  >
                    @
                  </span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                    placeholder="handle"
                    maxLength={30}
                    className="w-full rounded-lg pl-7 pr-4 py-2.5 text-sm transition-all duration-150 focus:outline-none"
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#F59E0B'
                      e.target.style.boxShadow = '0 0 0 1px #F59E0B'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Bio</FieldLabel>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short bio about yourself..."
                  maxLength={200}
                  rows={3}
                  className="w-full rounded-lg px-4 py-2.5 text-sm resize-none transition-all duration-150 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#F59E0B'
                    e.target.style.boxShadow = '0 0 0 1px #F59E0B'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <div
                  className="text-right text-[10px] mt-1"
                  style={{
                    color: bio.length > 180 ? '#F87171' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {bio.length}/200
                </div>
              </div>

              <div>
                <FieldLabel>Email</FieldLabel>
                <div
                  className="w-full rounded-lg px-4 py-2.5 text-sm flex items-center gap-2"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Mail className="w-4 h-4 shrink-0" style={{ color: 'var(--text-ghost)' }} />
                  <span
                    className="truncate"
                    style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px' }}
                  >
                    {email}
                  </span>
                  <span
                    className="ml-auto text-[10px] uppercase tracking-wide shrink-0"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    READ ONLY
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <SaveButton state={profileSave} onClick={handleProfileSave} />
            </div>
          </div>
        </Section>
      </div>

      {/* ── B. Investment Preferences ──────────────────────────── */}
      <div className="animate-fade-up-d2">
        <Section id="investment" title="Investment Preferences" icon={TrendingUp}>
          <div className="space-y-6">
            {/* Risk Tolerance */}
            <div>
              <FieldLabel>Risk Tolerance</FieldLabel>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(
                  [
                    {
                      value: 'conservative' as const,
                      label: 'Conservative',
                      desc: 'Capital preservation first',
                      Icon: ShieldCheck,
                    },
                    {
                      value: 'moderate' as const,
                      label: 'Moderate',
                      desc: 'Balanced growth and safety',
                      Icon: Scale,
                    },
                    {
                      value: 'aggressive' as const,
                      label: 'Aggressive',
                      desc: 'Maximum growth potential',
                      Icon: Rocket,
                    },
                  ] as const
                ).map(({ value, label, desc, Icon }) => {
                  const active = riskTolerance === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRiskTolerance(value)}
                      className="flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                      style={{
                        borderColor: active ? 'rgba(245,158,11,0.35)' : 'var(--border)',
                        backgroundColor: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{
                          backgroundColor: active
                            ? 'rgba(245,158,11,0.15)'
                            : 'var(--surface)',
                          border: `1px solid ${active ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
                        }}
                      >
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: active ? 'var(--amber)' : 'var(--text-ghost)' }}
                        />
                      </div>
                      <div>
                        <div
                          className="text-xs font-semibold leading-tight"
                          style={{ color: active ? 'var(--amber)' : 'var(--text)' }}
                        >
                          {label}
                        </div>
                        <div
                          className="text-[10px] mt-0.5 leading-tight"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {desc}
                        </div>
                      </div>
                      {active && (
                        <Check
                          className="w-3 h-3 self-end ml-auto"
                          style={{ color: 'var(--amber)' }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Investment Style */}
            <div>
              <FieldLabel>Investment Style</FieldLabel>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(
                  [
                    {
                      value: 'value' as const,
                      label: 'Value',
                      desc: 'Undervalued companies with strong fundamentals',
                      Icon: BarChart2,
                      color: '#34D399',
                    },
                    {
                      value: 'growth' as const,
                      label: 'Growth',
                      desc: 'High-growth companies disrupting markets',
                      Icon: TrendingUp,
                      color: '#38BDF8',
                    },
                    {
                      value: 'quant' as const,
                      label: 'Quant',
                      desc: 'Data-driven, algorithmic screening signals',
                      Icon: Cpu,
                      color: '#A78BFA',
                    },
                    {
                      value: 'blend' as const,
                      label: 'Blend',
                      desc: 'Balanced mix of all styles',
                      Icon: Layers,
                      color: '#F59E0B',
                    },
                  ] as const
                ).map(({ value, label, desc, Icon, color }) => {
                  const active = investmentStyle === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInvestmentStyle(value)}
                      className="flex items-start gap-3 p-3 rounded-lg border text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                      style={{
                        borderColor: active
                          ? `${color}55`
                          : 'var(--border)',
                        backgroundColor: active
                          ? `${color}0d`
                          : 'transparent',
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: active ? `${color}20` : 'var(--surface)',
                          border: `1px solid ${active ? `${color}40` : 'var(--border)'}`,
                        }}
                      >
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: active ? color : 'var(--text-ghost)' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: active ? color : 'var(--text)' }}
                          >
                            {label}
                          </span>
                          {active && <Check className="w-3 h-3" style={{ color }} />}
                        </div>
                        <div
                          className="text-[10px] mt-0.5 leading-tight"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {desc}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <SaveButton state={investSave} onClick={handleInvestSave} />
            </div>
          </div>
        </Section>
      </div>

      {/* ── C. Notifications ──────────────────────────────────────── */}
      <div className="animate-fade-up-d3">
        <Section id="notifications" title="Notifications" icon={Bell}>
          <div className="space-y-0">
            <Toggle
              checked={notificationsEnabled}
              onChange={setNotificationsEnabled}
              label="All notifications"
              description="Master toggle for all in-app notifications"
            />
            <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />
            <Toggle
              checked={emailDigest}
              onChange={setEmailDigest}
              label="Daily email digest"
              description="Top market moves and news summary delivered to your inbox"
            />
          </div>

          <div className="flex justify-end pt-4 mt-2 border-t border-[#1F2937]">
            <SaveButton state={notifSave} onClick={handleNotifSave} />
          </div>
        </Section>
      </div>

      {/* ── D. Appearance ────────────────────────────────────────── */}
      <div className="animate-fade-up-d4">
        <Section id="appearance" title="Appearance" icon={Sun} label="Instant">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'dark' as const, label: 'Dark Mode', Icon: Moon, desc: 'Precision Terminal' },
                { value: 'light' as const, label: 'Light Mode', Icon: Sun, desc: 'Financial Daylight' },
              ] as const
            ).map(({ value, label, Icon, desc }) => {
              const active = theme === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className="flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  style={{
                    borderColor: active ? 'rgba(245,158,11,0.35)' : 'var(--border)',
                    backgroundColor: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: active
                        ? 'rgba(245,158,11,0.15)'
                        : 'var(--surface)',
                      border: `1px solid ${active ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
                    }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: active ? 'var(--amber)' : 'var(--text-ghost)' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: active ? 'var(--amber)' : 'var(--text)' }}
                    >
                      {label}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {desc}
                    </div>
                  </div>
                  {active && (
                    <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--amber)' }} />
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Theme is applied instantly and persists across sessions.
          </p>
        </Section>
      </div>

      {/* ── E. Account & Security ─────────────────────────────────── */}
      <div className="animate-fade-up-d5">
        <Section id="security" title="Account & Security" icon={Shield}>
          <div className="space-y-4">
            {/* Email row */}
            <div>
              <FieldLabel>Email Address</FieldLabel>
              <div
                className="w-full rounded-lg px-4 py-2.5 text-sm flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                <Mail className="w-4 h-4 shrink-0" style={{ color: 'var(--text-ghost)' }} />
                <span
                  className="truncate"
                  style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px' }}
                >
                  {email}
                </span>
              </div>
            </div>

            {/* Subscription tier */}
            <div>
              <FieldLabel>Subscription</FieldLabel>
              <div
                className="w-full rounded-lg px-4 py-3 flex items-center justify-between"
                style={{
                  backgroundColor: tier.bg,
                  border: `1px solid ${tier.border}`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Crown className="w-4 h-4" style={{ color: tier.color }} />
                  <span className="text-sm font-semibold" style={{ color: tier.color }}>
                    {profile.subscription_tier.charAt(0).toUpperCase() +
                      profile.subscription_tier.slice(1)}{' '}
                    Plan
                  </span>
                </div>
                <span
                  className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full font-bold"
                  style={{
                    color: tier.color,
                    backgroundColor: tier.bg,
                    border: `1px solid ${tier.border}`,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {profile.subscription_status}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <Button
                variant="danger"
                onClick={handleSignOut}
                loading={loggingOut}
                className="gap-2 w-full sm:w-auto"
              >
                <LogOut className="w-4 h-4" />
                Sign out of Qademic
              </Button>

              <div className="relative group inline-block w-full sm:w-auto">
                <Button
                  variant="secondary"
                  disabled
                  className="gap-2 w-full sm:w-auto cursor-not-allowed opacity-40"
                >
                  <Shield className="w-4 h-4" />
                  Delete Account
                </Button>
                <span
                  className="absolute left-0 -top-9 whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg border opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Contact support to delete your account
                </span>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
