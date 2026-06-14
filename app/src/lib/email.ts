// Transactional email via Resend's REST API — no SDK dependency, key-gated.
// If RESEND_API_KEY is unset the whole thing is a safe no-op, so nothing is ever
// sent by accident in dev or before the domain is verified (QADEMIC.md §12 Phase 2).

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface EmailInput {
  to: string
  subject: string
  html: string
  text?: string
}

export type EmailResult =
  | { sent: true; id: string }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string }

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, skipped: true, reason: 'RESEND_API_KEY not set' }

  const from = process.env.ALERT_FROM_EMAIL ?? 'Qademic <alerts@qademic.com>'

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { sent: false, skipped: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json() as { id?: string }
    return { sent: true, id: data.id ?? '' }
  } catch (e) {
    return { sent: false, skipped: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

// ─── Qademic-branded alert digest ────────────────────────────────────────────
// One email per user per run, listing the alerts that fired. Plain, dark, on-brand.

export interface AlertLine {
  ticker: string
  title: string
  body: string
}

export function renderAlertDigest(alerts: AlertLine[]): { subject: string; html: string; text: string } {
  const n = alerts.length
  const subject = n === 1
    ? `Qademic alert · ${alerts[0].ticker}: ${alerts[0].title.replace(`${alerts[0].ticker}: `, '')}`
    : `Qademic · ${n} thesis alerts need your review`

  const rows = alerts.map(a => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #1F2937;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#F9FAFB;">${escapeHtml(a.title)}</div>
      <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#9CA3AF;margin-top:6px;">${escapeHtml(a.body)}</div>
    </td></tr>`).join('')

  const html = `
  <div style="background:#050810;padding:32px 0;font-family:Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:0 24px;">
      <div style="font-size:18px;font-weight:800;color:#F9FAFB;margin-bottom:4px;">
        <span style="color:#F59E0B;">Q</span>ademic
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6B7280;margin-bottom:24px;">
        Thesis monitor · ${n} alert${n === 1 ? '' : 's'}
      </div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#9CA3AF;margin-top:24px;">
        These are forced reviews, never auto-exits. Open your thesis and ask: drawdown within a living
        thesis, or thesis broken?
      </p>
      <a href="https://qademic.com/dashboard/theses"
        style="display:inline-block;margin-top:8px;background:#F59E0B;color:#050810;text-decoration:none;font-weight:700;font-size:13px;padding:10px 18px;border-radius:8px;">
        Review your theses →
      </a>
      <p style="font-family:Arial,sans-serif;font-size:10px;line-height:1.5;color:#4B5563;margin-top:28px;border-top:1px solid #1F2937;padding-top:16px;">
        Qademic is an educational research framework providing general information only. Not financial advice.
        You are receiving this because thesis email alerts are enabled on your account.
      </p>
    </div>
  </div>`

  const text = `Qademic — ${n} thesis alert${n === 1 ? '' : 's'}\n\n` +
    alerts.map(a => `${a.title}\n${a.body}`).join('\n\n') +
    `\n\nReview your theses: https://qademic.com/dashboard/theses\n\nGeneral information only. Not financial advice.`

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
