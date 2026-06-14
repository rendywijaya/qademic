'use client'

const layers = [
  {
    id: 'Q1', name: 'The Big Picture',       color: '#A78BFA',
    question: 'Is the overall market working for me or against me?',
    description: 'Before touching any individual stock, you need to know the macro regime. Are interest rates rising or falling? Is the Fed tightening or easing? Is money flowing into risky assets or running to safety? The answers determine whether the wind is at your back or in your face.',
    signals: ['Interest Rates', 'Yield Curve', 'Volatility Index', 'Dollar Strength', 'Credit Spreads'],
  },
  {
    id: 'Q2', name: 'The Right Industry',    color: '#38BDF8',
    question: 'Which sectors are winning right now, and is this one of them?',
    description: 'Even in a good market, some sectors massively outperform and others get crushed. Tech and financials behave differently in the same economic environment. This layer tells you whether the industry tailwind is real, or whether you are swimming against the tide.',
    signals: ['Sector Rotation', 'Relative Performance', 'Industry Earnings Trends', 'Regulatory Environment'],
  },
  {
    id: 'Q3', name: 'The Business Quality',  color: '#34D399',
    question: 'Is this actually a good business, and is it getting better?',
    description: 'Revenue growth, profit margins, free cash flow, return on equity, debt levels. The same numbers every professional analyst looks at when deciding whether a business deserves capital. Compared against its own history and against peers in the same industry.',
    signals: ['Revenue Growth', 'Free Cash Flow', 'Gross Margin', 'Return on Equity', 'Debt Load'],
  },
  {
    id: 'Q4', name: 'The Price Behaviour',   color: '#F59E0B',
    question: 'Is the market agreeing with your thesis, or fighting it?',
    description: 'Price momentum, short interest trends, unusual options activity. The market is a collective opinion. When smart money is quietly building positions while retail is selling, that shows up here. When short sellers are piling on, that shows up here too.',
    signals: ['Price Momentum', 'Short Interest Trend', 'Options Positioning', 'Volume Patterns'],
  },
  {
    id: 'Q5', name: 'The Insiders',          color: '#FB7185',
    question: 'What are the people who know most doing with their own money?',
    description: 'Executives and board members must report every trade to the SEC within two business days. When a CEO buys a million dollars of their own stock, that is a statement. This layer tracks those transactions and the patterns behind them, alongside what major institutional funds are adding or cutting.',
    signals: ['Executive Purchases', 'Insider Selling Patterns', 'Institutional 13F Changes', 'Analyst Upgrades'],
  },
  {
    id: 'Q6', name: 'The People Running It', color: '#E879F9',
    question: 'Would you trust this team with your money for ten years?',
    description: "Warren Buffett has said management quality is the most important factor in any investment. Is this founder-led or hired? What percentage does the CEO own? How have they allocated capital historically? Have they created shareholder value over time or diluted it? These questions have answers.",
    signals: ['Founder vs Hired CEO', 'Insider Ownership', 'Capital Allocation History', 'ROIC over 5 Years'],
  },
  {
    id: 'Q7', name: 'The Timing',            color: '#F97316',
    question: 'Even if everything is right, when will the market actually react?',
    description: "Knowing a stock is undervalued is not enough. Markets need a reason to reprice. Earnings reports, product launches, regulatory decisions, Fed meetings — these are the events that cause prices to move. This layer maps what is coming, what the market expects, and what history says happens next.",
    signals: ['Earnings Date', 'Options Implied Move', 'Product Launches', 'Macro Events', 'FDA Decisions'],
  },
]

export default function Q7Section() {
  return (
    <section id="framework" className="py-28 px-6 th-bg relative">
      <div className="absolute inset-0 dot-grid opacity-30" />
      <div className="max-w-6xl mx-auto relative z-10">

        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border mb-6"
            style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)', fontFamily: 'var(--font-mono)' }}>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--amber)' }}>HOW IT WORKS</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 th-text">
            Seven questions.
            <br />
            <span style={{ color: 'var(--amber)' }}>One clear answer.</span>
          </h2>
          <p className="text-lg max-w-2xl th-text-muted">
            Every hedge fund research desk works through the same questions before making an investment.
            Qademic runs all seven automatically, nightly, across thousands of stocks, and synthesises them
            into a single Setup Score. Here is what each question actually means.
          </p>
        </div>

        <div className="space-y-2">
          {layers.map((layer, index) => (
            <div key={layer.id}
              className="relative rounded-lg border bg-transparent overflow-hidden transition-all duration-200"
              style={{ borderColor: 'var(--border)', borderLeft: `3px solid ${layer.color}` }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(245,158,11,0.04)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}>
              <div className="p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-start gap-5">

                  <div className="shrink-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${layer.color}12`, border: `1px solid ${layer.color}25` }}>
                      <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: layer.color }}>
                        {layer.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-base font-bold mb-1" style={{ color: layer.color }}>
                      {layer.name}
                    </h3>
                    <p className="text-sm font-medium mb-2 th-text">
                      {layer.question}
                    </p>
                    <p className="text-sm leading-relaxed max-w-2xl th-text-muted">
                      {layer.description}
                    </p>
                  </div>

                  <div className="shrink-0 md:max-w-[220px]">
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                      {layer.signals.map((signal) => (
                        <span key={signal}
                          className="text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: `${layer.color}10`,
                            color: layer.color,
                            border: `1px solid ${layer.color}20`,
                          }}>
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {index < layers.length - 1 && (
                <div className="absolute -bottom-[5px] left-[22px] w-[3px] h-[8px] z-10"
                  style={{ backgroundColor: layers[index + 1].color, opacity: 0.5 }} />
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 p-5 rounded-lg border"
          style={{ borderColor: 'rgba(245,158,11,0.2)', backgroundColor: 'rgba(245,158,11,0.04)' }}>
          <p className="text-sm th-text-dim leading-relaxed">
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Seven questions. Applied to every stock. Every night.</span>{' '}
            The edge is not a prediction — it is a consistent, disciplined process applied the same way every time. That is what separates professionals from everyone else.
          </p>
        </div>
      </div>
    </section>
  )
}
