import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '30+ Free Trading Calculators | Position Size, Risk/Reward | TradVue',
  description:
    'Free trading calculators for position sizing, risk/reward, options Greeks, futures tick value, Sharpe ratio, and more. No sign-up required.',
  openGraph: {
    title: '30+ Free Trading Calculators | Position Size, Risk/Reward | TradVue',
    description:
      '30+ free trading calculators. Position sizing, risk/reward, Greeks, futures specs, and more.',
    url: 'https://tradvue.com/trading-calculators',
    siteName: 'TradVue',
    images: [
      {
        url: 'https://tradvue.com/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    type: 'website',
  },
}

export default function TradingCalculatorsPage() {
  return (
    <div style={{ fontFamily: 'var(--font)', background: 'var(--bg-0)', color: 'var(--text-0)', minHeight: '100vh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Are TradVue calculators really free?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes, all 30+ calculators are free forever. No sign-up, no credit card required.',
                },
              },
              {
                '@type': 'Question',
                name: 'What calculators does TradVue have?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Position sizing, risk/reward, options Greeks, futures tick value, Sharpe ratio, trade expectancy, compound growth, correlation matrix, Kelly criterion, and more.',
                },
              },
            ],
          }),
        }}
      />

      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid var(--border)',
          background: 'rgba(10, 10, 12, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 24px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-header.svg"
              alt="TradVue"
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            />
          </Link>
          <Link
            href="/tools"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              padding: '9px 20px',
              background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Use Calculators
          </Link>
        </div>
      </nav>

      <section style={{ padding: 'clamp(60px, 8vw, 100px) 24px 40px', maxWidth: '800px', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            marginBottom: '20px',
            color: 'var(--text-0)',
          }}
        >
          30+ Free Trading Calculators
        </h1>
        <p
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.1rem)',
            color: 'var(--text-1)',
            lineHeight: 1.6,
            marginBottom: '32px',
            fontWeight: 400,
          }}
        >
          Everything a trader needs to calculate. Position sizing, risk/reward, Greeks, futures specs, Sharpe ratio, and
          more. Free to start.
        </p>
        <Link
          href="/tools"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 32px',
            background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            textDecoration: 'none',
            fontSize: '15px',
            fontWeight: 700,
            boxShadow: '0 0 40px rgba(99,102,241,0.25)',
          }}
        >
          Access All Calculators
        </Link>
      </section>

      <section
        style={{
          padding: 'clamp(60px, 8vw, 100px) 24px',
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '40px',
              textAlign: 'center',
              color: 'var(--text-0)',
            }}
          >
            Complete Calculator Library
          </h2>

          <p style={{ fontSize: '15px', color: 'var(--text-2)', marginBottom: '32px', textAlign: 'center' }}>
            All calculators are free, always. No credit card required. No sign-up needed. Just use them.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {[
              { name: 'Position Size Calculator', desc: 'Calculate optimal position size based on risk percentage and stop loss.' },
              { name: 'Risk/Reward Ratio', desc: 'Calculate your risk-to-reward ratio. Know your edge before you trade.' },
              { name: 'Profit Target Calculator', desc: 'Set profit targets based on risk/reward multiples.' },
              { name: 'Options Greeks', desc: 'Calculate delta, gamma, theta, vega for any option.' },
              { name: 'IV Percentile', desc: 'Know if implied volatility is high or low historically.' },
              { name: 'Breakeven Calculator', desc: 'Find breakeven prices for any multi-leg strategy.' },
              { name: 'Futures Tick Value', desc: 'Calculate exact P&L per tick for any futures contract.' },
              { name: 'Margin Calculator', desc: 'Know your margin requirements before you trade.' },
              { name: 'Sharpe Ratio', desc: 'Measure risk-adjusted returns. Is your strategy actually good?' },
              { name: 'Trade Expectancy', desc: 'Calculate expected value per trade based on win rate and R:R.' },
              { name: 'Compound Growth', desc: 'Project account growth over time at various monthly returns.' },
              { name: 'Kelly Criterion', desc: 'Optimal position sizing based on your win rate and payoff ratio.' },
              { name: 'Pip Value Calculator', desc: 'Calculate pip value for forex pairs and account currency.' },
              { name: 'Correlation Matrix', desc: 'See which assets move together. Diversify smarter.' },
              { name: 'Max Consecutive Losers', desc: 'How many losers in a row can you handle? Model it.' },
              { name: 'Drawdown Calculator', desc: 'Calculate max drawdown and recovery time.' },
              { name: 'Percent Return', desc: 'Quick calculation of percentage gains and losses.' },
              { name: 'Tax Calculator (US)', desc: 'Estimate taxes on trading gains (short-term capital gains).' },
              { name: 'Day Trading Buying Power', desc: 'Calculate your FINRA day trading buying power.' },
              { name: 'Probability of Ruin', desc: 'What is the chance your account hits zero?' },
              { name: 'Forex Lot Size', desc: 'Calculate lot sizes based on pip risk.' },
              { name: 'Crypto Position Size', desc: 'Position sizing for volatile assets.' },
              { name: 'Options Breakeven Multi-Leg', desc: 'Breakeven for spreads, straddles, iron condors.' },
              { name: 'Portfolio Volatility', desc: 'Calculate expected volatility across your portfolio.' },
              { name: 'Leverage Calculator', desc: 'Understand true leverage and margin usage.' },
              { name: 'Break-Even Success Rate', desc: 'What win rate do you need to break even?' },
              { name: 'Risk per Trade', desc: 'How much money are you risking per trade?' },
              { name: 'Time Value Decay', desc: 'See how much an option loses per day to theta.' },
              { name: 'Volatility Cone', desc: 'See historical volatility percentiles.' },
            ].map((calc) => (
              <Link
                key={calc.name}
                href="/tools"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '20px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color 0.2s',
                  display: 'block',
                }}
              >
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-0)',
                    marginBottom: '8px',
                  }}
                >
                  {calc.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
                  {calc.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: 'clamp(60px, 8vw, 100px) 24px', maxWidth: '800px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '40px',
            textAlign: 'center',
            color: 'var(--text-0)',
          }}
        >
          Why These Calculators Matter
        </h2>

        <div style={{ display: 'grid', gap: '24px' }}>
          {[
            {
              title: 'Calculate Before You Trade',
              desc: 'Most traders skip this step. The ones who calculate position size, risk, and reward consistently outperform. Use our calculators to plan every trade.',
            },
            {
              title: 'No More Mental Math',
              desc: 'Stop trying to calculate Greeks in your head or searching YouTube for formulas. Get exact answers instantly.',
            },
            {
              title: 'Understand Your Edge',
              desc: 'Sharpe ratio, expected value, probability of ruin—these metrics tell you whether your strategy is actually profitable.',
            },
            {
              title: 'Trade All Markets',
              desc: 'Stocks, options, futures, forex, crypto. We have calculators for everything.',
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--blue)',
                  marginBottom: '10px',
                }}
              >
                {item.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          padding: 'clamp(60px, 8vw, 100px) 24px',
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '24px',
              color: 'var(--text-0)',
            }}
          >
            How Pros Use These Calculators
          </h2>

          <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.7, marginBottom: '32px' }}>
            Before every trade, professionals run the math. They calculate position size, verify risk/reward, and check
            if the expected value is positive. This is the difference between amateurs and pros.
          </p>

          <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.7, marginBottom: '32px' }}>
            You don't need expensive software. TradVue gives you the same tools for free.
          </p>

          <Link
            href="/tools"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '16px 40px',
              background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 700,
              boxShadow: '0 0 40px rgba(99,102,241,0.25)',
            }}
          >
            Access All Calculators
          </Link>
        </div>
      </section>

      <section style={{ padding: 'clamp(60px, 8vw, 100px) 24px', maxWidth: '800px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '32px',
            textAlign: 'center',
            color: 'var(--text-0)',
          }}
        >
          Free. Always.
        </h2>

        <div
          style={{
            background: 'linear-gradient(160deg, rgba(74,158,255,0.08) 0%, rgba(99,102,241,0.08) 100%)',
            border: '1px solid rgba(74,158,255,0.2)',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '16px', color: 'var(--text-1)', lineHeight: 1.7, margin: '0 0 20px 0' }}>
            All calculators are permanently free. No credit card. No sign-up. No ads (well, maybe a small badge).
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
            We believe every trader should have access to the tools they need. These calculators are our gift to the trading community.
          </p>
        </div>
      </section>

      <section
        style={{
          padding: 'clamp(60px, 8vw, 100px) 24px',
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '2.2rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '16px',
              color: 'var(--text-0)',
            }}
          >
            Start Calculating Like a Pro
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '32px', lineHeight: 1.6 }}>
            Free forever. No hidden costs. Just better trading.
          </p>
          <Link
            href="/tools"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '16px 40px',
              background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 700,
              boxShadow: '0 0 40px rgba(99,102,241,0.25)',
            }}
          >
            Use Calculators Now
          </Link>
        </div>
      </section>

      <section style={{ padding: '60px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-1)' }}>
            Related Pages
          </h3>
          <ul style={{ listStyle: 'none', display: 'grid', gap: '8px', margin: 0, padding: 0 }}>
            {[
              { href: '/best-trading-journal', text: 'Best Trading Journal for Day Traders' },
              { href: '/post-trade-ritual', text: 'Post-Trade Ritual' },
              { href: '/options-trading-journal', text: 'Options Trading Journal' },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  style={{
                    color: 'var(--blue)',
                    textDecoration: 'none',
                    fontSize: '14px',
                  }}
                >
                  → {link.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer style={{ padding: '40px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' }}>
        <p style={{ margin: '8px 0' }}>© 2026 TradVue. Not financial advice. Trading involves risk.</p>
        <p style={{ margin: '8px 0' }}>
          <Link href="/legal/disclaimer" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>
            Disclaimer
          </Link>
          {' • '}
          <Link href="/legal/privacy" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  )
}
