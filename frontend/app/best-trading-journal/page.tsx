import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Best Trading Journal for Day Traders 2026 | TradVue',
  description:
    'The best free trading journal for day traders. AI-powered analytics, 30+ calculators, prop firm tracking, and real-time alerts. Start journaling free to start.',
  openGraph: {
    title: 'Best Trading Journal for Day Traders 2026 | TradVue',
    description:
      'The best free trading journal for day traders. AI-powered analytics, 30+ calculators, prop firm tracking, and real-time alerts. Start journaling free.',
    url: 'https://tradvue.com/best-trading-journal',
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

export default function BestTradingJournalPage() {
  return (
    <div style={{ fontFamily: 'var(--font)', background: 'var(--bg-0)', color: 'var(--text-0)', minHeight: '100vh' }}>
      {/* ─────────────────────────────────────────────────────────────────
          STRUCTURED DATA
      ───────────────────────────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What makes TradVue the best trading journal?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'TradVue combines AI-powered analytics, 30+ free calculators, prop firm tracking, and a clean interface built by traders. You get real insights without paying premium prices.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is TradVue free?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. TradVue has a free tier that includes manual trade logging, basic analytics, and access to all 30+ calculators. Pro features like AI analysis are available during beta at no cost.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I track prop firm drawdowns in TradVue?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. TradVue has built-in prop firm tracking that syncs your journal with prop firm rules, showing real-time drawdown gauges and daily limits.',
                },
              },
            ],
          }),
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────
          HEADER / NAV
      ───────────────────────────────────────────────────────────────── */}
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

      {/* ─────────────────────────────────────────────────────────────────
          HERO
      ───────────────────────────────────────────────────────────────── */}
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
          The Best Free Trading Journal for Day Traders
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
          Stop journaling in spreadsheets. TradVue gives you AI-powered insights, real-time prop firm tracking, and
          30+ trading calculators—free to start, no credit card required.
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

      {/* ─────────────────────────────────────────────────────────────────
          FEATURES COMPARISON
      ───────────────────────────────────────────────────────────────── */}
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
            Why TradVue Stands Out
          </h2>

          <div style={{ display: 'grid', gap: '24px', marginBottom: '40px' }}>
            {[
              {
                title: 'AI-Powered Trade Analysis',
                desc: 'Every trade you log gets analyzed by AI. Spot your patterns, weaknesses, and edges without manually reviewing hundreds of trades.',
              },
              {
                title: '30+ Free Trading Calculators',
                desc: 'Position sizing, risk/reward, profit targets, options Greeks, futures tick value, Sharpe ratio, and more—all built in. No more switching between tabs.',
              },
              {
                title: 'Real-Time Prop Firm Tracking',
                desc: 'Link your journal to prop firm rules. See your drawdown gauge, daily loss limits, and trailing loss in real-time. Never exceed your rules again.',
              },
              {
                title: 'Multi-Asset Support',
                desc: 'Trade stocks, options, futures, crypto, or forex. TradVue auto-detects your asset class and applies the right calculations for each.',
              },
              {
                title: 'Smart Trade Tags & Notes',
                desc: 'Tag trades by setup, emotion, market condition, and outcome. Find patterns that make you money. Identify what loses you money.',
              },
              {
                title: 'Streak Tracking & Habits',
                desc: 'Build a journaling habit. Watch your streak grow. Research shows traders who journal consistently improve faster.',
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

      {/* ─────────────────────────────────────────────────────────────────
          FEATURE COMPARISON TABLE
      ───────────────────────────────────────────────────────────────── */}
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
          Feature Comparison
        </h2>

        <div style={{ overflowX: 'auto', marginBottom: '40px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px', color: 'var(--text-1)', fontWeight: 600 }}>
                  Feature
                </th>
                <th style={{ textAlign: 'center', padding: '12px', color: 'var(--blue)', fontWeight: 700 }}>
                  TradVue
                </th>
                <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-2)', fontWeight: 600 }}>
                  Spreadsheet
                </th>
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
                ['Free Forever', '✓', '✓'],
              ].map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'var(--bg-1)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px', color: 'var(--text-1)' }}>{row[0]}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>
                    {row[1]}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-2)' }}>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          HOW IT WORKS
      ───────────────────────────────────────────────────────────────── */}
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
                title: 'Log Your Trades',
                desc: 'Enter your trades manually or import from CSV. TradVue auto-detects your asset class.',
              },
              {
                step: '02',
                title: 'AI Analysis',
                desc: 'Our AI reviews every trade, spots patterns, and highlights what\'s working.',
              },
              {
                step: '03',
                title: 'Track Prop Firm Rules',
                desc: 'Connect to prop firms. See real-time drawdown, daily loss, and trailing loss gauges.',
              },
              {
                step: '04',
                title: 'Build Your Edge',
                desc: 'Use the insights to trade better. Repeat. Improve.',
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

      {/* ─────────────────────────────────────────────────────────────────
          PRICING
      ───────────────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px, 8vw, 100px) 24px', maxWidth: '800px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '24px',
            textAlign: 'center',
            color: 'var(--text-0)',
          }}
        >
          Pricing
        </h2>

        <p style={{ textAlign: 'center', color: 'var(--text-2)', marginBottom: '40px', fontSize: '15px' }}>
          Start free, upgrade only if you need advanced features.
        </p>

        <div style={{ display: 'grid', gap: '20px' }}>
          {[
            {
              name: 'Free',
              price: 'Free forever',
              features: [
                'Unlimited trade logging',
                'Basic analytics',
                '30+ calculators',
                'CSV import',
                'Email support',
              ],
            },
            {
              name: 'Pro',
              price: '$24/month',
              features: [
                'Everything in Free',
                'AI trade analysis',
                'Prop firm sync',
                'Advanced patterns',
                'Priority support',
              ],
              highlight: true,
            },
          ].map((tier) => (
            <div
              key={tier.name}
              style={{
                background: tier.highlight ? 'linear-gradient(160deg, rgba(74,158,255,0.06) 0%, rgba(99,102,241,0.06) 100%)' : 'var(--bg-1)',
                border: tier.highlight ? '1px solid rgba(74,158,255,0.3)' : '1px solid var(--border)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '4px' }}>
                  {tier.name}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-0)' }}>
                  {tier.price}
                </div>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', margin: 0, padding: 0 }}>
                {tier.features.map((feat) => (
                  <li
                    key={feat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      color: 'var(--text-1)',
                    }}
                  >
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          CTA
      ───────────────────────────────────────────────────────────────── */}
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
            Ready to Level Up Your Trading?
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '32px', lineHeight: 1.6 }}>
            Join traders who are using AI and data to trade smarter. Start free to start.
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

      {/* ─────────────────────────────────────────────────────────────────
          INTERNAL LINKS
      ───────────────────────────────────────────────────────────────── */}
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
              { href: '/post-trade-ritual', text: 'Post-Trade Ritual: Build Your Journal Habit' },
              { href: '/futures-trading-journal', text: 'Futures Trading Journal' },
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

      {/* ─────────────────────────────────────────────────────────────────
          FOOTER
      ───────────────────────────────────────────────────────────────── */}
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
