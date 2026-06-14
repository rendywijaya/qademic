import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBusinessExplainer } from '@/lib/ai/explainers'

export const maxDuration = 60

// Comprehensive business explainer for a stock. Returns the cached living-knowledge
// explainer; generates it lazily (and caches) on first view. This is the deep breakdown
// the stock page was missing.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') ?? '').toUpperCase()
  const name = searchParams.get('name') ?? ticker
  const sector = searchParams.get('sector')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const db = createAdminClient()
  const { data } = await db.from('business_explainers').select('*').eq('ticker', ticker).single()
  if (data) return NextResponse.json({ explainer: data, generated: false })

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ explainer: null })
  try {
    await generateBusinessExplainer(db, ticker, name, sector)
    const { data: fresh } = await db.from('business_explainers').select('*').eq('ticker', ticker).single()
    return NextResponse.json({ explainer: fresh, generated: true })
  } catch (e) {
    return NextResponse.json({ explainer: null, error: e instanceof Error ? e.message : 'failed' })
  }
}
