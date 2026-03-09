'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import Breadcrumbs from '../components/Breadcrumbs'

// ─────────────────────────────────────────────────────────────────────────────
// FAQ data (sourced from docs/HELP_CENTER_FAQ.md)
// ─────────────────────────────────────────────────────────────────────────────

const FAQ_DATA = [
  {
    id: 'getting-started',
    category: 'Getting Started',
    icon: '🚀',
    questions: [
      {
        q: 'How do I create an account?',
        a: 'Go to tradvue.com and click "Sign Up." Enter your email, create a password, and verify your email address. You\'ll be all set with a free account in seconds.',
      },
      {
        q: 'How do I set up my first watchlist?',
        a: 'Click "Create Watchlist" from your dashboard. Name it (e.g., "Tech Stocks"), then add tickers by searching or pasting symbols. Save and you\'re ready to track prices and alerts.',
      },
      {
        q: 'What should I know about the dashboard layout?',
        a: 'The dashboard has three main areas: Market Overview (top), Your Watchlists (left sidebar), and Chart/Details (main panel). Use the settings icon to customize which data columns you see.',
      },
      {
        q: "What's the difference between mobile and desktop?",
        a: 'Desktop gives you full charting tools, sentiment data, and advanced filters. Mobile focuses on watchlist monitoring and quick alerts. Both sync in real-time, so your data is always current.',
      },
    ],
  },
  {
    id: 'features',
    category: 'Features',
    icon: '⚡',
    questions: [
      {
        q: 'How do alerts work?',
        a: 'Set a price alert by clicking the bell icon on any ticker. Choose "above" or "below" a price, and we\'ll notify you via email or in-app when it hits. Upgrade to Pro for SMS and webhook alerts.',
      },
      {
        q: 'What data sources do you use?',
        a: 'We pull real-time data from major exchanges (NYSE, NASDAQ, AMEX) and secondary sources. Sentiment comes from news aggregators and social signals. All sources are licensed and verified.',
      },
      {
        q: 'How often is data refreshed?',
        a: 'Market data updates every 1-5 seconds during trading hours (9:30 AM - 4:00 PM ET). Sentiment analysis refreshes hourly. After-hours and weekend data updates once per hour.',
      },
      {
        q: 'Can I customize the ticker bar?',
        a: 'Yes. Click the gear icon in the ticker bar to show/hide price, volume, % change, or sentiment scores. Your preferences save automatically.',
      },
      {
        q: 'How does sentiment analysis work?',
        a: 'We analyze recent news articles, social media mentions, and market discussions using AI to calculate a sentiment score (-100 to +100). Red = negative, green = positive. Higher volume = more reliable signal.',
      },
    ],
  },
  {
    id: 'account-billing',
    category: 'Account & Billing',
    icon: '💳',
    questions: [
      {
        q: 'What are the differences between Free and Pro?',
        a: 'Free includes unlimited watchlists, real-time quotes, and email alerts. Pro adds SMS/Webhook alerts, custom indicators, sentiment archives, and 2-year historical data ($9.99/month).',
      },
      {
        q: 'How do I upgrade to Pro?',
        a: 'Click your profile icon, select "Billing," and choose "Upgrade to Pro." You\'ll get instant access to Pro features. Cancel anytime, no questions asked.',
      },
      {
        q: 'How do I cancel my subscription?',
        a: 'Go to Settings > Billing > Manage Subscription and click "Cancel Plan." Your account stays active until your billing cycle ends; after that, you revert to Free with all watchlists preserved.',
      },
      {
        q: 'How is my data handled?',
        a: 'We encrypt all data in transit and at rest. We never sell your watchlist data. Your login info and payment details are PCI-DSS compliant. See our Privacy Policy for full details.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    category: 'Troubleshooting',
    icon: '🔧',
    questions: [
      {
        q: "Why isn't my data loading?",
        a: 'Check your internet connection and refresh the page. If the problem persists, try clearing your browser cache or switching browsers. Contact us if the issue continues.',
      },
      {
        q: "Why aren't my alerts working?",
        a: 'Make sure alerts are enabled in Settings. Check your email spam folder and add tradvue@alerts.com to your contacts. Verify the alert rule is set correctly.',
      },
      {
        q: "I can't log in. What should I do?",
        a: 'Click "Forgot Password" to reset. If you never received a reset email, check spam. If it\'s still stuck, contact support@tradvue.com with your email address.',
      },
      {
        q: 'Which browsers are supported?',
        a: 'We support Chrome, Firefox, Safari, and Edge (latest 2 versions). Mobile browsers (iOS Safari, Chrome Android) are fully supported. Disable ad blockers if charts don\'t load.',
      },
    ],
  },
  {
    id: 'trading',
    category: 'Trading FAQ',
    icon: '📈',
    questions: [
      {
        q: 'Is TradVue financial advice?',
        a: 'No. TradVue is a research and monitoring tool only. We provide data and sentiment signals, not recommendations. Always do your own research and consult a financial advisor before trading.',
      },
      {
        q: 'Should I know about data delays?',
        a: 'Market data is real-time during trading hours but may lag 1-5 seconds. Sentiment data updates hourly. After-hours quotes have a 15-minute delay. Never rely solely on data for time-sensitive trades.',
      },
      {
        q: 'What markets does TradVue support?',
        a: 'We cover US equities (NYSE, NASDAQ, AMEX), ETFs, and mutual funds. International markets coming soon. Crypto is not currently supported.',
      },
      {
        q: 'How much historical data is available?',
        a: 'Free users get 1 year of chart history. Pro users get 2 years. All users can view company fundamentals and news archives going back 5 years.',
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Structured data for SEO (FAQ schema)
// ─────────────────────────────────────────────────────────────────────────────

const faqSchemaData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_DATA.flatMap(cat =>
    cat.questions.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    }))
  ),
}

// ─────────────────────────────────────────────────────────────────────────────
// AccordionItem
// ─────────────────────────────────────────────────────────────────────────────

function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
  highlight,
}: {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
  highlight: string
}) {
  // Highlight matching text in search
  const highlighted = (text: string) => {
    if (!highlight) return text
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(74,158,255,0.25)', color: 'var(--text-0)', borderRadius: '2px', padding: '0 2px' }}>
          {text.slice(idx, idx + highlight.length)}
        </mark>
        {text.slice(idx + highlight.length)}
      </>
    )
  }

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.15s',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '18px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-0)',
          fontSize: '14.5px',
          fontWeight: 500,
          lineHeight: 1.45,
          transition: 'color 0.15s',
        }}
        aria-expanded={isOpen}
      >
        <span>{highlighted(question)}</span>
        <span
          style={{
            flexShrink: 0,
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: isOpen ? 'rgba(74,158,255,0.15)' : 'var(--bg-3)',
            border: `1px solid ${isOpen ? 'rgba(74,158,255,0.3)' : 'var(--border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: isOpen ? '#4a9eff' : 'var(--text-2)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Answer panel */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isOpen ? '400px' : '0',
          transition: 'max-height 0.3s ease',
        }}
      >
        <div
          style={{
            padding: '0 20px 20px 20px',
            fontSize: '14px',
            color: 'var(--text-1)',
            lineHeight: 1.75,
          }}
        >
          <div
            style={{
              background: 'var(--bg-2)',
              borderLeft: '3px solid #4a9eff',
              borderRadius: '0 6px 6px 0',
              padding: '14px 16px',
            }}
          >
            {highlighted(answer)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [search, setSearch] = useState('')
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const toggle = (key: string) =>
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))

  // Filter FAQ data by search query
  const filteredData = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return FAQ_DATA
    return FAQ_DATA.map(cat => ({
      ...cat,
      questions: cat.questions.filter(
        item =>
          item.q.toLowerCase().includes(q) ||
          item.a.toLowerCase().includes(q)
      ),
    })).filter(cat => cat.questions.length > 0)
  }, [search])

  const totalResults = filteredData.reduce((acc, cat) => acc + cat.questions.length, 0)
  const isSearching = search.trim().length > 0

  return (
    <>
      {/* FAQ structured data */}
      <Script id="faq-schema" type="application/ld+json">
        {JSON.stringify(faqSchemaData)}
      </Script>

      <div
        style={{
          fontFamily: 'var(--font)',
          background: 'var(--bg-0)',
          color: 'var(--text-0)',
          minHeight: '100vh',
        }}
      >
        {/* ── Top nav ── */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            borderBottom: '1px solid var(--border)',
            background: 'rgba(10,10,12,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              padding: '0 24px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Link
              href="/"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-0)', letterSpacing: '-0.02em' }}>
                TradVue
              </span>
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Help Center</span>
              <Link
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  color: 'var(--text-2)',
                  textDecoration: 'none',
                  padding: '6px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Breadcrumbs ── */}
        <Breadcrumbs
          items={[{ label: 'Home', href: '/' }, { label: 'Help Center' }]}
        />

        {/* ── Hero ── */}
        <div
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(180deg, rgba(74,158,255,0.04) 0%, transparent 100%)',
            padding: 'clamp(48px, 8vw, 80px) 24px clamp(40px, 6vw, 64px)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#4a9eff',
              background: 'rgba(74,158,255,0.08)',
              border: '1px solid rgba(74,158,255,0.2)',
              borderRadius: '4px',
              padding: '4px 12px',
              marginBottom: '20px',
            }}
          >
            Help Center
          </div>
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              marginBottom: '16px',
              color: 'var(--text-0)',
            }}
          >
            How can we help you?
          </h1>
          <p
            style={{
              fontSize: 'clamp(14px, 2vw, 16px)',
              color: 'var(--text-2)',
              maxWidth: '520px',
              margin: '0 auto 36px',
              lineHeight: 1.65,
            }}
          >
            Find answers to common questions about TradVue. Browse by category or search below.
          </p>

          {/* Search box */}
          <div
            style={{
              maxWidth: '540px',
              margin: '0 auto',
              position: 'relative',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-3)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Search questions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px 14px 46px',
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                color: 'var(--text-0)',
                fontSize: '14px',
                outline: 'none',
                fontFamily: 'var(--font)',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(74,158,255,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {isSearching && (
            <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-3)' }}>
              {totalResults === 0
                ? 'No results found.'
                : `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${search}"`}
            </p>
          )}
        </div>

        {/* ── Category pills (only when not searching) ── */}
        {!isSearching && (
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              padding: '28px 24px 0',
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                padding: '7px 16px',
                borderRadius: '20px',
                border: `1px solid ${activeCategory === null ? 'rgba(74,158,255,0.4)' : 'var(--border)'}`,
                background: activeCategory === null ? 'rgba(74,158,255,0.1)' : 'var(--bg-1)',
                color: activeCategory === null ? '#4a9eff' : 'var(--text-2)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              All Categories
            </button>
            {FAQ_DATA.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  border: `1px solid ${activeCategory === cat.id ? 'rgba(74,158,255,0.4)' : 'var(--border)'}`,
                  background: activeCategory === cat.id ? 'rgba(74,158,255,0.1)' : 'var(--bg-1)',
                  color: activeCategory === cat.id ? '#4a9eff' : 'var(--text-2)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.category}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── FAQ sections ── */}
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '32px 24px 64px',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
          }}
        >
          {filteredData.length === 0 && isSearching && (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 24px',
                color: 'var(--text-2)',
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>
                No results for &ldquo;{search}&rdquo;
              </p>
              <p style={{ fontSize: '14px' }}>
                Try different keywords or{' '}
                <a href="mailto:support@tradvue.com" style={{ color: '#4a9eff', textDecoration: 'none' }}>
                  contact support
                </a>
                .
              </p>
            </div>
          )}

          {filteredData
            .filter(cat => !activeCategory || cat.id === activeCategory || isSearching)
            .map(cat => (
              <section key={cat.id} id={cat.id}>
                {/* Category header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                    }}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: '17px',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        color: 'var(--text-0)',
                        lineHeight: 1.2,
                      }}
                    >
                      {cat.category}
                    </h2>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      {cat.questions.length} question{cat.questions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Accordion */}
                <div
                  style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}
                >
                  {cat.questions.map((item, idx) => {
                    const key = `${cat.id}-${idx}`
                    return (
                      <AccordionItem
                        key={key}
                        question={item.q}
                        answer={item.a}
                        isOpen={!!openItems[key]}
                        onToggle={() => toggle(key)}
                        highlight={search}
                      />
                    )
                  })}
                </div>
              </section>
            ))}
        </div>

        {/* ── Still need help? ── */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-1)',
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              padding: 'clamp(48px, 6vw, 72px) 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'rgba(74,158,255,0.1)',
                border: '1px solid rgba(74,158,255,0.2)',
                marginBottom: '20px',
                fontSize: '24px',
              }}
            >
              💬
            </div>
            <h2
              style={{
                fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-0)',
                marginBottom: '12px',
              }}
            >
              Still need help?
            </h2>
            <p
              style={{
                fontSize: '15px',
                color: 'var(--text-2)',
                maxWidth: '400px',
                margin: '0 auto 28px',
                lineHeight: 1.65,
              }}
            >
              Can't find what you're looking for? Our support team typically responds within a few hours.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <a
                href="mailto:support@tradvue.com"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: '#4a9eff',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email Support
              </a>
              <a
                href="https://tradvue.com/learn"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: 'var(--bg-2)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(74,158,255,0.4)'
                  e.currentTarget.style.color = 'var(--text-0)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-1)'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                Visit Blog & Guides
              </a>
            </div>

            <p
              style={{
                marginTop: '20px',
                fontSize: '12px',
                color: 'var(--text-3)',
              }}
            >
              support@tradvue.com · Mon–Fri, 9am–6pm ET
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '20px 24px',
            background: 'var(--bg-0)',
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              © 2026 TradVue. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'Terms', href: '/legal/terms' },
                { label: 'Privacy', href: '/legal/privacy' },
                { label: 'Cookies', href: '/legal/cookies' },
                { label: 'Disclaimer', href: '/legal/disclaimer' },
              ].map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{ fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none' }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
