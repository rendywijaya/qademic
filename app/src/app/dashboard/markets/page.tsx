import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GET as getMacro } from '@/app/api/macro/route'
import { GET as getMarket } from '@/app/api/market-data/route'
import { GET as getSectors } from '@/app/api/sectors/route'
import type { MacroData } from '@/app/api/macro/route'
import type { MarketItem } from '@/app/api/market-data/route'
import type { SectorData } from '@/app/api/sectors/route'
import MacroClient from '@/components/macro/macro-client'
import SectorsClient from '@/components/sectors/sectors-client'

export const metadata = {
  title: 'Markets — Qademic',
  description: 'Regime detail, macro dashboard, and sector breadth — one surface (QADEMIC.md §8).',
}

// The Markets surface (QADEMIC.md §8) — absorbs Macro + Sectors + breadth, led by
// the deterministic regime read. Regime gates exposure market-wide; it never adds
// points to any individual stock (that separation is the whole design).

const MONO = 'var(--font-mono)'
const SANS = 'var(--font-dm-sans)'
const HEAD = 'var(--font-bricolage)'

const REGIME_META = {
  risk_on:  { label: 'RISK-ON',  color: '#10B981', note: 'Trend, breadth, and credit aligned — full sizing on new theses.' },
  neutral:  { label: 'NEUTRAL',  color: '#F59E0B', note: 'Mixed signals — half sizing on new theses.' },
  risk_off: { label: 'RISK-OFF', color: '#F87171', note: 'Risk gauges deteriorating — no new thesis entries; manage existing positions by their kill conditions.' },
} as const

interface RegimeRow {
  date: string
  trend_score: number; breadth_score: number; vol_score: number
  credit_score: number; curve_score: number; total: number
  state: keyof typeof REGIME_META; exposure_multiplier: number
  spy_close: number | null; spy_sma200: number | null
  pct_sectors_above_200dma: number | null; vix: number | null
  hy_oas: number | null; yield_curve: number | null
}

async function fetchMacro(): Promise<MacroData | null> {
  try { return await (await getMacro()).json() as MacroData } catch { return null }
}
async function fetchMarket(): Promise<MarketItem[]> {
  try { return await (await getMarket()).json() as MarketItem[] } catch { return [] }
}
async function fetchSectors(): Promise<SectorData | null> {
  try { return await (await getSectors()).json() as SectorData } catch { return null }
}

function ComponentChip({ label, score, detail }: { label: string; score: number; detail: string }) {
  const color = score > 0 ? '#10B981' : score < 0 ? '#F87171' : '#9CA3AF'
  const sign = score > 0 ? '+1' : score < 0 ? '−1' : '0'
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO, color: '#9CA3AF' }}>{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ fontFamily: MONO, color }}>{sign}</span>
      </div>
      <div className="text-[11px] tabular-nums" style={{ fontFamily: MONO, color: 'var(--text)' }}>{detail}</div>
    </div>
  )
}

export default async function MarketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: regimeRow }, macro, market, sectors] = await Promise.all([
    supabase.from('regime_daily').select('*').order('date', { ascending: false }).limit(1).maybeSingle(),
    fetchMacro(),
    fetchMarket(),
    fetchSectors(),
  ])
  const regime = regimeRow as RegimeRow | null
  const meta = regime ? REGIME_META[regime.state] : null

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-8">
      {/* ── Regime detail — the lead, the gate ── */}
      <section>
        <div className="text-[9px] uppercase tracking-[0.15em] mb-2" style={{ fontFamily: MONO, color: '#9CA3AF' }}>
          MARKET REGIME{regime ? ` · AS OF ${regime.date}` : ''}
        </div>
        {regime && meta ? (
          <div className="rounded-xl border p-5" style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}08` }}>
            <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
              <div>
                <div className="flex items-baseline gap-3">
                  <h1 className="text-2xl font-bold" style={{ fontFamily: HEAD, color: meta.color }}>{meta.label}</h1>
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: MONO, color: meta.color }}>
                    {Number(regime.exposure_multiplier).toFixed(1)}× exposure
                  </span>
                </div>
                <p className="text-xs mt-1.5 max-w-xl leading-relaxed" style={{ fontFamily: SANS, color: '#9CA3AF' }}>{meta.note}</p>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.12em]" style={{ fontFamily: MONO, color: '#6B7280' }}>COMPOSITE</div>
                <div className="text-3xl font-black tabular-nums" style={{ fontFamily: MONO, color: meta.color }}>
                  {regime.total >= 0 ? '+' : ''}{regime.total}
                </div>
                <div className="text-[9px]" style={{ fontFamily: MONO, color: '#6B7280' }}>range −5…+5</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <ComponentChip label="Trend" score={regime.trend_score}
                detail={regime.spy_close != null && regime.spy_sma200 != null
                  ? `SPY ${regime.spy_close > regime.spy_sma200 ? '>' : '<'} 200dma` : '—'} />
              <ComponentChip label="Breadth" score={regime.breadth_score}
                detail={regime.pct_sectors_above_200dma != null ? `${regime.pct_sectors_above_200dma.toFixed(0)}% sectors >200dma` : '—'} />
              <ComponentChip label="Volatility" score={regime.vol_score}
                detail={regime.vix != null ? `VIX ${regime.vix.toFixed(1)}` : '—'} />
              <ComponentChip label="Credit" score={regime.credit_score}
                detail={regime.hy_oas != null ? `HY OAS ${regime.hy_oas.toFixed(2)}` : '—'} />
              <ComponentChip label="Curve" score={regime.curve_score}
                detail={regime.yield_curve != null ? `10y−2y ${regime.yield_curve.toFixed(2)}` : '—'} />
            </div>
            <p className="text-[10px] mt-3 leading-relaxed" style={{ fontFamily: SANS, color: '#6B7280' }}>
              Five components, fixed conventional thresholds (Faber 2007). Sum gates exposure and new entries — it never
              touches an individual stock&apos;s rank. State flips require two consecutive closes.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ fontFamily: SANS, color: '#9CA3AF' }}>
              Regime not computed yet. The nightly <span style={{ fontFamily: MONO }}>regime</span> cron writes here after OHLCV ingest.
            </p>
          </div>
        )}
      </section>

      {/* ── Macro dashboard (absorbed) ── */}
      <section>
        <MacroClient macro={macro} market={market} />
      </section>

      {/* ── Sector rotation / breadth (absorbed) ── */}
      <section>
        <SectorsClient data={sectors} />
      </section>
    </div>
  )
}
