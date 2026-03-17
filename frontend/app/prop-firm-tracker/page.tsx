import { Metadata } from 'next'
import Link from 'next/link'
import '../components/seo-landing.css'

export const metadata: Metadata = {
  title: 'Free Prop Firm Tracker — Monitor Drawdown & Daily Limits in Real-Time',
  description:
    'Real-time prop firm rule tracker built into your trading journal. Monitor drawdown, daily loss limits, and trailing loss automatically. Free account required — no credit card needed.',
  alternates: {
    canonical: 'https://www.tradvue.com/prop-firm-tracker',
  },
  openGraph: {
    title: 'Free Prop Firm Tracker — Monitor Drawdown & Daily Limits | TradVue',
    description:
      'Real-time prop firm tracking. Monitor drawdown, daily loss limits, and trailing loss — built into your TradVue journal. Free to start.',
    url: 'https://www.tradvue.com/prop-firm-tracker',
    siteName: 'TradVue',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'Prop Firm Tracker — TradVue' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Prop Firm Tracker — Monitor Drawdown & Daily Limits | TradVue',
    description:
      'Real-time prop firm rule tracking built into your trading journal. Free to start.',
    images: ['/og-image.png'],
  },
}

export default function PropFirmTrackerPage() {
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
                    name: 'How does the TradVue prop firm tracker work?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Enter your prop firm rules (daily loss limit, max drawdown, trailing loss) and TradVue automatically tracks your compliance as you log trades. You see live gauges showing how close you are to each limit.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Which prop firms does TradVue support?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'TradVue supports manual rule entry for any prop firm. FTMO, Topstep, Apex, MyFundedFX, and any other firm — just enter your daily loss, max drawdown, and trailing loss limits.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'What is trailing drawdown and how does TradVue track it?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Trailing drawdown means your maximum drawdown limit follows your account high-water mark upward but never comes down. TradVue automatically calculates and displays your trailing drawdown in real-time as you trade.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Can I track multiple prop firm accounts?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. TradVue supports multiple prop firm accounts simultaneously. Each account has its own rules, balances, and compliance tracking.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Is the prop firm tracker free?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. The prop firm tracker is included in TradVue free tier. No credit card required to start.',
                    },
                  },
                ],
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tradvue.com' },
                  { '@type': 'ListItem', position: 2, name: 'Prop Firm Tracker', item: 'https://www.tradvue.com/prop-firm-tracker' },
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
            Real-time rule tracking — built-in
          </div>
          <h1 className="seo-hero-h1">
            Track Your Prop Firm Rules<br />
            <span className="gradient-text">In Real-Time</span>
          </h1>
          <p className="seo-hero-sub">
            Monitor your daily loss and max drawdown limits as you log trades. TradVue's prop firm tracker syncs your journal
            with your firm's rules and shows you exactly where you stand.
          </p>
          <Link href="/#signup" className="seo-hero-cta">
            Try Prop Firm Tracker Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <div className="seo-hero-trust">
            {['Works with any prop firm', 'Live compliance gauges', 'No credit card required'].map(t => (
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
            { value: '6', label: 'Rule Types Tracked' },
            { value: '∞', label: 'Prop Firms Supported' },
            { value: '100%', label: 'Rule Flexibility' },
            { value: '8', label: 'Firm Presets' },
          ].map(s => (
            <div key={s.label} className="seo-stat">
              <div className="seo-stat-value">{s.value}</div>
              <div className="seo-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── What is prop firm tracking ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>What Is Prop Firm Tracking?</h2>
            <div className="seo-divider" />
          </div>
          <div style={{
            background: 'linear-gradient(160deg, rgba(74,158,255,0.04), rgba(99,102,241,0.04))',
            border: '1px solid rgba(74,158,255,0.15)',
            borderRadius: '16px', padding: '32px', marginBottom: '32px',
          }}>
            <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.75, marginBottom: '20px' }}>
              Prop firm trading comes with strict rules: daily loss limits, max drawdown, trailing loss requirements.
              Break them, and you're out. Managing these rules manually is tedious and error-prone.
            </p>
            <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.75, margin: 0 }}>
              TradVue's prop firm tracker integrates directly into your journal. Every trade you log automatically
              updates your metrics. See live gauges showing how close you are to hitting a rule limit — so you always know your standing before taking another trade.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner">
          <div className="seo-section-header">
            <h2>Key Features</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-grid-3">
            {[
              { emoji: 'DG', title: 'Live Drawdown Gauge', desc: 'See your current drawdown as a percentage of your starting balance. Color-coded warnings when you\'re approaching your limit.', color: 'blue' },
              { emoji: 'DL', title: 'Daily Loss Tracking', desc: 'Track your daily losses in real-time. Get alerts when you\'re close to hitting your firm\'s daily loss limit.', color: 'red' },
              { emoji: 'TL', title: 'Trailing Loss Monitoring', desc: 'Some firms require a trailing stop — your account never drops below a recent high. TradVue tracks this automatically.', color: 'purple' },
              { emoji: 'MF', title: 'Multi-Firm Support', desc: 'Trading with multiple prop firms? Set rules for each firm and switch between them instantly.', color: 'green' },
              { emoji: 'RX', title: 'Rule Flexibility', desc: 'Every prop firm has different rules. TradVue lets you customize your limits. Whatever your firm demands, we track it.', color: 'yellow' },
              { emoji: 'HC', title: 'Historical Compliance', desc: 'Review your compliance history. See when you came close to limits and learn from it.', color: 'blue' },
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

      {/* ── How it connects ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>How It Connects to Your Journal</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-steps">
            {[
              { step: '01', title: 'Set Your Rules', desc: 'Enter your firm\'s daily loss, max drawdown, and trailing loss limits.' },
              { step: '02', title: 'Log Your Trades', desc: 'Journal trades as usual. TradVue auto-syncs your P&L with prop firm metrics.' },
              { step: '03', title: 'Watch Your Gauges', desc: 'Real-time drawdown, daily loss, and trailing loss gauges in your dashboard.' },
              { step: '04', title: 'Stay Informed', desc: 'Color-coded gauges show your status before you hit limits. See where you stand before taking another trade.' },
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

      {/* ── Supported rules ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Supported Rules</h2>
            <div className="seo-divider" />
          </div>
          <div style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: '14px', padding: '32px',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.7, margin: '0 0 20px' }}>
              TradVue supports custom rules for any prop firm, including:
            </p>
            <ul className="seo-check-list" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', display: 'grid' }}>
              {['Daily loss limits', 'Max drawdown (MDD)', 'Trailing loss (high-water mark)', 'Monthly loss limits', 'Profit targets', 'Account balance rules'].map(rule => (
                <li key={rule} className="seo-check-item">
                  <span className="check-icon">✓</span>
                  {rule}
                </li>
              ))}
            </ul>
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
              { q: 'How does the prop firm tracker work?', a: 'Link your TradVue journal to your prop firm. The tracker auto-calculates your real-time drawdown, daily loss, and trailing loss against your firm\'s rules.' },
              { q: 'Which prop firms does TradVue support?', a: 'TradVue supports manual rule entry for any prop firm. You set your daily loss, max drawdown, and trailing loss limits, and TradVue tracks them in real-time.' },
              { q: 'Do I need to connect my broker to use prop firm tracking?', a: 'No broker connection required. Just log your trades in TradVue as usual — the tracker automatically calculates your metrics from your journal entries.' },
              { q: 'What happens when I\'m close to hitting a limit?', a: 'TradVue\'s dashboard shows color-coded gauges that turn yellow when you\'re within 20% of a limit and red when you\'re within 5%. You\'ll always know your standing before taking another trade.' },
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
            Prop firm rules and parameters are based on user-entered data and publicly available information, which may change at any time. Always verify current rules directly with your prop firm. This is not financial advice.
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="seo-cta-section">
        <div className="seo-cta-inner">
          <h2 className="seo-cta-h2">Always Know Where You Stand</h2>
          <p className="seo-cta-sub">
            Real-time tracking keeps you compliant. Prop firm trading requires discipline — let TradVue handle the math.
          </p>
          <Link href="/#signup" className="seo-cta-btn">
            Try Prop Firm Tracker
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
              { href: '/propfirm', title: 'Prop Firm App', desc: 'The actual prop firm account manager tool', emoji: '🎯' },
              { href: '/journal', title: 'Trading Journal', desc: 'Log every trade and analyze your patterns', emoji: '📓' },
              { href: '/tools', title: 'Trading Calculators', desc: '30+ free calculators including position sizing', emoji: '🔢' },
              { href: '/best-trading-journal', title: 'Best Trading Journal Guide', desc: 'Why TradVue is the best journal for day traders', emoji: '🏆' },
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
                { href: '/trading-calculators', text: '30+ Free Trading Calculators' },
                { href: '/futures-trading-journal', text: 'Futures Trading Journal — NQ, ES, CL' },
                { href: '/post-trade-ritual', text: 'Post-Trade Ritual — Build Your Journaling Habit' },
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
