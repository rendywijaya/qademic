import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertStockAlert } from '@/lib/supabase/cache'
import { sendEmail, renderAlertDigest, emailConfigured, type AlertLine } from '@/lib/email'

export const maxDuration = 300

// Thesis monitor (QADEMIC.md §3 job 5) — the system watches what you own.
// Nightly, after compute-signals. Two deterministic checks per active thesis:
//   1. Trend failsafe: close < 200dma → forced review (never an auto-exit)
//   2. Business deterioration: score −20pts vs entry, or below the 40 floor
// Free-text quant kill conditions become machine-checkable with the Phase 1
// structured-metrics build; until then the founder reviews them on alert.

const DEDUPE_DAYS = 7

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: theses } = await admin
    .from('theses')
    .select('id, user_id, ticker, trend_failsafe, business_score_at_entry')
    .eq('status', 'active')

  if (!theses || theses.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, alerts: 0 })
  }

  const tickers = [...new Set(theses.map(t => t.ticker))]

  const [{ data: signals }, { data: scores }, { data: recentAlerts }] = await Promise.all([
    admin.from('stock_signals').select('ticker, price_vs_sma200').in('ticker', tickers),
    admin.from('stock_q7_scores').select('ticker, business_score').in('ticker', tickers),
    admin.from('stock_alerts')
      .select('ticker, alert_type')
      .in('ticker', tickers)
      .in('alert_type', ['thesis_failsafe', 'thesis_business_drop'])
      .gte('generated_at', new Date(Date.now() - DEDUPE_DAYS * 24 * 3600 * 1000).toISOString()),
  ])

  const sma200Map = new Map((signals ?? []).map(s => [s.ticker, s.price_vs_sma200 as number | null]))
  const bizMap = new Map((scores ?? []).map(s => [s.ticker, s.business_score as number | null]))
  const alreadyAlerted = new Set((recentAlerts ?? []).map(a => `${a.ticker}:${a.alert_type}`))

  let alerts = 0
  // Fired alerts grouped by thesis owner, for the opt-in email digest below.
  const firedByUser = new Map<string, AlertLine[]>()
  const recordFired = (userId: string | null, line: AlertLine) => {
    if (!userId) return
    firedByUser.set(userId, [...(firedByUser.get(userId) ?? []), line])
  }

  for (const thesis of theses) {
    const { ticker } = thesis
    const userId = (thesis.user_id as string | null) ?? null

    // 1. Trend failsafe — close below 200dma
    if (thesis.trend_failsafe) {
      const vs200 = sma200Map.get(ticker)
      if (vs200 !== null && vs200 !== undefined && vs200 < 0 && !alreadyAlerted.has(`${ticker}:thesis_failsafe`)) {
        const title = `${ticker}: trend failsafe — closed below 200dma`
        const body = `${ticker} is ${Math.abs(vs200).toFixed(1)}% below its 200-day moving average. An active thesis on this stock has its trend failsafe enabled: review the thesis now — is this a drawdown within a living thesis, or is the thesis broken?`
        await insertStockAlert({ ticker, alert_type: 'thesis_failsafe', severity: 'negative', title, body, metadata: { thesis: true, price_vs_sma200: vs200 } })
        recordFired(userId, { ticker, title, body })
        alreadyAlerted.add(`${ticker}:thesis_failsafe`)
        alerts++
      }
    }

    // 2. Business score deterioration vs entry snapshot
    const bizNow = bizMap.get(ticker)
    const bizEntry = thesis.business_score_at_entry as number | null
    if (
      bizNow !== null && bizNow !== undefined &&
      ((bizEntry !== null && bizEntry - bizNow >= 20) || bizNow < 40) &&
      !alreadyAlerted.has(`${ticker}:thesis_business_drop`)
    ) {
      const title = `${ticker}: Business score deteriorated to ${bizNow}`
      const body = bizEntry !== null
        ? `${ticker}'s Business score fell from ${bizEntry} at thesis entry to ${bizNow}. The quality case has weakened — check your kill conditions against the latest quarter.`
        : `${ticker}'s Business score is ${bizNow}, below the quality floor of 40. Check your kill conditions against the latest quarter.`
      await insertStockAlert({ ticker, alert_type: 'thesis_business_drop', severity: 'negative', title, body, metadata: { thesis: true, business_now: bizNow, business_at_entry: bizEntry } })
      recordFired(userId, { ticker, title, body })
      alreadyAlerted.add(`${ticker}:thesis_business_drop`)
      alerts++
    }
  }

  // ── Email digest — opt-in only, and only when Resend is configured ──────────
  // Gate on existing settings: notifications on AND the email channel on. A user
  // with no saved settings row is not emailed (no implicit opt-in to outbound mail).
  let emailed = 0
  if (emailConfigured() && firedByUser.size > 0) {
    const userIds = [...firedByUser.keys()]
    const { data: optedIn } = await admin
      .from('user_settings')
      .select('user_id')
      .in('user_id', userIds)
      .eq('notifications_enabled', true)
      .eq('email_digest', true)
    const optedInIds = new Set((optedIn ?? []).map(p => p.user_id as string))

    for (const userId of userIds) {
      if (!optedInIds.has(userId)) continue
      const lines = firedByUser.get(userId)!
      const { data: userData } = await admin.auth.admin.getUserById(userId)
      const to = userData?.user?.email
      if (!to) continue
      const { subject, html, text } = renderAlertDigest(lines)
      const res = await sendEmail({ to, subject, html, text })
      if (res.sent) emailed++
    }
  }

  return NextResponse.json({ ok: true, checked: theses.length, tickers: tickers.length, alerts, emailed })
}
