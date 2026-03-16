import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Post-Trade Ritual — Build Your Trading Journal Habit | TradVue',
  description:
    'Build a daily trading journal habit in 60 seconds. Emotion tracking, streak building, and habit science. Free to start.',
  openGraph: {
    title: 'Post-Trade Ritual — Build Your Trading Journal Habit | TradVue',
    description:
      'The post-trade ritual that builds journaling habits. Track emotions, build streaks, improve faster.',
    url: 'https://tradvue.com/post-trade-ritual',
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

export default function PostTradeRitualPage() {
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
                name: 'What is the post-trade ritual?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'A 60-second routine to journal every trade immediately after closing it. Entry, exit, emotion, and notes. The ritual is designed to build a habit through streak tracking.',
                },
              },
              {
                '@type': 'Question',
                name: 'Why does the ritual matter?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Traders who journal consistently improve faster. The ritual removes friction, makes journaling automatic, and builds the habit through streak tracking and rewards.',
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
          Build a Daily Trading Journal Habit in 60 Seconds
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
          Most traders skip journaling because it's tedious. TradVue's post-trade ritual removes friction and makes
          journaling automatic. Track emotions, build streaks, improve faster.
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
          Start Your Ritual
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
            Why Traders Fail to Journal
          </h2>

          <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.7, marginBottom: '32px' }}>
            Here's what usually happens:
          </p>

          <div style={{ display: 'grid', gap: '20px' }}>
            {[
              {
                step: '01',
                title: 'The Good Intention',
                desc: '"I\'ll journal every trade. It\'ll help me improve." Sounds great.',
              },
              {
                step: '02',
                title: 'The First Week',
                desc: 'You journal a few trades. It takes 10 minutes each. You\'re motivated.',
              },
              {
                step: '03',
                title: 'The Drift',
                desc: 'By week 3, you\'re tired. Market moving. No time to journal. You skip a few.',
              },
              {
                step: '04',
                title: 'The Quit',
                desc: 'Now you feel guilty, so you stop entirely. Back to trading without data.',
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
                    color: 'var(--red)',
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

          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '32px', fontStyle: 'italic' }}>
            TradVue fixes this by making the ritual 60 seconds and building habit momentum through streak tracking.
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
          The Post-Trade Ritual
        </h2>

        <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.7, marginBottom: '32px', textAlign: 'center' }}>
          60 seconds. Every trade. This simple ritual creates the habit.
        </p>

        <div style={{ display: 'grid', gap: '20px' }}>
          {[
            {
              step: '1',
              title: 'Entry Details (15 sec)',
              desc: 'Symbol, entry price, entry time. Auto-filled if you use broker sync.',
            },
            {
              step: '2',
              title: 'Exit Details (15 sec)',
              desc: 'Exit price, exit time. TradVue calculates your P&L instantly.',
            },
            {
              step: '3',
              title: 'Emotion Tag (10 sec)',
              desc: 'How did you feel? Confident, fearful, overextended, missed? Tag it.',
            },
            {
              step: '4',
              title: 'Quick Note (20 sec)',
              desc: 'One sentence. What was the setup? Why did you take it? What happened?',
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: 800,
                    color: 'var(--blue)',
                    flexShrink: 0,
                    width: '40px',
                    textAlign: 'center',
                  }}
                >
                  {item.step}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-0)' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '32px', textAlign: 'center', fontWeight: 600 }}>
          Done. Move on. TradVue tracks the rest.
        </p>
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
            Streak Tracking Builds Habits
          </h2>

          <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.7, marginBottom: '32px' }}>
            Humans are motivated by progress. TradVue shows you your journaling streak—how many consecutive trading days
            you've journaled every trade.
          </p>

          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              { milestone: '7 days', reward: 'You\'ve built the habit. Keep it going.' },
              { milestone: '30 days', reward: 'You have a month of data. Patterns are emerging.' },
              { milestone: '90 days', reward: 'You have a quarter of data. Real insights now.' },
              { milestone: '1 year', reward: 'A full year of trading data. This is your edge.' },
            ].map((item) => (
              <div
                key={item.milestone}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue)', marginBottom: '4px' }}>
                    {item.milestone}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{item.reward}</div>
                </div>
                <div style={{ fontSize: '28px', color: 'var(--green)' }}>✓</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '32px', textAlign: 'center', fontStyle: 'italic' }}>
            The streak is visual proof that you're building something. That motivation keeps you going.
          </p>
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
          Emotion Tracking for Self-Awareness
        </h2>

        <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.7, marginBottom: '24px' }}>
          The ritual includes emotion tags. Why? Because emotions drive bad trading decisions. By tagging how you felt,
          you start to notice patterns.
        </p>

        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-1)', marginBottom: '16px' }}>
            Common emotion tags:
          </p>
          <ul
            style={{
              listStyle: 'none',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              margin: 0,
              padding: 0,
            }}
          >
            {['Confident', 'Fearful', 'Greedy', 'Bored', 'FOMO', 'Overextended', 'Regretful', 'Lucky'].map((emotion) => (
              <div
                key={emotion}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: 'var(--text-1)',
                  textAlign: 'center',
                }}
              >
                {emotion}
              </div>
            ))}
          </ul>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '24px' }}>
          Over time, you'll see: "When I trade fearful, I lose money. When I trade confident but measured, I win."
          That's self-awareness. That's growth.
        </p>
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
            60 Seconds Changes Everything
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '32px', lineHeight: 1.6 }}>
            A small ritual, done daily, creates momentum. Track your streak. Watch your habits change. Improve faster.
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
            Start Your Ritual
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
              { href: '/prop-firm-tracker', text: 'Prop Firm Tracker' },
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
