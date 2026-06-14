import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

const ALLOWED_TIERS = ['growth', 'pro'] as const
type Tier = (typeof ALLOWED_TIERS)[number]

const PRICE_IDS: Record<Tier, string> = {
  growth: process.env.STRIPE_GROWTH_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
}

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
    !('tier' in body) ||
    !('userId' in body) ||
    !('email' in body)
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { tier, userId, email } = body as Record<string, unknown>

  if (typeof tier !== 'string' || !ALLOWED_TIERS.includes(tier as Tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  if (typeof userId !== 'string' || userId.trim() === '') {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const priceId = PRICE_IDS[tier as Tier]
  if (!priceId) {
    return NextResponse.json({ error: 'Price ID not configured' }, { status: 500 })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId.trim(),
        tier: tier as Tier,
      },
      customer_email: email.trim(),
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?cancelled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
