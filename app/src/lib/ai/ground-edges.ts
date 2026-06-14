/**
 * Grounded edge discovery — the contrarian upgrade.
 * Pulls the target's latest 10-K Business section (SEC EDGAR, free) + recent news,
 * and has Claude extract supplier/customer/competitor edges grounded in that real,
 * current text — quoting the supporting phrase. Edges stored with source='edgar'.
 * Falls back to knowledge-based extraction when no filing/news is available.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetch10KBusiness } from '../edgar'
import { fetchNews, headlinesToText } from '../news'
import { extractEdgesForEntity, type ExtractResult } from './extract-edges'

export interface GroundedResult {
  result: ExtractResult | null
  grounded: boolean
  sourceUrl: string | null
  filingDate: string | null
}

export async function groundEdgesForTicker(
  db: SupabaseClient,
  target: { id: string; ticker: string; name: string },
  candidates: { id: string; ticker: string; name: string }[],
): Promise<GroundedResult> {
  const biz = await fetch10KBusiness(target.ticker).catch(() => null)
  const news = await fetchNews(target.name, { days: 45, max: 10 }).catch(() => [])

  const parts: string[] = []
  if (biz) parts.push(`[${target.ticker} latest 10-K, filed ${biz.date} — Business section]\n${biz.text}`)
  if (news.length) parts.push(`[Recent news on ${target.name}]\n${headlinesToText(news)}`)

  if (!parts.length) {
    const result = await extractEdgesForEntity(db, target, candidates)
    return { result, grounded: false, sourceUrl: null, filingDate: null }
  }

  const grounding = { text: parts.join('\n\n'), source: biz ? 'edgar' : 'news' }
  const result = await extractEdgesForEntity(db, target, candidates, grounding)
  return { result, grounded: true, sourceUrl: biz?.sourceUrl ?? null, filingDate: biz?.date ?? null }
}
