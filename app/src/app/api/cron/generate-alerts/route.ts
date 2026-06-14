import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertStockAlert } from '@/lib/supabase/cache'
import { toGrade } from '@/lib/grades'

export const maxDuration = 300

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const yesterday = new Date(Date.now() - 25 * 3600 * 1000).toISOString()
  let alertsGenerated = 0

  // ── 1. Insider buy alerts ─────────────────────────────────────────────────
  // (insider_transactions is populated by the existing insider route)
  try {
    const { data: insiderRows } = await admin
      .from('insider_transactions')
      .select('ticker, name, title, transaction_type, value, date')
      .eq('transaction_type', 'P-Purchase')
      .gte('date', yesterday.split('T')[0])
      .gte('value', 100000)  // only significant buys ($100k+)
      .limit(50)

    for (const row of (insiderRows ?? []) as Array<{
      ticker: string; name: string; title: string | null; transaction_type: string; value: number; date: string
    }>) {
      const valueStr = row.value >= 1_000_000 ? `$${(row.value / 1_000_000).toFixed(1)}M` : `$${(row.value / 1000).toFixed(0)}K`
      await insertStockAlert({
        ticker: row.ticker,
        alert_type: 'insider_buy',
        severity: row.value >= 500_000 ? 'positive' : 'info',
        title: `${row.ticker}: Insider purchase ${valueStr}`,
        body: `${row.name}${row.title ? ` (${row.title})` : ''} bought ${valueStr} of ${row.ticker} stock.`,
        metadata: { name: row.name, title: row.title, value: row.value, date: row.date },
      })
      alertsGenerated++
    }
  } catch { /* non-fatal */ }

  // ── 2. Q7 score change alerts ─────────────────────────────────────────────
  // Alert when a watchlisted stock's setup score changes significantly
  try {
    const { data: watchlistRows } = await admin.from('watchlist').select('ticker').limit(200)
    const tickers = [...new Set((watchlistRows ?? []).map((r: { ticker: string }) => r.ticker))]

    if (tickers.length > 0) {
      const { data: q7Rows } = await admin
        .from('stock_q7_scores')
        .select('ticker, setup_score, recommendation, scored_at')
        .in('ticker', tickers)
        .gte('scored_at', yesterday)

      for (const row of (q7Rows ?? []) as Array<{
        ticker: string; setup_score: number; recommendation: string; scored_at: string
      }>) {
        if (row.setup_score >= 75) {
          await insertStockAlert({
            ticker: row.ticker,
            alert_type: 'q_score_change',
            severity: 'positive',
            title: `${row.ticker}: High Setup Score ${row.setup_score}/100`,
            body: `Q7 setup grade ${toGrade(row.recommendation, row.setup_score)} — setup score ${row.setup_score}/100 across all pillars.`,
            metadata: { setup_score: row.setup_score, recommendation: row.recommendation },
          })
          alertsGenerated++
        } else if (row.setup_score <= 30) {
          await insertStockAlert({
            ticker: row.ticker,
            alert_type: 'q_score_change',
            severity: 'warning',
            title: `${row.ticker}: Low Setup Score ${row.setup_score}/100`,
            body: `Q7 setup grade ${toGrade(row.recommendation, row.setup_score)} — setup score ${row.setup_score}/100. Review risk factors.`,
            metadata: { setup_score: row.setup_score, recommendation: row.recommendation },
          })
          alertsGenerated++
        }
      }
    }
  } catch { /* non-fatal */ }

  // ── 3. New institutional positions ───────────────────────────────────────
  try {
    const { data: newPositions } = await admin
      .from('institutional_holdings')
      .select('ticker, fund_name, shares, change_type')
      .eq('change_type', 'new')
      .limit(20)

    for (const row of (newPositions ?? []) as Array<{
      ticker: string; fund_name: string; shares: number | null; change_type: string
    }>) {
      await insertStockAlert({
        ticker: row.ticker,
        alert_type: 'institutional_new',
        severity: 'info',
        title: `${row.ticker}: New position by ${row.fund_name}`,
        body: `${row.fund_name} opened a new position in ${row.ticker}${row.shares ? ` (${row.shares.toLocaleString()} shares)` : ''}.`,
        metadata: { fund_name: row.fund_name, shares: row.shares },
      })
      alertsGenerated++
    }
  } catch { /* non-fatal */ }

  // ── 4. Forensic warnings ─────────────────────────────────────────────────
  try {
    const { data: watchlistRows } = await admin.from('watchlist').select('ticker').limit(200)
    const tickers = [...new Set((watchlistRows ?? []).map((r: { ticker: string }) => r.ticker))]

    if (tickers.length > 0) {
      const { data: forensicRows } = await admin
        .from('forensic_signals')
        .select('ticker, overall_flag, beneish_m_score, beneish_flag, accruals_flag, scored_at')
        .in('ticker', tickers)
        .eq('overall_flag', 'warning')
        .gte('scored_at', yesterday)

      for (const row of (forensicRows ?? []) as Array<{
        ticker: string; overall_flag: string; beneish_m_score: number | null; beneish_flag: boolean | null; accruals_flag: boolean | null; scored_at: string
      }>) {
        await insertStockAlert({
          ticker: row.ticker,
          alert_type: 'forensic_warning',
          severity: 'warning',
          title: `${row.ticker}: Earnings quality warning`,
          body: `Forensic analysis detected potential earnings quality issues: ${row.beneish_flag ? 'Beneish M-Score elevated. ' : ''}${row.accruals_flag ? 'High accruals ratio.' : ''}`,
          metadata: { beneish_m_score: row.beneish_m_score, accruals_flag: row.accruals_flag },
        })
        alertsGenerated++
      }
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, alertsGenerated })
}
