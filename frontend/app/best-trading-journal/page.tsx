import { Metadata } from 'next'
import Link from 'next/link'
import '../components/seo-landing.css'

export const metadata: Metadata = {
  title: 'Best Trading Journal for Day Traders 2026 | TradVue',
  description:
    'The best free trading journal for day traders in 2026. AI analytics, 30+ calculators, prop firm tracking, and real-time alerts. Create a free account — no credit card required.',
  alternates: {
    canonical: 'https://www.tradvue.com/best-trading-journal',
  },
  openGraph: {
    title: 'Best Trading Journal for Day Traders 2026 | TradVue',
    description:
      'The best free trading journal for day traders. AI-powered analytics, 30+ calculators, prop firm tracking, and real-time alerts. Free to start.',
    url: 'https://www.tradvue.com/best-trading-journal',
    siteName: 'TradVue',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'Best Trading Journal for Day Traders — TradVue' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Trading Journal for Day Traders 2026 | TradVue',
    description:
      'The best free trading journal. AI analytics, 30+ calculators, prop firm tracking. Free to start.',
    images: ['/og-image.png'],
  },
}

export default function BestTradingJournalPage() {
  return (
    <div className="seo-page">
      {/* ── Structured Data ── */}
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
                    name: 'What makes TradVue the best trading journal for day traders?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'TradVue combines AI-powered analytics, 30+ free calculators, prop firm tracking, and a clean interface built by traders. You get real-time drawdown gauges, emotion tracking, and pattern detection — available with a free account.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Is TradVue really free to use?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. Create a free account (no credit card required) for a 3-week full trial. The free tier includes basic trade logging, analytics (30-day view window), and all 30+ calculators. Dashboard, news, and calendar are open to all — no account needed.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Can I track prop firm drawdowns in TradVue?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue has built-in prop firm tracking that syncs your journal with prop firm rules, showing real-time drawdown gauges, daily loss limits, and trailing loss status.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Can I import my existing trades into TradVue?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue supports CSV import from most major brokers and platforms. You can import your full trade history to analyze historical performance.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Does TradVue work for options and futures traders?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue supports multi-asset journaling including stocks, options (with Greeks tracking), futures (with built-in contract specs for 20 contracts), forex, and crypto.',
                    },
                  },
                ],
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tradvue.com' },
                  { '@type': 'ListItem', position: 2, name: 'Best Trading Journal', item: 'https://www.tradvue.com/best-trading-journal' },
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
            Free account — no credit card required
          </div>
          <h1 className="seo-hero-h1">
            The Best Free Trading Journal<br />
            <span className="gradient-text">Built for Day Traders</span>
          </h1>
          <p className="seo-hero-sub">
            Stop journaling in spreadsheets. TradVue gives you AI-powered insights, real-time prop firm tracking,
            and 30+ trading calculators — free account, no credit card required.
          </p>
          <Link href="/#signup" className="seo-hero-cta">
            Start Journaling Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <div className="seo-hero-trust">
            {['No credit card required', 'Free tier included', 'Instant CSV import'].map(t => (
              <span key={t} className="seo-hero-trust-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="seo-section-alt" style={{ padding: '0' }}>
        <div className="seo-stats-bar" style={{ borderRadius: '0', border: 'none', borderBottom: '1px solid var(--border)' }}>
          {[
            { value: '30+', label: 'Built-in Calculators' },
            { value: '20', label: 'Futures Contracts' },
            { value: '60s', label: 'Per-Trade Ritual' },
            { value: '$24', label: 'Pro / Month' },
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
            <h2>Why TradVue Stands Out</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>
              Every feature built to help you analyze your trading — not just log more.
            </p>
          </div>
          <div className="seo-grid-3">
            {[
              { emoji: 'AI', title: 'AI-Powered Trade Analysis', desc: 'Every trade you log gets analyzed by AI. Spot your patterns, weaknesses, and edges without manually reviewing hundreds of trades.', color: 'blue' },
              { emoji: '30+', title: '30+ Free Trading Calculators', desc: 'Position sizing, risk/reward, profit targets, options Greeks, futures tick value, Sharpe ratio — all built in. No more switching between tabs.', color: 'purple' },
              { emoji: 'PF', title: 'Real-Time Prop Firm Tracking', desc: 'Link your journal to prop firm rules. See your drawdown gauge, daily loss limits, and trailing loss in real-time. Never exceed your rules again.', color: 'green' },
              { emoji: 'MA', title: 'Multi-Asset Support', desc: 'Trade stocks, options, futures, crypto, or forex. TradVue auto-detects your asset class and applies the right calculations for each.', color: 'yellow' },
              { emoji: 'TG', title: 'Smart Trade Tags & Notes', desc: 'Tag trades by setup, emotion, market condition, and outcome. Find patterns that make you money. Identify what loses you money.', color: 'blue' },
              { emoji: 'ST', title: 'Streak Tracking & Habits', desc: 'Build a journaling habit. Watch your streak grow. Consistency creates the data you need to analyze your patterns.', color: 'purple' },
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

      {/* ── Comparison table ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Feature Comparison</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-table-wrap">
            <table className="seo-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="highlight" style={{ textAlign: 'center' }}>TradVue</th>
                  <th style={{ textAlign: 'center', color: 'var(--text-2)' }}>Spreadsheet</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['AI Trade Analysis', '✓', '✗'],
                  ['30+ Calculators', '✓', '✗'],
                  ['Prop Firm Sync', '✓', '✗'],
                  ['Pattern Detection', '✓', '✗'],
                  ['Mobile App', '✓ (coming)', '✗'],
                  ['Emotion Tags', '✓', '✗'],
                  ['Real-Time Updates', '✓', '✗'],
                  ['CSV Import', '✓', '✓'],
                  ['Free to Start', '✓', '✓'],
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="feature-cell">{row[0]}</td>
                    <td className="center-cell"><span className="tick-yes">{row[1]}</span></td>
                    <td className="center-cell"><span className={row[2] === '✓' ? 'tick-yes' : 'tick-no'}>{row[2]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              { step: '01', title: 'Log Your Trades', desc: 'Enter your trades manually or import from CSV. TradVue auto-detects your asset class.' },
              { step: '02', title: 'AI Analysis', desc: 'Our AI reviews every trade, spots patterns, and highlights what\'s working.' },
              { step: '03', title: 'Track Prop Firm Rules', desc: 'Connect to prop firms. See real-time drawdown, daily loss, and trailing loss gauges.' },
              { step: '04', title: 'Build Your Edge', desc: 'Use the insights to analyze your patterns. Find your edge. Repeat.' },
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

      {/* ── Pricing ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Pricing</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>Start free, upgrade only if you need advanced features.</p>
          </div>
          <div className="seo-grid-2">
            {[
              {
                name: 'Free',
                price: 'Free to Start',
                sub: 'No credit card',
                features: ['Unlimited trade logging', 'Basic analytics', '30+ calculators', 'CSV import', 'Email support'],
                highlight: false,
              },
              {
                name: 'Pro',
                price: '$24/month',
                sub: 'Billed monthly',
                features: ['Everything in Free', 'Ad-free experience', 'AI trade analysis', 'Prop firm sync', 'Advanced patterns', 'Priority support'],
                highlight: true,
              },
            ].map(tier => (
              <div
                key={tier.name}
                style={{
                  background: tier.highlight
                    ? 'linear-gradient(160deg, rgba(74,158,255,0.06) 0%, rgba(99,102,241,0.06) 100%)'
                    : 'var(--bg-2)',
                  border: tier.highlight ? '1px solid rgba(74,158,255,0.3)' : '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '32px',
                  position: 'relative',
                }}
              >
                {tier.highlight && (
                  <div style={{
                    position: 'absolute', top: '20px', right: '20px',
                    background: 'linear-gradient(135deg, #4a9eff, #6366f1)',
                    color: '#fff', fontSize: '10px', fontWeight: 700,
                    letterSpacing: '0.08em', padding: '4px 10px', borderRadius: '100px',
                    textTransform: 'uppercase',
                  }}>Popular</div>
                )}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: tier.highlight ? 'var(--blue)' : 'var(--text-2)', textTransform: 'uppercase', marginBottom: '8px' }}>{tier.name}</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-0)', lineHeight: 1 }}>{tier.price}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '6px' }}>{tier.sub}</div>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', padding: 0, margin: '0 0 24px' }}>
                  {tier.features.map(feat => (
                    <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-1)' }}>
                      <span style={{ color: tier.highlight ? 'var(--blue)' : 'var(--green)' }}>✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/#signup" style={{
                  display: 'block', textAlign: 'center', padding: '12px',
                  borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '14px',
                  background: tier.highlight ? 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)' : 'var(--bg-3)',
                  color: '#fff',
                  border: tier.highlight ? 'none' : '1px solid var(--border)',
                }}>
                  Get Started Free
                </Link>
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
              { q: 'What makes TradVue the best trading journal for day traders?', a: 'TradVue combines AI-powered analytics, 30+ free calculators, prop firm tracking, and a clean interface built by traders. You get real-time drawdown gauges, emotion tracking, and pattern detection — available with a free account.' },
              { q: 'Is TradVue really free to use?', a: 'Yes. Create a free account (no credit card required) and get a 3-week full trial of all features. The free tier includes manual trade logging, basic analytics (30-day view window), and access to all 30+ calculators. Dashboard, news, and calendar are available without any account.' },
              { q: 'Can I track prop firm drawdowns in TradVue?', a: 'Yes. TradVue has built-in prop firm tracking that syncs your journal with prop firm rules, showing real-time drawdown gauges, daily loss limits, and trailing loss status.' },
              { q: 'Can I import my existing trades into TradVue?', a: 'Yes. TradVue supports CSV import from most major brokers and platforms. You can import your full trade history to analyze historical performance.' },
              { q: 'Does TradVue work for options and futures traders?', a: 'Yes. TradVue supports multi-asset journaling including stocks, options (with Greeks tracking), futures (with built-in contract specs for 20 contracts), forex, and crypto.' },
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
          <h2 className="seo-cta-h2">Ready to Level Up Your Trading?</h2>
          <p className="seo-cta-sub">
            Join traders using AI and data to trade smarter. Create a free account today — no credit card required.
          </p>
          <Link href="/#signup" className="seo-cta-btn">
            Start Journaling Free
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
      </section>

      {/* ── Related ── */}
      <section className="seo-related-section">
        <div className="seo-section-inner-narrow">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '24px', color: 'var(--text-0)' }}>
            Explore TradVue
          </h2>
          <div className="seo-related-grid">
            {[
              { href: '/prop-firm-tracker', title: 'Prop Firm Tracker', desc: 'Track drawdown & daily limits in real-time', emoji: '!' },
              { href: '/trading-calculators', title: '30+ Calculators', desc: 'Position size, risk/reward, Greeks & more', emoji: '#' },
              { href: '/futures-trading-journal', title: 'Futures Journal', desc: 'Track NQ, ES, CL with tick-based P&L', emoji: '^' },
              { href: '/options-trading-journal', title: 'Options Journal', desc: 'Track Greeks & multi-leg strategies', emoji: '*' },
              { href: '/post-trade-ritual', title: 'Post-Trade Ritual', desc: 'Build your daily journaling habit', emoji: '!' },
              { href: '/coach', title: 'AI Coach', desc: 'Get AI analysis of your trading patterns', emoji: '?' },
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
                { href: '/prop-firm-tracker', text: 'Free Prop Firm Tracker — Track Drawdown & Daily Limits' },
                { href: '/trading-calculators', text: '30+ Free Trading Calculators — Position Size, Risk/Reward' },
                { href: '/post-trade-ritual', text: 'Post-Trade Ritual — Build Your Journaling Habit in 60 Seconds' },
                { href: '/futures-trading-journal', text: 'Futures Trading Journal — Track NQ, ES, CL with Tick-Based P&L' },
                { href: '/options-trading-journal', text: 'Options Trading Journal — Track Greeks & Multi-Leg Strategies' },
              ].map(link => (
                <li key={link.href}><Link href={link.href}>→ {link.text}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="seo-footer">
        <p>© 2026 TradVue. Not financial advice. Trading involves risk.</p>
        <p>
          <Link href="/legal/disclaimer">Disclaimer</Link>
          {' • '}
          <Link href="/legal/privacy">Privacy</Link>
        </p>
      </footer>
    </div>
  )
}
