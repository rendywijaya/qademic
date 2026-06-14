import { cn } from '@/lib/utils'

interface Props {
  size?: number
  className?: string
}

function f(n: number) { return +n.toFixed(2) }

/**
 * Qademic Q mark.
 *
 * Dark square. Amber Q. No decorations.
 *
 * - #050810 base, thin amber border
 * - Bold 280° open arc — clear Q, not an O
 * - Tail at 30° above horizontal — elegant, not aggressive
 * - Soft glow from double-draw (no filter — renders identically everywhere)
 */
export function QMark({ size = 32, className }: Props) {
  const cx  = size / 2
  const cy  = size * 0.435
  const r   = size * 0.25        // circle radius
  const sw  = size * 0.115       // stroke width — bold enough to read at 16px
  const bw  = size * 0.05        // border width
  const rad = (d: number) => (d * Math.PI) / 180

  // 280° arc — 80° gap from 15° to 95° (right side, slightly open)
  const gS = 15                  // top of gap — tail attaches here
  const gE = 95                  // bottom of gap — arc starts here
  const sx = cx + r * Math.cos(rad(gE))
  const sy = cy + r * Math.sin(rad(gE))
  const ex = cx + r * Math.cos(rad(gS))
  const ey = cy + r * Math.sin(rad(gS))
  // large-arc=1, sweep=1 (clockwise 280°)
  const arc = `M ${f(sx)} ${f(sy)} A ${f(r)} ${f(r)} 0 1 1 ${f(ex)} ${f(ey)}`

  // Tail at 30° above horizontal — more elegant than 45°
  const tLen = size * 0.21
  const tx   = f(ex + tLen * Math.cos(rad(30)))
  const ty   = f(ey - tLen * Math.sin(rad(30)))

  const AMBER  = '#F59E0B'
  const DARK   = '#050810'

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      aria-label="Qademic"
    >
      {/* Dark base */}
      <rect width={size} height={size} rx={f(size * 0.22)} fill={DARK} />

      {/* Amber border — inset so it stays inside the rounded rect */}
      <rect
        x={f(bw / 2)} y={f(bw / 2)}
        width={f(size - bw)} height={f(size - bw)}
        rx={f(size * 0.22 - bw / 2)}
        fill="none"
        stroke={AMBER}
        strokeWidth={f(bw)}
        opacity="0.40"
      />

      {/* Soft glow — same paths, wider + faint (no SVG filter needed) */}
      <path
        d={arc}
        fill="none"
        stroke={AMBER}
        strokeWidth={f(sw * 2.4)}
        strokeLinecap="round"
        opacity="0.10"
      />
      <line
        x1={f(ex)} y1={f(ey)} x2={tx} y2={ty}
        stroke={AMBER}
        strokeWidth={f(sw * 2.4)}
        strokeLinecap="round"
        opacity="0.10"
      />

      {/* Q arc — amber, bold */}
      <path
        d={arc}
        fill="none"
        stroke={AMBER}
        strokeWidth={f(sw)}
        strokeLinecap="round"
      />

      {/* Rising tail ↗ at 30° */}
      <line
        x1={f(ex)} y1={f(ey)} x2={tx} y2={ty}
        stroke={AMBER}
        strokeWidth={f(sw)}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Nav / inline lockup: icon + wordmark */
export function QLogoInline({
  iconSize  = 28,
  textClass = 'text-sm font-bold',
  className,
}: {
  iconSize?:  number
  textClass?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <QMark size={iconSize} />
      <span
        className={textClass}
        style={{ fontFamily: 'var(--font-bricolage)', letterSpacing: '-0.02em' }}
      >
        <span style={{ color: '#F59E0B' }}>Q</span>
        <span className="th-text">ademic</span>
      </span>
    </div>
  )
}

/** SVG-text wordmark lockup */
export function QWordmark({ size = 32, className }: Props) {
  return (
    <div className={cn('flex items-center', className)} style={{ gap: size * 0.28 }}>
      <QMark size={size} />
      <svg
        viewBox={`0 0 ${size * 3.2} ${size}`}
        width={size * 3.2}
        height={size}
        aria-hidden
      >
        <text
          x="0"
          y={size * 0.72}
          fontFamily="var(--font-bricolage), sans-serif"
          fontWeight="700"
          fontSize={size * 0.5}
          letterSpacing="-0.6"
        >
          <tspan fill="#F59E0B">Q</tspan>
          <tspan fill="#F9FAFB">ademic</tspan>
        </text>
      </svg>
    </div>
  )
}

/** Large mark with ambient glow — hero / splash */
export function QHeroMark({ size = 80, className }: Props) {
  return (
    <div className={cn('relative inline-flex', className)}>
      <div
        className="absolute inset-0 rounded-[22%] blur-2xl"
        style={{ background: 'rgba(245,158,11,0.18)', transform: 'scale(1.5)' }}
      />
      <QMark size={size} className="relative" />
    </div>
  )
}

export default QLogoInline
