'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Waves, Sparkles, ArrowUpRight, Info, Loader2 } from 'lucide-react'
import WaveGraph from './wave-graph'

// mirrors lib/waves WaveRun (kept local to avoid server import in a client component)
interface Node { id: string; slug: string; ticker: string | null; name: string; kind: string; sector: string | null }
interface Edge { src_id: string; dst_id: string; relation: string; weight: number; confidence: number; evidence: string | null }
interface Result {
  entity_id: string; ticker: string | null; name: string; kind: string; hops: number
  raw_exposure: number; exposure_pct: number
  priced_in: number | null; priced_in_pct: number | null; opportunity_score: number | null
}
interface Shock { id: string; slug: string; name: string; origin_id: string | null; magnitude: number; stage: string; thesis: string | null }

interface WaveTab { slug: string; name: string; stage: string; detected_by: string }
interface Props {
  shock: Shock
  nodes: Node[]
  edges: Edge[]
  results: Result[]
  waves: WaveTab[]
}

function oppColor(opp: number | null): string {
  if (opp == null) return '#60A5FA'
  if (opp >= 40) return '#10B981'
  if (opp >= 15) return '#34D399'
  if (opp > -15) return '#FBBF24'
  return '#F87171'
}

const RELATION_LABEL: Record<string, string> = {
  exposed_to_theme: 'exposed to',
  drives_demand_for: 'drives demand for',
  consumes_commodity: 'consumes',
}

export default function WavesClient({ shock, nodes, edges, results, waves }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [aiText, setAiText] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const resById = useMemo(() => new Map(results.map((r) => [r.entity_id, r])), [results])

  const selectedNode = selectedId ? nodeById.get(selectedId) : null
  const selectedRes = selectedId ? resById.get(selectedId) : null
  const selectedEdges = useMemo(() => {
    if (!selectedId) return [] as { dir: 'in' | 'out'; other: Node; e: Edge }[]
    const out: { dir: 'in' | 'out'; other: Node; e: Edge }[] = []
    for (const e of edges) {
      if (e.src_id === selectedId) {
        const other = nodeById.get(e.dst_id)
        if (other) out.push({ dir: 'out', other, e })
      } else if (e.dst_id === selectedId) {
        const other = nodeById.get(e.src_id)
        if (other) out.push({ dir: 'in', other, e })
      }
    }
    return out.sort((a, b) => b.e.weight - a.e.weight)
  }, [selectedId, edges, nodeById])

  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id)
    setAiText('')
  }, [])

  async function explainWithAI() {
    if (!selectedNode) return
    setAiLoading(true)
    setAiText('')
    try {
      const res = await fetch('/api/waves/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shock: shock.slug, entity_id: selectedNode.id }),
      })
      if (!res.ok || !res.body) {
        setAiText(`(AI explanation unavailable — ${res.status})`)
        setAiLoading(false)
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        setAiText(acc)
      }
    } catch {
      setAiText('(AI explanation failed)')
    } finally {
      setAiLoading(false)
    }
  }

  const ranked = results.filter((r) => r.kind === 'company')

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <Waves className="w-6 h-6" style={{ color: '#38BDF8', flexShrink: 0, marginTop: 2 }} />
        <div>
          <h1 style={{ fontFamily: 'var(--font-bricolage)', fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
            Wave Map — {shock.name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#38BDF8', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.25)', padding: '2px 8px', borderRadius: 4 }}>
              {shock.stage}
            </span>
            <span style={{ fontSize: 11, color: '#6B7280' }}>
              {nodes.length} nodes · {edges.length} causal links
            </span>
          </div>
        </div>
      </div>
      {shock.thesis && (
        <p style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.7, maxWidth: 880, marginBottom: 14 }}>
          {shock.thesis}
        </p>
      )}

      {/* Wave switcher */}
      {waves.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {waves.map((w) => {
            const active = w.slug === shock.slug
            return (
              <Link
                key={w.slug}
                href={`/dashboard/waves?shock=${w.slug}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                  fontSize: 11.5, fontWeight: 600, textDecoration: 'none',
                  background: active ? 'rgba(56,189,248,.12)' : 'rgba(255,255,255,.02)',
                  border: `1px solid ${active ? 'rgba(56,189,248,.4)' : '#1F2937'}`,
                  color: active ? '#38BDF8' : '#9CA3AF',
                }}
              >
                {w.name}
                {w.detected_by === 'ai' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, letterSpacing: '.08em', color: '#F59E0B', background: 'rgba(245,158,11,.12)', padding: '1px 5px', borderRadius: 3 }}>AI</span>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 16, alignItems: 'start' }}>
        {/* Graph */}
        <div style={{ border: '1px solid #1F2937', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid #1F2937', flexWrap: 'wrap' }}>
            <LegendDot c="#10B981" label="un-repriced (high opp.)" />
            <LegendDot c="#FBBF24" label="fairly priced" />
            <LegendDot c="#F87171" label="already repriced" />
            <LegendDot c="#60A5FA" label="no signal" />
            <LegendDot c="#C084FC" label="commodity" />
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              size = exposure · click node · drag to move
            </span>
          </div>
          <WaveGraph
            nodes={nodes}
            edges={edges}
            results={results}
            originId={shock.origin_id ?? ''}
            selectedId={selectedId}
            onSelect={onSelect}
            height={600}
          />
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedNode ? (
            <NodeDetail
              node={selectedNode}
              res={selectedRes ?? null}
              edges={selectedEdges}
              aiText={aiText}
              aiLoading={aiLoading}
              onExplain={explainWithAI}
              onBack={() => onSelect(null)}
            />
          ) : (
            <RankedList ranked={ranked} onSelect={onSelect} />
          )}
          <p style={{ display: 'flex', gap: 6, fontSize: 10, color: '#4B5563', lineHeight: 1.6 }}>
            <Info className="w-3.5 h-3.5" style={{ flexShrink: 0, marginTop: 1 }} />
            Opportunity = causal exposure minus how much the market has already repriced it. A research
            prompt — where to look — never a buy signal. Edges are a curated/AI-built model, not ground truth.
          </p>
        </div>
      </div>
    </div>
  )
}

function LegendDot({ c, label }: { c: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#9CA3AF' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
      {label}
    </span>
  )
}

function RankedList({ ranked, onSelect }: { ranked: Result[]; onSelect: (id: string) => void }) {
  return (
    <div style={{ border: '1px solid #1F2937', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1F2937', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles className="w-4 h-4" style={{ color: '#F59E0B' }} />
        <span style={{ fontFamily: 'var(--font-bricolage)', fontSize: 14, fontWeight: 700 }}>Un-repriced beneficiaries</span>
      </div>
      <div style={{ maxHeight: 560, overflowY: 'auto' }}>
        {ranked.map((r, i) => (
          <button
            key={r.entity_id}
            onClick={() => onSelect(r.entity_id)}
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(31,41,55,.5)', cursor: 'pointer' }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4B5563', width: 16 }}>{i + 1}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: '#F9FAFB' }}>{r.ticker ?? '—'}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Bar pct={r.exposure_pct} color="#38BDF8" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563' }}>exp {r.exposure_pct}</span>
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: oppColor(r.opportunity_score), width: 38, textAlign: 'right' }}>
              {r.opportunity_score == null ? '—' : (r.opportunity_score > 0 ? '+' : '') + Math.round(r.opportunity_score)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ width: 54, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, opacity: 0.8 }} />
    </div>
  )
}

function NodeDetail({
  node, res, edges, aiText, aiLoading, onExplain, onBack,
}: {
  node: Node
  res: Result | null
  edges: { dir: 'in' | 'out'; other: Node; e: Edge }[]
  aiText: string
  aiLoading: boolean
  onExplain: () => void
  onBack: () => void
}) {
  return (
    <div style={{ border: '1px solid #1F2937', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1F2937' }}>
        <button onClick={onBack} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4B5563', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 6 }}>← back to list</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: '#F9FAFB' }}>{node.ticker ?? node.name}</span>
          {node.ticker && (
            <Link href={`/dashboard/stocks/${node.ticker}`} style={{ fontSize: 10, color: '#38BDF8', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              stock page <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{node.name} · {node.kind}</div>
      </div>

      {res && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: '#1F2937' }}>
          <Metric label="Exposure" value={`${res.exposure_pct}`} sub="pct" color="#38BDF8" />
          <Metric label="Priced in" value={res.priced_in_pct == null ? '—' : `${res.priced_in_pct}`} sub="pct" color="#F87171" />
          <Metric label="Opportunity" value={res.opportunity_score == null ? '—' : (res.opportunity_score > 0 ? '+' : '') + Math.round(res.opportunity_score)} sub={`${res.hops} hops`} color={oppColor(res.opportunity_score)} />
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#4B5563', marginBottom: 8 }}>Causal links</div>
        {edges.length === 0 && <div style={{ fontSize: 11, color: '#6B7280' }}>No mapped links.</div>}
        {edges.slice(0, 8).map((x, i) => (
          <div key={i} style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 6, paddingBottom: 6, borderBottom: i < Math.min(edges.length, 8) - 1 ? '1px solid rgba(31,41,55,.5)' : 'none' }}>
            <span style={{ color: '#64748B' }}>{x.dir === 'in' ? '← ' : '→ '}</span>
            <span style={{ color: '#E5E7EB', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>{x.other.ticker ?? x.other.name}</span>
            <span style={{ color: '#64748B' }}> · {RELATION_LABEL[x.e.relation] ?? x.e.relation} · w{x.e.weight.toFixed(2)}</span>
            {x.e.evidence && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2, fontStyle: 'italic' }}>{x.e.evidence}</div>}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 14px 14px' }}>
        <button
          onClick={onExplain}
          disabled={aiLoading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#0A0F1A', background: '#F59E0B', border: 'none', borderRadius: 7, padding: '7px 12px', cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1 }}
        >
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Explain & stress-test with AI
        </button>
        {aiText && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: '#CBD5E1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{aiText}</div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: '#0A0F1A', padding: '10px 12px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#4B5563' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563' }}>{sub}</div>
    </div>
  )
}
