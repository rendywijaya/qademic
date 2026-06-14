import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDailyBrief } from '@/lib/ai/daily-brief'

export const maxDuration = 300

// Nightly: generate the global daily learning brief from regime + wave propagation.
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
    const brief = await generateDailyBrief(db)
    return NextResponse.json({ ok: true, headline: brief.headline, ran_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
