import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTopStocks, type StoredQ7Score } from '@/lib/supabase/cache'
import { TrendingUp, Sparkles, ArrowUpRight } from 'lucide-react'
import StocksSearchClient from '@/components/stocks/stocks-search-client'
import { gradeMeta } from '@/lib/grades'

export const metadata = {
  title: 'Stock Analysis — Qademic',
  description: 'Search any stock for a full Q7 Framework analysis.',
}

function SetupScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F87171'
  return (
    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 shrink-0"
      style={{ borderColor: color, backgroundColor: `${color}10` }}>
      <span className="text-[11px] font-black tabular-nums leading-none" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {score}
      </span>
      <span className="text-[7px]" style={{ color, fontFamily: 'var(--font-mono)' }}>/100</span>
    </div>
  )
}

function StockIdeasCard({ stock }: { stock: StoredQ7Score }) {
  const rec = gradeMeta(stock.recommendation, stock.setup_score)
  const fmtCap = (n: number | null) => {
    if (!n) return '—'
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
    return `$${(n / 1e6).toFixed(0)}M`
  }

  return (
    <Link href={`/dashboard/stocks/${stock.ticker}`}
      className="group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 hover:border-amber-400/25 hover:shadow-amber-400/5 hover:shadow-lg"
      style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
      <SetupScoreRing score={stock.setup_score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-black" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
            {stock.ticker}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold"
            style={{ color: rec.color, backgroundColor: rec.bg, borderColor: rec.border, fontFamily: 'var(--font-mono)' }}>
            {rec.label}
          </span>
          <span className="ml-auto text-[10px] th-text-ghost"
            style={{ fontFamily: 'var(--font-mono)' }}>
            {fmtCap(stock.market_cap)}
          </span>
        </div>

        <div className="text-xs th-text-dim truncate mb-1.5">{stock.name}</div>

        {stock.verdict && (
          <p className="text-[11px] th-text-ghost leading-relaxed line-clamp-2">{stock.verdict}</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          {[
            { label: 'Q1', score: stock.q1_score, color: '#A78BFA' },
            { label: 'Q2', score: stock.q2_score, color: '#38BDF8' },
            { label: 'Q3', score: stock.q3_score, color: '#34D399' },
            { label: 'Q4', score: stock.q4_score, color: '#F59E0B' },
            { label: 'Q5', score: stock.q5_score, color: '#FB7185' },
            { label: 'Q6', score: stock.q6_score, color: '#E879F9' },
            { label: 'Q7', score: stock.q7_score, color: '#F97316' },
          ].map(({ label, score, color }) => (
            score != null ? (
              <div key={label} className="flex items-center gap-1">
                <span className="text-[8px] font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>{label}</span>
                <span className="text-[9px] tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>{score}</span>
              </div>
            ) : null
          ))}
          <span className="ml-auto">
            <ArrowUpRight className="w-3.5 h-3.5 th-text-ghost group-hover:text-amber-400 transition-colors" />
          </span>
        </div>
      </div>
    </Link>
  )
}

const POPULAR = [
  { ticker: 'AAPL', name: 'Apple' },
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'META', name: 'Meta' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'JPM', name: 'JPMorgan' },
  { ticker: 'BRK.B', name: 'Berkshire' },
  { ticker: 'V', name: 'Visa' },
  { ticker: 'LLY', name: 'Eli Lilly' },
  { ticker: 'COST', name: 'Costco' },
]

export default async function StocksPage() {
  const supabase = await createClient()
  const topStocks = await getTopStocks(supabase, 20)

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-up">

      {/* Header + Search */}
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--amber)' }} />
            <h1 className="text-2xl font-black th-text">Stock Analysis</h1>
          </div>
          <p className="text-sm th-text-dim">
            Q7 Framework analysis — Setup Score, seven pillars, AI-powered. Enter any ticker to get started.
          </p>
        </div>
        <StocksSearchClient />
      </div>

      {/* Quick picks */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] th-text-ghost border-b mb-4 pb-2"
          style={{ fontFamily: 'var(--font-mono)', borderColor: 'rgba(245,158,11,0.12)' }}>
          QUICK PICKS
        </div>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map(({ ticker, name }) => (
            <Link key={ticker} href={`/dashboard/stocks/${ticker}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'transparent' }}>
              <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{ticker}</span>
              <span className="th-text-ghost">{name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Setup Scores from DB */}
      {topStocks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 border-b mb-4 pb-2"
            style={{ borderColor: 'rgba(245,158,11,0.12)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--amber)' }} />
            <span className="text-[10px] uppercase tracking-[0.15em] th-text-ghost"
              style={{ fontFamily: 'var(--font-mono)' }}>
              TOP SETUP SCORES · UPDATED NIGHTLY
            </span>
          </div>
          <div className="space-y-2">
            {topStocks.map(stock => (
              <StockIdeasCard key={stock.ticker} stock={stock} />
            ))}
          </div>
        </div>
      )}

      {topStocks.length === 0 && (
        <div className="rounded-xl border px-6 py-8 text-center"
          style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--amber)', opacity: 0.5 }} />
          <div className="text-sm font-semibold th-text mb-1">Nightly analysis not yet run</div>
          <p className="text-xs th-text-ghost max-w-sm mx-auto">
            Stock ideas will appear here after the first nightly batch run. Search any ticker above to get an instant analysis.
          </p>
        </div>
      )}

    </div>
  )
}
