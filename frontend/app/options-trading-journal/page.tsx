import { Metadata } from 'next'
import Link from 'next/link'
import '../components/seo-landing.css'

export const metadata: Metadata = {
  title: 'Options Trading Journal — Track Greeks, Spreads & Multi-Leg P&L',
  description:
    'Options journal with Greeks tracking (delta, gamma, theta, vega), multi-leg strategy support (Iron Condors, spreads, straddles), and P&L by strategy type. Free to start.',
  alternates: {
    canonical: 'https://www.tradvue.com/options-trading-journal',
  },
  openGraph: {
    title: 'Options Trading Journal — Track Greeks, Spreads & Multi-Leg P&L | TradVue',
    description:
      'Track options trades with Greeks, multi-leg strategies, and deep analytics. Iron Condors, spreads, straddles. Free to start.',
    url: 'https://www.tradvue.com/options-trading-journal',
    siteName: 'TradVue',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'Options Trading Journal — TradVue' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Options Trading Journal — Track Greeks, Spreads & P&L | TradVue',
    description: 'Track options with Greeks, multi-leg strategies, and analytics. Free to start.',
    images: ['/og-image.png'],
  },
}

export default function OptionsTradingJournalPage() {
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
                    name: 'Can TradVue track multi-leg options strategies?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue supports spreads, straddles, Iron Condors, butterflies, and any multi-leg strategy. Log all legs at once and tag trades by strategy type for deep performance analytics.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Does TradVue calculate options Greeks?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue tracks delta, gamma, theta, and vega for individual positions and your overall portfolio, helping you understand your total risk exposure.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Which options strategies does TradVue support?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'TradVue supports covered calls, cash-secured puts, vertical spreads, calendar spreads, straddles, strangles, Iron Condors, butterfly spreads, ratio spreads, and any custom multi-leg position.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Can I analyze my P&L by options strategy type?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue\'s analytics break down your P&L by strategy type. See whether your Iron Condors are outperforming your spreads, or which strategies perform best in different market conditions.',
                    },
                  },
                ],
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tradvue.com' },
                  { '@type': 'ListItem', position: 2, name: 'Options Trading Journal', item: 'https://www.tradvue.com/options-trading-journal' },
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
          <Link href="/#signup" className="seo-nav-cta">Get Started Free</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="seo-hero">
        <div className="seo-hero-glow-1" />
        <div className="seo-hero-glow-2" />
        <div className="seo-hero-inner">
          <div className="seo-hero-badge">
            <span className="seo-hero-badge-dot" />
            Greeks tracking + multi-leg strategies
          </div>
          <h1 className="seo-hero-h1">
            Journal Your Options Trades<br />
            <span className="gradient-text">With Greeks Precision</span>
          </h1>
          <p className="seo-hero-sub">
            Multi-leg strategies, Greeks analysis, and P&L by strategy type. TradVue lets you understand
            your options portfolio with the precision it demands.
          </p>
          <Link href="/#signup" className="seo-hero-cta">
            Try Options Journaling Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <div className="seo-hero-trust">
            {['Delta, Gamma, Theta, Vega', 'Multi-leg strategies', 'P&L by strategy type'].map(t => (
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
            { value: '4', label: 'Greeks Tracked' },
            { value: '12+', label: 'Strategy Types' },
            { value: '4', label: 'Max Legs Per Trade' },
            { value: '100%', label: 'P&L Accuracy' },
          ].map(s => (
            <div key={s.label} className="seo-stat">
              <div className="seo-stat-value">{s.value}</div>
              <div className="seo-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section className="seo-section">
        <div className="seo-section-inner">
          <div className="seo-section-header">
            <h2>Built for Options Traders</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-grid-3">
            {[
              { emoji: 'ML', title: 'Multi-Leg Strategies', desc: 'Trade spreads, straddles, Iron Condors, Butterflies, and any complex position. Log multiple legs at once.', color: 'blue' },
              { emoji: 'GK', title: 'Greeks Tracking', desc: 'View delta, gamma, theta, vega, and rho exposure. Understand your portfolio risk at a glance.', color: 'purple' },
              { emoji: 'PA', title: 'P&L by Strategy Type', desc: 'Analyze P&L by strategy type. Compare spreads vs. straddles vs. iron condors to see what the data shows.', color: 'green' },
              { emoji: 'TG', title: 'Strike & Expiration Tags', desc: 'Organize by strike price, days to expiration, and strategy type. Find patterns that work.', color: 'yellow' },
              { emoji: 'BE', title: 'Breakeven Analysis', desc: 'TradVue calculates breakeven prices for any multi-leg strategy automatically.', color: 'red' },
              { emoji: 'RM', title: 'Risk Management', desc: 'Max loss, max profit, probability of profit — see your full risk profile before you trade.', color: 'blue' },
            ].map(f => (
              <div key={f.title} className="seo-card">
                <div className={`seo-card-icon seo-card-icon-${f.color}`}>{f.emoji}</div>
                <div className="seo-card-title">{f.title}</div>
                <div className="seo-card-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Strategies ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Supported Strategies</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>Log any single or multi-leg strategy. TradVue calculates the math.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {[
              { name: 'Covered Call', legs: 2 },
              { name: 'Cash-Secured Put', legs: 1 },
              { name: 'Vertical Spread', legs: 2 },
              { name: 'Calendar Spread', legs: 2 },
              { name: 'Straddle', legs: 2 },
              { name: 'Strangle', legs: 2 },
              { name: 'Iron Condor', legs: 4 },
              { name: 'Butterfly Spread', legs: 3 },
              { name: 'Ratio Spread', legs: 3 },
              { name: 'Diagonal Spread', legs: 2 },
              { name: 'Backspread', legs: 3 },
              { name: 'Long Call', legs: 1 },
            ].map(strategy => (
              <div key={strategy.name} className="seo-card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '4px' }}>{strategy.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--blue)' }}>{strategy.legs} {strategy.legs === 1 ? 'leg' : 'legs'}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>How It Works</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-steps">
            {[
              { step: '01', title: 'Choose Your Strategy', desc: 'Select from pre-built strategies or create a custom multi-leg position.' },
              { step: '02', title: 'Log All Legs', desc: 'Enter calls, puts, entry prices, and quantities for each leg.' },
              { step: '03', title: 'See Your Greeks', desc: 'TradVue calculates delta, gamma, theta, vega for the entire position.' },
              { step: '04', title: 'Analyze & Learn', desc: 'See P&L by strategy type. Find what works. Discard what doesn\'t.' },
            ].map(item => (
              <div key={item.step} className="seo-step">
                <div className="seo-step-num">{item.step}</div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Greeks explainer ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Why Greeks Matter</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>Most options traders ignore the Greeks and trade by feel. The Greeks tell you exactly what you're risking.</p>
          </div>
          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              { greek: 'Δ Delta', meaning: 'How much your position moves with the underlying. Delta 0.5 = $50 move per $100 stock move.', color: 'blue' },
              { greek: 'Γ Gamma', meaning: 'How fast delta changes. High gamma = more risk but more flexibility.', color: 'purple' },
              { greek: 'Θ Theta', meaning: 'Time decay. How much you make (or lose) every day if nothing else changes.', color: 'yellow' },
              { greek: 'V Vega', meaning: 'Volatility sensitivity. How much you make/lose if implied volatility changes.', color: 'green' },
            ].map(item => (
              <div key={item.greek} className="seo-card" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', padding: '20px' }}>
                <div className={`seo-card-icon seo-card-icon-${item.color}`} style={{ marginBottom: 0, fontSize: '18px', fontWeight: 800, fontFamily: 'serif' }}>
                  {item.greek.split(' ')[0]}
                </div>
                <div>
                  <div className="seo-card-title" style={{ marginBottom: '6px' }}>{item.greek}</div>
                  <div className="seo-card-desc">{item.meaning}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Frequently Asked Questions</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-faq-list">
            {[
              { q: 'Can TradVue track multi-leg options strategies?', a: 'Yes. TradVue supports spreads, straddles, Iron Condors, butterflies, and any multi-leg strategy. Log all legs at once and tag trades by strategy type for deep performance analytics.' },
              { q: 'Does TradVue calculate options Greeks?', a: 'Yes. TradVue tracks delta, gamma, theta, and vega for individual positions and your overall portfolio, helping you understand your total risk exposure.' },
              { q: 'Which options strategies does TradVue support?', a: 'TradVue supports covered calls, cash-secured puts, vertical spreads, calendar spreads, straddles, strangles, Iron Condors, butterfly spreads, ratio spreads, and any custom multi-leg position.' },
              { q: 'Can I analyze my P&L by options strategy type?', a: 'Yes. TradVue\'s analytics break down your P&L by strategy type. See whether your Iron Condors are outperforming your spreads, or which strategies perform best in different market conditions.' },
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
            Performance analytics are based on user-entered data and may not reflect actual trading results. Past performance does not indicate future results. This is not financial advice.
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="seo-cta-section">
        <div className="seo-cta-inner">
          <h2 className="seo-cta-h2">Stop Guessing. Start Understanding Your Options.</h2>
          <p className="seo-cta-sub">TradVue gives you the math. Greeks, P&L, strategy performance. Trade smarter.</p>
          <Link href="/#signup" className="seo-cta-btn">
            Try Options Journaling Free
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
              { href: '/journal', title: 'Start Journaling', desc: 'Open the trading journal app', emoji: '📓' },
              { href: '/tools', title: 'Options Calculator', desc: 'Calculate Greeks with Black-Scholes', emoji: '⚡' },
              { href: '/best-trading-journal', title: 'Best Trading Journal', desc: 'Why TradVue works for options traders', emoji: '🏆' },
              { href: '/trading-calculators', title: 'All Calculators', desc: '30+ free trading tools and calculators', emoji: '🔢' },
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
                { href: '/trading-calculators', text: '30+ Free Trading Calculators — Position Size, Greeks' },
                { href: '/post-trade-ritual', text: 'Post-Trade Ritual — Build Your Daily Habit' },
                { href: '/futures-trading-journal', text: 'Futures Trading Journal — NQ, ES, CL' },
              ].map(link => (
                <li key={link.href}><Link href={link.href}>→ {link.text}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="seo-footer">
        <p>© 2026 TradVue. Not financial advice. Trading involves risk.</p>
        <p><Link href="/legal/disclaimer">Disclaimer</Link>{' • '}<Link href="/legal/privacy">Privacy</Link></p>
      </footer>
    </div>
  )
}
