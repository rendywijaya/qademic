import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

// Service-role client — bypasses RLS for server-side profile updates
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'
type SubscriptionTier = 'free' | 'growth' | 'pro' | 'teams'

function mapStripeStatus(status: Stripe.Subscription['status']): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'trialing':
      return 'trialing'
    default:
      return 'cancelled'
  }
}

async function updateProfileSubscription(
  userId: string,
  updates: {
    subscription_tier?: SubscriptionTier
    subscription_status?: SubscriptionStatus
    stripe_customer_id?: string
  }
) {
  const supabase = createServiceClient()

  // Try full update first; if stripe_customer_id column doesn't exist, retry without it
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error && error.message?.includes('stripe_customer_id')) {
    const { stripe_customer_id: _, ...safeUpdates } = updates
    void _
    await supabase.from('profiles').update(safeUpdates).eq('id', userId)
  }
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const tier = session.metadata?.tier as SubscriptionTier | undefined
      const customerId = typeof session.customer === 'string' ? session.customer : null

      if (!userId || !tier) break

      await updateProfileSubscription(userId, {
        subscription_tier: tier,
        subscription_status: 'active',
        ...(customerId ? { stripe_customer_id: customerId } : {}),
      })
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      if (!userId) break

      await updateProfileSubscription(userId, {
        subscription_status: mapStripeStatus(subscription.status),
      })
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      if (!userId) break

      await updateProfileSubscription(userId, {
        subscription_tier: 'free',
        subscription_status: 'cancelled',
      })
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
