import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface HoldingInput {
  ticker: string
  companyName: string
  shares: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPct: number
  dailyChangePct: number
  sector: string
  score: number
  grossMargin: number
  revenueGrowth: number
  fcfMargin: number
  pe: number
}

interface InsightRequest {
  holdings: HoldingInput[]
  totalValue: number
  totalCostBasis: number
  totalPnL: number
  totalPnLPct: number
}

function validateRequest(body: unknown): InsightRequest {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.holdings) || b.holdings.length === 0) throw new Error('No holdings')
  if (b.holdings.length > 50) throw new Error('Too many holdings')
  return b as unknown as InsightRequest
}

function buildPrompt(req: InsightRequest): string {
  const sectorMap: Record<string, number> = {}
  for (const h of req.holdings) {
    sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.marketValue
  }

  const holdingLines = req.holdings
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((h, i) => {
      const pnlSign = h.unrealizedPnL >= 0 ? '+' : ''
      const daySign = h.dailyChangePct >= 0 ? '+' : ''
      return `${i + 1}. ${h.ticker} — ${h.companyName}
   Shares: ${h.shares} @ $${h.avgCost.toFixed(2)} avg cost
   Current: $${h.currentPrice.toFixed(2)} | Market Value: $${h.marketValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
   P&L: ${pnlSign}$${h.unrealizedPnL.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${pnlSign}${h.unrealizedPnLPct.toFixed(1)}%) | Today: ${daySign}${h.dailyChangePct.toFixed(2)}%
   Sector: ${h.sector} | Q-Score: ${h.score}/100 | PE: ${h.pe > 0 ? h.pe.toFixed(1) : 'N/A'}
   Gross Margin: ${h.grossMargin.toFixed(1)}% | Revenue Growth: ${h.revenueGrowth > 0 ? '+' : ''}${h.revenueGrowth.toFixed(1)}% | FCF Margin: ${h.fcfMargin.toFixed(1)}%`
    })
    .join('\n\n')

  const sectorLines = Object.entries(sectorMap)
    .sort((a, b) => b[1] - a[1])
    .map(([sector, value]) => {
      const pct = ((value / req.totalValue) * 100).toFixed(1)
      return `   ${sector}: ${pct}% ($${value.toLocaleString('en-US', { maximumFractionDigits: 0 })})`
    })
    .join('\n')

  const totalSign = req.totalPnL >= 0 ? '+' : ''

  return `Analyse this investment portfolio through the Q5 Framework:

PORTFOLIO SUMMARY
Total Value: $${req.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
Cost Basis: $${req.totalCostBasis.toLocaleString('en-US', { maximumFractionDigits: 0 })}
Unrealized P&L: ${totalSign}$${req.totalPnL.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${totalSign}${req.totalPnLPct.toFixed(1)}%)
Positions: ${req.holdings.length}

HOLDINGS
${holdingLines}

SECTOR ALLOCATION
${sectorLines}

Provide a concise, hedge-fund-quality portfolio review covering:

**Q1 MACRO POSITIONING**
How exposed is this portfolio to current macro risks (rates, inflation, USD, geopolitics)? Rate the macro positioning 1-10.

**Q2 SECTOR ANALYSIS**
Any dangerous concentration? Sectors to rotate into/out of given current cycle? Rate sector balance 1-10.

**Q3 FUNDAMENTAL QUALITY**
Assess the overall fundamental quality — earnings growth, margins, balance sheet. Identify the strongest and weakest positions by fundamentals. Rate fundamental quality 1-10.

**Q4 QUANT SIGNALS**
Momentum profile of the portfolio. Any positions showing weakness signals? Rate quant momentum 1-10.

**Q5 SENTIMENT**
Overall sentiment exposure. Any crowded trades? Contrarian opportunities? Rate sentiment positioning 1-10.

**TOP 3 RECOMMENDATIONS**
Specific, actionable steps the investor should consider.

Keep each section tight — 2-4 sentences max. Lead with the most important insight.`
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let insightReq: InsightRequest
  try {
    const body = await req.json()
    insightReq = validateRequest(body)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const prompt = buildPrompt(insightReq)

  const stream = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    stream: true,
    system: `You are Qademic AI — a senior hedge fund portfolio analyst. You analyse portfolios through the Q5 Framework (Macro, Sector, Fundamental, Quant, Sentiment). Be direct, precise, and data-driven. Use markdown bold headers exactly as given. This is analytical commentary, not financial advice.`,
    messages: [{ role: 'user', content: prompt }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
