import { Metadata } from 'next'
import Link from 'next/link'
import '../components/seo-landing.css'

export const metadata: Metadata = {
  title: 'Futures Trading Journal — Track NQ, ES, CL with Tick-Based P&L',
  description:
    'The best futures trading journal. Auto-detect specs for 20 contracts including NQ, ES, CL. Tick-based P&L, margin tracking, prop firm sync. Free to start.',
  alternates: {
    canonical: 'https://www.tradvue.com/futures-trading-journal',
  },
  openGraph: {
    title: 'Futures Trading Journal — Track NQ, ES, CL with Tick-Based P&L | TradVue',
    description:
      'Best futures journal. 20 contract specs built-in, tick-based P&L, prop firm integration. Free to start.',
    url: 'https://www.tradvue.com/futures-trading-journal',
    siteName: 'TradVue',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'Futures Trading Journal — TradVue' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Futures Trading Journal — Track NQ, ES, CL with Tick-Based P&L | TradVue',
    description: 'Best futures journal with 20 built-in contract specs and tick-based P&L. Free to start.',
    images: ['/og-image.png'],
  },
}

export default function FuturesTradingJournalPage() {
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
                    name: 'How does TradVue auto-detect futures contract specs?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Type your contract symbol (NQ, ES, CL, etc.) and TradVue automatically loads the tick value, point value, multiplier, and margin requirement. All 20 built-in contracts are pre-configured.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Does TradVue calculate tick-based P&L for futures?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue uses each contract\'s tick value and multiplier to calculate tick-based P&L. For NQ: (exit - entry) × $20 per point ($5.00/tick). For ES: (exit - entry) × $50 per point ($12.50/tick). Calculations are based on published contract specifications.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Does TradVue support micro futures contracts?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue has built-in specs for MES (Micro E-mini S&P), MNQ (Micro Nasdaq), MCL (Micro Crude Oil), and MGC (Micro Gold), with correct micro multipliers.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Can I track prop firm rules while futures trading?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue\'s prop firm tracker integrates directly with your futures journal. Set your daily loss, max drawdown, and trailing loss limits. See live compliance gauges as you trade.',
                    },
                  },
                ],
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tradvue.com' },
                  { '@type': 'ListItem', position: 2, name: 'Futures Trading Journal', item: 'https://www.tradvue.com/futures-trading-journal' },
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
            20 contracts built-in — NQ, ES, CL and more
          </div>
          <h1 className="seo-hero-h1">
            The Best Futures Trading Journal<br />
            <span className="gradient-text">Tick-Accurate P&amp;L</span>
          </h1>
          <p className="seo-hero-sub">
            Trade NQ, ES, CL, and 17 other futures contracts with auto-detected specs, tick-based P&L,
            and integrated prop firm tracking. TradVue does the math so you focus on trading.
          </p>
          <Link href="/#signup" className="seo-hero-cta">
            Start Journaling Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <div className="seo-hero-trust">
            {['20 built-in contracts', 'Tick-accurate P&L', 'Prop firm sync'].map(t => (
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
            { value: '20', label: 'Built-in Contracts' },
            { value: '4', label: 'Micro Contracts' },
            { value: '0', label: 'Manual Lookups' },
            { value: '100%', label: 'Tick Accuracy' },
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
            <h2>Why Futures Traders Choose TradVue</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-grid-3">
            {[
              { emoji: '20', title: '20 Built-In Contracts', desc: 'NQ, ES, CL, GC, SI, TY, ZB, ZF, NG, RB, GE, ZC, ZS, ZM, ZW, YM, MES, MNQ, MCL, MGC. Add more anytime.', color: 'blue' },
              { emoji: 'AD', title: 'Auto-Detect Contract Specs', desc: 'Enter your symbol — TradVue loads tick value, multiplier, and margin. No manual calculations.', color: 'purple' },
              { emoji: 'PL', title: 'Tick-Based P&L', desc: 'Estimated profit or loss based on published contract specifications. Always verify with your broker.', color: 'green' },
              { emoji: 'MG', title: 'Margin Tracking', desc: 'Track your margin usage in real-time. Know your buying power without spreadsheets.', color: 'yellow' },
              { emoji: 'PF', title: 'Prop Firm Integration', desc: 'If you\'re trading with a prop firm, connect your rules and monitor compliance live.', color: 'red' },
              { emoji: '🔬', title: 'Micro Contract Support', desc: 'Trade micros? TradVue calculates correctly for MES, MNQ, MCL, and more.', color: 'blue' },
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

      {/* ── Contract list ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Built-In Contract Specs</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>All these contracts auto-load. Add custom contracts anytime.</p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '28px',
          }}>
            {[
              'NQ (Nasdaq-100)', 'ES (E-mini S&P 500)', 'CL (Crude Oil)', 'GC (Gold)',
              'SI (Silver)', 'TY (10-Year Note)', 'ZB (30-Year Bond)', 'ZF (5-Year Note)',
              'NG (Natural Gas)', 'RB (Gasoline)', 'GE (Eurodollar)', 'ZC (Corn)',
              'ZS (Soybean)', 'ZM (Soybean Meal)', 'ZW (Wheat)', 'YM (Mini Dow)',
              'MES (Micro E-mini S&P)', 'MNQ (Micro Nasdaq)', 'MCL (Micro Crude)', 'MGC (Micro Gold)',
            ].map(contract => (
              <div key={contract} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-1)' }}>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                {contract}
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
              { step: '01', title: 'Select Your Contract', desc: 'Choose from 20 built-in contracts or add a custom one. TradVue loads the specs automatically.' },
              { step: '02', title: 'Log Your Trade', desc: 'Enter entry price, exit price, contract size. TradVue calculates your P&L instantly.' },
              { step: '03', title: 'See Tick-Based P&L', desc: 'Estimated profit or loss based on the contract\'s published tick value and multiplier.' },
              { step: '04', title: 'Track Your Progress', desc: 'Analyze your performance over time. Find what works, fix what doesn\'t.' },
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

      {/* ── Example calc ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Example: NQ Trade Calculation</h2>
            <div className="seo-divider" />
          </div>
          <div style={{
            background: 'var(--bg-2)',
            border: '1px solid rgba(74,158,255,0.2)',
            borderRadius: '14px', padding: '28px',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--text-1)', marginBottom: '20px' }}>
              Let's say you trade NQ (Nasdaq-100 E-mini):
            </p>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
              {[['Entry', '17500'], ['Exit', '17510'], ['Size', '1 contract'], ['Tick value', '$5.00 per tick'], ['Point value', '$20 per point']].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                  <span style={{ color: 'var(--blue)', fontWeight: 700, minWidth: '100px' }}>{label}</span>
                  <span style={{ color: 'var(--text-1)' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,192,106,0.08), rgba(74,158,255,0.08))',
              border: '1px solid rgba(0,192,106,0.25)',
              borderRadius: '10px', padding: '16px',
              fontSize: '15px', color: 'var(--green)', fontWeight: 700,
            }}>
              TradVue calculates: (17510 − 17500) × (4 ticks) × $5.00/tick × 1 contract = <strong>$200 profit</strong>
            </div>
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
              { q: 'How does TradVue auto-detect futures contract specs?', a: 'Type your contract symbol (NQ, ES, CL, etc.) and TradVue automatically loads the tick value, point value, multiplier, and margin requirement. All 20 built-in contracts are pre-configured.' },
              { q: 'Does TradVue calculate tick-based P&L for futures?', a: 'Yes. TradVue uses each contract\'s tick value and multiplier to calculate tick-based P&L. For NQ: (exit - entry) × $20 per point ($5.00/tick). For ES: (exit - entry) × $50 per point ($12.50/tick). Calculations are based on published contract specifications and do not account for commissions, fees, or slippage.' },
              { q: 'Does TradVue support micro futures contracts?', a: 'Yes. TradVue has built-in specs for MES (Micro E-mini S&P), MNQ (Micro Nasdaq), MCL (Micro Crude Oil), and MGC (Micro Gold), with correct micro multipliers.' },
              { q: 'Can I track prop firm rules while futures trading?', a: 'Yes. TradVue\'s prop firm tracker integrates directly with your futures journal. Set your daily loss, max drawdown, and trailing loss limits. See live compliance gauges as you trade.' },
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
          <h2 className="seo-cta-h2">Journal Your Futures Trades with Confidence</h2>
          <p className="seo-cta-sub">Let TradVue handle the contract specs and calculations. You focus on trading.</p>
          <Link href="/#signup" className="seo-cta-btn">
            Start Journaling Free
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
              { href: '/propfirm', title: 'Prop Firm Tracker', desc: 'Track your prop firm rules & compliance', emoji: '🎯' },
              { href: '/tools', title: 'Futures Calculator', desc: 'Calculate tick value for any contract', emoji: '🔢' },
              { href: '/best-trading-journal', title: 'Best Trading Journal', desc: 'Why TradVue works for futures traders', emoji: '🏆' },
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
                { href: '/prop-firm-tracker', text: 'Prop Firm Tracker — Monitor Rules in Real-Time' },
                { href: '/trading-calculators', text: '30+ Free Trading Calculators' },
                { href: '/options-trading-journal', text: 'Options Trading Journal — Track Greeks & Strategies' },
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
