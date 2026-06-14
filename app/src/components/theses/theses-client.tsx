'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, X, Crosshair, ShieldAlert, Trash2 } from 'lucide-react'
import {
  createThesis, activateThesis, closeThesis, deleteThesis,
  type Thesis, type KillCondition,
} from '@/app/actions/theses'

// Theses — the core v3 object (QADEMIC.md §4). A thesis is written BEFORE entry:
// claim, what's priced in, kill conditions. The system watches it after.

interface RegimeRow {
  date: string
  state: 'risk_on' | 'neutral' | 'risk_off'
  exposure_multiplier: number
}

export interface LiveTickerState {
  priceVsSma200: number | null
  business: number | null
  timing: number | null
}

interface Props {
  theses: Thesis[]
  regime: RegimeRow | null
  live?: Record<string, LiveTickerState>
}

const MONO = 'var(--font-mono)'
const SANS = 'var(--font-dm-sans)'
const HEAD = 'var(--font-bricolage)'

const REGIME_META = {
  risk_on:  { label: 'RISK-ON',  color: '#10B981', note: 'New thesis entries allowed · full sizing' },
  neutral:  { label: 'NEUTRAL',  color: '#F59E0B', note: 'New entries allowed · half sizing' },
  risk_off: { label: 'RISK-OFF', color: '#F87171', note: 'No new thesis entries — manage existing positions by their kill conditions' },
} as const

const TIER_LABEL = { starter: 'STARTER', standard: 'STANDARD', high_conviction: 'HIGH CONVICTION' } as const

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3"
      style={{ fontFamily: MONO, color: '#9CA3AF' }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0D1117',
  border: '1px solid #1F2937',
  color: '#F9FAFB',
  fontFamily: SANS,
}

// ─── New thesis form ──────────────────────────────────────────────────────────

function NewThesisForm({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ticker, setTicker] = useState('')
  const [theme, setTheme] = useState('')
  const [claim, setClaim] = useState('')
  const [pricedIn, setPricedIn] = useState('')
  const [sizeTier, setSizeTier] = useState<Thesis['size_tier']>('standard')
  const [kills, setKills] = useState<KillCondition[]>([{ kind: 'quant', description: '' }])

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const res = await createThesis({ ticker, theme, claim, pricedIn, killConditions: kills, sizeTier })
      if (!res.success) setError(res.error ?? 'Failed')
      else onDone()
    })
  }

  return (
    <div className="rounded-lg border p-4 md:p-5 space-y-4"
      style={{ borderColor: 'rgba(245,158,11,0.25)', backgroundColor: 'rgba(245,158,11,0.03)' }}>
      <div className="flex items-center justify-between">
        <SectionLabel>New Thesis — written before entry, always</SectionLabel>
        <button onClick={onDone} aria-label="Cancel" className="p-1" style={{ color: '#6B7280' }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
          placeholder="TICKER" maxLength={10}
          className="rounded px-3 py-2 text-sm tabular-nums" style={{ ...inputStyle, fontFamily: MONO }} />
        <input value={theme} onChange={e => setTheme(e.target.value)}
          placeholder="Theme (e.g. AI capex, GLP-1 supply chain)"
          className="rounded px-3 py-2 text-sm md:col-span-2" style={inputStyle} />
      </div>

      <div>
        <div className="text-[10px] mb-1.5" style={{ fontFamily: MONO, color: '#6B7280' }}>
          THE CLAIM — what must become true for this to work
        </div>
        <textarea value={claim} onChange={e => setClaim(e.target.value)} rows={3}
          placeholder="One paragraph. If you can't write it, you don't have a thesis."
          className="w-full rounded px-3 py-2 text-sm leading-relaxed" style={inputStyle} />
      </div>

      <div>
        <div className="text-[10px] mb-1.5" style={{ fontFamily: MONO, color: '#6B7280' }}>
          WHAT&apos;S PRICED IN — what does the current price already assume?
        </div>
        <textarea value={pricedIn} onChange={e => setPricedIn(e.target.value)} rows={2}
          placeholder="e.g. Price implies ~14% growth for 10 years. Do you believe more than that?"
          className="w-full rounded px-3 py-2 text-sm leading-relaxed" style={inputStyle} />
      </div>

      <div>
        <div className="text-[10px] mb-1.5" style={{ fontFamily: MONO, color: '#6B7280' }}>
          KILL CONDITIONS — where are you wrong? Defined now, not later.
        </div>
        <div className="space-y-2">
          {kills.map((k, i) => (
            <div key={i} className="flex gap-2">
              <select value={k.kind}
                onChange={e => setKills(ks => ks.map((x, j) => j === i ? { ...x, kind: e.target.value as KillCondition['kind'] } : x))}
                className="rounded px-2 py-2 text-[10px] font-bold" style={{ ...inputStyle, fontFamily: MONO, width: 88 }}>
                <option value="quant">QUANT</option>
                <option value="qual">QUAL</option>
              </select>
              <input value={k.description}
                onChange={e => setKills(ks => ks.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                placeholder={k.kind === 'quant' ? 'e.g. Gross margin contracts 2 consecutive quarters' : 'e.g. Management pivots away from the core product'}
                className="flex-1 rounded px-3 py-2 text-sm" style={inputStyle} />
              {kills.length > 1 && (
                <button onClick={() => setKills(ks => ks.filter((_, j) => j !== i))}
                  aria-label="Remove condition" className="px-2" style={{ color: '#6B7280' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => setKills(ks => [...ks, { kind: 'quant', description: '' }])}
          className="mt-2 text-[11px] inline-flex items-center gap-1"
          style={{ fontFamily: MONO, color: '#F59E0B' }}>
          <Plus className="w-3 h-3" /> Add condition
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={sizeTier ?? 'standard'} onChange={e => setSizeTier(e.target.value as Thesis['size_tier'])}
          className="rounded px-3 py-2 text-[11px] font-bold" style={{ ...inputStyle, fontFamily: MONO }}>
          <option value="starter">SIZE: STARTER</option>
          <option value="standard">SIZE: STANDARD</option>
          <option value="high_conviction">SIZE: HIGH CONVICTION</option>
        </select>
        <button onClick={submit} disabled={pending}
          className="rounded px-4 py-2 text-xs font-bold disabled:opacity-50"
          style={{ backgroundColor: '#F59E0B', color: '#050810', fontFamily: SANS }}>
          {pending ? 'Saving…' : 'Save thesis'}
        </button>
        {error && <span className="text-xs" style={{ color: '#F87171', fontFamily: SANS }}>{error}</span>}
      </div>
    </div>
  )
}

// ─── Thesis card ──────────────────────────────────────────────────────────────

function ThesisCard({ thesis, live }: { thesis: Thesis; live?: LiveTickerState }) {
  const failsafeBreached =
    thesis.status === 'active' && thesis.trend_failsafe &&
    live?.priceVsSma200 !== null && live?.priceVsSma200 !== undefined && live.priceVsSma200 < 0
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'activate' | 'close'>('view')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [price, setPrice] = useState('')
  const [followedPlan, setFollowedPlan] = useState(true)
  const [reviewNotes, setReviewNotes] = useState('')

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.success) setError(res.error ?? 'Failed')
      else setMode('view')
    })
  }

  const outcomeColor = (thesis.outcome_pct ?? 0) >= 0 ? '#10B981' : '#F87171'

  return (
    <div className="rounded-lg border p-4 md:p-5 transition-all hover:border-[rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.06)]"
      style={{ borderColor: '#1F2937', backgroundColor: 'transparent' }}>

      {/* Head row */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link href={`/dashboard/stocks/${thesis.ticker}`}
            className="text-base font-bold tabular-nums hover:text-[#F59E0B] transition-colors"
            style={{ fontFamily: MONO, color: '#F9FAFB' }}>
            {thesis.ticker}
          </Link>
          {thesis.theme && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
              style={{ fontFamily: MONO, color: '#38BDF8', borderColor: 'rgba(56,189,248,0.25)', backgroundColor: 'rgba(56,189,248,0.06)' }}>
              {thesis.theme.toUpperCase()}
            </span>
          )}
          {thesis.size_tier && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border"
              style={{ fontFamily: MONO, color: '#9CA3AF', borderColor: '#1F2937' }}>
              {TIER_LABEL[thesis.size_tier]}
            </span>
          )}
        </div>
        {thesis.status === 'closed' && thesis.outcome_pct !== null && (
          <span className="text-sm font-bold tabular-nums" style={{ fontFamily: MONO, color: outcomeColor }}>
            {thesis.outcome_pct >= 0 ? '+' : ''}{thesis.outcome_pct.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Live failsafe breach — forced review, never an auto-exit */}
      {failsafeBreached && (
        <div className="rounded border px-3 py-2 mb-3 text-xs"
          style={{ fontFamily: SANS, color: '#F87171', borderColor: 'rgba(248,113,113,0.35)', backgroundColor: 'rgba(248,113,113,0.06)' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700 }}>TREND FAILSAFE · </span>
          {thesis.ticker} is {Math.abs(live!.priceVsSma200!).toFixed(1)}% below its 200dma — review the thesis:
          drawdown within a living thesis, or thesis broken?
        </div>
      )}

      {/* Claim */}
      <p className="text-sm leading-relaxed mb-3" style={{ fontFamily: SANS, color: '#D1D5DB' }}>
        {thesis.claim}
      </p>

      {/* Priced in */}
      {thesis.priced_in && (
        <p className="text-xs leading-relaxed mb-3 pl-3 border-l-2"
          style={{ fontFamily: SANS, color: '#9CA3AF', borderColor: 'rgba(245,158,11,0.35)' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: '#F59E0B' }}>PRICED IN · </span>
          {thesis.priced_in}
        </p>
      )}

      {/* Kill conditions */}
      <div className="space-y-1.5 mb-3">
        {thesis.kill_conditions.map((k, i) => (
          <div key={i} className="flex items-start gap-2 text-xs" style={{ fontFamily: SANS, color: k.triggered_at ? '#F87171' : '#9CA3AF' }}>
            <span className="text-[8.5px] font-bold mt-0.5 px-1 rounded border shrink-0"
              style={{ fontFamily: MONO, color: k.kind === 'quant' ? '#34D399' : '#A78BFA', borderColor: '#1F2937' }}>
              {k.kind.toUpperCase()}
            </span>
            <span className={k.triggered_at ? 'font-semibold' : ''}>
              {k.description}
              {k.triggered_at && <span style={{ fontFamily: MONO, fontSize: 9 }}> · TRIGGERED {k.triggered_at}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Entry / exit data */}
      {(thesis.entry_date || thesis.exit_date) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-[10px] tabular-nums" style={{ fontFamily: MONO, color: '#6B7280' }}>
          {thesis.entry_date && <span>ENTRY {thesis.entry_date} @ ${thesis.entry_price?.toFixed(2)}</span>}
          {thesis.exit_date && <span>EXIT {thesis.exit_date} @ ${thesis.exit_price?.toFixed(2)}</span>}
          {thesis.business_score_at_entry !== null && (
            <span>
              BIZ {thesis.business_score_at_entry}
              {thesis.status === 'active' && live?.business != null && live.business !== thesis.business_score_at_entry && (
                <span style={{ color: live.business < thesis.business_score_at_entry ? '#F87171' : '#10B981' }}>
                  {' '}→ {live.business}
                </span>
              )}
            </span>
          )}
          {thesis.timing_score_at_entry !== null && <span>TIM {thesis.timing_score_at_entry}</span>}
          {thesis.regime_at_entry && <span>REGIME {thesis.regime_at_entry.toUpperCase()}</span>}
          {thesis.followed_plan !== null && (
            <span style={{ color: thesis.followed_plan ? '#10B981' : '#F87171' }}>
              {thesis.followed_plan ? 'FOLLOWED PLAN' : 'BROKE PLAN'}
            </span>
          )}
        </div>
      )}

      {thesis.review_notes && (
        <p className="text-xs leading-relaxed mb-3" style={{ fontFamily: SANS, color: '#9CA3AF' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: '#6B7280' }}>REVIEW · </span>
          {thesis.review_notes}
        </p>
      )}

      {/* Actions */}
      {mode === 'view' && thesis.status !== 'closed' && (
        <div className="flex items-center gap-3 pt-1">
          {thesis.status === 'watching' && (
            <>
              <button onClick={() => setMode('activate')}
                className="text-[11px] font-bold rounded px-3 py-1.5"
                style={{ fontFamily: MONO, backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
                ENTERED → ACTIVATE
              </button>
              <button onClick={() => run(() => deleteThesis(thesis.id))} disabled={pending}
                aria-label="Delete thesis" className="p-1.5" style={{ color: '#4B5563' }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {thesis.status === 'active' && (
            <button onClick={() => setMode('close')}
              className="text-[11px] font-bold rounded px-3 py-1.5"
              style={{ fontFamily: MONO, backgroundColor: 'rgba(248,113,113,0.08)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              EXIT → CLOSE &amp; REVIEW
            </button>
          )}
        </div>
      )}

      {mode !== 'view' && (
        <div className="space-y-2 pt-2 border-t mt-2" style={{ borderColor: '#1F2937' }}>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="rounded px-2 py-1.5 text-xs tabular-nums" style={{ ...inputStyle, fontFamily: MONO }} />
            <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)}
              placeholder={mode === 'activate' ? 'Entry price' : 'Exit price'}
              className="rounded px-2 py-1.5 text-xs tabular-nums w-28" style={{ ...inputStyle, fontFamily: MONO }} />
          </div>
          {mode === 'close' && (
            <>
              <label className="flex items-center gap-2 text-xs" style={{ fontFamily: SANS, color: '#9CA3AF' }}>
                <input type="checkbox" checked={followedPlan} onChange={e => setFollowedPlan(e.target.checked)} />
                I followed the plan (exited on kill condition / thesis completion, not emotion)
              </label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2}
                placeholder="Review: what did this trade teach you?"
                className="w-full rounded px-3 py-2 text-xs leading-relaxed" style={inputStyle} />
            </>
          )}
          <div className="flex items-center gap-2">
            <button disabled={pending}
              onClick={() => run(() => mode === 'activate'
                ? activateThesis(thesis.id, { date, price: parseFloat(price) })
                : closeThesis(thesis.id, { date, price: parseFloat(price), followedPlan, reviewNotes }))}
              className="rounded px-3 py-1.5 text-xs font-bold disabled:opacity-50"
              style={{ backgroundColor: '#F59E0B', color: '#050810', fontFamily: SANS }}>
              {pending ? 'Saving…' : 'Confirm'}
            </button>
            <button onClick={() => setMode('view')} className="text-xs" style={{ color: '#6B7280', fontFamily: SANS }}>
              Cancel
            </button>
            {error && <span className="text-xs" style={{ color: '#F87171', fontFamily: SANS }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ThesesClient({ theses, regime, live }: Props) {
  const [showForm, setShowForm] = useState(false)

  const groups: Array<{ key: Thesis['status']; label: string }> = [
    { key: 'active', label: 'Active Positions' },
    { key: 'watching', label: 'Watching — thesis written, not entered' },
    { key: 'closed', label: 'Closed — the track record' },
  ]

  const regimeMeta = regime ? REGIME_META[regime.state] : null

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5"
            style={{ fontFamily: HEAD, color: '#F9FAFB' }}>
            <Crosshair className="w-5 h-5" style={{ color: '#F59E0B' }} />
            Theses
          </h1>
          <p className="text-xs mt-1" style={{ fontFamily: SANS, color: '#9CA3AF' }}>
            Claim → what&apos;s priced in → kill conditions → size. Written before entry, reviewed after exit.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="rounded px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
            style={{ backgroundColor: '#F59E0B', color: '#050810', fontFamily: SANS }}>
            <Plus className="w-3.5 h-3.5" /> New thesis
          </button>
        )}
      </div>

      {/* Regime gate */}
      {regimeMeta && (
        <div className="rounded-lg border px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ borderColor: `${regimeMeta.color}40`, backgroundColor: `${regimeMeta.color}08` }}>
          <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: regimeMeta.color }} />
          <span className="text-[10px] font-bold tracking-[0.1em]" style={{ fontFamily: MONO, color: regimeMeta.color }}>
            REGIME: {regimeMeta.label} · {regime!.exposure_multiplier.toFixed(1)}×
          </span>
          <span className="text-xs" style={{ fontFamily: SANS, color: '#9CA3AF' }}>{regimeMeta.note}</span>
        </div>
      )}

      {showForm && <NewThesisForm onDone={() => setShowForm(false)} />}

      {/* Groups */}
      {theses.length === 0 && !showForm ? (
        <div className="rounded-lg border p-10 text-center" style={{ borderColor: '#1F2937' }}>
          <p className="text-sm mb-2" style={{ fontFamily: HEAD, color: '#F9FAFB' }}>No theses yet.</p>
          <p className="text-xs max-w-md mx-auto leading-relaxed" style={{ fontFamily: SANS, color: '#9CA3AF' }}>
            The discipline is the edge: write the claim, what&apos;s priced in, and where you&apos;re wrong —
            BEFORE you buy. Most investors never define what would make them sell. You will.
          </p>
        </div>
      ) : (
        groups.map(g => {
          const items = theses.filter(t => t.status === g.key)
          if (items.length === 0) return null
          return (
            <section key={g.key}>
              <SectionLabel>{g.label} · {items.length}</SectionLabel>
              <div className="space-y-3">
                {items.map(t => <ThesisCard key={t.id} thesis={t} live={live?.[t.ticker]} />)}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
