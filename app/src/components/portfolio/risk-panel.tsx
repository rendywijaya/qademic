import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { gradeMeta, toGrade, GRADE_META, type Grade } from '@/lib/grades'
import {
  AlertTriangle, CheckCircle, ArrowRight, PieChart, Activity, Layers, BarChart3,
} from 'lucide-react'
import type { PortfolioHolding } from '@/lib/supabase/types'

// Risk & exposure analytics (QADEMIC.md §8 — Portfolio & Risk is one surface).
// Server component: composes under the holdings editor on /dashboard/portfolio.
// Value-weighted concentration, trend health, theme overlap, regime exposure,
// and weak-link identification — all from the nightly scores. Not advice.

interface Q7Score {
  ticker: string; sector: string | null; setup_score: number; recommendation: string
  q1_score: number | null; q2_score: number | null; q3_score: number | null
  q4_score: number | null; q5_score: number | null; verdict: string | null
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const cfg = {
    low:    { color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)', label: 'LOW RISK' },
    medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', label: 'MEDIUM RISK' },
    high:   { color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)', label: 'HIGH RISK' },
  }[level]
  return (
    <span className="text-[9px] px-2 py-0.5 rounded border font-bold"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border, fontFamily: 'var(--font-mono)' }}>
      {cfg.label}
    </span>
  )
}

function ScoreBar({ score, max = 100, color }: { score: number; max?: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full" style={{ width: `${(score / max) * 100}%`, backgroundColor: color }} />
    </div>
  )
}

export default async function RiskPanel({ holdings }: { holdings: PortfolioHolding[] }) {
  if (holdings.length === 0) return null

  const supabase = await createClient()
  const tickers = holdings.map(h => h.ticker)

  const [{ data: q7Rows }, { data: regime }, { data: signalRows }, { data: thesisRows }] = await Promise.all([
    supabase
      .from('stock_q7_scores')
      .select('ticker, sector, setup_score, recommendation, price, q1_score, q2_score, q3_score, q4_score, q5_score, verdict')
      .in('ticker', tickers),
    supabase
      .from('regime_daily')
      .select('date, state, exposure_multiplier')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('stock_signals').select('ticker, price_vs_sma200').in('ticker', tickers),
    supabase.from('theses').select('ticker, theme').eq('status', 'active'),
  ])

  const q7Map = new Map<string, Q7Score & { price: number | null }>(
    (q7Rows ?? []).map((r: Q7Score & { price: number | null }) => [r.ticker, r])
  )
  const sma200Map = new Map((signalRows ?? []).map(s => [s.ticker as string, s.price_vs_sma200 as number | null]))

  // 1. Sector concentration — value-weighted (shares × last price, cost as fallback)
  const valueByTicker: Record<string, number> = {}
  holdings.forEach(h => {
    const px = q7Map.get(h.ticker)?.price ?? h.avg_cost_usd
    valueByTicker[h.ticker] = (valueByTicker[h.ticker] ?? 0) + h.shares * px
  })
  const totalValue = Object.values(valueByTicker).reduce((a, b) => a + b, 0) || 1

  const sectorValues: Record<string, { value: number; stocks: string[] }> = {}
  Object.entries(valueByTicker).forEach(([t, value]) => {
    const sector = q7Map.get(t)?.sector ?? 'Unknown'
    sectorValues[sector] = {
      value: (sectorValues[sector]?.value ?? 0) + value,
      stocks: [...(sectorValues[sector]?.stocks ?? []), t],
    }
  })
  const sectorConcentration = Object.entries(sectorValues)
    .map(([sector, { value, stocks }]) => ({ sector, count: stocks.length, pct: Math.round((value / totalValue) * 100), stocks }))
    .sort((a, b) => b.pct - a.pct)
  const topSectorPct = sectorConcentration[0]?.pct ?? 0
  const concentrationRisk: 'low' | 'medium' | 'high' = topSectorPct > 50 ? 'high' : topSectorPct > 35 ? 'medium' : 'low'

  // 2. Trend health — value-weighted % of portfolio above its 200dma
  let valueAbove200 = 0
  let valueWithSignal = 0
  Object.entries(valueByTicker).forEach(([t, value]) => {
    const vs200 = sma200Map.get(t)
    if (vs200 === null || vs200 === undefined) return
    valueWithSignal += value
    if (vs200 >= 0) valueAbove200 += value
  })
  const trendHealthPct = valueWithSignal > 0 ? Math.round((valueAbove200 / valueWithSignal) * 100) : null
  const trendRisk: 'low' | 'medium' | 'high' = trendHealthPct === null ? 'medium' : trendHealthPct >= 70 ? 'low' : trendHealthPct >= 40 ? 'medium' : 'high'

  // 3. Theme concentration — several "different" stocks can be one bet
  const themeCounts: Record<string, string[]> = {}
  ;(thesisRows ?? []).forEach(t => {
    const theme = (t.theme as string | null)?.trim()
    if (!theme) return
    themeCounts[theme] = [...(themeCounts[theme] ?? []), t.ticker as string]
  })
  const themeConcentration = Object.entries(themeCounts)
    .map(([theme, stocks]) => ({ theme, stocks }))
    .sort((a, b) => b.stocks.length - a.stocks.length)
  const crowdedThemes = themeConcentration.filter(t => t.stocks.length >= 3)

  // 4. Setup score distribution
  const scoredHoldings = tickers.filter(t => q7Map.has(t))
  const scores = scoredHoldings.map(t => q7Map.get(t)!.setup_score)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const minScore = scores.length > 0 ? Math.min(...scores) : null
  const maxScore = scores.length > 0 ? Math.max(...scores) : null
  const recDistribution = scoredHoldings.reduce<Record<string, number>>((acc, t) => {
    const grade = toGrade(q7Map.get(t)?.recommendation, q7Map.get(t)?.setup_score)
    acc[grade] = (acc[grade] ?? 0) + 1
    return acc
  }, {})

  // 5. Weak links: holdings with low setup score
  const weakLinks = scoredHoldings
    .map(t => ({ ticker: t, score: q7Map.get(t)!.setup_score, rec: q7Map.get(t)!.recommendation }))
    .filter(h => h.score < 45 || ['D', 'F'].includes(toGrade(h.rec, h.score)))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)

  // 6. Unanalyzed holdings
  const unanalyzed = tickers.filter(t => !q7Map.has(t))

  return (
    <div className="space-y-6 mt-10">
      <div className="flex items-center gap-2 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
        <div className="text-[9px] uppercase tracking-[0.15em]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
          RISK &amp; EXPOSURE · {tickers.length} HOLDINGS · {scoredHoldings.length} ANALYZED
        </div>
      </div>

      {/* ── Regime context — exposure is gated market-wide, not per stock ── */}
      {regime && (() => {
        const meta = ({
          risk_on:  { label: 'RISK-ON',  color: '#10B981', note: 'Full sizing on new theses' },
          neutral:  { label: 'NEUTRAL',  color: '#F59E0B', note: 'Half sizing on new theses' },
          risk_off: { label: 'RISK-OFF', color: '#F87171', note: 'No new thesis entries — existing positions managed by their kill conditions' },
        } as const)[regime.state as 'risk_on' | 'neutral' | 'risk_off']
        return (
          <Link href="/flows" className="block rounded-lg border px-4 py-3"
            style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}08` }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-bold tracking-[0.12em]"
                style={{ fontFamily: 'var(--font-mono)', color: meta.color }}>
                REGIME: {meta.label} · {Number(regime.exposure_multiplier).toFixed(1)}×
              </span>
              <span className="text-xs" style={{ color: '#9CA3AF' }}>{meta.note}</span>
              <ArrowRight className="w-3 h-3 ml-auto" style={{ color: '#6B7280' }} />
            </div>
          </Link>
        )
      })()}

      {/* ── TOP ROW: 3 KPI cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="text-[9px] uppercase tracking-[0.12em] mb-2" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
            AVG SETUP SCORE
          </div>
          {avgScore != null ? (
            <>
              <div className="text-4xl font-black tabular-nums mb-1"
                style={{ fontFamily: 'var(--font-mono)', color: avgScore >= 70 ? '#10B981' : avgScore >= 50 ? '#F59E0B' : '#F87171' }}>
                {avgScore}
              </div>
              <div className="text-[10px]" style={{ color: '#6B7280' }}>Range: {minScore}–{maxScore}</div>
            </>
          ) : (
            <div className="text-2xl font-bold" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>—</div>
          )}
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="text-[9px] uppercase tracking-[0.12em] mb-2" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
            CONCENTRATION
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-black tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: topSectorPct > 50 ? '#F87171' : topSectorPct > 35 ? '#F59E0B' : '#10B981' }}>
              {topSectorPct}%
            </span>
          </div>
          <div className="text-[10px]" style={{ color: '#6B7280' }}>
            {sectorConcentration[0]?.sector ?? '—'} (top sector)
          </div>
          <div className="mt-2"><RiskBadge level={concentrationRisk} /></div>
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="text-[9px] uppercase tracking-[0.12em] mb-2" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
            TREND HEALTH
          </div>
          <div className="text-4xl font-black tabular-nums mb-1"
            style={{ fontFamily: 'var(--font-mono)', color: trendHealthPct != null ? (trendHealthPct >= 70 ? '#10B981' : trendHealthPct >= 40 ? '#F59E0B' : '#F87171') : '#6B7280' }}>
            {trendHealthPct != null ? `${trendHealthPct}%` : '—'}
          </div>
          <div className="text-[10px]" style={{ color: '#6B7280' }}>of portfolio value above its 200dma</div>
          <div className="mt-2"><RiskBadge level={trendRisk} /></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sector Breakdown */}
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <div className="text-[10px] uppercase tracking-[0.12em] font-bold"
              style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
              SECTOR CONCENTRATION
            </div>
          </div>
          <div className="space-y-3">
            {sectorConcentration.map(({ sector, pct, stocks }) => {
              const barColor = pct > 50 ? '#F87171' : pct > 35 ? '#F59E0B' : '#10B981'
              return (
                <div key={sector}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{sector}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>
                        {stocks.join(', ')}
                      </span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: barColor, fontFamily: 'var(--font-mono)' }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <ScoreBar score={pct} color={barColor} />
                </div>
              )
            })}
          </div>
          {concentrationRisk === 'high' && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#F87171' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: '#F87171' }}>
                Portfolio is heavily concentrated in {sectorConcentration[0]?.sector}. Consider diversifying to reduce sector-specific risk.
              </p>
            </div>
          )}
        </section>

        {/* Setup Score Distribution */}
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <div className="text-[10px] uppercase tracking-[0.12em] font-bold"
              style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
              SETUP SCORE DISTRIBUTION
            </div>
          </div>
          {scoredHoldings.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>No scores yet for your holdings.</p>
              <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>Run the nightly score-stocks pipeline.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {scoredHoldings
                  .map(t => ({ ticker: t, score: q7Map.get(t)!.setup_score, rec: q7Map.get(t)!.recommendation }))
                  .sort((a, b) => b.score - a.score)
                  .map(({ ticker, score, rec }) => {
                    const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F87171'
                    const grade = gradeMeta(rec, score)
                    return (
                      <Link key={ticker} href={`/dashboard/stocks/${ticker}`}>
                        <div className="flex items-center gap-3 py-1.5">
                          <div className="w-12 text-xs font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{ticker}</div>
                          <div className="flex-1"><ScoreBar score={score} color={color} /></div>
                          <div className="w-8 text-right text-[10px] font-bold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>{score}</div>
                          <div className="w-16 text-right text-[9px]" style={{ color: grade.color, fontFamily: 'var(--font-mono)' }}>
                            GRADE {grade.grade}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
              </div>
              <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                {Object.entries(recDistribution).map(([rec, count]) => (
                  <div key={rec} className="flex items-center gap-1.5 text-[9px]"
                    style={{ color: GRADE_META[rec as Grade]?.color ?? '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GRADE_META[rec as Grade]?.color ?? '#9CA3AF' }} />
                    {count}× Grade {rec}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Q-Pillar Analysis */}
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <div className="text-[10px] uppercase tracking-[0.12em] font-bold"
              style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
              Q-PILLAR BREAKDOWN (PORTFOLIO AVG)
            </div>
          </div>
          {scoredHoldings.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Run nightly score-stocks to populate Q pillar data.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { q: 'Q1', label: 'Macro',       color: '#A78BFA', scores: scoredHoldings.map(t => q7Map.get(t)?.q1_score ?? null) },
                { q: 'Q2', label: 'Sector',       color: '#38BDF8', scores: scoredHoldings.map(t => q7Map.get(t)?.q2_score ?? null) },
                { q: 'Q3', label: 'Fundamental',  color: '#34D399', scores: scoredHoldings.map(t => q7Map.get(t)?.q3_score ?? null) },
                { q: 'Q4', label: 'Quant',        color: '#F59E0B', scores: scoredHoldings.map(t => q7Map.get(t)?.q4_score ?? null) },
                { q: 'Q5', label: 'Sentiment',    color: '#FB7185', scores: scoredHoldings.map(t => q7Map.get(t)?.q5_score ?? null) },
              ].map(({ q, label, color, scores }) => {
                const valid = scores.filter((s): s is number => s != null)
                const avg = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null
                return (
                  <div key={q}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>{q}</span>
                        <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{label}</span>
                      </div>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: avg != null ? color : '#6B7280', fontFamily: 'var(--font-mono)' }}>
                        {avg ?? '—'}/100
                      </span>
                    </div>
                    {avg != null && <ScoreBar score={avg} color={color} />}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Weak Links + Actions */}
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <div className="text-[10px] uppercase tracking-[0.12em] font-bold"
              style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
              ATTENTION REQUIRED
            </div>
          </div>

          {weakLinks.length > 0 ? (
            <div className="space-y-3">
              <div className="text-[9px] mb-2" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>
                HOLDINGS WITH LOW SETUP SCORES OR WEAK GRADES
              </div>
              {weakLinks.map(({ ticker, score, rec }) => (
                <Link key={ticker} href={`/dashboard/stocks/${ticker}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border transition-all"
                    style={{ borderColor: 'rgba(248,113,113,0.2)', backgroundColor: 'rgba(248,113,113,0.05)' }}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
                      <span className="text-sm font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{ticker}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: '#F87171', fontFamily: 'var(--font-mono)' }}>
                        {score}/100
                      </span>
                      <span className="text-[9px]" style={{ color: '#F87171', fontFamily: 'var(--font-mono)' }}>
                        GRADE {toGrade(rec, score)}
                      </span>
                      <ArrowRight className="w-3 h-3" style={{ color: '#6B7280' }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : scoredHoldings.length > 0 ? (
            <div className="flex items-center gap-3 p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CheckCircle className="w-4 h-4" style={{ color: '#10B981' }} />
              <p className="text-xs" style={{ color: '#10B981' }}>No holdings with weak setup scores. Portfolio looks healthy.</p>
            </div>
          ) : null}

          {unanalyzed.length > 0 && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(245,158,11,0.05)' }}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#F59E0B' }} />
              <div>
                <div className="text-[10px] font-bold mb-0.5" style={{ color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                  {unanalyzed.length} holdings not yet analyzed
                </div>
                <div className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                  {unanalyzed.join(', ')}
                </div>
                <div className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
                  Run nightly score-stocks to analyze these tickers.
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Theme concentration — several "different" stocks can be one bet ── */}
      {themeConcentration.length > 0 && (
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <div className="text-[10px] uppercase tracking-[0.12em] font-bold"
              style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
              THEME CONCENTRATION · ACTIVE THESES
            </div>
          </div>
          <div className="space-y-2.5">
            {themeConcentration.map(({ theme, stocks }) => (
              <div key={theme} className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{theme}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)' }}>
                    {stocks.join(', ')}
                  </span>
                  <span className="text-xs font-bold tabular-nums"
                    style={{ color: stocks.length >= 3 ? '#F87171' : stocks.length === 2 ? '#F59E0B' : '#10B981', fontFamily: 'var(--font-mono)' }}>
                    {stocks.length}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {crowdedThemes.length > 0 && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#F87171' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: '#F87171' }}>
                {crowdedThemes.map(t => `${t.stocks.length} active theses ride "${t.theme}"`).join('; ')}.
                These positions will likely draw down together — size the THEME, not just each stock.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
