import { NextRequest, NextResponse } from 'next/server'
import {
  loadScreenUniverse, parseQueryToFilters, applyScreenFilters, buildReasoning,
  type ScreenRow,
} from '@/lib/screener'

// NL screener (QADEMIC.md §6): Haiku parses the query → the data does the
// filtering. The universe never enters a prompt; every number in a result is a
// live computed value; reasoning lines are deterministic.

export interface ScreenerApiResult {
  ticker: string
  name: string
  sector: string
  price: number
  marketCap: number
  score: number          // quant score (0-100); setup composite where scored
  momentum3m: number | null
  vsSma200: number | null
  rsi14: number | null
  businessScore: number | null
  timingScore: number | null
  grade: string | null
  reasoning: string
  // legacy display fields — enriched client-side from live FMP/price routes
  pe: number
  revenueGrowth: number
  change: number
}

function toApiResult(r: ScreenRow): ScreenerApiResult {
  return {
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    price: r.price ?? 0,
    marketCap: r.marketCap ?? 0,
    score: r.setupScore ?? r.quantScore ?? 0,
    momentum3m: r.momentum3m,
    vsSma200: r.vsSma200,
    rsi14: r.rsi14,
    businessScore: r.businessScore,
    timingScore: r.timingScore,
    grade: r.grade,
    reasoning: buildReasoning(r),
    pe: 0,
    revenueGrowth: 0,
    change: 0,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { query: string }
    const query = body.query?.trim()
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const [universe, parsed] = await Promise.all([
      loadScreenUniverse(),
      parseQueryToFilters(query),
    ])

    if (universe.length === 0) {
      return NextResponse.json(
        { results: [], aiPowered: false, explanation: 'No signal data yet — run the nightly pipeline.', universeSize: 0 },
        { status: 200 }
      )
    }

    const rows = applyScreenFilters(universe, parsed.filters)

    return NextResponse.json({
      results: rows.map(toApiResult),
      aiPowered: parsed.aiParsed,
      explanation: parsed.explanation,
      universeSize: universe.length,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    if (process.env.NODE_ENV !== 'production') {
      console.error('[screener]', errMsg)
    }
    return NextResponse.json(
      { results: [], aiPowered: false, error: 'Screener unavailable — please try again' },
      { status: 200 }
    )
  }
}
