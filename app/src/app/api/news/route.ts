import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'

const NEWS_KEY = process.env.NEWS_API_KEY
const client = new Anthropic()

type Q5Layer = 'Q1 Macro' | 'Q2 Sector' | 'Q3 Fundamental' | 'Q4 Quant' | 'Q5 Sentiment'

export interface LiveNewsItem {
  id: string
  headline: string
  source: string
  publishedAt: string
  layer: Q5Layer
  aiSummary: string
  url: string
  sentimentScore: number         // -100 to +100
  sentimentLabel: 'bullish' | 'bearish' | 'neutral'
}

interface NewsApiArticle {
  title: string
  description: string | null
  url: string
  source: { name: string }
  publishedAt: string
}

async function fetchArticles(): Promise<NewsApiArticle[]> {
  // Use top-headlines business category — strictly business/finance news
  const url = new URL('https://newsapi.org/v2/top-headlines')
  url.searchParams.set('category', 'business')
  url.searchParams.set('language', 'en')
  url.searchParams.set('pageSize', '30')
  url.searchParams.set('apiKey', NEWS_KEY!)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json() as { articles?: NewsApiArticle[]; status: string }
  if (data.status !== 'ok' || !data.articles) return []

  const FINANCE_WORDS = [
    'stock', 'market', 'invest', 'earnings', 'revenue', 'profit', 'loss',
    'fed', 'federal reserve', 'inflation', 'rate', 'gdp', 'economy', 'economic',
    'trade', 'bond', 'equity', 'etf', 'fund', 'nasdaq', 's&p', 'dow', 'wall street',
    'sector', 'ipo', 'shares', 'company', 'billion', 'trillion', 'quarter',
    'growth', 'recession', 'bank', 'financial', 'price', 'tech', 'energy',
  ]

  // Deduplicate by URL and filter to financial content
  const seen = new Set<string>()
  return data.articles.filter(a => {
    if (!a.title || a.title === '[Removed]') return false
    if (seen.has(a.url)) return false
    seen.add(a.url)
    const text = `${a.title} ${a.description ?? ''}`.toLowerCase()
    return FINANCE_WORDS.some(k => text.includes(k))
  }).slice(0, 20)
}

async function tagAndSummarize(articles: NewsApiArticle[]): Promise<LiveNewsItem[]> {
  if (!process.env.ANTHROPIC_API_KEY || articles.length === 0) {
    return articles.slice(0, 10).map((a, i) => ({
      id: `news-${i}`,
      headline: a.title,
      source: a.source.name,
      publishedAt: a.publishedAt,
      layer: 'Q1 Macro' as Q5Layer,
      aiSummary: a.description ?? 'Read the full article for details.',
      url: a.url,
      sentimentScore: 0,
      sentimentLabel: 'neutral' as const,
    }))
  }

  const articleList = articles.slice(0, 15).map((a, i) =>
    `${i + 1}. "${a.title}" — ${a.source.name}\n   ${a.description ?? ''}`
  ).join('\n\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are an expert financial analyst using the Q5 Framework to classify market news.

Q5 Framework:
- Q1 Macro: Central banks, interest rates, inflation, GDP, geopolitics, currency
- Q2 Sector: Industry trends, sector rotation, ETF flows, supply chains
- Q3 Fundamental: Company earnings, revenue, margins, PE, balance sheet
- Q4 Quant: Technical signals, momentum, volume, price action, algorithmic flows
- Q5 Sentiment: Investor sentiment, fear/greed, retail flows, social media, options activity

Articles:
${articleList}

For each article, return a JSON array. Each object:
{
  "index": 1,
  "layer": "Q1 Macro",
  "summary": "One-sentence investor-focused insight (max 25 words) explaining why this matters for investing",
  "sentiment": 0
}

sentiment is an integer from -100 to +100. Focus on market impact, not just tone.
Positive = good for markets/the company. Negative = bad news.
>30 = bullish, <-30 = bearish, -30 to 30 = neutral.

Return ONLY the JSON array, no other text.`,
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return []

  const text = textBlock.text.trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']') + 1
  if (start === -1) return []

  const tags = JSON.parse(text.slice(start, end)) as Array<{
    index: number
    layer: Q5Layer
    summary: string
    sentiment?: number
  }>

  return tags
    .filter(t => t.index >= 1 && t.index <= articles.length)
    .map(t => {
      const a = articles[t.index - 1]
      const rawScore = typeof t.sentiment === 'number' ? Math.round(t.sentiment) : 0
      const score = Math.max(-100, Math.min(100, rawScore))
      const label: 'bullish' | 'bearish' | 'neutral' =
        score > 30 ? 'bullish' : score < -30 ? 'bearish' : 'neutral'
      return {
        id: `news-${t.index}-${Date.now()}`,
        headline: a.title,
        source: a.source.name,
        publishedAt: a.publishedAt,
        layer: t.layer,
        aiSummary: t.summary,
        url: a.url,
        sentimentScore: score,
        sentimentLabel: label,
      }
    })
}

const fetchNews = unstable_cache(
  async (): Promise<LiveNewsItem[]> => {
    if (!NEWS_KEY) return []
    const articles = await fetchArticles()
    if (articles.length === 0) return []
    return tagAndSummarize(articles)
  },
  ['live-news-v3'],
  { revalidate: 21600 }
)

export async function GET() {
  const news = await fetchNews()
  return NextResponse.json(news, {
    headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' },
  })
}
