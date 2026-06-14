'use client'

import { useEffect, useRef } from 'react'
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WaveNodeInput {
  id: string
  slug: string
  name: string
  ticker: string | null
  kind: string
}
export interface WaveEdgeInput {
  src_id: string
  dst_id: string
  weight: number
}
export interface WaveResult {
  entity_id: string
  exposure_pct: number
  priced_in_pct: number | null
  opportunity_score: number | null
  hops: number
}

interface SimNode extends SimulationNodeDatum {
  id: string
  name: string
  ticker: string | null
  kind: string
  r: number
  color: string
  isOrigin: boolean
}
type SimLink = SimulationLinkDatum<SimNode> & { weight: number }

interface Props {
  nodes: WaveNodeInput[]
  edges: WaveEdgeInput[]
  results: WaveResult[]
  originId: string
  selectedId: string | null
  onSelect: (id: string | null) => void
  height?: number
}

// ─── Visual encoding ──────────────────────────────────────────────────────────

function nodeColor(kind: string, r: WaveResult | undefined, isOrigin: boolean): string {
  if (isOrigin) return '#F59E0B'
  if (kind === 'theme') return '#F59E0B'
  if (kind === 'commodity') return '#C084FC'
  const opp = r?.opportunity_score
  if (opp == null) return '#60A5FA' // exposure-only (no priced-in reading)
  if (opp >= 40) return '#10B981'
  if (opp >= 15) return '#34D399'
  if (opp > -15) return '#FBBF24'
  return '#F87171'
}

function nodeRadius(r: WaveResult | undefined, isOrigin: boolean): number {
  if (isOrigin) return 17
  const exp = r?.exposure_pct ?? 30
  return 5 + (exp / 100) * 9
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function WaveGraph({
  nodes,
  edges,
  results,
  originId,
  selectedId,
  onSelect,
  height = 600,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const selectedRef = useRef<string | null>(selectedId)
  selectedRef.current = selectedId

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resById = new Map(results.map((r) => [r.entity_id, r]))
    const sim_nodes: SimNode[] = nodes.map((n) => {
      const isOrigin = n.id === originId
      const r = resById.get(n.id)
      return {
        id: n.id,
        name: n.name,
        ticker: n.ticker,
        kind: n.kind,
        r: nodeRadius(r, isOrigin),
        color: nodeColor(n.kind, r, isOrigin),
        isOrigin,
      }
    })
    const byId = new Map(sim_nodes.map((n) => [n.id, n]))
    const sim_links: SimLink[] = edges
      .filter((e) => byId.has(e.src_id) && byId.has(e.dst_id))
      .map((e) => ({ source: e.src_id, target: e.dst_id, weight: e.weight }))

    let W = wrap.clientWidth || 800
    let H = height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    function sizeCanvas() {
      W = wrap!.clientWidth || 800
      canvas!.width = W * dpr
      canvas!.height = H * dpr
      canvas!.style.width = `${W}px`
      canvas!.style.height = `${H}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    sizeCanvas()

    // Pin the origin near the centre-left so the wave reads left→right
    const origin = byId.get(originId)
    if (origin) {
      origin.fx = W * 0.28
      origin.fy = H * 0.5
    }

    const sim: Simulation<SimNode, SimLink> = forceSimulation(sim_nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(sim_links)
          .id((d) => d.id)
          .distance((l) => 60 + (1 - l.weight) * 80)
          .strength((l) => 0.15 + l.weight * 0.4),
      )
      .force('charge', forceManyBody<SimNode>().strength(-220))
      .force('center', forceCenter(W / 2, H / 2).strength(0.04))
      .force('collide', forceCollide<SimNode>().radius((d) => d.r + 8))

    let hoverId: string | null = null
    let dragId: string | null = null

    function draw() {
      ctx!.clearRect(0, 0, W, H)
      const sel = selectedRef.current
      const neighbors = new Set<string>()
      if (sel) {
        for (const l of sim_links) {
          const s = (l.source as SimNode).id
          const t = (l.target as SimNode).id
          if (s === sel) neighbors.add(t)
          if (t === sel) neighbors.add(s)
        }
      }

      // edges
      for (const l of sim_links) {
        const s = l.source as SimNode
        const t = l.target as SimNode
        const active = sel && (s.id === sel || t.id === sel)
        ctx!.beginPath()
        ctx!.moveTo(s.x!, s.y!)
        ctx!.lineTo(t.x!, t.y!)
        ctx!.strokeStyle = active
          ? 'rgba(56,189,248,0.55)'
          : `rgba(148,163,184,${0.06 + l.weight * 0.14})`
        ctx!.lineWidth = active ? 1.6 : 0.4 + l.weight * 1.2
        ctx!.stroke()
      }

      // nodes
      for (const n of sim_nodes) {
        const dim = sel && n.id !== sel && !neighbors.has(n.id)
        const isHover = n.id === hoverId
        const isSel = n.id === sel
        ctx!.globalAlpha = dim ? 0.28 : 1
        // glow
        if (isSel || isHover || n.isOrigin) {
          ctx!.beginPath()
          ctx!.arc(n.x!, n.y!, n.r + (isSel ? 8 : 5), 0, Math.PI * 2)
          ctx!.fillStyle = n.color + '22'
          ctx!.fill()
        }
        ctx!.beginPath()
        ctx!.arc(n.x!, n.y!, n.r, 0, Math.PI * 2)
        ctx!.fillStyle = '#0A0F1A'
        ctx!.fill()
        ctx!.lineWidth = isSel ? 3 : 2
        ctx!.strokeStyle = n.color
        ctx!.stroke()
        // inner dot
        ctx!.beginPath()
        ctx!.arc(n.x!, n.y!, n.r * 0.42, 0, Math.PI * 2)
        ctx!.fillStyle = n.color
        ctx!.fill()
        // label (origin, big nodes, hover/selected/neighbors)
        const showLabel = n.isOrigin || n.r > 9 || isHover || isSel || neighbors.has(n.id)
        if (showLabel && !dim) {
          const label = n.ticker ?? n.name
          ctx!.font = `${n.isOrigin ? 700 : 600} ${n.isOrigin ? 12 : 10}px ui-monospace, monospace`
          ctx!.textAlign = 'center'
          ctx!.textBaseline = 'top'
          ctx!.fillStyle = isSel || isHover ? '#F9FAFB' : '#94A3B8'
          ctx!.fillText(label, n.x!, n.y! + n.r + 3)
        }
        ctx!.globalAlpha = 1
      }
    }

    sim.on('tick', draw)

    // ── interaction ──
    function nodeAt(mx: number, my: number): SimNode | null {
      let best: SimNode | null = null
      let bestD = Infinity
      for (const n of sim_nodes) {
        const d = Math.hypot(n.x! - mx, n.y! - my)
        if (d < n.r + 6 && d < bestD) {
          best = n
          bestD = d
        }
      }
      return best
    }
    function pos(e: MouseEvent): [number, number] {
      const rect = canvas!.getBoundingClientRect()
      return [e.clientX - rect.left, e.clientY - rect.top]
    }
    const onMove = (e: MouseEvent) => {
      const [mx, my] = pos(e)
      if (dragId) {
        const n = byId.get(dragId)
        if (n) {
          n.fx = mx
          n.fy = my
          sim.alphaTarget(0.2).restart()
        }
        return
      }
      const n = nodeAt(mx, my)
      hoverId = n?.id ?? null
      canvas!.style.cursor = n ? 'pointer' : 'default'
      if (sim.alpha() < 0.02) draw()
    }
    const onDown = (e: MouseEvent) => {
      const [mx, my] = pos(e)
      const n = nodeAt(mx, my)
      if (n) {
        dragId = n.id
        n.fx = mx
        n.fy = my
      }
    }
    const onUp = (e: MouseEvent) => {
      const [mx, my] = pos(e)
      const n = nodeAt(mx, my)
      if (dragId) {
        const dn = byId.get(dragId)
        // release pin unless it's the origin (keep origin anchored)
        if (dn && dn.id !== originId) {
          dn.fx = null
          dn.fy = null
        }
        sim.alphaTarget(0)
        dragId = null
      }
      // click select (only if not a drag-move)
      onSelect(n ? n.id : null)
    }
    const onLeave = () => {
      hoverId = null
      if (sim.alpha() < 0.02) draw()
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mouseup', onUp)
    canvas.addEventListener('mouseleave', onLeave)

    const ro = new ResizeObserver(() => {
      sizeCanvas()
      if (origin) {
        origin.fx = W * 0.28
        origin.fy = H * 0.5
      }
      sim.force('center', forceCenter(W / 2, H / 2).strength(0.04))
      sim.alpha(0.3).restart()
    })
    ro.observe(wrap)

    return () => {
      sim.stop()
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [nodes, edges, results, originId, height, onSelect])

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
