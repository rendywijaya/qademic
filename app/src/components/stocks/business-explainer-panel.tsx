'use client'

import { useEffect, useState } from 'react'
import { Building2, TrendingUp, GitBranch, Loader2, ShieldAlert } from 'lucide-react'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'

interface Explainer {
  ticker: string
  name: string | null
  what_they_do: string | null
  how_they_make_money: string | null
  value_chain: string | null
  bull_case: string | null
  bear_case: string | null
  what_breaks_it: string | null
  freshness: string | null
}

function Block({ icon: Icon, label, color, body }: { icon: typeof Building2; label: string; color: string; body: string | null }) {
  if (!body) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color }}>{label}</span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.75, color: '#9CA3AF' }}>{body}</p>
    </div>
  )
}

export default function BusinessExplainerPanel({ fundamentals: f }: { fundamentals: FMPFundamentals }) {
  const [ex, setEx] = useState<Explainer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({ ticker: f.ticker, name: f.name, sector: f.sector ?? '' })
    fetch(`/api/stocks/explainer?${params}`)
      .then((r) => r.json())
      .then((d) => { setEx(d.explainer ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [f.ticker, f.name, f.sector])

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', background: 'rgba(255,255,255,0.012)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
        <Building2 className="w-4 h-4" style={{ color: 'var(--amber)' }} />
        <span style={{ fontFamily: 'var(--font-bricolage)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>What {f.name} actually does</span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#4B5563', marginLeft: 'auto' }} />}
      </div>

      {loading && !ex ? (
        <p style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.7 }}>Generating a deep business breakdown… (first view only — cached after).</p>
      ) : !ex ? (
        <p style={{ fontSize: 12.5, color: '#6B7280' }}>Business breakdown unavailable.</p>
      ) : (
        <>
          <Block icon={Building2} label="What they do" color="#38BDF8" body={ex.what_they_do} />
          <Block icon={TrendingUp} label="How they make money" color="#34D399" body={ex.how_they_make_money} />
          <Block icon={GitBranch} label="Where they sit in the value chain" color="#A78BFA" body={ex.value_chain} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
            <div style={{ border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 14px', background: 'rgba(16,185,129,0.03)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#10B981', marginBottom: 6 }}>Bull case</div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: '#9CA3AF' }}>{ex.bull_case ?? '—'}</p>
            </div>
            <div style={{ border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px 14px', background: 'rgba(248,113,113,0.03)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F87171', marginBottom: 6 }}>Bear case</div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: '#9CA3AF' }}>{ex.bear_case ?? '—'}</p>
            </div>
          </div>
          {ex.what_breaks_it && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <ShieldAlert className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F59E0B' }}>What breaks the thesis</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.75, color: '#9CA3AF' }}>{ex.what_breaks_it}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
