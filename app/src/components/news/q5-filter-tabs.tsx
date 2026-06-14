'use client'

import { type Q5Layer } from '@/lib/data/news-data'

type FilterTab = 'All' | Q5Layer

interface Q5FilterTabsProps {
  active: FilterTab
  onChange: (tab: FilterTab) => void
}

const tabs: FilterTab[] = ['All', 'Q1 Macro', 'Q2 Sector', 'Q3 Fundamental', 'Q4 Quant', 'Q5 Sentiment']

const q5Colors: Record<FilterTab, string> = {
  'All':            '#F59E0B',
  'Q1 Macro':       '#A78BFA',
  'Q2 Sector':      '#38BDF8',
  'Q3 Fundamental': '#34D399',
  'Q4 Quant':       '#F59E0B',
  'Q5 Sentiment':   '#FB7185',
}

export default function Q5FilterTabs({ active, onChange }: Q5FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const isActive = active === tab
        const color = q5Colors[tab]
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-md border transition-all duration-150 uppercase tracking-[0.08em]"
            style={{
              fontFamily: 'var(--font-mono)',
              ...(isActive
                ? {
                    backgroundColor: `${color}12`,
                    color: color,
                    borderColor: `${color}40`,
                    borderBottom: `2px solid ${color}`,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: 'var(--text-ghost)',
                    borderColor: 'var(--border)',
                  }),
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.borderColor = `${color}30`
                ;(e.currentTarget as HTMLElement).style.color = color
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text-ghost)'
              }
            }}
          >
            {tab}
          </button>
        )
      })}
    </div>
  )
}
