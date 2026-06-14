import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { groundEdgesForTicker } from '@/lib/ai/ground-edges'

export const maxDuration = 300

// Weekly: re-discover interconnection edges for covered companies, grounded in their
// latest 10-K (EDGAR, free) + recent news. Edges stored with source='edgar'. This is
// what keeps the graph reflecting what companies actually say, not the model's memory.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const db = createAdminClient()
  const { data: ents } = await db
    .from('graph_entities')
    .select('id, ticker, name')
    .eq('kind', 'company')
    .not('ticker', 'is', null)
  const companies = (ents ?? []).filter((e) => e.ticker)

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 40), companies.length)

  let grounded = 0
  let edges = 0
  for (let i = 0; i < limit; i++) {
    const target = companies[i]
    const candidates = companies.filter((c) => c.ticker !== target.ticker)
    try {
      const g = await groundEdgesForTicker(db, target, candidates)
      if (g.grounded) grounded++
      edges += g.result?.found.length ?? 0
    } catch {
      // skip on per-company failure
    }
  }

  return NextResponse.json({ ok: true, processed: limit, grounded, edges, ran_at: new Date().toISOString() })
}
