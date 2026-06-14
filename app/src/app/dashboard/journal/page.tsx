import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ScrollText, ArrowRight } from 'lucide-react'
import type { Thesis } from '@/app/actions/theses'

export const metadata = {
  title: 'Journal — Qademic',
  description:
    'The scoreboard: adherence, asymmetry, and attribution vs SPY — the only honest measures of whether the process works.',
}

// The Review surface (QADEMIC.md §3 job 6, §8 surface #8). Theses shows the cards;
// the Journal turns the closed ones into the scoreboard. Hit rate is ~50-55% even
// for professionals — so this page never celebrates hit rate. The edge it tries to
// surface is asymmetry (winners bigger than losers) and adherence (followed the plan),
// measured against the only honest benchmark: just holding SPY over the same window.

const MONO = 'var(--font-mono)'
const SANS = 'var(--font-dm-sans)'
const HEAD = 'var(--font-bricolage)'
const POS = '#10B981'
const NEG = '#F87171'
const AMBER = '#F59E0B'
const MUTED = '#9CA3AF'
const GHOST = '#6B7280'

type SpyRow = { date: string; close: number }

// Last SPY close on or before `date`. Rows must be ascending by date.
function spyCloseAsOf(rows: SpyRow[], date: string): number | null {
  let found: number | null = null
  for (const r of rows) {
    if (r.date <= date) found = r.close
    else break
  }
  return found
}

function spyReturnPct(rows: SpyRow[], entry: string, exit: string): number | null {
  const e = spyCloseAsOf(rows, entry)
  const x = spyCloseAsOf(rows, exit)
  if (e == null || x == null || e === 0) return null
  return ((x - e) / e) * 100
}

function heldDays(entry: string, exit: string): number {
  return Math.max(0, Math.round((new Date(exit).getTime() - new Date(entry).getTime()) / 86400000))
}

function signed(n: number, digits = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`
}

interface ClosedRow {
  t: Thesis
  held: number | null
  spy: number | null
  alpha: number | null
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: '#1F2937' }}>
      <div className="text-[9px] uppercase tracking-[0.12em] mb-2" style={{ fontFamily: MONO, color: GHOST }}>
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums leading-none" style={{ fontFamily: MONO, color: color ?? '#F9FAFB' }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] mt-1.5 leading-snug" style={{ fontFamily: SANS, color: MUTED }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ fontFamily: MONO, color: MUTED }}>
      {children}
    </div>
  )
}

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: thesesData } = await supabase
    .from('theses')
    .select('*')
    .order('created_at', { ascending: false })
  const theses = (thesesData ?? []) as Thesis[]

  const closed = theses.filter(t => t.status === 'closed')
  const activeCount = theses.filter(t => t.status === 'active').length
  const watchingCount = theses.filter(t => t.status === 'watching').length

  // SPY attribution: pull SPY history back to the earliest entry, compare like-for-like.
  const entryDates = closed.map(t => t.entry_date).filter((d): d is string => !!d)
  let spyRows: SpyRow[] = []
  if (entryDates.length > 0) {
    const earliest = entryDates.reduce((a, b) => (a < b ? a : b))
    const { data } = await supabase
      .from('ohlcv_daily')
      .select('date, close')
      .eq('ticker', 'SPY')
      .gte('date', earliest)
      .order('date', { ascending: true })
    spyRows = (data ?? []) as SpyRow[]
  }

  const rows: ClosedRow[] = closed.map(t => {
    const held = t.entry_date && t.exit_date ? heldDays(t.entry_date, t.exit_date) : null
    const spy = t.entry_date && t.exit_date ? spyReturnPct(spyRows, t.entry_date, t.exit_date) : null
    const alpha = t.outcome_pct != null && spy != null ? t.outcome_pct - spy : null
    return { t, held, spy, alpha }
  })

  // ── Scoreboard aggregates (realized only) ──────────────────────────────────
  const withOutcome = closed.filter(t => t.outcome_pct != null)
  const withPlan = closed.filter(t => t.followed_plan != null)
  const adherence = withPlan.length > 0
    ? Math.round((withPlan.filter(t => t.followed_plan).length / withPlan.length) * 100)
    : null
  const hitRate = withOutcome.length > 0
    ? Math.round((withOutcome.filter(t => (t.outcome_pct as number) > 0).length / withOutcome.length) * 100)
    : null

  const winners = withOutcome.filter(t => (t.outcome_pct as number) > 0).map(t => t.outcome_pct as number)
  const losers = withOutcome.filter(t => (t.outcome_pct as number) <= 0).map(t => t.outcome_pct as number)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const avgWinner = avg(winners)
  const avgLoser = avg(losers)
  const avgOutcome = avg(withOutcome.map(t => t.outcome_pct as number))
  // Asymmetry ratio: how many times bigger is the average winner than the average loser?
  const asymmetry = avgWinner != null && avgLoser != null && avgLoser !== 0
    ? avgWinner / Math.abs(avgLoser)
    : null

  const alphas = rows.map(r => r.alpha).filter((a): a is number => a != null)
  const avgAlpha = avg(alphas)
  const beatSpy = alphas.length > 0 ? alphas.filter(a => a > 0).length : null

  const hasRecord = closed.length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ fontFamily: HEAD, color: '#F9FAFB' }}>
            <ScrollText className="w-5 h-5" style={{ color: AMBER }} />
            Journal
          </h1>
          <p className="text-xs mt-1 max-w-xl leading-relaxed" style={{ fontFamily: SANS, color: MUTED }}>
            The scoreboard. Hit rate is ~50–55% even for professionals, so it is never the point —
            the edge, if there is one, is <span style={{ color: '#D1D5DB' }}>asymmetry</span> (winners
            bigger than losers), <span style={{ color: '#D1D5DB' }}>adherence</span> (you followed your
            own plan), and <span style={{ color: '#D1D5DB' }}>alpha vs simply holding SPY</span>.
          </p>
        </div>
        <Link href="/dashboard/theses"
          className="rounded px-3 py-2 text-[11px] font-bold inline-flex items-center gap-1.5 shrink-0"
          style={{ fontFamily: MONO, border: '1px solid #1F2937', color: MUTED }}>
          Theses <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {!hasRecord ? (
        <div className="rounded-lg border p-10 text-center" style={{ borderColor: '#1F2937' }}>
          <p className="text-sm mb-2" style={{ fontFamily: HEAD, color: '#F9FAFB' }}>No closed theses yet.</p>
          <p className="text-xs max-w-md mx-auto leading-relaxed mb-4" style={{ fontFamily: SANS, color: MUTED }}>
            The track record builds itself, one closed thesis at a time. Write a thesis, enter, and
            when you exit — on a kill condition or because the thesis played out — the scoreboard
            starts here: adherence, asymmetry, and how you did versus just holding SPY.
          </p>
          {(activeCount > 0 || watchingCount > 0) && (
            <p className="text-[10px]" style={{ fontFamily: MONO, color: GHOST }}>
              {activeCount} active · {watchingCount} watching · 0 closed
            </p>
          )}
          <Link href="/dashboard/theses"
            className="inline-flex items-center gap-1.5 mt-5 rounded px-4 py-2 text-xs font-bold"
            style={{ backgroundColor: AMBER, color: '#050810', fontFamily: SANS }}>
            Go to Theses <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Scoreboard */}
          <section>
            <SectionLabel>Scoreboard · {closed.length} closed · {activeCount} open</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                label="Avg alpha vs SPY"
                value={avgAlpha != null ? `${signed(avgAlpha)}pp` : '—'}
                color={avgAlpha != null ? (avgAlpha >= 0 ? POS : NEG) : MUTED}
                sub={beatSpy != null ? `Beat SPY on ${beatSpy} of ${alphas.length} closed` : 'Needs SPY price history'}
              />
              <StatCard
                label="Adherence"
                value={adherence != null ? `${adherence}%` : '—'}
                color={adherence != null ? (adherence >= 80 ? POS : adherence >= 50 ? AMBER : NEG) : MUTED}
                sub="Exited on plan, not emotion"
              />
              <StatCard
                label="Asymmetry"
                value={asymmetry != null ? `${asymmetry.toFixed(2)}×` : '—'}
                color={asymmetry != null ? (asymmetry >= 1 ? POS : NEG) : MUTED}
                sub={avgWinner != null && avgLoser != null
                  ? `Avg winner ${signed(avgWinner)}% vs loser ${signed(avgLoser)}%`
                  : 'Winner vs loser size'}
              />
              <StatCard
                label="Hit rate"
                value={hitRate != null ? `${hitRate}%` : '—'}
                color={MUTED}
                sub={`${winners.length}W / ${losers.length}L — not the point`}
              />
              <StatCard
                label="Avg outcome"
                value={avgOutcome != null ? `${signed(avgOutcome)}%` : '—'}
                color={avgOutcome != null ? (avgOutcome >= 0 ? POS : NEG) : MUTED}
                sub="Mean realized return per thesis"
              />
              <StatCard
                label="Decisions logged"
                value={`${closed.length}`}
                color="#F9FAFB"
                sub="Closed theses in the record"
              />
            </div>
          </section>

          {/* Attribution table */}
          <section>
            <SectionLabel>Attribution — every closed thesis vs holding SPY over the same window</SectionLabel>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#1F2937' }}>
              <div className="hidden md:grid grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr] gap-2 px-4 py-2.5 border-b text-[9px] font-bold uppercase tracking-[0.1em]"
                style={{ borderColor: '#1F2937', fontFamily: MONO, color: GHOST }}>
                <span>Thesis</span>
                <span className="text-right">Held</span>
                <span className="text-right">Outcome</span>
                <span className="text-right">SPY</span>
                <span className="text-right">Alpha</span>
                <span className="text-right">Plan</span>
              </div>
              {rows.map(({ t, held, spy, alpha }) => (
                <div key={t.id}
                  className="grid grid-cols-2 md:grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-b last:border-b-0 items-center"
                  style={{ borderColor: '#1F2937' }}>
                  <div className="col-span-2 md:col-span-1 min-w-0">
                    <Link href={`/dashboard/stocks/${t.ticker}`}
                      className="text-sm font-bold tabular-nums hover:text-[#F59E0B] transition-colors"
                      style={{ fontFamily: MONO, color: '#F9FAFB' }}>
                      {t.ticker}
                    </Link>
                    {t.theme && (
                      <span className="ml-2 text-[9px]" style={{ fontFamily: MONO, color: '#38BDF8' }}>
                        {t.theme.toUpperCase()}
                      </span>
                    )}
                    <div className="text-[10px] mt-0.5 md:hidden" style={{ fontFamily: MONO, color: GHOST }}>
                      {t.exit_date}
                    </div>
                  </div>
                  <span className="text-right text-xs tabular-nums" style={{ fontFamily: MONO, color: MUTED }}>
                    {held != null ? `${held}d` : '—'}
                  </span>
                  <span className="text-right text-xs font-bold tabular-nums"
                    style={{ fontFamily: MONO, color: t.outcome_pct == null ? MUTED : t.outcome_pct >= 0 ? POS : NEG }}>
                    {t.outcome_pct != null ? `${signed(t.outcome_pct)}%` : '—'}
                  </span>
                  <span className="text-right text-xs tabular-nums" style={{ fontFamily: MONO, color: MUTED }}>
                    {spy != null ? `${signed(spy)}%` : '—'}
                  </span>
                  <span className="text-right text-xs font-bold tabular-nums"
                    style={{ fontFamily: MONO, color: alpha == null ? MUTED : alpha >= 0 ? POS : NEG }}>
                    {alpha != null ? `${signed(alpha)}pp` : '—'}
                  </span>
                  <span className="text-right text-[9px] font-bold tabular-nums"
                    style={{ fontFamily: MONO, color: t.followed_plan == null ? MUTED : t.followed_plan ? POS : NEG }}>
                    {t.followed_plan == null ? '—' : t.followed_plan ? 'KEPT' : 'BROKE'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-2 leading-relaxed" style={{ fontFamily: SANS, color: GHOST }}>
              Alpha = thesis outcome − SPY return over the identical hold window (SPY priced from our own
              daily history). It is the only benchmark that matters: beating the index you could have
              bought for free, after the fact, with discipline.
            </p>
          </section>

          {/* Decision timeline — the reviews, where the learning lives */}
          {closed.some(t => t.review_notes) && (
            <section>
              <SectionLabel>Reviews — what each closed trade taught</SectionLabel>
              <div className="space-y-3">
                {closed.filter(t => t.review_notes).map(t => (
                  <div key={t.id} className="rounded-lg border p-4" style={{ borderColor: '#1F2937' }}>
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span className="text-sm font-bold tabular-nums" style={{ fontFamily: MONO, color: '#F9FAFB' }}>
                        {t.ticker}
                      </span>
                      {t.outcome_pct != null && (
                        <span className="text-xs font-bold tabular-nums"
                          style={{ fontFamily: MONO, color: t.outcome_pct >= 0 ? POS : NEG }}>
                          {signed(t.outcome_pct)}%
                        </span>
                      )}
                      <span className="text-[10px] tabular-nums" style={{ fontFamily: MONO, color: GHOST }}>
                        {t.entry_date} → {t.exit_date}
                      </span>
                      {t.followed_plan != null && (
                        <span className="text-[9px] font-bold" style={{ fontFamily: MONO, color: t.followed_plan ? POS : NEG }}>
                          {t.followed_plan ? 'FOLLOWED PLAN' : 'BROKE PLAN'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ fontFamily: SANS, color: '#D1D5DB' }}>
                      {t.review_notes}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
