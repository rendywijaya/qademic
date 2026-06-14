'use client'

import { Network, Waves, Search, BarChart2, Shield, Radar, BookOpen, Sparkles } from 'lucide-react'

const features = [
  {
    icon: Network, id: '01', title: 'Interconnection Graph',
    description: 'The market as one living graph — companies, commodities, themes and sectors, linked by who supplies, buys from, competes with and depends on whom. The structure most investors only hold in their heads, made explicit and queryable.',
    color: '#38BDF8', tag: 'CORE ENGINE',
  },
  {
    icon: Waves, id: '02', title: 'Wave Propagation',
    description: 'Pick a demand shock — AI capex, GLP-1, reshoring — and watch it travel the chain. Every node is scored: causal exposure minus how much the market has already repriced. High score = exposed to the wave, not yet priced.',
    color: '#F59E0B', tag: 'THE EDGE',
  },
  {
    icon: Search, id: '03', title: 'AI Edge Discovery',
    description: 'Claude reads filings, transcripts and news to map who actually supplies and buys from whom — every edge with a cited quote and a confidence score, validated against ground truth before it is trusted. Catches links before they are consensus.',
    color: '#A78BFA', tag: 'CLAUDE AI',
  },
  {
    icon: Shield, id: '04', title: 'Stress-Test Reasoning',
    description: 'For every surfaced name, the AI argues against itself — contracts, substitution, saturation, margin pass-through, timing. The part that kills false edges, so you don\'t fall in love with a story the chain doesn\'t support.',
    color: '#FB7185', tag: 'FALSE-EDGE KILLER',
  },
  {
    icon: Radar, id: '05', title: 'Wave Auto-Detection',
    description: 'Every week the system scans regime + where money is already flowing, and proposes the next emerging waves — then auto-builds each one into the graph. It found a GLP-1 second-order wave on its own. The system looks for the next move while you sleep.',
    color: '#F97316', tag: 'AUTONOMOUS',
  },
  {
    icon: BookOpen, id: '06', title: 'Living Knowledge Base',
    description: 'A deep, plain-language explainer on every company and sector — what they do, how they make money, where they sit in the chain, what breaks the thesis. Evergreen, auto-refreshed. Browse the graph and you browse the encyclopedia.',
    color: '#34D399', tag: 'LEARN',
  },
  {
    icon: Sparkles, id: '07', title: 'Daily Learning Brief',
    description: 'Every morning, the market taught back to you: regime and what it means, where demand is flowing, which nodes moved closer to repricing — plus one deep dive. You wake up a little sharper, not buried in data.',
    color: '#E879F9', tag: 'EVERY DAY',
  },
  {
    icon: BarChart2, id: '08', title: 'Regime · Rotation · Filings',
    description: 'The grounding layer: a deterministic risk-on/off regime model, sector-rotation flows, momentum, and SEC/EDGAR filing intelligence. Auditable math under the AI reasoning — computed nightly, never a black box.',
    color: '#38BDF8', tag: 'FOUNDATION',
  },
]

const whyItems = [
  {
    number: '01',
    headline: 'See the whole board.',
    body: 'The big winners are obvious in hindsight — the chip, then the memory, then the power. We make the connections explicit so the second- and third-order beneficiaries are visible up front, not after they\'ve run.',
  },
  {
    number: '02',
    headline: 'Find what hasn\'t repriced.',
    body: 'Being right about the wave isn\'t enough — the obvious names are already expensive. Every node is scored on exposure minus what the price already assumes, so you spend your attention where the gap is widest.',
  },
  {
    number: '03',
    headline: 'Think, don\'t get fooled.',
    body: 'The AI doesn\'t cheerlead — it stress-tests every link and tells you when the chain doesn\'t support the story. Opportunity scores are a research prompt, never a buy signal. Conviction with a built-in devil\'s advocate.',
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
              Built to find the next multibagger.
              <br />
              <span style={{ color: 'var(--amber)' }}>Before the crowd.</span>
            </h2>
            <p className="max-w-xl leading-relaxed th-text-dim" style={{ fontSize: '1rem' }}>
              AI does the reasoning, deterministic math does the ranking — so it&apos;s intelligent
              and auditable. Computed nightly. It looks for the next wave on its own.
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
              WHY IT WORKS
            </span>
          </div>

          <h2 className="font-extrabold tracking-tight mb-14 leading-tight th-text"
            style={{ fontFamily: 'var(--font-bricolage)', fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
            The contrarian&apos;s edge,
            <br />
            <span style={{ color: 'var(--amber)' }}>made systematic.</span>
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
