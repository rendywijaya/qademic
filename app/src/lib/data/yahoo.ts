// Yahoo unofficial chart API — acceptable for the personal-validation phase only
// (QADEMIC.md §11). A licensed feed replaces this at commercialization.
// Ticker format in: Yahoo (BRK-B). Our DB stores dot format (BRK.B).

export interface YahooBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  adjClose: number
  volume: number
}

interface YahooResponse {
  chart: {
    result: Array<{
      timestamp: number[]
      indicators: {
        quote: Array<{
          open: (number | null)[]
          high: (number | null)[]
          low: (number | null)[]
          close: (number | null)[]
          volume: (number | null)[]
        }>
        adjclose?: Array<{ adjclose: (number | null)[] }>
      }
    }> | null
    error?: { message: string }
  }
}

function toISODate(unixTs: number): string {
  return new Date(unixTs * 1000).toISOString().split('T')[0]
}

export async function fetchYahooOHLCV(ticker: string, range: '5d' | '3mo' | '5y'): Promise<YahooBar[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${range}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json() as YahooResponse
    const result = data?.chart?.result?.[0]
    if (!result) return []

    const timestamps = result.timestamp
    const quote = result.indicators.quote[0]
    const adjclose = result.indicators.adjclose?.[0]?.adjclose ?? quote.close

    return timestamps
      .map((ts, i) => ({
        date: toISODate(ts),
        open: quote.open[i] ?? 0,
        high: quote.high[i] ?? 0,
        low: quote.low[i] ?? 0,
        close: quote.close[i] ?? 0,
        adjClose: adjclose[i] ?? quote.close[i] ?? 0,
        volume: quote.volume[i] ?? 0,
      }))
      .filter(r => r.close > 0)
  } catch {
    return []
  }
}
