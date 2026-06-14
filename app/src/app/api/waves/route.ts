import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runWave } from '@/lib/waves'

// Wave propagation read endpoint — market-wide, identical for everyone (like /api/rotation).
// Returns the interconnection graph + the ranked un-repriced beneficiaries for a shock.
export const revalidate = 1800

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shock = searchParams.get('shock') ?? 'ai-capex'

  const db = createAdminClient()
  const run = await runWave(db, shock)
  if (!run) {
    return NextResponse.json({ error: `unknown shock: ${shock}` }, { status: 404 })
  }
  return NextResponse.json(run)
}
