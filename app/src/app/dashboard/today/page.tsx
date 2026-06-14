import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, BookOpen, Radio, Waves } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import MarkdownLite from '@/components/waves/markdown-lite'

export const metadata: Metadata = {
  title: 'Today / Learn — WorldContrarian',
  description: 'Your daily market learning brief + the living knowledge library.',
}

export const revalidate = 600

export default async function TodayPage() {
  const db = createAdminClient()
  const [{ data: briefRows }, { data: bizRows }, { data: secRows }] = await Promise.all([
    db.from('daily_briefs').select('*').is('user_id', null).order('brief_date', { ascending: false }).limit(1),
    db.from('business_explainers').select('ticker, name, what_they_do, freshness').order('freshness', { ascending: false }).limit(60),
    db.from('sector_explainers').select('slug, name, how_it_works, freshness').order('freshness', { ascending: false }).limit(20),
  ])
  const brief = briefRows?.[0] ?? null
  const biz = bizRows ?? []
  const sec = secRows ?? []

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Sparkles className="w-6 h-6" style={{ color: '#F59E0B' }} />
        <h1 style={{ fontFamily: 'var(--font-bricolage)', fontSize: 24, fontWeight: 800 }}>Today / Learn</h1>
      </div>
      <p style={{ fontSize: 12.5, color: '#9CA3AF', marginBottom: 18 }}>
        The market, taught back to you every day — plus a living library that deepens every night.
      </p>

      {/* Daily brief */}
      {brief ? (
        <div style={{ border: '1px solid #1F2937', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1F2937', background: 'rgba(245,158,11,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Radio className="w-4 h-4" style={{ color: '#F59E0B' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#F59E0B' }}>
                Daily Brief · {brief.brief_date}
              </span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-bricolage)', fontSize: 19, fontWeight: 800, lineHeight: 1.25 }}>{brief.headline}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#1F2937' }}>
            <Note icon="regime" title="Regime" body={brief.regime_note} />
            <Note icon="flows" title="Flows" body={brief.flows_note} />
            <Note icon="waves" title="Waves" body={brief.waves_note} />
          </div>
          {brief.deep_dive_md && (
            <div style={{ padding: '18px 20px', borderTop: '1px solid #1F2937' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 6 }}>
                Deep dive
              </div>
              <h3 style={{ fontFamily: 'var(--font-bricolage)', fontSize: 16, fontWeight: 800, color: '#F9FAFB', marginBottom: 8 }}>{brief.deep_dive_title}</h3>
              <MarkdownLite text={brief.deep_dive_md} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ border: '1px dashed #1F2937', borderRadius: 16, padding: '28px 20px', textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>No brief generated yet.</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4B5563', marginTop: 6 }}>
            Run <code>npx tsx --env-file=.env.local scripts/generate-brief.ts</code> or trigger the daily-brief cron.
          </p>
        </div>
      )}

      {/* Knowledge library */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <BookOpen className="w-5 h-5" style={{ color: '#34D399' }} />
        <h2 style={{ fontFamily: 'var(--font-bricolage)', fontSize: 17, fontWeight: 800 }}>Knowledge Library</h2>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{biz.length} companies · {sec.length} sectors</span>
      </div>

      {sec.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 8 }}>Sectors</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {sec.map((s) => (
              <div key={s.slug} style={cardStyle}>
                <div style={{ fontFamily: 'var(--font-bricolage)', fontSize: 13, fontWeight: 700, color: '#34D399', marginBottom: 4 }}>{s.name}</div>
                <p style={clampStyle}>{s.how_it_works}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 8 }}>Companies</div>
      {biz.length === 0 ? (
        <p style={{ fontSize: 12, color: '#6B7280' }}>
          No company explainers yet — run <code style={{ color: '#9CA3AF' }}>scripts/generate-explainers.ts</code>.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {biz.map((b) => (
            <Link key={b.ticker} href={`/dashboard/stocks/${b.ticker}`} style={{ ...cardStyle, textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: '#F9FAFB' }}>{b.ticker}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
              </div>
              <p style={clampStyle}>{b.what_they_do}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #1F2937',
  borderRadius: 12,
  padding: '12px 14px',
  background: 'rgba(255,255,255,.012)',
}
const clampStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: '#9CA3AF',
  lineHeight: 1.6,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
}

function Note({ icon, title, body }: { icon: 'regime' | 'flows' | 'waves'; title: string; body: string | null }) {
  const Icon = icon === 'waves' ? Waves : icon === 'flows' ? Radio : Sparkles
  const color = icon === 'waves' ? '#38BDF8' : icon === 'flows' ? '#34D399' : '#A78BFA'
  return (
    <div style={{ background: '#0A0F1A', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color }}>{title}</span>
      </div>
      <p style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.65 }}>{body ?? '—'}</p>
    </div>
  )
}
