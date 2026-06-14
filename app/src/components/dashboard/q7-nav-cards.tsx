'use client'

import Link from 'next/link'
import {
  Globe, Layers, TrendingUp, FlaskConical, UserSearch,
  Users, Calendar,
} from 'lucide-react'

const Q7_PILLARS = [
  { id: 'Q1', label: 'Macro',               href: '/dashboard/macro',    color: '#A78BFA', icon: Globe },
  { id: 'Q2', label: 'Sectors',             href: '/dashboard/sectors',  color: '#38BDF8', icon: Layers },
  { id: 'Q3', label: 'Stock Analysis',      href: '/dashboard/stocks',   color: '#34D399', icon: TrendingUp },
  { id: 'Q4', label: 'Quant',               href: '/dashboard/quant',    color: '#F59E0B', icon: FlaskConical },
  { id: 'Q5', label: 'Insider & Sentiment', href: '/dashboard/insider',  color: '#FB7185', icon: UserSearch },
  { id: 'Q6', label: 'Management',          href: '',                    color: '#E879F9', icon: Users,    soon: true },
  { id: 'Q7', label: 'Catalyst & Earnings', href: '/dashboard/earnings', color: '#F97316', icon: Calendar },
]

export default function Q7NavCards() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {Q7_PILLARS.map((p) => {
        const card = (
          <div
            className="border rounded-lg p-4 text-center transition-all duration-200"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'var(--border)',
              opacity: p.soon ? 0.5 : 1,
              cursor: p.soon ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => {
              if (!p.soon) (e.currentTarget as HTMLElement).style.borderColor = `${p.color}40`
            }}
            onMouseLeave={e => {
              if (!p.soon) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2.5"
              style={{ backgroundColor: `${p.color}12`, border: `1px solid ${p.color}25` }}>
              <p.icon className="w-4 h-4" style={{ color: p.color }} />
            </div>
            <div className="text-[9px] font-bold mb-0.5"
              style={{ fontFamily: 'var(--font-mono)', color: p.color }}>
              {p.id}
            </div>
            <div className="text-[10px] font-medium leading-tight"
              style={{ color: 'var(--text-dim)' }}>
              {p.label}
            </div>
            {p.soon && (
              <div className="mt-1.5 text-[8px] font-bold uppercase tracking-wide"
                style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                SOON
              </div>
            )}
          </div>
        )

        return p.soon
          ? <div key={p.id}>{card}</div>
          : <Link key={p.id} href={p.href}>{card}</Link>
      })}
    </div>
  )
}
