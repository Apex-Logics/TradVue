import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Free Prop Firm Tracker — Track Drawdown, Daily Limits | TradVue',
  description:
    'Real-time prop firm tracking. Monitor your drawdown, daily loss limits, and trailing loss without leaving your journal. Free to start, no credit card needed.',
  openGraph: {
    title: 'Free Prop Firm Tracker — Track Drawdown, Daily Limits | TradVue',
    description:
      'Real-time prop firm tracking. Monitor your drawdown, daily loss limits, and trailing loss. Built into TradVue journal.',
    url: 'https://tradvue.com/prop-firm-tracker',
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

export default function PropFirmTrackerPage() {
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
                name: 'How does the prop firm tracker work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Link your TradVue journal to your prop firm. The tracker auto-calculates your real-time drawdown, daily loss, and trailing loss against your firm\'s rules.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which prop firms does TradVue support?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'TradVue supports manual rule entry for any prop firm. You set your daily loss, max drawdown, and trailing loss limits, and TradVue tracks them in real-time.',
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
            href="/#signup"
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
            Get Started Free
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
          Track Your Prop Firm Rules in Real-Time
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
          Never exceed your daily loss or max drawdown again. TradVue's real-time prop firm tracker syncs your journal
          with your firm's rules and shows you exactly where you stand.
        </p>
        <Link
          href="/#signup"
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
          Try Prop Firm Tracker Free
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
            What Is Prop Firm Tracking?
          </h2>

          <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.7, marginBottom: '32px' }}>
            Prop firm trading comes with strict rules: daily loss limits, max drawdown, trailing loss requirements. Break them, and you're out. Managing these rules manually is tedious and error-prone.
          </p>

          <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.7 }}>
            TradVue's prop firm tracker integrates directly into your journal. Every trade you log automatically updates your metrics. See live gauges showing how close you are to hitting a rule limit, and never get surprised by a blown account again.
          </p>
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
          Key Features
        </h2>

        <div style={{ display: 'grid', gap: '24px' }}>
          {[
            {
              title: 'Live Drawdown Gauge',
              desc: 'See your current drawdown as a percentage of your starting balance. Color-coded warnings when you\'re approaching your limit.',
            },
            {
              title: 'Daily Loss Tracking',
              desc: 'Track your daily losses in real-time. Get alerts when you\'re close to hitting your firm\'s daily loss limit.',
            },
            {
              title: 'Trailing Loss Monitoring',
              desc: 'Some firms require a trailing stop—your account never drops below a recent high. TradVue tracks this automatically.',
            },
            {
              title: 'Multi-Firm Support',
              desc: 'Trading with multiple prop firms? Set rules for each firm and switch between them instantly.',
            },
            {
              title: 'Rule Flexibility',
              desc: 'Every prop firm has different rules. TradVue lets you customize your limits. Whatever your firm demands, we track it.',
            },
            {
              title: 'Historical Compliance',
              desc: 'Review your compliance history. See when you came close to limits and learn from it.',
            },
          ].map((feature, i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--blue)',
                  marginBottom: '8px',
                }}
              >
                {feature.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                {feature.desc}
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
            How It Connects to Your Journal
          </h2>

          <div style={{ display: 'grid', gap: '20px' }}>
            {[
              {
                step: '01',
                title: 'Set Your Rules',
                desc: 'Enter your firm\'s daily loss, max drawdown, and trailing loss limits.',
              },
              {
                step: '02',
                title: 'Log Your Trades',
                desc: 'Journal trades as usual. TradVue auto-syncs your P&L with prop firm metrics.',
              },
              {
                step: '03',
                title: 'Watch Your Gauges',
                desc: 'Real-time drawdown, daily loss, and trailing loss gauges in your dashboard.',
              },
              {
                step: '04',
                title: 'Stay Compliant',
                desc: 'Alerts warn you before you hit limits. Make better decisions, keep your account alive.',
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  display: 'flex',
                  gap: '20px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: 'var(--blue)',
                    flexShrink: 0,
                  }}
                >
                  {item.step}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-0)' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
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
            marginBottom: '32px',
            textAlign: 'center',
            color: 'var(--text-0)',
          }}
        >
          Supported Rules
        </h2>

        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px', marginBottom: '40px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.7, margin: '0 0 16px 0' }}>
            TradVue supports custom rules for any prop firm, including:
          </p>
          <ul
            style={{
              listStyle: 'none',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              margin: 0,
              padding: 0,
            }}
          >
            {[
              'Daily loss limits',
              'Max drawdown (MDD)',
              'Trailing loss (high-water mark)',
              'Monthly loss limits',
              'Profit targets',
              'Account balance rules',
            ].map((rule) => (
              <li key={rule} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-1)' }}>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                {rule}
              </li>
            ))}
          </ul>
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
            Never Blow Your Account Again
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '32px', lineHeight: 1.6 }}>
            Real-time tracking keeps you compliant. Prop firm trading requires discipline—let TradVue handle the math.
          </p>
          <Link
            href="/#signup"
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
            Try Prop Firm Tracker
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
              { href: '/trading-calculators', text: '30+ Free Trading Calculators' },
              { href: '/futures-trading-journal', text: 'Futures Trading Journal' },
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
