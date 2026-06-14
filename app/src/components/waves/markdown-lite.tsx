// Minimal markdown renderer — handles ## / ### headers, **bold**, and paragraphs.
// Avoids pulling a markdown dependency for the small bits of model-authored prose.
import React from 'react'

function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={`${keyBase}-${i}`} style={{ color: '#F9FAFB', fontWeight: 700 }}>
          {p.slice(2, -2)}
        </strong>
      )
    }
    return <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>
  })
}

export default function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (!line.trim()) return
    if (line.startsWith('### ')) {
      out.push(
        <h4 key={i} style={{ fontFamily: 'var(--font-bricolage)', fontSize: 13, fontWeight: 700, color: '#E5E7EB', margin: '14px 0 4px' }}>
          {inline(line.slice(4), `h4-${i}`)}
        </h4>,
      )
    } else if (line.startsWith('## ')) {
      out.push(
        <h3 key={i} style={{ fontFamily: 'var(--font-bricolage)', fontSize: 15, fontWeight: 800, color: '#F59E0B', margin: '18px 0 6px' }}>
          {inline(line.slice(3), `h3-${i}`)}
        </h3>,
      )
    } else if (line.startsWith('# ')) {
      out.push(
        <h2 key={i} style={{ fontFamily: 'var(--font-bricolage)', fontSize: 18, fontWeight: 800, color: '#F9FAFB', margin: '18px 0 8px' }}>
          {inline(line.slice(2), `h2-${i}`)}
        </h2>,
      )
    } else if (/^[-*]\s/.test(line)) {
      out.push(
        <li key={i} style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.7, marginLeft: 16 }}>
          {inline(line.replace(/^[-*]\s/, ''), `li-${i}`)}
        </li>,
      )
    } else {
      out.push(
        <p key={i} style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.75, margin: '0 0 8px' }}>
          {inline(line, `p-${i}`)}
        </p>,
      )
    }
  })
  return <div>{out}</div>
}
