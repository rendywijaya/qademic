import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
})

export const PLANS = {
  growth: {
    name: 'Growth',
    price: 9.99,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID ?? '',
  },
  pro: {
    name: 'Pro',
    price: 29.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
  },
} as const

export type PlanTier = keyof typeof PLANS
