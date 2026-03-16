import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Futures Trading Journal — Track NQ, ES, CL Trades | TradVue',
  description:
    'The best futures trading journal. Auto-detect contract specs for NQ, ES, CL, and 17 others. Tick-based P&L, margin tracking, and prop firm sync. Free to start.',
  openGraph: {
    title: 'Futures Trading Journal — Track NQ, ES, CL Trades | TradVue',
    description:
      'Best futures journal. 17 contract specs built-in. Auto-detect, tick-based P&L, prop firm integration.',
    url: 'https://tradvue.com/futures-trading-journal',
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

export default function FuturesTradingJournalPage() {
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
                name: 'How does TradVue auto-detect futures contracts?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Enter your contract symbol and TradVue auto-loads the tick value, multiplier, and margin requirement. NQ, ES, CL, and 17 other contracts are built-in.',
                },
              },
              {
                '@type': 'Question',
                name: 'Does TradVue calculate tick-based P&L?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. TradVue uses contract-specific tick values to calculate your exact profit or loss based on entry, exit, and contract specifications.',
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
          The Best Futures Trading Journal
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
          Trade NQ, ES, CL, and 17 other futures contracts with auto-detected specs, tick-based P&L, and integrated prop
          firm tracking. TradVue does the math so you focus on trading.
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
          Start Journaling Free
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
            Why Futures Traders Choose TradVue
          </h2>

          <div style={{ display: 'grid', gap: '24px' }}>
            {[
              {
                title: '20 Built-In Contracts',
                desc: 'NQ, ES, CL, GC, SI, TY, ZB, ZF, NG, RB, GE, ZC, ZS, ZM, ZW, YM, MES, MNQ, MCL, MGC. Add more anytime.',
              },
              {
                title: 'Auto-Detect Contract Specs',
                desc: 'Enter your symbol—TradVue loads tick value, multiplier, and margin. No manual calculations.',
              },
              {
                title: 'Tick-Based P&L',
                desc: 'Your exact profit or loss based on contract specifications. No rounding errors.',
              },
              {
                title: 'Margin Tracking',
                desc: 'Track your margin usage in real-time. Know your buying power without spreadsheets.',
              },
              {
                title: 'Prop Firm Integration',
                desc: 'If you\'re trading with a prop firm, connect your rules and monitor compliance.',
              },
              {
                title: 'Micro Contract Support',
                desc: 'Trade micros? TradVue calculates correctly for MES, MNQ, MCL, and more.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-2)',
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
          Built-In Contract Specs
        </h2>

        <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '24px', textAlign: 'center' }}>
          All these contracts auto-load. Add custom contracts anytime.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '24px',
          }}
        >
          {[
            'NQ (Nasdaq-100)',
            'ES (E-mini S&P 500)',
            'CL (Crude Oil)',
            'GC (Gold)',
            'SI (Silver)',
            'TY (10-Year Note)',
            'ZB (30-Year Bond)',
            'ZF (5-Year Note)',
            'NG (Natural Gas)',
            'RB (Gasoline)',
            'GE (Eurodollar)',
            'ZC (Corn)',
            'ZS (Soybean)',
            'ZM (Soybean Meal)',
            'ZW (Wheat)',
            'YM (Mini Dow)',
            'MES (Micro E-mini S&P)',
            'MNQ (Micro Nasdaq)',
            'MCL (Micro Crude)',
            'MGC (Micro Gold)',
          ].map((contract) => (
            <div key={contract} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-1)' }}>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
              {contract}
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
            How It Works
          </h2>

          <div style={{ display: 'grid', gap: '20px' }}>
            {[
              {
                step: '01',
                title: 'Select Your Contract',
                desc: 'Choose from 20 built-in contracts or add a custom one. TradVue loads the specs automatically.',
              },
              {
                step: '02',
                title: 'Log Your Trade',
                desc: 'Enter entry price, exit price, contract size. TradVue calculates your P&L instantly.',
              },
              {
                step: '03',
                title: 'See Tick-Based P&L',
                desc: 'Your exact profit or loss based on the contract\'s tick value and multiplier.',
              },
              {
                step: '04',
                title: 'Track Your Progress',
                desc: 'Analyze your performance over time. Find what works, fix what doesn\'t.',
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
          Example: NQ Trade Calculation
        </h2>

        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-1)', marginBottom: '16px' }}>
            Let's say you trade NQ (Nasdaq-100 E-mini):
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px', marginBottom: '20px' }}>
            {[
              'Entry: 17500',
              'Exit: 17510',
              'Size: 1 contract',
              'Tick value: $20 per tick',
              'Multiplier: $100 per point',
            ].map((item) => (
              <li key={item} style={{ fontSize: '14px', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--blue)' }}>→</span>
                {item}
              </li>
            ))}
          </ul>
          <div
            style={{
              background: 'var(--bg-2)',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              color: 'var(--green)',
              fontWeight: 700,
            }}
          >
            TradVue calculates: (17510 - 17500) × 1 × $100 = <strong>$1,000 profit</strong>
          </div>
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
            Journal Your Futures Trades with Confidence
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '32px', lineHeight: 1.6 }}>
            Let TradVue handle the contract specs and calculations. You focus on trading.
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
            Start Journaling Free
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
              { href: '/prop-firm-tracker', text: 'Prop Firm Tracker' },
              { href: '/trading-calculators', text: '30+ Free Trading Calculators' },
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
