import { Metadata } from 'next'
import Link from 'next/link'
import '../components/seo-landing.css'

export const metadata: Metadata = {
  title: 'Post-Trade Ritual — Build a Daily Trading Journal Habit in 60 Seconds',
  description:
    'Build a consistent trading journal habit with TradVue\'s post-trade ritual. Emotion tags, streak tracking, and 60-second journaling. Free to start, try now.',
  alternates: {
    canonical: 'https://www.tradvue.com/post-trade-ritual',
  },
  openGraph: {
    title: 'Post-Trade Ritual — Build a Daily Trading Journal Habit in 60 Seconds | TradVue',
    description:
      'Build a trading journal habit in 60 seconds per trade. Emotion tags, streak tracking, habit science. Free to start.',
    url: 'https://www.tradvue.com/post-trade-ritual',
    siteName: 'TradVue',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'Post-Trade Ritual — TradVue' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Post-Trade Ritual — Build a Daily Trading Journal Habit | TradVue',
    description:
      'Build a trading journal habit in 60 seconds per trade. Emotion tags and streak tracking. Free to start.',
    images: ['/og-image.png'],
  },
}

export default function PostTradeRitualPage() {
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
                    name: 'What is the post-trade ritual for traders?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'The post-trade ritual is a 60-second routine to journal every trade immediately after closing it: entry/exit details, emotion tag, and a quick note. Designed to build a consistent journaling habit through streak tracking.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Why does journaling after every trade help traders improve?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Journaling captures the data and emotions behind every trade. Over time, patterns emerge — you see which setups work, which emotions lead to bad decisions, and exactly where your edge is. Traders who journal consistently build a richer dataset to analyze their own patterns and tendencies.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'How does streak tracking help build a journaling habit?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'TradVue tracks your consecutive days of journaling. Seeing your streak grow creates motivation to keep going. Missing a day feels significant — which prevents the common pattern of slowly stopping.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'What emotion tags does TradVue use in the post-trade ritual?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'TradVue includes emotion tags like: Confident, Fearful, Greedy, Bored, FOMO, Overextended, Regretful, and Lucky. Over time you\'ll see correlations between emotions and your P&L.',
                    },
                  },
                ],
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tradvue.com' },
                  { '@type': 'ListItem', position: 2, name: 'Post-Trade Ritual', item: 'https://www.tradvue.com/post-trade-ritual' },
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
            60-second ritual — build your edge daily
          </div>
          <h1 className="seo-hero-h1">
            Build a Daily Trading Journal Habit<br />
            <span className="gradient-text">In 60 Seconds</span>
          </h1>
          <p className="seo-hero-sub">
            Most traders skip journaling because it's tedious. TradVue's post-trade ritual removes friction and makes
            journaling automatic. Track emotions, build streaks, improve faster.
          </p>
          <Link href="/#signup" className="seo-hero-cta">
            Start Your Ritual
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <div className="seo-hero-trust">
            {['60 seconds per trade', 'Emotion tracking', 'Streak-based motivation'].map(t => (
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
            { value: '60s', label: 'Per Trade' },
            { value: '8', label: 'Emotion Tags' },
            { value: '365', label: 'Day Streaks Possible' },
            { value: '∞', label: 'Data Over Time' },
          ].map(s => (
            <div key={s.label} className="seo-stat">
              <div className="seo-stat-value">{s.value}</div>
              <div className="seo-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Why traders fail ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Why Traders Fail to Journal</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>Here's what usually happens:</p>
          </div>
          <div className="seo-steps">
            {[
              { step: '01', title: 'The Good Intention', desc: '"I\'ll journal every trade. It\'ll help me improve." Sounds great.', color: 'var(--blue)' },
              { step: '02', title: 'The First Week', desc: 'You journal a few trades. It takes 10 minutes each. You\'re motivated.', color: 'var(--purple)' },
              { step: '03', title: 'The Drift', desc: 'By week 3, you\'re tired. Market\'s moving. No time to journal. You skip a few.', color: 'var(--yellow)' },
              { step: '04', title: 'The Quit', desc: 'Now you feel guilty, so you stop entirely. Back to trading without data.', color: 'var(--red)' },
            ].map(item => (
              <div key={item.step} className="seo-step">
                <div className="seo-step-num" style={{ color: item.color, borderColor: item.color + '40', background: item.color + '15' }}>
                  {item.step}
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '28px', fontStyle: 'italic', textAlign: 'center', padding: '16px', background: 'var(--bg-1)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            TradVue fixes this by making the ritual 60 seconds and building habit momentum through streak tracking.
          </p>
        </div>
      </section>

      {/* ── The ritual ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>The Post-Trade Ritual</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>60 seconds. Every trade. This simple ritual creates the habit.</p>
          </div>
          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              { step: '1', time: '15 sec', title: 'Entry Details', desc: 'Symbol, entry price, entry time. Auto-filled if you use broker sync.', color: 'blue' },
              { step: '2', time: '15 sec', title: 'Exit Details', desc: 'Exit price, exit time. TradVue calculates your P&L instantly.', color: 'purple' },
              { step: '3', time: '10 sec', title: 'Emotion Tag', desc: 'How did you feel? Confident, fearful, overextended, missed? Tag it.', color: 'yellow' },
              { step: '4', time: '20 sec', title: 'Quick Note', desc: 'One sentence. What was the setup? Why did you take it? What happened?', color: 'green' },
            ].map(item => (
              <div key={item.step} style={{
                display: 'flex', gap: '20px', alignItems: 'flex-start',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '24px',
              }}>
                <div className={`seo-card-icon seo-card-icon-${item.color}`} style={{ marginBottom: 0, fontSize: '20px', fontWeight: 800 }}>
                  {item.step}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-0)', margin: 0 }}>{item.title}</h3>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                      background: `var(--${item.color}-dim, rgba(74,158,255,0.1))`,
                      color: `var(--${item.color}, #4a9eff)`,
                      borderRadius: '100px', letterSpacing: '0.04em',
                    }}>{item.time}</span>
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '24px', textAlign: 'center', fontWeight: 600 }}>
            Done. Move on. TradVue tracks the rest.
          </p>
        </div>
      </section>

      {/* ── Streak tracking ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Streak Tracking Builds Habits</h2>
            <div className="seo-divider" />
          </div>
          <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.75, marginBottom: '32px', textAlign: 'center' }}>
            Humans are motivated by progress. TradVue shows you your journaling streak — consecutive trading days
            you've journaled every trade.
          </p>
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              { milestone: '7 days', reward: 'You\'ve built the habit. Keep it going.', color: 'var(--green)' },
              { milestone: '30 days', reward: 'You have a month of data. Patterns are emerging.', color: 'var(--blue)' },
              { milestone: '90 days', reward: 'You have a quarter of data. Real insights now.', color: 'var(--purple)' },
              { milestone: '1 year', reward: 'A full year of trading data. This is your edge.', color: 'var(--yellow)' },
            ].map(item => (
              <div key={item.milestone} style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px',
                padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '4px' }}>{item.milestone}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{item.reward}</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Emotions ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Emotion Tracking for Self-Awareness</h2>
            <div className="seo-divider" />
          </div>
          <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.75, marginBottom: '28px', textAlign: 'center' }}>
            The ritual includes emotion tags. Why? Because emotions drive bad trading decisions. By tagging how you felt,
            you start to notice patterns that cost you money.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Confident', color: 'blue' },
              { label: 'Fearful', color: 'red' },
              { label: 'Greedy', color: 'yellow' },
              { label: 'Bored', color: 'purple' },
              { label: 'FOMO', color: 'red' },
              { label: 'Overextended', color: 'yellow' },
              { label: 'Regretful', color: 'purple' },
              { label: 'Lucky', color: 'green' },
            ].map(emotion => (
              <div key={emotion.label} className={`seo-card-icon seo-card-icon-${emotion.color}`} style={{
                width: '100%', height: 'auto', borderRadius: '10px', padding: '14px 16px',
                fontSize: '13px', fontWeight: 600, textAlign: 'center', marginBottom: 0,
              }}>
                {emotion.label}
              </div>
            ))}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.7, fontStyle: 'italic' }}>
            Over time, you'll see: "When I trade fearful, I lose money. When I trade confident but measured, I win."
            That's self-awareness. That's growth.
          </p>
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
              { q: 'What is the post-trade ritual for traders?', a: 'The post-trade ritual is a 60-second routine to journal every trade immediately after closing it: entry/exit details, emotion tag, and a quick note. Designed to build a consistent journaling habit through streak tracking.' },
              { q: 'Why does journaling after every trade help traders improve?', a: 'Journaling captures the data and emotions behind every trade. Over time, patterns emerge — you see which setups work, which emotions lead to bad decisions, and exactly where your edge is. Traders who journal consistently build a richer dataset to analyze their own patterns and tendencies.' },
              { q: 'How does streak tracking help build a journaling habit?', a: 'TradVue tracks your consecutive days of journaling. Seeing your streak grow creates motivation to keep going. Missing a day feels significant — which prevents the common pattern of slowly stopping.' },
              { q: 'What emotion tags does TradVue use in the post-trade ritual?', a: 'TradVue includes emotion tags like: Confident, Fearful, Greedy, Bored, FOMO, Overextended, Regretful, and Lucky. Over time you\'ll see correlations between emotions and your P&L.' },
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

      {/* ── CTA ── */}
      <section className="seo-cta-section">
        <div className="seo-cta-inner">
          <h2 className="seo-cta-h2">60 Seconds Changes Everything</h2>
          <p className="seo-cta-sub">
            A small ritual, done daily, creates momentum. Track your streak. Watch your habits change. Improve faster.
          </p>
          <Link href="/#signup" className="seo-cta-btn">
            Start Your Ritual
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
              { href: '/ritual', title: 'Start Your Ritual', desc: 'Open the post-trade ritual app now', emoji: '' },
              { href: '/journal', title: 'Trading Journal', desc: 'Full-featured journal with AI analytics', emoji: '' },
              { href: '/best-trading-journal', title: 'Best Trading Journal', desc: 'Why journaling changes your trading', emoji: '' },
              { href: '/coach', title: 'AI Trading Coach', desc: 'Get AI insights on your trade patterns', emoji: '' },
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
                { href: '/prop-firm-tracker', text: 'Prop Firm Tracker — Monitor Rules in Real-Time' },
                { href: '/options-trading-journal', text: 'Options Trading Journal — Track Greeks & Strategies' },
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
