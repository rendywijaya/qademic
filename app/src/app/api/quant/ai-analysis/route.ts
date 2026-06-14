import Anthropic from '@anthropic-ai/sdk'
import type { QuantAnalysis } from '@/app/api/quant/analysis/route'

const client = new Anthropic()

function buildPrompt(analysis: QuantAnalysis): string {
  const { ticker, factors, technical, piotroski, returns, fundamentals } = analysis

  const factorLines = [
    `  Value:     ${factors.value}/100`,
    `  Quality:   ${factors.quality}/100`,
    `  Momentum:  ${factors.momentum}/100`,
    `  Low Vol:   ${factors.lowVol}/100`,
    `  Growth:    ${factors.growth}/100`,
    `  Composite: ${factors.composite}/100`,
  ].join('\n')

  const techLines = [
    `  RSI (14d):      ${technical.rsi.toFixed(1)} ${technical.rsi > 70 ? '(OVERBOUGHT)' : technical.rsi < 30 ? '(OVERSOLD)' : '(NEUTRAL)'}`,
    `  MACD:           ${technical.macd.toFixed(3)} | Signal: ${technical.macdSignal.toFixed(3)} | Hist: ${technical.macdHistogram.toFixed(3)}`,
    `  SMA200:         $${technical.sma200.toFixed(2)} | Price vs 200DMA: ${technical.pctFrom200DMA > 0 ? '+' : ''}${technical.pctFrom200DMA.toFixed(1)}%`,
    `  SMA50:          $${technical.sma50.toFixed(2)}`,
    `  Bollinger %B:   ${(technical.bbandsPercent * 100).toFixed(0)}%`,
    `  Volume vs 20d:  ${technical.volumeAvg20 > 0 ? (technical.volume / technical.volumeAvg20).toFixed(1) : 'N/A'}x avg`,
    `  52w High:       $${technical.weekHigh52.toFixed(2)}`,
    `  52w Low:        $${technical.weekLow52.toFixed(2)}`,
  ].join('\n')

  const returnLines = [
    `  1M: ${returns.ret1m > 0 ? '+' : ''}${returns.ret1m.toFixed(1)}%`,
    `  3M: ${returns.ret3m > 0 ? '+' : ''}${returns.ret3m.toFixed(1)}%`,
    `  6M: ${returns.ret6m > 0 ? '+' : ''}${returns.ret6m.toFixed(1)}%`,
    `  12M: ${returns.ret12m > 0 ? '+' : ''}${returns.ret12m.toFixed(1)}%`,
  ].join('\n')

  const pioLines = Object.entries(piotroski.criteria)
    .map(([k, v]) => `  ${v ? '✓' : '✗'} ${k.replace(/_/g, ' ')}`)
    .join('\n')

  return `Perform a Q4 Quantamental Analysis for ${ticker} (${fundamentals.name}) in ${fundamentals.sector}.

Current Price: $${fundamentals.price.toFixed(2)} | Market Cap: $${(fundamentals.marketCap / 1e9).toFixed(1)}B | P/E: ${fundamentals.pe || 'N/A'}x

FACTOR SCORES:
${factorLines}

TECHNICAL INDICATORS:
${techLines}

MOMENTUM RETURNS:
${returnLines}

PIOTROSKI F-SCORE: ${piotroski.score}/9
${pioLines}

FUNDAMENTALS CONTEXT:
  ROE: ${fundamentals.roe.toFixed(1)}% | Gross Margin: ${fundamentals.grossMargin.toFixed(1)}% | FCF Margin: ${fundamentals.fcfMargin.toFixed(1)}%
  Revenue Growth (YoY): ${fundamentals.revenueGrowth > 0 ? '+' : ''}${fundamentals.revenueGrowth.toFixed(1)}%
  Debt/Equity: ${fundamentals.debtEquity.toFixed(2)}x | Dividend Yield: ${fundamentals.dividendYield.toFixed(2)}%

Structure your response with these exact bold headers:

**FACTOR SUMMARY**
2-3 sentences on the composite Q4 score of ${factors.composite}/100 and the dominant factors driving it. Be specific about which factors are strong vs weak.

**TECHNICAL SETUP**
2-3 sentences on RSI reading, trend vs 200DMA, MACD signal, and momentum direction. Use the numbers.

**QUALITY CHECK**
1-2 sentences on the Piotroski score of ${piotroski.score}/9 and what the failing criteria signal about financial health.

**QUANTAMENTAL VERDICT**
Overall assessment in 1-2 sentences, then 2 actionable bullet points starting with →

Keep it hedge fund research note quality. Data-driven, no filler.`
}

function validate(body: unknown): { ticker: string; analysis: QuantAnalysis } {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  const b = body as Record<string, unknown>
  if (typeof b.ticker !== 'string') throw new Error('Missing ticker')
  if (!b.analysis || typeof b.analysis !== 'object') throw new Error('Missing analysis')
  return { ticker: b.ticker, analysis: b.analysis as QuantAnalysis }
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let payload: { ticker: string; analysis: QuantAnalysis }
  try {
    const body = await req.json()
    payload = validate(body)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Bad request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const stream = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    stream: true,
    system:
      "You are Qademic's Q4 Quantitative analyst. Provide data-driven factor analysis. Be precise, use numbers. Hedge fund research note quality.",
    messages: [{ role: 'user', content: buildPrompt(payload.analysis) }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
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
