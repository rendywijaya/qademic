export interface MarketItem {
  symbol: string
  name: string
  price: string
  change: number
  changePercent: number
}

export const marketData: MarketItem[] = [
  { symbol: 'SPY', name: 'S&P 500', price: '5,234.18', change: 42.56, changePercent: 0.82 },
  { symbol: 'BTC', name: 'Bitcoin', price: '67,420', change: -847.20, changePercent: -1.24 },
  { symbol: 'GLD', name: 'Gold', price: '2,341', change: 7.23, changePercent: 0.31 },
  { symbol: 'QQQ', name: 'NASDAQ', price: '18,124', change: 156.30, changePercent: 0.87 },
  { symbol: 'VIX', name: 'VIX', price: '14.82', change: -0.63, changePercent: -4.08 },
  { symbol: 'DXY', name: 'USD Index', price: '104.21', change: 0.18, changePercent: 0.17 },
  { symbol: 'TNX', name: '10Y Yield', price: '4.34%', change: 0.03, changePercent: 0.69 },
]
