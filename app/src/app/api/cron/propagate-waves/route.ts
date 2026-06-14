import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runWave, listActiveShocks } from '@/lib/waves'

export const maxDuration = 300

// Nightly: re-run wave propagation for every active shock and append to wave_propagation
// (the append-only "what changed today" log — mirrors the autoresearch results pattern).
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const shocks = await listActiveShocks(db)
  const out: Record<string, number> = {}
  for (const s of shocks) {
    const run = await runWave(db, s.slug, { persist: true })
    out[s.slug] = run?.results.length ?? 0
  }
  return NextResponse.json({ ok: true, shocks: out, ran_at: new Date().toISOString() })
}
