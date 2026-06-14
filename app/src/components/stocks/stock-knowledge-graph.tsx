'use client'

import { useEffect, useRef, useState } from 'react'
import type { Q5StockAnalysis, Q5LayerResult } from '@/app/api/stocks/analysis/route'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'
import { gradeMeta } from '@/lib/grades'

// ─── Static config ────────────────────────────────────────────────────────────

const Q_HEX: Record<string, string>   = { center:'#F59E0B', q1:'#A78BFA', q2:'#38BDF8', q3:'#34D399', q4:'#F59E0B', q5:'#FB7185', q6:'#E879F9', q7:'#F97316' }
const Q_NUM: Record<string, number>   = { center:0xF59E0B,  q1:0xA78BFA,  q2:0x38BDF8,  q3:0x34D399,  q4:0xF59E0B,  q5:0xFB7185,  q6:0xE879F9,  q7:0xF97316 }
const Q_LABEL: Record<string, string> = { q1:'Macro', q2:'Sector', q3:'Fundamental', q4:'Quant', q5:'Sentiment', q6:'Management', q7:'Catalyst' }
const Q_POS: Record<string, [number,number,number]> = {
  q1:[-1.6, 0.9,-0.5], q2:[1.5, 0.6,-0.4], q3:[0.2,-1.5, 0.8],
  q4:[-0.9,-0.9, 1.4], q5:[0.9, 1.3, 1.1], q6:[-1.5,-0.4,-1.0], q7:[1.3,-1.0,-0.8],
}
interface Signal { type:'pos'|'neg'|'neu'; text:string }
interface StatRow { label:string; value:string; color:string }
interface NodeDetail { id:string; title:string; score:number|null; badge:string; badgeColor:string; badgeBg:string; text:string; stats:StatRow[]; signals:Signal[] }

function fmtCap(n:number){ if(n>=1e12) return `$${(n/1e12).toFixed(2)}T`; if(n>=1e9) return `$${(n/1e9).toFixed(2)}B`; return `$${(n/1e6).toFixed(0)}M` }

function layerDetail(id:string, layer:Q5LayerResult|undefined, ticker:string): NodeDetail {
  if (!layer) return { id, title:`${Q_LABEL[id]} Analysis`, score:null, badge:'PENDING', badgeColor:'#6B7280', badgeBg:'rgba(107,114,128,.12)', text:`${Q_LABEL[id]} analysis for ${ticker}.`, stats:[], signals:[] }
  const sc = layer.score; const c = sc>=70?'#10B981':sc>=50?'#F59E0B':'#F87171'
  return { id, title:layer.title, score:sc, badge:sc>=78?'STRONG':sc>=63?'POSITIVE':sc>=43?'NEUTRAL':'WEAK', badgeColor:Q_HEX[id], badgeBg:`${Q_HEX[id]}18`, text:layer.analysis, stats:[{label:'Score',value:`${sc}/100`,color:c}], signals:[] }
}

// ─── Canvas sprite helper ─────────────────────────────────────────────────────

function makeSpriteCanvas(id:string, line1:string, line2:string, sub:string, hex:string, isCenter:boolean, score:number|null): HTMLCanvasElement {
  const S = 160, cx = S/2, cy = S/2
  const c = document.createElement('canvas'); c.width=S; c.height=S
  const ctx = c.getContext('2d')!
  // Ambient glow
  const g = ctx.createRadialGradient(cx,cy,S*.18,cx,cy,S*.5)
  g.addColorStop(0,hex+'28'); g.addColorStop(1,hex+'00')
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,S*.5,0,Math.PI*2); ctx.fill()
  // Dark bg
  const R = isCenter ? S*.38 : S*.34
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fillStyle='#060B14'; ctx.fill()
  // Colored ring
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2)
  ctx.strokeStyle=hex; ctx.lineWidth=isCenter?6:4.5; ctx.shadowColor=hex; ctx.shadowBlur=14; ctx.stroke(); ctx.shadowBlur=0
  // Score arc (center only)
  if (isCenter && score!==null) {
    const arc = (score/100)*Math.PI*2
    ctx.beginPath(); ctx.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+arc)
    ctx.strokeStyle='#10B981'; ctx.lineWidth=6; ctx.lineCap='round'; ctx.shadowColor='#10B981'; ctx.shadowBlur=10; ctx.stroke(); ctx.shadowBlur=0; ctx.lineCap='butt'
  }
  // Text
  ctx.textAlign='center'; ctx.textBaseline='middle'
  if (isCenter) {
    ctx.font=`800 ${S*.13}px 'JetBrains Mono',monospace`; ctx.fillStyle=hex; ctx.shadowColor=hex; ctx.shadowBlur=8
    ctx.fillText(line1,cx,cy-S*.09); ctx.shadowBlur=0
    ctx.font=`700 ${S*.085}px 'JetBrains Mono',monospace`; ctx.fillStyle='#10B981'
    ctx.fillText(score?`${score}/100`:'—',cx,cy+S*.07)
    ctx.font=`500 ${S*.07}px 'DM Sans',sans-serif`; ctx.fillStyle='#9CA3AF'
    ctx.fillText('Setup Score',cx,cy+S*.19)
  } else {
    ctx.font=`800 ${S*.12}px 'JetBrains Mono',monospace`; ctx.fillStyle=hex; ctx.shadowColor=hex; ctx.shadowBlur=6
    ctx.fillText(line1,cx,cy-S*.12); ctx.shadowBlur=0
    ctx.font=`600 ${S*.085}px 'DM Sans',sans-serif`; ctx.fillStyle='#F9FAFB'
    ctx.fillText(line2,cx,cy+S*.03)
    ctx.font=`700 ${S*.08}px 'JetBrains Mono',monospace`; ctx.fillStyle=hex
    ctx.fillText(sub,cx,cy+S*.18)
  }
  return c
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ detail, onClose }: { detail:NodeDetail|null; onClose:()=>void }) {
  const vis = detail !== null
  return (
    <div style={{ position:'absolute', right:vis?12:-324, top:12, bottom:12, width:300, background:'rgba(7,11,20,0.97)', border:'1px solid #1F2937', borderRadius:14, overflowY:'auto', transition:'right .34s cubic-bezier(.4,0,.2,1)', zIndex:10, backdropFilter:'blur(20px)' }}>
      {detail ? <>
        <button onClick={onClose} style={{ position:'absolute', top:11, right:11, background:'none', border:'none', color:'#4B5563', cursor:'pointer', fontSize:13, padding:'3px 7px', borderRadius:4, zIndex:2 }}>✕</button>
        {/* Score ring + badge + title */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 12px' }}>
          {detail.score!==null && (
            <svg width={62} height={62} viewBox="0 0 62 62" style={{ flexShrink:0 }}>
              <circle cx={31} cy={31} r={24} fill="rgba(0,0,0,.4)" stroke="rgba(255,255,255,.05)" strokeWidth={5}/>
              <circle cx={31} cy={31} r={24} fill="none" stroke={detail.badgeColor} strokeWidth={5} strokeLinecap="round"
                strokeDasharray={`${(detail.score/100*2*Math.PI*24).toFixed(1)} ${(2*Math.PI*24).toFixed(1)}`}
                strokeDashoffset={`${(2*Math.PI*24/4).toFixed(1)}`}
                style={{ filter:`drop-shadow(0 0 4px ${detail.badgeColor})` }}/>
              <text x={31} y={27} textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize={12} fontWeight={800} fill={detail.badgeColor}>{detail.score}</text>
              <text x={31} y={39} textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize={8} fill="#6B7280">/100</text>
            </svg>
          )}
          <div style={{ minWidth:0 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:8, fontWeight:800, letterSpacing:'.1em', background:detail.badgeBg, color:detail.badgeColor, border:`1px solid ${detail.badgeColor}44`, padding:'3px 9px', borderRadius:4, display:'inline-block', marginBottom:5 }}>{detail.badge}</span>
            <div style={{ fontFamily:'var(--font-bricolage)', fontSize:15, fontWeight:700, color:detail.badgeColor, lineHeight:1.25 }}>{detail.title}</div>
          </div>
        </div>
        <div style={{ height:1, background:'#1F2937', margin:'0 16px' }}/>
        <div style={{ padding:'12px 16px' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:7.5, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'#4B5563', marginBottom:8 }}>Analysis</div>
          <p style={{ fontSize:11.5, color:'#9CA3AF', lineHeight:1.75 }}>{detail.text}</p>
        </div>
        {detail.stats.length>0 && <>
          <div style={{ height:1, background:'#1F2937', margin:'0 16px' }}/>
          <div style={{ padding:'12px 16px' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:7.5, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'#4B5563', marginBottom:8 }}>Key Metrics</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {detail.stats.map((s,i)=>(
                <div key={i} style={{ background:'rgba(255,255,255,.02)', border:'1px solid #1F2937', borderRadius:7, padding:'8px 10px' }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:7, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'#4B5563', marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:800, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </>}
        {detail.signals.length>0 && <>
          <div style={{ height:1, background:'#1F2937', margin:'0 16px' }}/>
          <div style={{ padding:'12px 16px' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:7.5, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'#4B5563', marginBottom:8 }}>Signals</div>
            {detail.signals.map((s,i)=>(
              <div key={i} style={{ display:'flex', gap:7, fontSize:11, lineHeight:1.5, marginBottom:5, color:s.type==='pos'?'#d1fae5':s.type==='neg'?'#fecaca':'#9CA3AF' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, marginTop:4, background:s.type==='pos'?'#10B981':s.type==='neg'?'#F87171':'#9CA3AF' }}/>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </>}
      </> : (
        <div style={{ padding:'40px 16px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:10, color:'#4B5563', lineHeight:1.7 }}>
          ← Click any node<br/>to see analysis
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { ticker:string; analysis:Q5StockAnalysis; setupScore:number; fundamentals:FMPFundamentals }

export default function StockKnowledgeGraph({ ticker, analysis, setupScore, fundamentals:f }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [detail, setDetail] = useState<NodeDetail|null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let rafId = 0
    let disposed = false

    // Build details
    const a = analysis as unknown as Record<string,Q5LayerResult|undefined>
    const qKeys = ['q1','q2','q3','q4','q5','q6','q7'] as const
    const rec = gradeMeta(analysis.recommendation, setupScore)
    const centerDet: NodeDetail = {
      id:'center', title:f.name, score:setupScore, badge:rec.label, badgeColor:rec.color, badgeBg:rec.bg,
      text:`${f.name} — Q7 Setup Score ${setupScore}/100. The score covers macro environment, sector dynamics, fundamental quality, quantitative signals, sentiment, management, and catalysts.`,
      stats:[
        {label:'Price',   value:`$${f.price.toFixed(2)}`,     color:'#F9FAFB'},
        {label:'Mkt Cap', value:fmtCap(f.marketCap),         color:'#F9FAFB'},
        {label:'Score',   value:`${setupScore}/100`,         color:'#F59E0B'},
        {label:'P/E',     value:f.pe>0?`${f.pe.toFixed(1)}×`:'—', color:f.pe>0&&f.pe<30?'#10B981':'#F59E0B'},
      ],
      signals:[
        {type:f.revenueGrowth>10?'pos':'neu', text:`Revenue growth ${f.revenueGrowth>0?'+':''}${f.revenueGrowth.toFixed(1)}%`},
        {type:f.grossMargin>40?'pos':'neu',   text:`Gross margin ${f.grossMargin.toFixed(1)}%`},
        {type:f.debtEquity<1?'pos':'neg',     text:`Debt/Equity ${f.debtEquity.toFixed(2)}`},
        {type:f.change>0?'pos':f.change<0?'neg':'neu', text:`Today ${f.change>=0?'+':''}${f.change.toFixed(2)}%`},
      ],
    }
    const layerDets: Record<string,NodeDetail> = {}
    qKeys.forEach(k => { layerDets[k] = layerDetail(k, a[k], ticker) })

    import('three').then(THREE => {
      if (disposed) return
      const W = mount.clientWidth || 900, H = 520

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
      renderer.setSize(W,H)
      renderer.setClearColor(0x000000,0)
      const canvas = renderer.domElement
      canvas.style.cssText = `position:absolute;top:0;left:0;width:${W}px;height:${H}px;cursor:grab`
      mount.appendChild(canvas)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(52,W/H,0.1,100)
      camera.position.set(0,0.1,6.5)

      // Starfield
      const sGeo = new THREE.BufferGeometry()
      const sArr: number[] = []
      for (let i=0;i<200;i++) sArr.push((Math.random()-.5)*16,(Math.random()-.5)*12,(Math.random()-.5)*6-2)
      sGeo.setAttribute('position',new THREE.Float32BufferAttribute(sArr,3))
      scene.add(new THREE.Points(sGeo,new THREE.PointsMaterial({color:0xffffff,size:.013,transparent:true,opacity:.22})))

      const grp = new THREE.Group(); scene.add(grp)
      const CENTER_POS: [number,number,number] = [0,0,0]

      // Edges
      qKeys.forEach(k => {
        const pts=[new THREE.Vector3(...CENTER_POS),new THREE.Vector3(...Q_POS[k]!)]
        grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:Q_NUM[k],transparent:true,opacity:.15})))
      })

      type NodeEntry = { id:string; sprite:InstanceType<typeof THREE.Sprite>; glow:InstanceType<typeof THREE.Mesh>; hit:InstanceType<typeof THREE.Mesh>; nodeDetail:NodeDetail }
      const nodes: NodeEntry[] = []
      const clickMeshes: InstanceType<typeof THREE.Mesh>[] = []

      function addNode(id:string, pos:[number,number,number], line1:string, line2:string, sub:string, hex:string, isCenter:boolean, sc:number|null, det:NodeDetail, r:number) {
        // Sprite
        const tex = new THREE.CanvasTexture(makeSpriteCanvas(id,line1,line2,sub,hex,isCenter,sc))
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}))
        const scale = isCenter?0.90:0.65; sprite.scale.set(scale,scale,1); sprite.position.set(...pos)
        grp.add(sprite)
        // Glow halo
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(r*2.2,14,14),
          new THREE.MeshBasicMaterial({color:Q_NUM[id]??Q_NUM.center,transparent:true,opacity:.04,blending:THREE.AdditiveBlending,depthWrite:false})
        ); glow.position.set(...pos); grp.add(glow)
        // Invisible hit sphere
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(r*2.0,12,12),
          new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
        ); hit.position.set(...pos); hit.userData.nodeId=id; grp.add(hit); clickMeshes.push(hit)
        nodes.push({id,sprite,glow,hit,nodeDetail:det})
      }

      // Center node
      addNode('center',CENTER_POS,ticker,`${setupScore}/100`,'Setup Score','#F59E0B',true,setupScore,centerDet,0.22)
      // Q layer nodes
      qKeys.forEach(k => {
        const layer = a[k]; const sc = layer?.score??50
        addNode(k,Q_POS[k]!,`Q${k[1]}`,Q_LABEL[k],`${sc}/100`,Q_HEX[k],false,null,layerDets[k]!,0.14)
      })

      // Edge particles
      const MAX_P = 70
      const pGeo = new THREE.BufferGeometry()
      const pPos = new Float32Array(MAX_P*3), pCol = new Float32Array(MAX_P*3)
      pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3))
      pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3))
      grp.add(new THREE.Points(pGeo,new THREE.PointsMaterial({size:.04,vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false})))

      type Particle = { from:[number,number,number]; to:[number,number,number]; t:number; spd:number; c:InstanceType<typeof THREE.Color> }
      const pState: Particle[] = qKeys.flatMap(k => {
        const c=new THREE.Color(Q_NUM[k]!)
        return Array.from({length:9},()=>({from:CENTER_POS,to:Q_POS[k]!,t:Math.random(),spd:.003+Math.random()*.004,c}))
      }).slice(0,MAX_P)

      // Interaction state
      const rc = new THREE.Raycaster(), mv = new THREE.Vector2()
      let hovId: string|null = null
      let isDrag=false, didDrag=false, lx=0, ly=0

      function getHovNode(e:MouseEvent): string|null {
        const rect = canvas.getBoundingClientRect()
        mv.set(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1)
        rc.setFromCamera(mv,camera)
        const hits = rc.intersectObjects(clickMeshes)
        return hits.length>0 ? (hits[0].object.userData.nodeId as string) : null
      }

      function setHover(id:string|null) {
        if (id===hovId) return
        // Reset previous
        if (hovId!==null) {
          const prev = nodes.find(n=>n.id===hovId)
          if (prev) {
            ;(prev.glow.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity=.04
            const s=isCenter(hovId)?.9:0.65; prev.sprite.scale.set(s,s,1)
          }
        }
        hovId=id
        if (hovId!==null) {
          const cur = nodes.find(n=>n.id===hovId)
          if (cur) {
            ;(cur.glow.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity=.18
            const s=isCenter(hovId)?.9*1.12:0.65*1.18; cur.sprite.scale.set(s,s,1)
          }
        }
        canvas.style.cursor = hovId ? 'pointer' : (isDrag?'grabbing':'grab')
      }

      function isCenter(id:string|null){ return id==='center' }

      const onCanvasClick = (e:MouseEvent) => {
        if (didDrag) return
        const id = getHovNode(e)
        if (id) { const n=nodes.find(n=>n.id===id); if (n) setDetail(n.nodeDetail) }
        else setDetail(null)
      }
      const onCanvasMouseMove = (e:MouseEvent) => { if (!isDrag) setHover(getHovNode(e)) }
      const onCanvasMouseDown = (e:MouseEvent) => { isDrag=true; didDrag=false; lx=e.clientX; ly=e.clientY; canvas.style.cursor='grabbing' }
      const onWindowMouseUp = () => { isDrag=false; canvas.style.cursor='grab' }
      const onWindowMouseMove = (e:MouseEvent) => {
        if (!isDrag) return
        const dx=e.clientX-lx, dy=e.clientY-ly
        if (Math.abs(dx)>2||Math.abs(dy)>2) didDrag=true
        grp.rotation.y+=dx*.007; grp.rotation.x+=dy*.007
        grp.rotation.x=Math.max(-1.1,Math.min(1.1,grp.rotation.x))
        lx=e.clientX; ly=e.clientY
      }
      const onWheel = (e:WheelEvent) => { camera.position.z=Math.max(3,Math.min(11,camera.position.z+e.deltaY*.013)); e.preventDefault() }

      canvas.addEventListener('click',onCanvasClick)
      canvas.addEventListener('mousemove',onCanvasMouseMove)
      canvas.addEventListener('mousedown',onCanvasMouseDown)
      window.addEventListener('mouseup',onWindowMouseUp)
      window.addEventListener('mousemove',onWindowMouseMove)
      mount.addEventListener('wheel',onWheel,{passive:false})

      // Render loop
      let tick=0
      function loop() {
        if (disposed) return
        tick++
        // Pulse glow halos (only non-hovered)
        nodes.forEach(n => {
          if (n.id===hovId) return
          const m = n.glow.material as InstanceType<typeof THREE.MeshBasicMaterial>
          const baseOp = .03+.015*Math.sin(tick*.03+nodes.indexOf(n)*.8)
          m.opacity = baseOp
        })
        // Edge particles
        pState.forEach((p,i)=>{
          p.t=(p.t+p.spd)%1
          const f=p.t<.12?p.t/.12:p.t>.88?(1-p.t)/.12:1
          pPos[i*3]=p.from[0]+p.t*(p.to[0]-p.from[0])
          pPos[i*3+1]=p.from[1]+p.t*(p.to[1]-p.from[1])
          pPos[i*3+2]=p.from[2]+p.t*(p.to[2]-p.from[2])
          pCol[i*3]=p.c.r*f; pCol[i*3+1]=p.c.g*f; pCol[i*3+2]=p.c.b*f
        })
        pGeo.attributes.position.needsUpdate=true
        pGeo.attributes.color.needsUpdate=true
        renderer.render(scene,camera)
        rafId=requestAnimationFrame(loop)
      }
      loop()

      // Cleanup
      ;(mount as HTMLElement & {__threeCleanup?:()=>void}).__threeCleanup = () => {
        disposed=true
        cancelAnimationFrame(rafId)
        canvas.removeEventListener('click',onCanvasClick)
        canvas.removeEventListener('mousemove',onCanvasMouseMove)
        canvas.removeEventListener('mousedown',onCanvasMouseDown)
        window.removeEventListener('mouseup',onWindowMouseUp)
        window.removeEventListener('mousemove',onWindowMouseMove)
        mount.removeEventListener('wheel',onWheel)
        renderer.dispose()
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
      }
    })

    return () => {
      disposed=true
      cancelAnimationFrame(rafId)
      const el = mount as HTMLElement & {__threeCleanup?:()=>void}
      el.__threeCleanup?.()
    }
  }, [ticker, analysis, setupScore, f])

  return (
    <div style={{ border:'1px solid #1F2937', borderRadius:16, overflow:'hidden', background:'rgba(0,0,0,.25)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:'1px solid #1F2937', background:'rgba(255,255,255,.015)' }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:800, color:'#F59E0B', background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', padding:'3px 8px', borderRadius:4 }}>Q7</span>
        <span style={{ fontFamily:'var(--font-bricolage)', fontSize:15, fontWeight:700 }}>Knowledge Graph — Q Framework</span>
        <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:8, color:'#4B5563', letterSpacing:'.06em', textTransform:'uppercase' }}>Click Node · Drag to Orbit · Scroll to Zoom</span>
      </div>
      <div ref={mountRef} style={{ position:'relative', width:'100%', height:520, overflow:'hidden' }}>
        <DetailPanel detail={detail} onClose={()=>setDetail(null)}/>
        <div id="graphHint" style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', fontFamily:'var(--font-mono)', fontSize:8, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'#4B5563', pointerEvents:'none', whiteSpace:'nowrap', opacity:.5 }}>
          CLICK NODE · DRAG TO ORBIT · SCROLL TO ZOOM
        </div>
      </div>
    </div>
  )
}
