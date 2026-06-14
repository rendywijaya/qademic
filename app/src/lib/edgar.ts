/**
 * Direct SEC EDGAR access — free, unthrottled (10 req/sec with a proper User-Agent),
 * no FMP in the path. Pulls the latest 10-K and extracts the Business section (Item 1),
 * which is where companies name their customers, suppliers, and competitors — the raw
 * material for grounded interconnection edges.
 *
 * SEC fair-access policy requires a User-Agent identifying the requester.
 */

const SEC_UA = 'WorldContrarian (qademic.com) research contact rendyyap9@gmail.com'
const SUBMISSIONS = 'https://data.sec.gov/submissions'
const TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json'

async function secFetch(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': SEC_UA, Accept: 'application/json, text/html' }, cache: 'no-store' })
}

// ── ticker → CIK (10-digit, zero-padded) ──────────────────────────────────────
let cikCache: Map<string, string> | null = null

async function loadCikMap(): Promise<Map<string, string>> {
  if (cikCache) return cikCache
  const res = await secFetch(TICKERS_URL)
  if (!res.ok) throw new Error(`SEC ticker map ${res.status}`)
  const data = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>
  const map = new Map<string, string>()
  for (const k of Object.keys(data)) {
    const e = data[k]
    map.set(e.ticker.toUpperCase(), String(e.cik_str).padStart(10, '0'))
  }
  cikCache = map
  return map
}

export async function getCik(ticker: string): Promise<string | null> {
  try {
    const map = await loadCikMap()
    return map.get(ticker.toUpperCase()) ?? null
  } catch {
    return null
  }
}

// ── latest 10-K (or 10-K/A) primary document ──────────────────────────────────
export async function getLatest10K(cik: string): Promise<{ url: string; date: string } | null> {
  const res = await secFetch(`${SUBMISSIONS}/CIK${cik}.json`)
  if (!res.ok) return null
  const data = (await res.json()) as {
    filings?: { recent?: { form: string[]; accessionNumber: string[]; primaryDocument: string[]; filingDate: string[] } }
  }
  const r = data.filings?.recent
  if (!r) return null
  // 10-K (domestic), 20-F (foreign private issuers, e.g. TSM/ASML), 40-F (Canadian)
  const ANNUAL = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F'])
  for (let i = 0; i < r.form.length; i++) {
    if (ANNUAL.has(r.form[i])) {
      const acc = r.accessionNumber[i].replace(/-/g, '')
      const doc = r.primaryDocument[i]
      if (!doc) continue
      const url = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${acc}/${doc}`
      return { url, date: r.filingDate[i] }
    }
  }
  return null
}

// ── HTML → text ───────────────────────────────────────────────────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#?[a-z0-9]+;/gi, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Extract the Business section (Item 1). 10-Ks repeat "Item 1" in the table of
// contents, so we take the text from the LAST "Item 1. Business" up to the next
// "Item 1A"/"Item 2". Falls back to a keyword-dense window, then a head slice.
function extractBusiness(text: string): string {
  const lower = text.toLowerCase()
  const startMatches = [...lower.matchAll(/item\s*1\s*[\.\:\)]?\s*business/g)]
  const start = startMatches.length ? startMatches[startMatches.length - 1].index ?? 0 : -1

  if (start >= 0) {
    const after = lower.slice(start + 20)
    const endRel = after.search(/item\s*1a\s*[\.\:\)]?\s*risk|item\s*2\s*[\.\:\)]?\s*propert/)
    const end = endRel > 500 ? start + 20 + endRel : start + 24000
    const section = text.slice(start, Math.min(end, start + 24000)).trim()
    if (section.length > 800) return section
  }

  // fallback: window around customer/supplier/competition mentions
  const kw = lower.search(/customers?|suppliers?|competit/)
  if (kw > 0) return text.slice(Math.max(0, kw - 2000), kw + 18000).trim()

  return text.slice(0, 16000).trim()
}

export interface EdgarBusiness {
  ticker: string
  date: string
  text: string
  sourceUrl: string
}

/** Fetch + extract the latest 10-K Business section for a ticker. Free, no FMP. */
export async function fetch10KBusiness(ticker: string, maxChars = 16000): Promise<EdgarBusiness | null> {
  const cik = await getCik(ticker)
  if (!cik) return null
  const filing = await getLatest10K(cik)
  if (!filing) return null
  const res = await secFetch(filing.url)
  if (!res.ok) return null
  const html = await res.text()
  const text = htmlToText(html)
  const section = extractBusiness(text)
  if (section.length < 400) return null
  return { ticker, date: filing.date, text: section.slice(0, maxChars), sourceUrl: filing.url }
}
