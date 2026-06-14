import { cn } from '@/lib/utils'
import { type Q5Layer } from '@/lib/data/news-data'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'q5' | 'popular' | 'pro'
  layer?: Q5Layer
  className?: string
}

const q5Styles: Record<Q5Layer, string> = {
  'Q1 Macro':       'bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/25',
  'Q2 Sector':      'bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/25',
  'Q3 Fundamental': 'bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/25',
  'Q4 Quant':       'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/25',
  'Q5 Sentiment':   'bg-[#FB7185]/10 text-[#FB7185] border border-[#FB7185]/25',
}

export function Badge({ children, variant = 'default', layer, className }: BadgeProps) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md tracking-wide'

  const variants = {
    default:  'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]',
    success:  'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/25',
    warning:  'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/25',
    danger:   'bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/25',
    q5:       layer ? q5Styles[layer] : 'bg-[var(--surface-2)] text-[var(--text-muted)]',
    popular:  'bg-[#F59E0B] text-[#050810] font-bold',
    pro:      'bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/25',
  }

  return (
    <span className={cn(base, variants[variant], className)}>
      {children}
    </span>
  )
}

export function Q5Badge({ layer }: { layer: Q5Layer }) {
  return (
    <Badge variant="q5" layer={layer}>
      {layer}
    </Badge>
  )
}
