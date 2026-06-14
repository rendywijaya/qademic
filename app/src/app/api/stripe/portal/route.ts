import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('customerId' in body)
  ) {
    return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })
  }

  const { customerId } = body as Record<string, unknown>

  if (typeof customerId !== 'string' || customerId.trim() === '') {
    return NextResponse.json({ error: 'Invalid customerId' }, { status: 400 })
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId.trim(),
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
