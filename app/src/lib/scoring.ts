/**
 * Qademic Rule-Based Scoring Engine
 * Zero AI cost — runs for every stock nightly.
 * Claude is invoked only when a trigger event fires (earnings, large score delta, etc.)
 *
 * v3 doctrine (QADEMIC.md §4): per-stock scores use per-stock pillars ONLY.
 *   BUSINESS = mean(Q3 Fundamental, Q6 Management)   — what to own (moves quarterly)
 *   TIMING   = mean(Q4 Quant, Q5 Smart money, Q7 Catalyst) — when to act (moves daily)
 *   Composite (display) = equal-weight mean of Q3..Q7 (1/N — weights are never tuned)
 * Q1 Macro and market-level Q2 are CONTEXT layers: macro gates exposure via the
 * regime engine (regime_daily); it never adds points to an individual stock.
 */

// ─── Input types ────────────────────────────────────────────────────────────

export interface MacroInput {
  fedRate: number        // FEDFUNDS %
  cpi: number            // CPI YoY %
  tenYearYield: number   // DGS10 %
  yieldCurve: number     // 10Y-2Y spread; negative = inverted
  unemployment: number   // UNRATE %
  vix?: number           // VIX spot level
}

export interface SectorInput {
  sectorChangePct1d: number  // sector ETF 1-day % change
  sectorRank: number         // 1 = top performing sector today, 11 = bottom
  sectorPeVsHistAvg?: number // ratio: current / 5yr avg P/E (1.0 = at avg)
}

export interface FundamentalInput {
  revenueGrowth: number          // YoY %
  priorRevenueGrowth?: number    // prior year YoY % (for acceleration signal)
  grossMargin: number             // %
  fcfMargin: number               // %
  netMargin?: number              // %
  roe: number                     // %
  debtEquity: number              // ratio
  pe?: number                     // trailing or forward P/E
  sectorAvgPe?: number            // for relative valuation
  epsBeatStreak?: number          // consecutive quarterly EPS beats (negative = misses)
  revenueVsEstimate?: number      // last quarter: actual vs consensus % surprise
}

export interface QuantInput {
  price: number
  sma20?: number
  sma50?: number
  sma200?: number
  rsi14?: number
  momentum1m?: number    // price change % over 1 month
  momentum3m?: number    // price change % over 3 months
  momentum6m?: number    // price change % over 6 months
  volumeRatio20d?: number // current volume / 20d average volume
  shortInterestPct?: number // short interest as % of float
}

export interface SentimentInput {
  insiderNetBuyingUsd?: number      // net $ bought minus sold, last 90 days
  analystBuyPct?: number            // % of analysts rating Buy (0–100)
  analystAvgPtUpside?: number       // % implied upside to average price target
  putCallRatio?: number             // options market put/call ratio
  institutionalOwnershipChangePct?: number // net % change last quarter (13F)
}

export interface ManagementInput {
  isFounderLed?: boolean
  insiderOwnershipPct?: number   // % of shares owned by mgmt + directors
  roic1yr?: number
  roic3yrAvg?: number
  roicTrend?: 'improving' | 'stable' | 'declining'
  debtTrend?: 'reducing' | 'stable' | 'increasing'
  precomputedMgmtScore?: number  // use this if already computed by management_scores pipeline
}

export interface CatalystInput {
  daysToNextEarnings?: number
  lastEarningsBeat?: boolean
  earningsBeatStreak?: number    // consecutive quarterly beats
  recentCatalysts?: Array<'buyback' | 'dividend_raise' | 'analyst_day' | 'product_launch' | 'spin_off'>
}

// ─── Output type ────────────────────────────────────────────────────────────

export interface PillarScore {
  score: number      // 0–100
  signals: string[]  // plain English signal bullets (used when AI narrative not available)
}

export interface AlgorithmicScores {
  q1: PillarScore
  q2: PillarScore
  q3: PillarScore
  q4: PillarScore
  q5: PillarScore
  q6: PillarScore
  q7: PillarScore
  setupScore: number
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function fmt1(n: number) { return n.toFixed(1) }
function fmt0(n: number) { return n.toFixed(0) }
function fmtM(n: number) { return `$${(Math.abs(n) / 1e6).toFixed(0)}M` }

// ─── Q1: MACRO ───────────────────────────────────────────────────────────────

export function scoreQ1(m: MacroInput): PillarScore {
  let score = 50
  const signals: string[] = []

  // Fed Rate — single biggest driver of growth stock multiples
  if (m.fedRate < 2) {
    score += 15
    signals.push(`Fed rate ${fmt1(m.fedRate)}% — very accommodative, major multiple expansion tailwind`)
  } else if (m.fedRate < 3.5) {
    score += 8
    signals.push(`Fed rate ${fmt1(m.fedRate)}% — supportive for equities`)
  } else if (m.fedRate < 4.5) {
    signals.push(`Fed rate ${fmt1(m.fedRate)}% — neutral, watching for cuts`)
  } else if (m.fedRate < 5.5) {
    score -= 8
    signals.push(`Fed rate ${fmt1(m.fedRate)}% — restrictive, headwind for high-multiple stocks`)
  } else {
    score -= 15
    signals.push(`Fed rate ${fmt1(m.fedRate)}% — very restrictive, discount rate headwind`)
  }

  // CPI
  if (m.cpi < 2) {
    score += 10
    signals.push('Inflation contained — Fed has full room to ease')
  } else if (m.cpi < 3) {
    score += 5
    signals.push(`CPI ${fmt1(m.cpi)}% — moderate, within tolerance`)
  } else if (m.cpi < 4.5) {
    score -= 5
    signals.push(`CPI ${fmt1(m.cpi)}% — elevated, may keep Fed restrictive longer`)
  } else {
    score -= 15
    signals.push(`CPI ${fmt1(m.cpi)}% — high inflation regime, Fed unlikely to ease`)
  }

  // Yield Curve (10Y–2Y)
  if (m.yieldCurve > 0.5) {
    score += 10
    signals.push('Yield curve steep — classic expansion/growth regime signal')
  } else if (m.yieldCurve > 0) {
    score += 5
    signals.push('Yield curve normalizing after inversion — recovery signal')
  } else if (m.yieldCurve > -0.5) {
    score -= 5
    signals.push('Yield curve slightly inverted — mild caution')
  } else {
    score -= 15
    signals.push(`Yield curve inverted ${fmt1(m.yieldCurve)}% — historical recession precursor, defensive posture`)
  }

  // Unemployment
  if (m.unemployment < 4) {
    score += 5
    signals.push('Strong labor market — consumer spending supported, soft landing scenario')
  } else if (m.unemployment > 6) {
    score -= 8
    signals.push(`Unemployment ${fmt1(m.unemployment)}% — labor weakness signals economic stress`)
  }

  // VIX
  if (m.vix !== undefined) {
    if (m.vix < 15) {
      score += 10
      signals.push(`VIX ${fmt0(m.vix)} — very low fear, full risk-on environment`)
    } else if (m.vix < 20) {
      score += 5
      signals.push(`VIX ${fmt0(m.vix)} — calm markets, institutional risk appetite healthy`)
    } else if (m.vix > 30) {
      score -= 15
      signals.push(`VIX ${fmt0(m.vix)} — elevated fear, risk-off conditions, volatility drag`)
    } else if (m.vix > 25) {
      score -= 8
      signals.push(`VIX ${fmt0(m.vix)} — above-average volatility, defensive bias`)
    }
  }

  return { score: clamp(score), signals }
}

// ─── Q2: SECTOR ──────────────────────────────────────────────────────────────

export function scoreQ2(s: SectorInput): PillarScore {
  let score = 50
  const signals: string[] = []

  // 1-day sector performance
  if (s.sectorChangePct1d > 2) {
    score += 12
    signals.push(`Sector +${fmt1(s.sectorChangePct1d)}% today — strong institutional inflow`)
  } else if (s.sectorChangePct1d > 0.5) {
    score += 7
    signals.push(`Sector +${fmt1(s.sectorChangePct1d)}% — positive rotation signal`)
  } else if (s.sectorChangePct1d > 0) {
    score += 3
  } else if (s.sectorChangePct1d > -0.5) {
    score -= 3
  } else if (s.sectorChangePct1d > -2) {
    score -= 8
    signals.push(`Sector ${fmt1(s.sectorChangePct1d)}% — rotation out, headwind`)
  } else {
    score -= 15
    signals.push(`Sector ${fmt1(s.sectorChangePct1d)}% — heavy selling, strong rotation out`)
  }

  // Sector rank (1=top, 11=bottom across GICS sectors)
  if (s.sectorRank === 1) {
    score += 15
    signals.push('Top performing sector today — institutional money actively rotating in')
  } else if (s.sectorRank <= 3) {
    score += 8
    signals.push('Among top 3 sectors — favored in current rotation')
  } else if (s.sectorRank >= 10) {
    score -= 10
    signals.push('Among bottom 2 sectors — money actively rotating out')
  } else if (s.sectorRank >= 8) {
    score -= 5
    signals.push('Below-average sector performance today')
  }

  // Sector valuation vs history
  if (s.sectorPeVsHistAvg !== undefined) {
    if (s.sectorPeVsHistAvg < 0.8) {
      score += 10
      signals.push('Sector trading at discount to 5yr historical P/E average')
    } else if (s.sectorPeVsHistAvg < 0.95) {
      score += 5
    } else if (s.sectorPeVsHistAvg > 1.6) {
      score -= 10
      signals.push('Sector at significant premium to historical valuation')
    } else if (s.sectorPeVsHistAvg > 1.3) {
      score -= 5
    }
  }

  return { score: clamp(score), signals }
}

// ─── Q3: FUNDAMENTAL ─────────────────────────────────────────────────────────

export function scoreQ3(f: FundamentalInput): PillarScore {
  let score = 50
  const signals: string[] = []

  // Revenue Growth — the single most important fundamental signal
  if (f.revenueGrowth > 50) {
    score += 20
    signals.push(`Revenue +${fmt0(f.revenueGrowth)}% YoY — hypergrowth, top 0.1% of all stocks`)
  } else if (f.revenueGrowth > 30) {
    score += 16
    signals.push(`Revenue +${fmt0(f.revenueGrowth)}% YoY — exceptional, institutional-grade growth`)
  } else if (f.revenueGrowth > 20) {
    score += 12
    signals.push(`Revenue +${fmt0(f.revenueGrowth)}% YoY — strong, well above market rate`)
  } else if (f.revenueGrowth > 10) {
    score += 8
    signals.push(`Revenue +${fmt0(f.revenueGrowth)}% YoY — solid growth`)
  } else if (f.revenueGrowth > 5) {
    score += 4
    signals.push(`Revenue +${fmt0(f.revenueGrowth)}% YoY — modest growth`)
  } else if (f.revenueGrowth > 0) {
    score += 2
  } else if (f.revenueGrowth > -10) {
    score -= 8
    signals.push(`Revenue ${fmt0(f.revenueGrowth)}% — declining revenue is a structural red flag`)
  } else if (f.revenueGrowth > -25) {
    score -= 16
    signals.push(`Revenue ${fmt0(f.revenueGrowth)}% — significant revenue decline, thesis at risk`)
  } else {
    score -= 22
    signals.push(`Revenue ${fmt0(f.revenueGrowth)}% — severe decline, potential value trap`)
  }

  // Revenue growth acceleration / deceleration
  if (f.priorRevenueGrowth !== undefined) {
    const delta = f.revenueGrowth - f.priorRevenueGrowth
    if (delta > 8) {
      score += 6
      signals.push(`Growth accelerating +${fmt0(delta)}pts vs prior year — momentum building`)
    } else if (delta < -12) {
      score -= 7
      signals.push(`Growth decelerating ${fmt0(delta)}pts vs prior year — watch for further slowdown`)
    }
  }

  // Gross Margin — quality/moat indicator
  if (f.grossMargin > 70) {
    score += 12
    signals.push(`Gross margin ${fmt0(f.grossMargin)}% — software/platform-like pricing power`)
  } else if (f.grossMargin > 50) {
    score += 8
    signals.push(`Gross margin ${fmt0(f.grossMargin)}% — strong pricing power`)
  } else if (f.grossMargin > 30) {
    score += 4
  } else if (f.grossMargin < 15) {
    score -= 8
    signals.push(`Gross margin ${fmt0(f.grossMargin)}% — thin margins, competitive pressure`)
  }

  // FCF Margin — earnings quality
  if (f.fcfMargin > 30) {
    score += 12
    signals.push(`FCF margin ${fmt0(f.fcfMargin)}% — exceptional cash generation`)
  } else if (f.fcfMargin > 15) {
    score += 8
    signals.push(`FCF margin ${fmt0(f.fcfMargin)}% — strong free cash flow`)
  } else if (f.fcfMargin > 5) {
    score += 4
  } else if (f.fcfMargin < 0) {
    score -= 12
    signals.push('Negative FCF — cash burning, watch runway and dilution risk')
  }

  // Return on Equity
  if (f.roe > 40) {
    score += 10
    signals.push(`ROE ${fmt0(f.roe)}% — exceptional capital efficiency, top 5% globally`)
  } else if (f.roe > 20) {
    score += 7
    signals.push(`ROE ${fmt0(f.roe)}% — strong returns on equity`)
  } else if (f.roe > 10) {
    score += 3
  } else if (f.roe < 0) {
    score -= 10
    signals.push('Negative ROE — equity capital being consumed, not compounding')
  }

  // Debt/Equity — balance sheet risk
  if (f.debtEquity < 0.1) {
    score += 8
    signals.push('Near-zero debt — fortress balance sheet, can invest aggressively in downturns')
  } else if (f.debtEquity < 0.5) {
    score += 4
  } else if (f.debtEquity > 3) {
    score -= 8
    signals.push(`D/E ${fmt1(f.debtEquity)}× — elevated leverage, interest burden constrains growth`)
  } else if (f.debtEquity > 1.5) {
    score -= 4
  }

  // Valuation — P/E vs sector
  if (f.pe !== undefined && f.pe > 0) {
    if (f.sectorAvgPe !== undefined && f.sectorAvgPe > 0) {
      const ratio = f.pe / f.sectorAvgPe
      if (ratio < 0.5) {
        score += 12
        signals.push(`P/E ${fmt0(f.pe)}× — 50%+ discount to sector avg ${fmt0(f.sectorAvgPe)}×, potential mispricing`)
      } else if (ratio < 0.8) {
        score += 7
        signals.push(`P/E ${fmt0(f.pe)}× — below sector avg ${fmt0(f.sectorAvgPe)}×`)
      } else if (ratio > 2.2) {
        score -= 10
        signals.push(`P/E ${fmt0(f.pe)}× — 2×+ sector premium requires flawless execution`)
      } else if (ratio > 1.5) {
        score -= 5
      }
    } else {
      // Absolute P/E without sector context
      if (f.pe < 10) { score += 8; signals.push(`P/E ${fmt0(f.pe)}× — low absolute valuation`) }
      else if (f.pe < 20) { score += 4 }
      else if (f.pe > 60) { score -= 8; signals.push(`P/E ${fmt0(f.pe)}× — premium valuation, growth must continue`) }
      else if (f.pe > 100) { score -= 14 }
    }
  }

  // EPS beat streak
  if (f.epsBeatStreak !== undefined) {
    if (f.epsBeatStreak >= 8) {
      score += 10
      signals.push(`${f.epsBeatStreak} consecutive EPS beats — management consistently delivers on guidance`)
    } else if (f.epsBeatStreak >= 4) {
      score += 6
      signals.push(`${f.epsBeatStreak} consecutive EPS beats — strong execution track record`)
    } else if (f.epsBeatStreak >= 2) {
      score += 3
    } else if (f.epsBeatStreak === 0) {
      score -= 8
      signals.push('Missed last earnings — broken beat streak, watch next quarter carefully')
    } else if (f.epsBeatStreak < 0) {
      score -= 14
      signals.push(`${Math.abs(f.epsBeatStreak)} consecutive misses — execution concern, trust is eroding`)
    }
  }

  return { score: clamp(score), signals }
}

// ─── Q4: QUANT ───────────────────────────────────────────────────────────────

export function scoreQ4(q: QuantInput): PillarScore {
  let score = 50
  const signals: string[] = []

  // Price vs 200-day SMA — the primary trend filter
  if (q.sma200 && q.price > 0) {
    const vs200 = ((q.price - q.sma200) / q.sma200) * 100
    if (vs200 > 40) {
      score += 3
      signals.push(`${fmt0(vs200)}% above 200d MA — strong trend but extended, pullback risk`)
    } else if (vs200 > 5) {
      score += 12
      signals.push(`${fmt0(vs200)}% above 200d MA — healthy uptrend, institutional accumulation confirmed`)
    } else if (vs200 > -5) {
      score += 4
      signals.push('At 200d MA support — trend inflection point, critical level')
    } else if (vs200 > -20) {
      score -= 12
      signals.push(`${fmt0(Math.abs(vs200))}% below 200d MA — broken trend, institutional selling pressure`)
    } else {
      score -= 20
      signals.push(`${fmt0(Math.abs(vs200))}% below 200d MA — deep downtrend, strong negative momentum`)
    }
  }

  // Price vs 50-day SMA — intermediate trend
  if (q.sma50 && q.price > 0) {
    const vs50 = ((q.price - q.sma50) / q.sma50) * 100
    if (vs50 > 5) { score += 6; signals.push('Above 50d MA — intermediate uptrend intact') }
    else if (vs50 > -5) { score += 2 }
    else { score -= 6; signals.push('Below 50d MA — near-term trend broken') }
  }

  // RSI — momentum and overbought/oversold
  if (q.rsi14 !== undefined) {
    if (q.rsi14 < 30) {
      score += 8
      signals.push(`RSI ${fmt0(q.rsi14)} — oversold, historically high-probability bounce setup`)
    } else if (q.rsi14 < 45) {
      score += 12
      signals.push(`RSI ${fmt0(q.rsi14)} — pulled back from overbought into healthy buy zone`)
    } else if (q.rsi14 < 60) {
      score += 8
      signals.push(`RSI ${fmt0(q.rsi14)} — healthy momentum, not extended`)
    } else if (q.rsi14 < 70) {
      score += 4
      signals.push(`RSI ${fmt0(q.rsi14)} — strong momentum, approaching overbought`)
    } else if (q.rsi14 < 80) {
      score -= 2
      signals.push(`RSI ${fmt0(q.rsi14)} — overbought, short-term pullback risk`)
    } else {
      score -= 8
      signals.push(`RSI ${fmt0(q.rsi14)} — extreme overbought, high reversal probability`)
    }
  }

  // 3-month momentum — best single medium-term signal
  if (q.momentum3m !== undefined) {
    if (q.momentum3m > 30) {
      score += 8
      signals.push(`+${fmt0(q.momentum3m)}% 3-month momentum — institutional demand very strong`)
    } else if (q.momentum3m > 10) {
      score += 6
      signals.push(`+${fmt0(q.momentum3m)}% 3-month momentum — positive institutional flow`)
    } else if (q.momentum3m > 0) {
      score += 3
    } else if (q.momentum3m < -20) {
      score -= 12
      signals.push(`${fmt0(q.momentum3m)}% 3-month — severe underperformance, avoid catching falling knife`)
    } else if (q.momentum3m < -5) {
      score -= 6
      signals.push(`${fmt0(q.momentum3m)}% 3-month — negative momentum, wait for stabilization`)
    }
  }

  // 1-month momentum — short-term confirmation
  if (q.momentum1m !== undefined) {
    if (q.momentum1m > 8) { score += 5 }
    else if (q.momentum1m < -8) { score -= 5 }
  }

  // Volume confirmation
  if (q.volumeRatio20d !== undefined && q.volumeRatio20d > 1.5) {
    score += 5
    signals.push(`${fmt1(q.volumeRatio20d)}× average volume — unusual activity, follow the price direction`)
  }

  // Short interest
  if (q.shortInterestPct !== undefined) {
    if (q.shortInterestPct < 2) {
      score += 5
      signals.push('Short interest <2% — bears not fighting this, low crowding risk')
    } else if (q.shortInterestPct > 15) {
      score -= 8
      signals.push(`${fmt0(q.shortInterestPct)}% short interest — significant bear conviction, but potential squeeze fuel`)
    } else if (q.shortInterestPct > 8) {
      score -= 4
    }
  }

  return { score: clamp(score), signals }
}

// ─── Q5: SENTIMENT & INSIDER ─────────────────────────────────────────────────

export function scoreQ5(s: SentimentInput): PillarScore {
  let score = 50
  const signals: string[] = []

  // Insider net buying — strongest signal when significant
  if (s.insiderNetBuyingUsd !== undefined) {
    if (s.insiderNetBuyingUsd > 10_000_000) {
      score += 20
      signals.push(`Insiders net bought ${fmtM(s.insiderNetBuyingUsd)} last 90d — rare, highest-conviction bullish signal`)
    } else if (s.insiderNetBuyingUsd > 2_000_000) {
      score += 12
      signals.push(`Insiders net bought ${fmtM(s.insiderNetBuyingUsd)} — meaningful buying by those who know the business`)
    } else if (s.insiderNetBuyingUsd > 500_000) {
      score += 6
      signals.push(`Net insider buying ${fmtM(s.insiderNetBuyingUsd)} — bullish signal`)
    } else if (s.insiderNetBuyingUsd < -50_000_000) {
      score -= 8
      signals.push(`Heavy insider selling ${fmtM(s.insiderNetBuyingUsd)} — likely 10b5-1 diversification, but scale warrants attention`)
    } else if (s.insiderNetBuyingUsd < -5_000_000) {
      score -= 3
    }
  }

  // Analyst consensus
  if (s.analystBuyPct !== undefined) {
    if (s.analystBuyPct > 90) {
      score += 12
      signals.push(`${fmt0(s.analystBuyPct)}% analyst Buy — near-unanimous Wall St. bullishness`)
    } else if (s.analystBuyPct > 70) {
      score += 8
      signals.push(`${fmt0(s.analystBuyPct)}% analyst Buy — strong consensus`)
    } else if (s.analystBuyPct > 50) {
      score += 4
    } else if (s.analystBuyPct < 35) {
      score -= 10
      signals.push(`Only ${fmt0(s.analystBuyPct)}% Buy — significant sell-side skepticism`)
    }
  }

  // Price target upside
  if (s.analystAvgPtUpside !== undefined) {
    if (s.analystAvgPtUpside > 30) {
      score += 10
      signals.push(`Avg analyst PT implies ${fmt0(s.analystAvgPtUpside)}% upside — sell-side sees significant value`)
    } else if (s.analystAvgPtUpside > 15) {
      score += 5
    } else if (s.analystAvgPtUpside < 0) {
      score -= 8
      signals.push(`Avg analyst PT ${fmt0(s.analystAvgPtUpside)}% below current price — downside risk flagged`)
    }
  }

  // Options sentiment (put/call ratio)
  if (s.putCallRatio !== undefined) {
    if (s.putCallRatio < 0.5) {
      score += 8
      signals.push(`Put/Call ${s.putCallRatio.toFixed(2)} — options market pricing strong upside`)
    } else if (s.putCallRatio < 0.8) {
      score += 4
    } else if (s.putCallRatio > 1.5) {
      score -= 8
      signals.push(`Put/Call ${s.putCallRatio.toFixed(2)} — heavy put buying, hedges being placed`)
    } else if (s.putCallRatio > 1.2) {
      score -= 4
    }
  }

  // Institutional ownership change (13F)
  if (s.institutionalOwnershipChangePct !== undefined) {
    if (s.institutionalOwnershipChangePct > 5) {
      score += 8
      signals.push(`Institutional ownership +${fmt1(s.institutionalOwnershipChangePct)}% last quarter — smart money accumulating`)
    } else if (s.institutionalOwnershipChangePct > 1) {
      score += 4
    } else if (s.institutionalOwnershipChangePct < -5) {
      score -= 8
      signals.push(`Institutional ownership ${fmt1(s.institutionalOwnershipChangePct)}% last quarter — smart money distributing`)
    } else if (s.institutionalOwnershipChangePct < -1) {
      score -= 4
    }
  }

  return { score: clamp(score), signals }
}

// ─── Q6: MANAGEMENT ──────────────────────────────────────────────────────────

export function scoreQ6(m: ManagementInput): PillarScore {
  // If we have a pre-computed management score, use it directly
  if (m.precomputedMgmtScore !== undefined) {
    const s: string[] = []
    if (m.isFounderLed) s.push('Founder-led company — statistically outperform by 3.1× over 10yr')
    if (m.insiderOwnershipPct !== undefined && m.insiderOwnershipPct > 5) {
      s.push(`${fmt1(m.insiderOwnershipPct)}% insider ownership — incentives fully aligned`)
    }
    return { score: clamp(m.precomputedMgmtScore), signals: s }
  }

  let score = 50
  const signals: string[] = []

  if (m.isFounderLed === true) {
    score += 15
    signals.push('Founder-led company — statistically outperform by 3.1× over 10yr (NBER study)')
  }

  if (m.insiderOwnershipPct !== undefined) {
    if (m.insiderOwnershipPct > 10) {
      score += 12
      signals.push(`${fmt1(m.insiderOwnershipPct)}% insider ownership — management eating own cooking`)
    } else if (m.insiderOwnershipPct > 3) {
      score += 7
    } else if (m.insiderOwnershipPct < 0.3) {
      score -= 5
      signals.push('Very low insider ownership — management not materially invested in outcome')
    }
  }

  if (m.roic3yrAvg !== undefined) {
    if (m.roic3yrAvg > 30) {
      score += 15
      signals.push(`ROIC ${fmt0(m.roic3yrAvg)}% 3yr avg — exceptional capital allocation, Buffett-grade quality`)
    } else if (m.roic3yrAvg > 15) {
      score += 8
      signals.push(`ROIC ${fmt0(m.roic3yrAvg)}% — above cost of capital, creating value for shareholders`)
    } else if (m.roic3yrAvg > 5) {
      score += 3
    } else if (m.roic3yrAvg <= 0) {
      score -= 12
      signals.push('ROIC negative — management destroying shareholder capital')
    }
  }

  if (m.roicTrend === 'improving') {
    score += 8
    signals.push('ROIC trend improving — execution quality rising, compounding accelerating')
  } else if (m.roicTrend === 'declining') {
    score -= 8
    signals.push('ROIC trend declining — capital efficiency deteriorating, watch closely')
  }

  if (m.debtTrend === 'reducing') { score += 5; signals.push('Actively reducing debt — balance sheet strengthening') }
  else if (m.debtTrend === 'increasing') { score -= 5 }

  return { score: clamp(score), signals }
}

// ─── Q7: CATALYST ────────────────────────────────────────────────────────────

export function scoreQ7(c: CatalystInput): PillarScore {
  let score = 50
  const signals: string[] = []

  if (c.daysToNextEarnings !== undefined) {
    if (c.daysToNextEarnings <= 3) {
      // Imminent — reduce score (high uncertainty, hold for clarity)
      score -= 5
      signals.push(`Earnings in ${c.daysToNextEarnings} day(s) — imminent, binary risk event, wait for clarity`)
    } else if (c.daysToNextEarnings <= 14) {
      if (c.earningsBeatStreak && c.earningsBeatStreak >= 4) {
        score += 12
        signals.push(`Earnings in ${c.daysToNextEarnings}d — ${c.earningsBeatStreak}-quarter beat streak, management has credibility`)
      } else if (c.lastEarningsBeat === false) {
        score -= 5
        signals.push(`Earnings in ${c.daysToNextEarnings}d — last quarter missed, higher uncertainty`)
      } else {
        score += 6
        signals.push(`Earnings in ${c.daysToNextEarnings}d — near-term catalyst`)
      }
    } else if (c.daysToNextEarnings <= 45) {
      score += 3
      signals.push(`Next earnings ~${c.daysToNextEarnings} days out — medium-term catalyst on horizon`)
    } else {
      signals.push(`Next earnings ~${c.daysToNextEarnings} days out — no near-term catalyst`)
    }
  }

  // Post-earnings reaction (last result)
  if (c.lastEarningsBeat !== undefined && (c.daysToNextEarnings === undefined || c.daysToNextEarnings > 45)) {
    if (c.lastEarningsBeat) {
      score += 10
      signals.push('Beat last earnings — positive momentum catalyst in effect')
    } else {
      score -= 15
      signals.push('Missed last earnings — negative catalyst, wait for next print to confirm recovery')
    }
  }

  // Special catalysts
  if (c.recentCatalysts) {
    if (c.recentCatalysts.includes('buyback')) {
      score += 10
      signals.push('Active buyback program — management buying dips, EPS accretive')
    }
    if (c.recentCatalysts.includes('dividend_raise')) {
      score += 8
      signals.push('Dividend raised — management confident in future earnings power')
    }
    if (c.recentCatalysts.includes('analyst_day')) {
      score += 6
      signals.push('Analyst day announced — management to reset long-term targets')
    }
    if (c.recentCatalysts.includes('product_launch')) {
      score += 6
      signals.push('Major product launch — revenue catalyst in near-term pipeline')
    }
  }

  return { score: clamp(score), signals }
}

// ─── v3 SCORES — per-stock pillars only, equal weight (1/N) ──────────────────
// Macro (Q1) and market-level sector (Q2) never contribute: they are identical
// for every stock, so blending them in shifts the whole universe together and
// pollutes stock-vs-stock comparison. Regime gates exposure separately.

// Null-tolerant 1/N: pillars without real input data are EXCLUDED, never faked
// as neutral 50s. A score only exists if at least one real pillar exists.
function meanOf(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  return clamp(present.reduce((a, b) => a + b, 0) / present.length)
}

// "Is this a good business at a fair price?" — moves quarterly
export function calcBusinessScore(scores: { q3?: number | null; q6?: number | null }): number | null {
  return meanOf([scores.q3, scores.q6])
}

// "Is now a good entry?" — moves daily
export function calcTimingScore(scores: { q4?: number | null; q5?: number | null; q7?: number | null }): number | null {
  return meanOf([scores.q4, scores.q5, scores.q7])
}

// Display composite across the per-stock pillars (legacy `setup_score` column)
export function calcSetupScore(scores: {
  q3?: number | null; q4?: number | null; q5?: number | null; q6?: number | null; q7?: number | null
}): number | null {
  return meanOf([scores.q3, scores.q4, scores.q5, scores.q6, scores.q7])
}

// Pillar score → short label for template text
export function pillarLabel(score: number): string {
  if (score >= 80) return 'very strong'
  if (score >= 65) return 'strong'
  if (score >= 50) return 'neutral'
  if (score >= 35) return 'weak'
  return 'very weak'
}

// Build template narrative from signals (used when Claude narrative not yet generated)
export function buildTemplateNarrative(
  pillarName: string,
  signals: string[],
  score: number,
): string {
  const level = pillarLabel(score)
  if (signals.length === 0) return `${pillarName} signals are ${level}. Score: ${score}/100.`
  return signals.slice(0, 3).join('. ') + '.'
}

// ─── TRIGGER DETECTION ───────────────────────────────────────────────────────

export interface TriggerEvent {
  type: 'first_score' | 'score_delta' | 'earnings' | 'major_insider' | 'price_spike'
  reason: string
}

export function detectTriggers(
  newSetupScore: number,
  prior?: { setupScore: number; scoredAt: string } | null,
  earnings?: { daysToNext: number; justFiled: boolean },
  insiderNetBuying?: number,
  priceChangePct?: number,
): TriggerEvent | null {
  // First time scoring this stock
  if (!prior) return { type: 'first_score', reason: 'Initial score — generate AI narrative' }

  // Score delta > 8 points since last AI narrative
  const delta = Math.abs(newSetupScore - prior.setupScore)
  if (delta >= 8) return { type: 'score_delta', reason: `Setup score changed ${delta > 0 ? '+' : ''}${newSetupScore - prior.setupScore} points` }

  // Earnings just filed (≤1 day old)
  if (earnings?.justFiled) return { type: 'earnings', reason: 'Earnings report just filed — update narrative' }

  // Major insider buy (>$5M)
  if (insiderNetBuying && insiderNetBuying > 5_000_000) {
    return { type: 'major_insider', reason: `Insider net bought $${(insiderNetBuying / 1e6).toFixed(0)}M` }
  }

  // Large price move
  if (priceChangePct && Math.abs(priceChangePct) >= 5) {
    return { type: 'price_spike', reason: `Price moved ${priceChangePct > 0 ? '+' : ''}${priceChangePct.toFixed(1)}% today` }
  }

  return null // no trigger — use cached narrative
}
