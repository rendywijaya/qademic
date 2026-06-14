'use client'

import { useEffect, useRef, useState } from 'react'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'

const ISO_W = 72, ISO_DX = 28, ISO_DY = 12
const FLOOR_Y = 260, GAP = 108, START_X = 56

function barX(i: number) { return START_X + i * GAP }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath(); ctx.fill(); ctx.stroke()
}

function drawIsoBar(ctx: CanvasRenderingContext2D, x: number, floorY: number, w: number, h: number, cols: [string, string, string], alpha: number, label: string, valStr: string) {
  if (h < 1) return
  const y0 = floorY - h
  ctx.save(); ctx.globalAlpha = alpha

  // Front face
  ctx.fillStyle = cols[0]
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + w, y0); ctx.lineTo(x + w, floorY); ctx.lineTo(x, floorY); ctx.closePath(); ctx.fill()
  const fg = ctx.createLinearGradient(x, y0, x + w, y0)
  fg.addColorStop(0, 'rgba(255,255,255,.10)'); fg.addColorStop(1, 'transparent')
  ctx.fillStyle = fg; ctx.fill()

  // Right face
  ctx.fillStyle = cols[1]
  ctx.beginPath(); ctx.moveTo(x + w, y0); ctx.lineTo(x + w + ISO_DX, y0 - ISO_DY); ctx.lineTo(x + w + ISO_DX, floorY - ISO_DY); ctx.lineTo(x + w, floorY); ctx.closePath(); ctx.fill()

  // Top face
  ctx.fillStyle = cols[2]
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + w, y0); ctx.lineTo(x + w + ISO_DX, y0 - ISO_DY); ctx.lineTo(x + ISO_DX, y0 - ISO_DY); ctx.closePath(); ctx.fill()

  // Edge lines
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = .8
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + w, y0); ctx.lineTo(x + w + ISO_DX, y0 - ISO_DY); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + w, y0); ctx.lineTo(x + w, floorY); ctx.stroke()
  ctx.restore()

  // Value label
  if (alpha > .3) {
    ctx.save(); ctx.globalAlpha = alpha
    ctx.fillStyle = '#F9FAFB'; ctx.font = `700 11px 'JetBrains Mono',monospace`
    ctx.textAlign = 'center'; ctx.fillText(valStr, x + w / 2, y0 - 14)
    ctx.restore()
  }
  // Axis label
  ctx.save(); ctx.globalAlpha = Math.min(alpha * 1.5, 1)
  ctx.fillStyle = '#9CA3AF'; ctx.font = `700 9px 'JetBrains Mono',monospace`
  ctx.textAlign = 'center'
  label.split('\n').forEach((line, li) => ctx.fillText(line, x + w / 2, floorY + 13 + li * 13))
  ctx.restore()
}

interface BarDef { label: string; val: number; maxVal: number; valStr: string; full: string; cols: [string, string, string] }

function buildBars(f: FMPFundamentals): BarDef[] {
  const rvg = Math.max(-30, Math.min(150, f.revenueGrowth))
  const gm  = Math.max(0, Math.min(100, f.grossMargin))
  const fcf = Math.max(0, Math.min(100, f.fcfMargin))
  const roe = Math.max(0, Math.min(100, f.roe))
  return [
    { label:'Revenue\nGrowth',  val:Math.max(0,rvg), maxVal:100, valStr:`+${rvg.toFixed(1)}%`,   full:`Revenue growth ${f.revenueGrowth>0?'+':''}${f.revenueGrowth.toFixed(1)}% YoY`,  cols:['#34D399','#059669','#6EE7B7'] },
    { label:'Gross\nMargin',    val:gm,  maxVal:100, valStr:`${gm.toFixed(1)}%`,                  full:`Gross margin ${gm.toFixed(1)}% — keeps $${gm.toFixed(0)} of every $100 revenue`,   cols:['#A78BFA','#7C3AED','#C4B5FD'] },
    { label:'FCF\nMargin',      val:fcf, maxVal:100, valStr:`${fcf.toFixed(1)}%`,                 full:`Free cash flow margin ${fcf.toFixed(1)}% of revenue`,                              cols:['#F59E0B','#D97706','#FCD34D'] },
    { label:'Return\non Equity',val:roe, maxVal:100, valStr:`${roe.toFixed(1)}%`,                 full:`ROE ${roe.toFixed(1)}% — return generated per $ of equity`,                        cols:['#FB7185','#E11D48','#FDA4AF'] },
    { label:'Div\nYield',       val:Math.min(f.dividendYield*10, 100), maxVal:100, valStr:f.dividendYield>0?`${f.dividendYield.toFixed(2)}%`:'N/A', full:f.dividendYield>0?`Dividend yield ${f.dividendYield.toFixed(2)}%`:'No dividend paid', cols:['#38BDF8','#0284C7','#7DD3FC'] },
  ]
}

interface Props { fundamentals: FMPFundamentals }

export default function IsoFinancialBars({ fundamentals: f }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState(-1)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const cv = canvas  // non-null capture for closures
    const ctx = cv.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = 700, H = 300
    canvas.width = W * dpr; canvas.height = H * dpr
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    const bars = buildBars(f)
    let progress = 0
    let raf: number
    let hov = -1

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Grid lines
      for (let i = 0; i <= 5; i++) {
        const gy = FLOOR_Y - i * 46
        ctx.beginPath(); ctx.moveTo(36, gy); ctx.lineTo(W - 20, gy)
        ctx.strokeStyle = `rgba(31,41,55,${.5 - .05 * i})`; ctx.lineWidth = 1; ctx.stroke()
        if (i > 0) {
          ctx.fillStyle = 'rgba(75,85,99,.55)'; ctx.font = '700 8px JetBrains Mono,monospace'
          ctx.textAlign = 'right'
          ctx.fillText(`${i * 20}%`, 32, gy + 3)
        }
      }
      // Floor
      ctx.beginPath(); ctx.moveTo(36, FLOOR_Y); ctx.lineTo(W - 20, FLOOR_Y)
      ctx.strokeStyle = 'rgba(31,41,55,.9)'; ctx.lineWidth = 1.5; ctx.stroke()

      bars.forEach((b, i) => {
        const delay = i * .12
        const localP = Math.max(0, Math.min(1, (progress - delay) / (1 - delay * .8)))
        const eased = 1 - Math.pow(1 - localP, 3)
        const maxH = (b.maxVal / 100) * 220
        const drawnH = (b.val / b.maxVal) * maxH * eased
        const isHov = hov === i

        drawIsoBar(ctx, barX(i), FLOOR_Y, ISO_W, drawnH, b.cols, isHov ? 1 : .88, b.label, drawnH > 12 ? b.valStr : '')

        if (isHov && eased > .8) {
          ctx.save()
          ctx.shadowColor = b.cols[0]; ctx.shadowBlur = 20
          ctx.strokeStyle = b.cols[0]; ctx.lineWidth = 1.5; ctx.globalAlpha = .4
          ctx.strokeRect(barX(i) - 2, FLOOR_Y - drawnH - 2, ISO_W + 4, drawnH + 4)
          ctx.restore()
          // Tooltip
          const tx = barX(i) + ISO_W / 2, ty = FLOOR_Y - drawnH - 42
          const tw = b.full.length * 6.2 + 18
          ctx.fillStyle = 'rgba(17,24,39,.96)'
          ctx.strokeStyle = b.cols[0]; ctx.lineWidth = 1
          roundRect(ctx, tx - tw / 2, ty - 14, Math.min(tw, W - 24), 26, 5)
          ctx.fillStyle = '#F9FAFB'; ctx.font = '600 9.5px DM Sans,sans-serif'
          ctx.textAlign = 'center'; ctx.fillText(b.full, tx, ty + 3)
        }
      })
    }

    // Animate in
    const t0 = performance.now()
    const dur = 2200
    function animate(now: number) {
      progress = Math.min((now - t0) / dur, 1)
      draw()
      if (progress < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    // Hover
    function onMove(e: MouseEvent) {
      const rect = cv.getBoundingClientRect()
      const mx = (e.clientX - rect.left) * (W / rect.width)
      const my = (e.clientY - rect.top) * (H / rect.height)
      let found = -1
      bars.forEach((b, i) => {
        const bh = (b.val / b.maxVal) * 220
        if (mx >= barX(i) && mx <= barX(i) + ISO_W + ISO_DX && my >= FLOOR_Y - bh - ISO_DY && my <= FLOOR_Y) found = i
      })
      if (found !== hov) { hov = found; setHovered(found); if (progress >= 1) draw() }
    }
    function onLeave() { hov = -1; setHovered(-1); if (progress >= 1) draw() }
    cv.addEventListener('mousemove', onMove)
    cv.addEventListener('mouseleave', onLeave)

    // Scroll trigger — replay when first visible
    const obs = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { progress = 0; const t = performance.now(); animate(t); obs.disconnect() }
    }, { threshold: .3 })
    obs.observe(cv)

    return () => {
      cancelAnimationFrame(raf)
      cv.removeEventListener('mousemove', onMove)
      cv.removeEventListener('mouseleave', onLeave)
      obs.disconnect()
    }
  }, [f])

  return (
    <div style={{ border: '1px solid #1F2937', borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid #1F2937', background: 'rgba(255,255,255,.015)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, color: '#34D399', background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.25)', padding: '3px 8px', borderRadius: 4 }}>Q3</span>
        <span style={{ fontFamily: 'var(--font-bricolage)', fontSize: 15, fontWeight: 700 }}>Financial Profile — Isometric View</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4B5563', letterSpacing: '.06em', textTransform: 'uppercase' }}>Hover bars for detail</span>
      </div>
      <div style={{ padding: '20px', overflowX: 'auto' }}>
        <canvas ref={ref} style={{ display: 'block', borderRadius: 8, maxWidth: '100%' }} />
      </div>
    </div>
  )
}
