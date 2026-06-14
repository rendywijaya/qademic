/**
 * Live news headlines via NewsAPI (NEWS_API_KEY). Used to ground edge discovery and
 * wave detection in what the world is saying *now*. Degrades to [] on any failure —
 * news is supplementary; EDGAR filings are the primary grounding.
 */
const NEWS_API = 'https://newsapi.org/v2/everything'

export interface Headline {
  title: string
  description: string | null
  source: string
  publishedAt: string
  url: string
}

export async function fetchNews(
  query: string,
  opts: { days?: number; max?: number } = {},
): Promise<Headline[]> {
  const key = process.env.NEWS_API_KEY
  if (!key) return []
  const from = new Date(Date.now() - (opts.days ?? 30) * 86400000).toISOString().slice(0, 10)
  const url =
    `${NEWS_API}?q=${encodeURIComponent(query)}&from=${from}` +
    `&sortBy=publishedAt&language=en&pageSize=${opts.max ?? 12}&apiKey=${key}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = (await res.json()) as {
      articles?: Array<{ title: string; description: string | null; source?: { name?: string }; publishedAt: string; url: string }>
    }
    return (data.articles ?? []).map((a) => ({
      title: a.title,
      description: a.description,
      source: a.source?.name ?? '',
      publishedAt: a.publishedAt,
      url: a.url,
    }))
  } catch {
    return []
  }
}

export function headlinesToText(headlines: Headline[]): string {
  return headlines
    .map((h) => `- ${h.title}${h.description ? `: ${h.description}` : ''} (${h.source}, ${h.publishedAt.slice(0, 10)})`)
    .join('\n')
}
