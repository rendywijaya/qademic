import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, BookOpen } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Methodology — Qademic',
  description:
    'Every signal defined, every construction cited, every output tracked forward in public. The complete Qademic methodology.',
}

export const revalidate = 3600

// The Proof surface (QADEMIC.md §3 job 6, §10). Public by design — trust is the
// product. Describes what is LIVE, never what is planned; aspirational features
// are labeled as such explicitly.

const MONO = 'var(--font-mono)'
const SANS = 'var(--font-dm-sans)'
const HEAD = 'var(--font-bricolage)'

function daysSince(date: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 86400000) + 1)
}

const SIGNALS: Array<{ layer: string; color: string; construction: string; evidence: string }> = [
  {
    layer: 'Q1 Macro → Regime',
    color: '#A78BFA',
    construction:
      'Five components, fixed conventional thresholds: SPY vs 200dma (trend), % of 11 sector ETFs above own 200dma (breadth), VIX level (volatility), high-yield credit spread level + 3-month change (credit), 10y−2y Treasury spread (curve). Sum ∈ [−5,+5] → risk-on / neutral / risk-off; state flips need 2 consecutive closes. Regime gates exposure — it never adds points to any stock.',
    evidence: 'Faber (2007) — trend-following reduces drawdowns; credit spreads as risk gauge',
  },
  {
    layer: 'Q2 Sector → Rotation',
    color: '#38BDF8',
    construction:
      'Relative strength = sector ETF return minus SPY return over 1m / 3m / 6m, computed from our own stored daily prices. Sectors ranked by 3m RS; four-phase read (leading / improving / weakening / lagging) from RS level + 1m pace. Context for theme selection — not a stock-score input.',
    evidence: 'Moskowitz & Grinblatt (1999) — industry momentum persists for months',
  },
  {
    layer: 'Q3 Fundamental',
    color: '#34D399',
    construction:
      'Profitability (gross profitability, FCF margin), growth (revenue YoY), returns (ROE/ROIC), balance sheet (D/E), valuation context — scored from cited fundamentals, then converted to a sector-neutral percentile rank across the universe before it enters the Business score (ranks, not absolute levels).',
    evidence: 'Novy-Marx (2013) gross profitability; Piotroski (2000) F-score',
  },
  {
    layer: 'Q4 Quant',
    color: '#F59E0B',
    construction:
      'Price vs 200/50/20dma, momentum over 1–12 month windows, RSI position, volume confirmation — computed nightly from daily OHLCV. No intraday data, by design.',
    evidence: 'Jegadeesh & Titman (1993) — 12-1 momentum, the most replicated anomaly in finance',
  },
  {
    layer: 'Q5 Smart Money',
    color: '#FB7185',
    construction:
      'Insider transactions (SEC Form 4 via aggregator), analyst recommendation trends. Migrating to opportunistic-vs-routine insider classification and rating changes (changes predict; levels do not).',
    evidence: 'Cohen, Malloy & Pomorski (2012) — decoding inside information',
  },
  {
    layer: 'Q6 Management',
    color: '#34D399',
    construction:
      'ROIC level and trend, debt trajectory, capital allocation quality from reported statements.',
    evidence: 'Sloan (1996) — accruals quality predicts returns',
  },
  {
    layer: 'Q7 Catalyst',
    color: '#F97316',
    construction:
      'Days to next earnings, beat streak, post-earnings reaction context.',
    evidence: 'Ball & Brown (1968) — post-earnings-announcement drift, replicated for 50+ years',
  },
]

export default async function MethodologyPage() {
  const supabase = await createClient()

  // Live forward-record counters — the Proof page reports its own data honestly
  const [{ count: snapshotCount }, { data: firstSnap }, { data: validationRows }] = await Promise.all([
    supabase.from('score_history').select('*', { count: 'exact', head: true }),
    supabase.from('score_history').select('scored_date').order('scored_date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('signal_validation').select('*'),
  ])
  const since = firstSnap?.scored_date ?? null
  const daysAccruing = since ? daysSince(since) : 0

  const validation = (validationRows ?? []) as Array<{
    signal: string; window_days: number; cohorts: number; n_observations: number
    top_avg_fwd: number | null; bottom_avg_fwd: number | null; spread: number | null
    universe_avg_fwd: number | null; spy_avg_fwd: number | null
    first_cohort_date: string | null; last_cohort_date: string | null
  }>
  const SIGNAL_LABEL: Record<string, string> = { setup_score: 'Setup score', business_score: 'Business score' }
  const maturedValidation = validation.filter(v => v.cohorts > 0).sort((a, b) => a.signal.localeCompare(b.signal))
  const fwd = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#050810', color: '#F9FAFB' }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14">

        <Link href="/" className="inline-flex items-center gap-1.5 text-xs mb-8"
          style={{ fontFamily: MONO, color: '#6B7280' }}>
          <ArrowLeft className="w-3.5 h-3.5" /> qademic.com
        </Link>

        <div className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.15em] uppercase mb-4 px-2.5 py-1 rounded border"
          style={{ fontFamily: MONO, color: '#F59E0B', borderColor: 'rgba(245,158,11,0.25)', backgroundColor: 'rgba(245,158,11,0.06)' }}>
          <BookOpen className="w-3 h-3" />
          Methodology · Public by design
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: HEAD }}>
          Every signal defined.<br />
          Every construction <span style={{ color: '#F59E0B' }}>cited</span>.<br />
          Every output tracked, in public.
        </h1>

        <p className="text-sm leading-relaxed mb-10 max-w-xl" style={{ fontFamily: SANS, color: '#9CA3AF' }}>
          Qademic is deterministic: the same inputs always produce the same scores, and the
          construction of every signal is published here. We did not invent these factors —
          each one stands on decades of peer-reviewed evidence. AI never scores, sizes, or
          predicts; it only reads documents. This page describes what is <em>live</em> today,
          not what is planned.
        </p>

        {/* The three outputs */}
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: HEAD }}>The three outputs</h2>
        <div className="rounded-lg border p-4 mb-10 text-xs leading-relaxed space-y-2"
          style={{ borderColor: '#1F2937', fontFamily: SANS, color: '#D1D5DB' }}>
          <p><span style={{ fontFamily: MONO, color: '#34D399', fontWeight: 700 }}>BUSINESS </span>
            = mean of the sector-neutral percentile ranks of Q3 and Q6. &ldquo;Versus comparable
            companies, is this a good business at a fair price?&rdquo; Moves quarterly.</p>
          <p><span style={{ fontFamily: MONO, color: '#F59E0B', fontWeight: 700 }}>TIMING </span>
            = mean of the sector-neutral percentile ranks of Q4, Q5 and Q7. &ldquo;Versus comparable
            companies, is now a good entry?&rdquo; Moves daily.</p>
          <p><span style={{ fontFamily: MONO, color: '#A78BFA', fontWeight: 700 }}>REGIME </span>
            = market-wide gate. Scales exposure and gates new entries. It is identical for every
            stock, so it can never move a stock&apos;s rank — blending it in would shift the whole
            universe together and pollute stock-vs-stock comparison.</p>
          <p style={{ color: '#9CA3AF' }}>
            Each pillar is ranked sector-neutral (percentile vs comparable companies; thin sectors
            fall back to a whole-universe rank), then the ranks combine with equal weights (1/N).
            Ranks, not absolute levels — and weights are never tuned to backtests, because naive
            equal-weight combination is brutally hard to beat out-of-sample (DeMiguel, Garlappi &amp;
            Uppal 2009). Grades describe entry quality (Timing, with a Business floor) — never
            buy/sell instructions.
          </p>
        </div>

        {/* Signal table */}
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: HEAD }}>The layers, with receipts</h2>
        <div className="space-y-3 mb-10">
          {SIGNALS.map(s => (
            <div key={s.layer} className="rounded-lg border p-4" style={{ borderColor: '#1F2937' }}>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2"
                style={{ fontFamily: MONO, color: s.color }}>
                {s.layer}
              </div>
              <p className="text-xs leading-relaxed mb-2" style={{ fontFamily: SANS, color: '#D1D5DB' }}>
                {s.construction}
              </p>
              <p className="text-[10px]" style={{ fontFamily: MONO, color: '#6B7280' }}>
                EVIDENCE · {s.evidence}
              </p>
            </div>
          ))}
        </div>

        {/* Validation doctrine */}
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: HEAD }}>How we validate — and what we refuse to fake</h2>
        <div className="rounded-lg border p-4 mb-6 text-xs leading-relaxed space-y-2.5"
          style={{ borderColor: '#1F2937', fontFamily: SANS, color: '#D1D5DB' }}>
          <p>
            <strong>Price-based signals are backtested</strong> — prices are honest point-in-time
            data. Components with no decile spread get removed; weights are never tuned.
          </p>
          <p>
            <strong>Fundamental signals are NOT backtested by us.</strong> Vendor fundamentals are
            restated over time; backtesting them looks rigorous and is quietly a lie. The academic
            literature above is the backtest — done on clean data, by people better at it than us.
          </p>
          <p>
            <strong>Everything is tracked forward instead.</strong> Scores are snapshotted daily to
            an append-only history. As the record matures, this page will show — live and
            unfakeable — how stocks we ranked highly actually performed versus stocks we ranked
            poorly, and versus simply holding SPY.
          </p>
        </div>

        {/* Live record counter */}
        <div className="rounded-lg border p-4 mb-10 flex flex-wrap gap-x-8 gap-y-2"
          style={{ borderColor: 'rgba(245,158,11,0.25)', backgroundColor: 'rgba(245,158,11,0.03)' }}>
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] mb-1" style={{ fontFamily: MONO, color: '#6B7280' }}>
              FORWARD RECORD ACCRUING SINCE
            </div>
            <div className="text-sm font-bold tabular-nums" style={{ fontFamily: MONO, color: '#F59E0B' }}>
              {since ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] mb-1" style={{ fontFamily: MONO, color: '#6B7280' }}>
              DAYS OF HISTORY
            </div>
            <div className="text-sm font-bold tabular-nums" style={{ fontFamily: MONO, color: '#F9FAFB' }}>
              {daysAccruing}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] mb-1" style={{ fontFamily: MONO, color: '#6B7280' }}>
              SCORE SNAPSHOTS
            </div>
            <div className="text-sm font-bold tabular-nums" style={{ fontFamily: MONO, color: '#F9FAFB' }}>
              {snapshotCount ?? 0}
            </div>
          </div>
          <div className="w-full text-[10px] leading-relaxed" style={{ fontFamily: SANS, color: '#6B7280' }}>
            First forward-cohort statistics publish automatically once 30-day windows mature.
            No numbers will appear here before the data exists.
          </div>
        </div>

        {/* Forward-cohort decile spread — publishes itself only once windows mature */}
        {maturedValidation.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold mb-1" style={{ fontFamily: HEAD }}>The forward record, live</h2>
            <p className="text-xs leading-relaxed mb-4 max-w-xl" style={{ fontFamily: SANS, color: '#9CA3AF' }}>
              On each historical date we split the scored universe into a top decile and a bottom
              decile, then measured every stock&apos;s return over the next 30 days. Averaged across
              cohorts, on prices that were real on the day. The benchmark is simply holding SPY.
            </p>
            <div className="space-y-3">
              {maturedValidation.map(v => {
                const beatSpy = v.spread != null && v.spy_avg_fwd != null
                return (
                  <div key={`${v.signal}-${v.window_days}`} className="rounded-lg border p-4"
                    style={{ borderColor: '#1F2937' }}>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <span className="text-[10px] font-bold tracking-[0.12em] uppercase"
                        style={{ fontFamily: MONO, color: '#F59E0B' }}>
                        {SIGNAL_LABEL[v.signal] ?? v.signal} · {v.window_days}-day forward
                      </span>
                      <span className="text-[9px]" style={{ fontFamily: MONO, color: '#6B7280' }}>
                        {v.cohorts} cohorts · {v.n_observations} obs · {v.first_cohort_date}→{v.last_cohort_date}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'TOP DECILE', value: fwd(v.top_avg_fwd), color: '#10B981' },
                        { label: 'BOTTOM DECILE', value: fwd(v.bottom_avg_fwd), color: '#F87171' },
                        { label: 'SPREAD', value: fwd(v.spread), color: v.spread != null && v.spread >= 0 ? '#10B981' : '#F87171' },
                        { label: 'VS HOLDING SPY', value: fwd(v.spy_avg_fwd), color: '#9CA3AF' },
                      ].map(c => (
                        <div key={c.label}>
                          <div className="text-[9px] uppercase tracking-[0.1em] mb-1" style={{ fontFamily: MONO, color: '#6B7280' }}>
                            {c.label}
                          </div>
                          <div className="text-base font-bold tabular-nums" style={{ fontFamily: MONO, color: c.color }}>
                            {c.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    {beatSpy && (
                      <p className="text-[10px] mt-3 leading-relaxed" style={{ fontFamily: SANS, color: '#6B7280' }}>
                        Top-decile average vs SPY over the same windows:{' '}
                        <span style={{ color: (v.top_avg_fwd ?? 0) >= (v.spy_avg_fwd ?? 0) ? '#10B981' : '#F87171' }}>
                          {fwd((v.top_avg_fwd ?? 0) - (v.spy_avg_fwd ?? 0))}
                        </span>. Early, small-sample, and survivorship-caveated — but real and unfaked.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Known limitations */}
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: HEAD }}>Known limitations, stated plainly</h2>
        <ul className="text-xs leading-relaxed space-y-2 mb-10 list-disc pl-4"
          style={{ fontFamily: SANS, color: '#9CA3AF' }}>
          <li>Universe is currently ~45 large caps expanding toward the S&amp;P 500; cross-sectional scores get more meaningful as the universe grows.</li>
          <li>Business and Timing are sector-neutral percentile ranks; sectors with fewer than eight comparable scored names fall back to a whole-universe rank until coverage grows.</li>
          <li>Using current index members introduces survivorship bias in any historical study; all such outputs carry this caveat.</li>
          <li>Hit rates in markets are ~50–55% even for professionals. The edge — if any — is asymmetry and risk discipline, not prediction. We will never claim otherwise.</li>
        </ul>

        <p className="text-[10px] leading-relaxed border-t pt-5" style={{ fontFamily: SANS, color: '#6B7280', borderColor: '#1F2937' }}>
          Qademic is an educational research framework providing general information only. It does
          not consider your objectives, financial situation or needs, and is not financial advice.
          Nothing here is a recommendation to buy or sell any security.
        </p>
      </div>
    </div>
  )
}
