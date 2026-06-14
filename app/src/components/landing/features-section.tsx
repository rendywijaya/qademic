'use client'

import { TrendingUp, Bell, Search, BarChart2, Shield, Users } from 'lucide-react'

const features = [
  {
    icon: TrendingUp, id: '01', title: 'Setup Score',
    description: 'All seven pillars synthesise into one number — 87/100. Each pillar is shown with its data source and plain-English reasoning. The same structured check, applied to every stock, every night. A research score, not a prediction.',
    color: '#F59E0B', tag: 'CORE IP',
  },
  {
    icon: Bell, id: '02', title: 'Earnings Intelligence',
    description: 'Earnings in 6 days? See beat rate, implied move from options, analyst revision trend, management guidance style, and historical base rate for this exact setup. Every quarter, for every stock you track.',
    color: '#F97316', tag: 'Q7 CATALYST',
  },
  {
    icon: Bell, id: '03', title: 'Proactive Alert System',
    description: '8-K filed? AI summary in 5 minutes. Insider bought $1M+? Immediate alert with historical pattern. Unusual options sweep? You know before the news does. Alerts are filtered to your stocks only.',
    color: '#FB7185', tag: 'REAL-TIME',
  },
  {
    icon: Search, id: '04', title: 'Natural Language Screener',
    description: '"Show me profitable small-caps where insiders bought over $1M in 90 days and revenue is accelerating." Runs against 8,000+ stocks. Every result cited with source. No hallucination.',
    color: '#A78BFA', tag: 'CLAUDE AI',
  },
  {
    icon: BarChart2, id: '05', title: 'Plain Language Backtester',
    description: '"Buy when Q4 momentum > 4.0 AND insider bought > $500k AND short interest falling." No code. 20 years of real data. Returns annual return, win rate, max drawdown, Sharpe. Every trade shown.',
    color: '#38BDF8', tag: 'BACKTESTING',
  },
  {
    icon: Shield, id: '06', title: 'Portfolio Risk Monitor',
    description: '"68% tech exposure. If macro turns risk-off, your portfolio historically loses 24%. Current Q1 score: 3.8 — safe. You\'ll be alerted if it drops." Thesis tracking per holding. Auto-contradiction alerts.',
    color: '#34D399', tag: 'PORTFOLIO',
  },
  {
    icon: TrendingUp, id: '07', title: 'SEC Filing Intelligence',
    description: '8-K: AI summary within 5 minutes of EDGAR publication. 10-K delta: what changed vs last year, auto-flagged. 13F: institutional moves parsed and searchable by fund. Free source, real-time.',
    color: '#E879F9', tag: 'SEC / EDGAR',
  },
  {
    icon: Users, id: '08', title: 'Community Track Records',
    description: 'Three structured formats — Shared Screens (verified criteria + track records), Earnings Prediction Contests (gamified), Bull vs Bear Debates (timestamped, auto-tracked). Not Reddit. Accountability built in.',
    color: '#F59E0B', tag: 'COMMUNITY',
  },
]

const whyItems = [
  {
    number: '01',
    headline: 'Stop flying blind.',
    body: 'You have opinions. Qademic gives you evidence. Every stock is assessed across seven dimensions — the same ones professionals work through before committing capital. Not gut feel. A process.',
  },
  {
    number: '02',
    headline: 'Stop missing what matters.',
    body: 'A major filing drops. An executive buys a million dollars of their own stock. Your portfolio\'s risk profile shifts. You find out within minutes — not two days later when you happen to check.',
  },
  {
    number: '03',
    headline: 'Stop being inconsistent.',
    body: 'Most investors judge each stock differently depending on how they feel that day. Qademic applies the same seven-layer framework every time. Same discipline. No emotion. No shortcuts.',
  },
]

export default function FeaturesSection() {
  return (
    <>
      <section id="features" className="py-28 px-6 relative overflow-hidden th-surface">
        <div className="absolute inset-0 dot-grid opacity-[0.15]" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border mb-7"
              style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)', fontFamily: 'var(--font-mono)' }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--amber)' }}>
                PLATFORM FEATURES
              </span>
            </div>
            <h2 className="font-extrabold tracking-tight mb-5 leading-[0.95] th-text"
              style={{ fontFamily: 'var(--font-bricolage)', fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)' }}>
              Everything a hedge fund uses.
              <br />
              <span style={{ color: 'var(--amber)' }}>Now in your hands.</span>
            </h2>
            <p className="max-w-xl leading-relaxed th-text-dim" style={{ fontSize: '1rem' }}>
              Pre-computed nightly. Delivered proactively. Backtestable in plain language.
              Not a chatbot. The complete research OS.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px rounded-xl overflow-hidden border th-border th-surface-2">
            {features.map((f) => (
              <div key={f.id}
                className="group relative p-6 transition-all duration-300 th-surface"
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--surface)')}>
                <div className="text-[10px] font-bold mb-4" style={{ color: 'var(--border)', fontFamily: 'var(--font-mono)' }}>
                  {f.id}
                </div>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${f.color}12`, border: `1px solid ${f.color}25` }}>
                  <f.icon className="w-4 h-4" style={{ color: f.color }} />
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-2"
                  style={{ color: f.color, fontFamily: 'var(--font-mono)' }}>
                  {f.tag}
                </div>
                <h3 className="text-sm font-bold mb-2 th-text" style={{ fontFamily: 'var(--font-bricolage)' }}>
                  {f.title}
                </h3>
                <p className="text-[13px] leading-relaxed th-text-dim">{f.description}</p>
                <div className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500"
                  style={{ backgroundColor: f.color, opacity: 0.4 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Qademic */}
      <section className="py-24 px-6 th-bg">
        <div className="max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border mb-6"
            style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)', fontFamily: 'var(--font-mono)' }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--amber)' }}>
              WHY QADEMIC
            </span>
          </div>

          <h2 className="font-extrabold tracking-tight mb-14 leading-tight th-text"
            style={{ fontFamily: 'var(--font-bricolage)', fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
            Three things that change
            <br />
            <span style={{ color: 'var(--amber)' }}>when you use Qademic.</span>
          </h2>

          <div className="space-y-0 divide-y th-border">
            {whyItems.map((item) => (
              <div key={item.number}
                className="grid md:grid-cols-[120px_1fr] gap-6 py-10 items-start group cursor-default">
                <div className="text-[42px] font-black tabular-nums leading-none transition-colors duration-200"
                  style={{ fontFamily: 'var(--font-mono)', color: '#1F2937' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#1F2937')}>
                  {item.number}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3 th-text" style={{ fontFamily: 'var(--font-bricolage)' }}>
                    {item.headline}
                  </h3>
                  <p className="text-sm leading-relaxed max-w-xl th-text-dim">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
