// Setup grades replace buy/sell recommendation labels everywhere (METHODOLOGY.md §8).
// Grades describe analysis quality — never trade instructions (ASIC: general information only).

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

const LEGACY_REC: Record<string, Grade> = {
  strong_buy: 'A', buy: 'B', hold: 'C', sell: 'D', strong_sell: 'F',
}

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F']

export function scoreToGrade(setupScore: number): Grade {
  if (setupScore >= 78) return 'A'
  if (setupScore >= 63) return 'B'
  if (setupScore >= 43) return 'C'
  if (setupScore >= 28) return 'D'
  return 'F'
}

// v3 entry-quality grade (QADEMIC.md §4): graded on Timing, with a Business floor —
// a great entry on a weak business is never better than C. The third condition
// (regime supportive) is applied where regime state is displayed, not stored per stock.
export function gradeFromScores(business: number, timing: number): Grade {
  const base: Grade = timing >= 75 ? 'A' : timing >= 60 ? 'B' : timing >= 45 ? 'C' : timing >= 30 ? 'D' : 'F'
  if (business < 40 && (base === 'A' || base === 'B')) return 'C'
  return base
}

// Accepts legacy recommendation strings, already-migrated grades, or a raw score.
export function toGrade(recommendation?: string | null, setupScore?: number): Grade {
  if (recommendation && recommendation in LEGACY_REC) return LEGACY_REC[recommendation]
  if (recommendation && GRADES.includes(recommendation as Grade)) return recommendation as Grade
  if (typeof setupScore === 'number') return scoreToGrade(setupScore)
  return 'C'
}

export const GRADE_META: Record<Grade, { label: string; color: string; bg: string; border: string }> = {
  A: { label: 'A · STRONG SETUP', color: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.25)' },
  B: { label: 'B · FAVORABLE',    color: '#34D399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.25)' },
  C: { label: 'C · NEUTRAL',      color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)' },
  D: { label: 'D · WEAK',         color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)' },
  F: { label: 'F · POOR SETUP',   color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)' },
}

export function gradeMeta(recommendation?: string | null, setupScore?: number) {
  const grade = toGrade(recommendation, setupScore)
  return { grade, ...GRADE_META[grade] }
}

export const DISCLAIMER =
  'Qademic is an educational research framework providing general information only. It does not consider your objectives, financial situation or needs, and is not financial advice. Setup grades describe analysis quality — they are not instructions to trade.'
