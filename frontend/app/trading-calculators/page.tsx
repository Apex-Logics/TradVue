import { Metadata } from 'next'
import Link from 'next/link'
import '../components/seo-landing.css'

export const metadata: Metadata = {
  title: '30+ Free Trading Calculators — Position Size, Risk, Options Greeks',
  description:
    'Free trading calculators for position sizing, risk/reward, options Greeks, futures tick value, Sharpe ratio, Kelly criterion, trade expectancy, and more. Try now.',
  alternates: {
    canonical: 'https://www.tradvue.com/trading-calculators',
  },
  openGraph: {
    title: '30+ Free Trading Calculators — Position Size, Risk, Options Greeks | TradVue',
    description:
      '30+ free trading calculators: position sizing, risk/reward, Greeks, futures specs, Sharpe ratio, Kelly criterion, and more. No sign-up required.',
    url: 'https://www.tradvue.com/trading-calculators',
    siteName: 'TradVue',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'TradVue Free Trading Calculators' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '30+ Free Trading Calculators | TradVue',
    description: 'Free trading calculators: position sizing, risk/reward, Greeks, futures specs, and more. No sign-up.',
    images: ['/og-image.png'],
  },
}

export default function TradingCalculatorsPage() {
  return (
    <div className="seo-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'FAQPage',
                mainEntity: [
                  {
                    '@type': 'Question',
                    name: 'Are TradVue\'s trading calculators really free?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. All 30+ calculators are free to use. No sign-up, no credit card, no hidden costs. Just open the tools and calculate.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'What trading calculators does TradVue offer?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'TradVue includes: Position Size Calculator, Risk/Reward Ratio, Options Greeks (Black-Scholes), Futures Tick Value, Sharpe Ratio, Kelly Criterion, Trade Expectancy, Compound Growth, Correlation Matrix, Risk of Ruin, Pip Value (Forex), Dividend Planner, and more.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'How do I calculate the right position size for a trade?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Use TradVue\'s position size calculator. Enter your account size, risk percentage (typically 1-2%), and stop loss distance. The calculator tells you exactly how many shares, contracts, or lots to trade.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Does TradVue have a futures calculator for NQ and ES?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. The futures calculator includes built-in specs for NQ, ES, CL, GC, and 16 other contracts. Enter your entry, exit, and contract count to get tick-based P&L based on published contract specifications.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'What is the Kelly Criterion and how do I use it?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'The Kelly Criterion calculates the optimal position size percentage based on your historical win rate and average win/loss ratio. TradVue\'s Kelly calculator shows both full and half-Kelly (recommended for trading).',
                    },
                  },
                ],
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tradvue.com' },
                  { '@type': 'ListItem', position: 2, name: 'Trading Calculators', item: 'https://www.tradvue.com/trading-calculators' },
                ],
              },
            ],
          }),
        }}
      />

      {/* ── Nav ── */}
      <nav className="seo-nav">
        <div className="seo-nav-inner">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-header.svg" alt="TradVue" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
          </Link>
          <Link href="/tools" className="seo-nav-cta">Use Calculators</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="seo-hero">
        <div className="seo-hero-glow-1" />
        <div className="seo-hero-glow-2" />
        <div className="seo-hero-inner">
          <div className="seo-hero-badge">
            <span className="seo-hero-badge-dot" />
            30+ calculators — no sign-up required
          </div>
          <h1 className="seo-hero-h1">
            30+ Free Trading Calculators<br />
            <span className="gradient-text">Calculate Before You Trade</span>
          </h1>
          <p className="seo-hero-sub">
            Everything a trader needs to calculate. Position sizing, risk/reward, Greeks, futures specs,
            Sharpe ratio, and more. Free to use — no sign-up, no credit card required.
          </p>
          <Link href="/tools" className="seo-hero-cta">
            Access All Calculators
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <div className="seo-hero-trust">
            {['No credit card', 'No sign-up required', 'All markets covered'].map(t => (
              <span key={t} className="seo-hero-trust-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="seo-section-alt" style={{ padding: '0' }}>
        <div className="seo-stats-bar" style={{ borderRadius: '0', border: 'none', borderBottom: '1px solid var(--border)' }}>
          {[
            { value: '30+', label: 'Calculators' },
            { value: '5', label: 'Asset Classes' },
            { value: '0', label: 'Sign-up Required' },
            { value: '∞', label: 'Free Uses' },
          ].map(s => (
            <div key={s.label} className="seo-stat">
              <div className="seo-stat-value">{s.value}</div>
              <div className="seo-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Calculator library ── */}
      <section className="seo-section">
        <div className="seo-section-inner">
          <div className="seo-section-header">
            <h2>Complete Calculator Library</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>All calculators are free to use. No credit card. No sign-up required.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { name: 'Position Size Calculator', desc: 'Calculate optimal position size based on risk percentage and stop loss.' },
              { name: 'Risk/Reward Ratio', desc: 'Calculate your risk-to-reward ratio. Know your edge before you trade.', emoji: '⚖️' },
              { name: 'Profit Target Calculator', desc: 'Set profit targets based on risk/reward multiples.' },
              { name: 'Options Greeks', desc: 'Calculate delta, gamma, theta, vega for any option.' },
              { name: 'IV Percentile', desc: 'Know if implied volatility is high or low historically.' },
              { name: 'Breakeven Calculator', desc: 'Find breakeven prices for any multi-leg strategy.', emoji: '↔️' },
              { name: 'Futures Tick Value', desc: 'Calculate P&L per tick for any futures contract based on published contract specifications.' },
              { name: 'Margin Calculator', desc: 'Know your margin requirements before you trade.' },
              { name: 'Sharpe Ratio', desc: 'Measure risk-adjusted returns. Is your strategy actually good?' },
              { name: 'Trade Expectancy', desc: 'Calculate expected value per trade based on win rate and R:R.', emoji: '🔮' },
              { name: 'Compound Growth', desc: 'Project account growth over time at various monthly returns.' },
              { name: 'Kelly Criterion', desc: 'Optimal position sizing based on your win rate and payoff ratio.' },
              { name: 'Pip Value Calculator', desc: 'Calculate pip value for forex pairs and account currency.', emoji: '💱' },
              { name: 'Correlation Matrix', desc: 'See which assets move together. Diversify smarter.' },
              { name: 'Max Consecutive Losers', desc: 'How many losers in a row can you handle? Model it.', emoji: '😤' },
              { name: 'Drawdown Calculator', desc: 'Calculate max drawdown and recovery time.' },
              { name: 'Percent Return', desc: 'Quick calculation of percentage gains and losses.', emoji: '💹' },
              { name: 'Tax Calculator (US)', desc: 'Estimate taxes on trading gains (short-term capital gains).', emoji: '🏛️' },
              { name: 'Day Trading Buying Power', desc: 'Calculate your FINRA day trading buying power.' },
              { name: 'Probability of Ruin', desc: 'What is the chance your account hits zero?', emoji: '🎰' },
              { name: 'Forex Lot Size', desc: 'Calculate lot sizes based on pip risk.', emoji: '🌍' },
              { name: 'Crypto Position Size', desc: 'Position sizing for volatile assets.', emoji: '₿' },
              { name: 'Options Breakeven Multi-Leg', desc: 'Breakeven for spreads, straddles, iron condors.', emoji: '🔀' },
              { name: 'Portfolio Volatility', desc: 'Calculate expected volatility across your portfolio.', emoji: '🌊' },
              { name: 'Leverage Calculator', desc: 'Understand true leverage and margin usage.' },
              { name: 'Break-Even Success Rate', desc: 'What win rate do you need to break even?' },
              { name: 'Risk per Trade', desc: 'How much money are you risking per trade?' },
              { name: 'Time Value Decay', desc: 'See how much an option loses per day to theta.', emoji: '⏳' },
              { name: 'Volatility Cone', desc: 'See historical volatility percentiles.' },
            ].map(calc => (
              <Link key={calc.name} href="/tools" className="seo-card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px' }}>
                <div className="seo-card-title" style={{ marginBottom: '6px' }}>{calc.name}</div>
                <div className="seo-card-desc">{calc.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why they matter ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Why These Calculators Matter</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-grid-2">
            {[
              { emoji: '📊', title: 'Calculate Before You Trade', desc: 'Most traders skip this step. Calculating position size, risk, and reward before every trade is a discipline that separates systematic traders from impulsive ones.', color: 'blue' },
              { emoji: 'MM', title: 'No More Mental Math', desc: 'Stop trying to calculate Greeks in your head or searching YouTube for formulas. Get exact answers instantly.', color: 'purple' },
              { emoji: 'AN', title: 'Analyze Your Edge', desc: 'Sharpe ratio, expected value, probability of ruin — these metrics help you evaluate whether your strategy has a statistical edge.', color: 'green' },
              { emoji: 'AM', title: 'All Markets', desc: 'Stocks, options, futures, forex, crypto. Calculators for every asset class.', color: 'yellow' },
            ].map(item => (
              <div key={item.title} className="seo-card">
                <div className={`seo-card-icon seo-card-icon-${item.color}`}>{item.emoji}</div>
                <div className="seo-card-title">{item.title}</div>
                <div className="seo-card-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How pros use them ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>How Pros Use These Calculators</h2>
            <div className="seo-divider" />
          </div>
          <div style={{
            background: 'linear-gradient(160deg, rgba(74,158,255,0.05), rgba(99,102,241,0.05))',
            border: '1px solid rgba(74,158,255,0.15)',
            borderRadius: '16px', padding: '36px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.75, marginBottom: '24px' }}>
              Before every trade, professionals run the math. They calculate position size, verify risk/reward, and check
              if the expected value is positive. This is the difference between amateurs and pros.
            </p>
            <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.75, marginBottom: '32px' }}>
              You don't need expensive software. TradVue gives you the same tools — free to use.
            </p>
            <Link href="/tools" className="seo-hero-cta" style={{ fontSize: '14px', padding: '12px 28px' }}>
              Access All Calculators
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Frequently Asked Questions</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-faq-list">
            {[
              { q: 'Are TradVue\'s trading calculators really free?', a: 'Yes. All 30+ calculators are free to use. No sign-up, no credit card, no hidden costs. Just open the tools and calculate.' },
              { q: 'What trading calculators does TradVue offer?', a: 'TradVue includes: Position Size Calculator, Risk/Reward Ratio, Options Greeks (Black-Scholes), Futures Tick Value, Sharpe Ratio, Kelly Criterion, Trade Expectancy, Compound Growth, Correlation Matrix, Risk of Ruin, Pip Value (Forex), Dividend Planner, and more.' },
              { q: 'How do I calculate the right position size for a trade?', a: 'Use TradVue\'s position size calculator. Enter your account size, risk percentage (typically 1-2%), and stop loss distance. The calculator tells you exactly how many shares, contracts, or lots to trade.' },
              { q: 'Does TradVue have a futures calculator for NQ and ES?', a: 'Yes. The futures calculator includes built-in specs for NQ, ES, CL, GC, and 16 other contracts. Enter your entry, exit, and contract count to get tick-based P&L based on published contract specifications.' },
              { q: 'What is the Kelly Criterion and how do I use it?', a: 'The Kelly Criterion calculates the optimal position size percentage based on your historical win rate and average win/loss ratio. TradVue\'s Kelly calculator shows both full and half-Kelly (recommended for trading).' },
            ].map(item => (
              <div key={item.q} className="seo-faq-item">
                <div className="seo-faq-q">
                  <span>{item.q}</span>
                  <span className="seo-faq-q-icon">+</span>
                </div>
                <div className="seo-faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section style={{
        padding: '16px 24px',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(180,180,200,0.55)', lineHeight: 1.6 }}>
            Calculations are based on published specifications and user-entered data. Results are estimates only and do not account for commissions, fees, slippage, or market conditions. Always verify with your broker. This is not financial advice.
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="seo-cta-section">
        <div className="seo-cta-inner">
          <h2 className="seo-cta-h2">Start Calculating Like a Pro</h2>
          <p className="seo-cta-sub">
            All calculators are free to use. No credit card. No sign-up required. Just better trading.
          </p>
          <Link href="/tools" className="seo-cta-btn">
            Use Calculators Now
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
      </section>

      {/* ── Related ── */}
      <section className="seo-related-section">
        <div className="seo-section-inner-narrow">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '24px', color: 'var(--text-0)' }}>You Might Also Like</h2>
          <div className="seo-related-grid">
            {[
              { href: '/tools', title: 'Use Calculators Now', desc: 'Launch the actual calculator app', emoji: '🚀' },
              { href: '/journal', title: 'Trading Journal', desc: 'Log trades and track your performance', emoji: '📓' },
              { href: '/best-trading-journal', title: 'Best Trading Journal', desc: 'Why traders choose TradVue', emoji: '🏆' },
              { href: '/options-trading-journal', title: 'Options Journal', desc: 'Track Greeks and multi-leg strategies', emoji: '⚡' },
            ].map(item => (
              <Link key={item.href} href={item.href} className="seo-related-card">
                <div className="seo-related-card-title">{item.title}</div>
                <div className="seo-related-card-desc">{item.desc}</div>
              </Link>
            ))}
          </div>
          <div className="seo-guide-links">
            <h3>Related Guides</h3>
            <ul>
              {[
                { href: '/best-trading-journal', text: 'Best Trading Journal for Day Traders 2026' },
                { href: '/post-trade-ritual', text: 'Post-Trade Ritual — Build Your Daily Habit' },
                { href: '/options-trading-journal', text: 'Options Trading Journal — Track Greeks & Strategies' },
                { href: '/futures-trading-journal', text: 'Futures Trading Journal — NQ, ES, CL' },
                { href: '/prop-firm-tracker', text: 'Prop Firm Tracker — Monitor Rules in Real-Time' },
              ].map(link => (
                <li key={link.href}><Link href={link.href}>→ {link.text}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="seo-footer">
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px' }}>Calculations are based on published contract specifications and user-entered data. Actual P&amp;L may differ due to commissions, fees, slippage, and market conditions. Always verify with your broker.</p>
        <p>© 2026 TradVue. Not financial advice. Trading involves risk.</p>
        <p><Link href="/legal/disclaimer">Disclaimer</Link>{' • '}<Link href="/legal/privacy">Privacy</Link></p>
      </footer>
    </div>
  )
}
