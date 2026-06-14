'use client'

import Link from 'next/link'
import { Check, Zap } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'See WHAT the system sees: regime, scores, rotation. Understand the framework. No credit card.',
    features: [
      'Business + Timing score on covered stocks',
      'Summary signal per Q layer (1-2 bullets)',
      'Market regime dashboard — fully public',
      'Capital flows / rotation page (public)',
      'Watchlist up to 5 stocks',
      'Public methodology — every signal defined and cited',
    ],
    cta: 'Start for free',
    href: '/signup',
    popular: false,
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$25',
    period: 'per month',
    description: 'The full research OS: HOW the analysis works, and everything personalized to YOUR positions.',
    features: [
      'Full layer math — every metric behind every score',
      'Rotation map + weekly theme briefing',
      'Thesis cards — kill conditions monitored for you',
      'Personalized morning brief (your stocks only)',
      'All alerts — thesis triggers, insider buys, score moves',
      'Natural language screener',
      'Portfolio risk — theme concentration, regime exposure',
      'Position sizing for your account',
      'Decision journal + attribution vs SPY',
    ],
    cta: 'Start with Pro',
    href: '/signup?plan=pro',
    popular: true,
    highlight: true,
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className="py-28 px-6 th-surface relative">
      <div className="absolute inset-0 dot-grid opacity-15" />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border mb-6"
            style={{
              backgroundColor: 'var(--amber-dim)',
              borderColor: 'var(--amber-border)',
              color: 'var(--amber)',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
            }}>
            PRICING
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 th-text">
            Start free.
            <br />
            <span style={{ color: 'var(--amber)' }}>Upgrade when you see it.</span>
          </h2>
          <p className="text-lg max-w-xl th-text-muted">
            No ads. No trade commissions. No selling your data. We make money when you pay us, and not before.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
          {plans.map((plan) => (
            <div key={plan.name}
              className="relative rounded-lg border flex flex-col transition-all duration-200"
              style={{
                borderColor: plan.highlight ? 'rgba(245,158,11,0.4)' : 'var(--border)',
                backgroundColor: plan.highlight ? 'var(--amber-dim)' : 'transparent',
                boxShadow: plan.highlight ? '0 0 40px rgba(245,158,11,0.08)' : 'none',
              }}>
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold tracking-wide"
                  style={{ backgroundColor: 'var(--amber)', color: '#050810' }}>
                  <Zap className="w-3 h-3" />
                  MOST POPULAR
                </div>
              )}

              <div className={`p-6 ${plan.popular ? 'pt-8' : ''} flex flex-col flex-1`}>
                <div className="mb-6">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 th-text-dim"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-bold tabular-nums th-text" style={{ fontFamily: 'var(--font-mono)' }}>
                      {plan.price}
                    </span>
                    <span className="text-sm th-text-dim">/{plan.period}</span>
                  </div>
                  <p className="text-xs leading-relaxed th-text-muted">{plan.description}</p>
                </div>

                <div className="h-px th-bar-track mb-6" />

                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: plan.highlight ? 'var(--amber-dim)' : 'rgba(52,211,153,0.12)' }}>
                        <Check className="w-2.5 h-2.5"
                          style={{ color: plan.highlight ? 'var(--amber)' : 'var(--positive)' }} />
                      </div>
                      <span className="text-xs leading-relaxed th-text-muted">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.href}
                  className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                  style={plan.highlight
                    ? { backgroundColor: 'var(--amber)', color: '#050810' }
                    : { backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }
                  }>
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-8 th-text-dim" style={{ fontFamily: 'var(--font-mono)' }}>
          Cancel anytime. No contracts. No bullshit.
        </p>
      </div>
    </section>
  )
}
