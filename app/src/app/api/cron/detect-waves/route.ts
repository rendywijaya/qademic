import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectWaves } from '@/lib/ai/detect-waves'

export const maxDuration = 300

// Weekly: scan regime + momentum for emerging demand waves and auto-build them as
// propagatable subgraphs. This is the system finding the NEXT wave on its own.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }
  try {
    const db = createAdminClient()
    const result = await detectWaves(db)
    return NextResponse.json({ ok: true, ...result, ran_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
