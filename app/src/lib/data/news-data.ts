export type Q5Layer = 'Q1 Macro' | 'Q2 Sector' | 'Q3 Fundamental' | 'Q4 Quant' | 'Q5 Sentiment'

export interface NewsItem {
  id: string
  headline: string
  source: string
  publishedAt: Date
  layer: Q5Layer
  aiSummary: string
  url: string
  imageGradient: string
  sentimentScore?: number
  sentimentLabel?: 'bullish' | 'bearish' | 'neutral'
}

export const newsData: NewsItem[] = [
  {
    id: '1',
    headline: 'Fed Signals Rate Cuts Unlikely Before Q3 as Inflation Remains Sticky Above 3%',
    source: 'Wall Street Journal',
    publishedAt: new Date(Date.now() - 23 * 60000),
    layer: 'Q1 Macro',
    aiSummary: 'The Federal Reserve indicated it needs more confidence that inflation is sustainably moving toward 2% before cutting rates. This hawkish stance may pressure growth stocks and increase bond yields through Q2, creating headwinds for high-multiple technology names.',
    url: '#',
    imageGradient: 'from-purple-600 to-blue-700',
  },
  {
    id: '2',
    headline: 'AI Semiconductor Demand Surges: Taiwan Exports Hit Record $14.2B in March',
    source: 'Bloomberg',
    publishedAt: new Date(Date.now() - 2.5 * 3600000),
    layer: 'Q2 Sector',
    aiSummary: 'Taiwan\'s semiconductor exports surged to a record high, driven by insatiable AI chip demand from hyperscalers. This confirms the AI infrastructure buildout remains robust, benefiting companies across the GPU, HBM memory, and advanced packaging supply chains.',
    url: '#',
    imageGradient: 'from-blue-600 to-cyan-600',
  },
  {
    id: '3',
    headline: 'NVIDIA Q1 Earnings: Data Center Revenue Triples YoY to $22.6B, Guidance Beats by 15%',
    source: 'Reuters',
    publishedAt: new Date(Date.now() - 5 * 3600000),
    layer: 'Q3 Fundamental',
    aiSummary: 'NVIDIA delivered another blowout quarter with data center revenue tripling year-over-year. Gross margins expanded to 78.4%, showcasing exceptional pricing power. Forward guidance of $26.5B significantly exceeded consensus estimates of $23.1B, suggesting demand has not yet peaked.',
    url: '#',
    imageGradient: 'from-green-600 to-emerald-600',
  },
  {
    id: '4',
    headline: 'Smart Money Accumulation in Healthcare: Institutional Flow Data Shows $4.2B Inflows This Week',
    source: 'Goldman Sachs Research',
    publishedAt: new Date(Date.now() - 8 * 3600000),
    layer: 'Q4 Quant',
    aiSummary: 'Institutional flow data reveals significant accumulation in healthcare and biotech names, with $4.2B in net inflows over the past 5 trading days. The 14-day RSI for XLV sits at 42, suggesting the sector is approaching oversold territory — a contrarian setup worth watching.',
    url: '#',
    imageGradient: 'from-orange-500 to-amber-600',
  },
  {
    id: '5',
    headline: 'Retail Investor Sentiment Hits 18-Month High: AAII Bull Ratio at 64% — Is This a Warning Sign?',
    source: 'Barron\'s',
    publishedAt: new Date(Date.now() - 24 * 3600000),
    layer: 'Q5 Sentiment',
    aiSummary: 'The AAII Sentiment Survey shows bullish retail investor sentiment hitting 64%, the highest level since October 2022. Historically, extreme bullish readings above 60% have preceded short-term market pullbacks of 5–10%, though this can persist for weeks before mean-reverting.',
    url: '#',
    imageGradient: 'from-red-500 to-rose-600',
  },
]
