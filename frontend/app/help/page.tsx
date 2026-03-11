'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import Breadcrumbs from '../components/Breadcrumbs'
import PersistentNav from '../components/PersistentNav'
import { IconArrowLeft } from '../components/Icons'

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
        a: 'We cover US equities (NYSE, NASDAQ, AMEX), ETFs, and mutual funds. International markets coming soon. Crypto tools (Fear & Greed, Gas Tracker, Staking Calculator) are available in Tools.',
      },
      {
        q: 'How much historical data is available?',
        a: 'Free users get 1 year of chart history. Pro users get 2 years. All users can view company fundamentals and news archives going back 5 years.',
      },
    ],
  },
  {
    id: 'market-data',
    category: 'Market Data',
    icon: '📡',
    questions: [
      {
        q: 'Where does the stock price data come from?',
        a: 'Real-time quotes are sourced from licensed market data providers covering NYSE, NASDAQ, and AMEX. Data is updated every 1-5 seconds during trading hours (9:30 AM – 4:00 PM ET).',
      },
      {
        q: 'How often is the news feed updated?',
        a: 'News articles refresh every few minutes during market hours. Breaking news is surfaced within 2-5 minutes of publication. After-hours, the feed updates once every 30 minutes.',
      },
      {
        q: 'Why does a stock price look slightly different from my broker?',
        a: 'Minor discrepancies (a few cents) are normal due to the time it takes to fetch and display quotes. If you see a large discrepancy, try refreshing the page. Always use your broker\'s price for actual trade execution.',
      },
      {
        q: 'Does TradVue support pre-market and after-hours quotes?',
        a: 'Yes. Extended hours quotes (4 AM – 8 PM ET) are displayed where available. Note that extended-hours data can be less liquid and more volatile than regular session prices.',
      },
    ],
  },
  {
    id: 'portfolio',
    category: 'Portfolio',
    icon: '📊',
    questions: [
      {
        q: 'How do I add a stock to my watchlist?',
        a: 'Go to Portfolio → Watchlist tab → click "+ Add to Watchlist". Enter the ticker symbol (e.g. AAPL) and an optional target buy price. Company info, current price, and key metrics are fetched automatically.',
      },
      {
        q: 'How do I add a stock to my holdings?',
        a: 'Go to Portfolio → Holdings tab → click "+ Add Position". Enter ticker, number of shares, buy date, and average cost per share. The company name, sector, current price, and dividend data populate automatically.',
      },
      {
        q: 'How do I remove a stock from my watchlist or holdings?',
        a: 'In the watchlist or holdings table, click the "Del" button on the right side of the row. You\'ll be prompted to confirm before deletion.',
      },
      {
        q: 'What does "Allocation %" mean in the Holdings table?',
        a: 'Allocation % shows what percentage of your total portfolio market value this single position represents. For example, if AAPL is worth $5,000 and your total portfolio is $25,000, AAPL is 20% allocated. High concentration in one stock = higher risk.',
      },
      {
        q: 'What is "Yield on Cost" (YOC)?',
        a: 'Yield on Cost is your annual dividend income divided by what you originally paid (your cost basis), not the current price. If you bought a stock for $50 that now yields $3/year, your YOC is 6% — even if the stock is now at $100 and the current yield is only 3%.',
      },
      {
        q: 'Does my portfolio data sync across devices?',
        a: 'Without an account, data is stored in your browser\'s local storage (device-specific). Sign in to enable cloud sync — your data will then be available on any device. Use the Export button to back up your data as JSON or CSV anytime.',
      },
      {
        q: 'How accurate are the dividend calculations?',
        a: 'Dividend data is pulled from historical payment records. Projected annual income is estimated from the most recent dividend rate × share count. Always verify against your broker statements — forward dividends can change.',
      },
    ],
  },
  {
    id: 'journal',
    category: 'Journal',
    icon: '📒',
    questions: [
      {
        q: 'How do I log a trade manually?',
        a: 'Go to Journal → Trade Log tab → click "+ New Trade". Fill in the symbol, entry price, exit price, position size, and stop loss. P&L, R-Multiple, and % gain/loss are calculated automatically. Add a setup tag and rating to enable analytics.',
      },
      {
        q: 'What CSV formats does the import support?',
        a: 'TradVue Journal supports three CSV formats: Generic (our standard template — download from the import dialog), Robinhood (exported from the app or website), and IBKR (Interactive Brokers trade confirmations). Other brokers may work with the Generic format if columns match.',
      },
      {
        q: 'What are setup tags and how should I use them?',
        a: 'Setup tags label the type of trade you took — e.g. "Breakout", "Pullback", "Gap Fill", "VWAP Bounce". Tag every trade consistently, and the Analytics tab will show you which setups have the best win rate and profit factor. This reveals your edge.',
      },
      {
        q: 'What are mistake tags?',
        a: 'Mistake tags help you track recurring errors — e.g. "FOMO", "Oversize", "Held Too Long", "Revenge Trade". After logging 20+ trades, the Analytics tab shows which mistakes cost you the most money, so you can focus on fixing the highest-impact ones first.',
      },
      {
        q: 'What is R-Multiple?',
        a: 'R-Multiple measures your trade\'s outcome relative to your initial risk. If you risked $100 (entry minus stop × shares) and made $250, that\'s a +2.5R trade. If you lost $100, that\'s -1R. Tracking R-Multiple lets you evaluate performance independently of position size.',
      },
      {
        q: 'How do I export my journal data?',
        a: 'Click the Export button in the journal header. You can export as CSV (for spreadsheets) or JSON (for full backup and restore). The Backup button saves all trades and notes as a restorable JSON file.',
      },
    ],
  },
  {
    id: 'tools',
    category: 'Tools',
    icon: '🔧',
    questions: [
      {
        q: 'What is the Position Size Calculator?',
        a: 'This tool tells you how many shares to buy based on your account size, how much you\'re willing to risk (%), your entry price, and your stop loss price. It helps ensure you never risk more than your defined % on a single trade.',
      },
      {
        q: 'What is the Risk/Reward Calculator?',
        a: 'Enter your entry price, stop loss, and take profit target. The tool shows your risk/reward ratio (e.g. 1:3), break-even win rate needed to be profitable, and dollar amounts at stake. A 1:2 or better ratio is generally considered good.',
      },
      {
        q: 'What are Options Greeks?',
        a: 'Greeks measure how an option\'s price changes relative to different factors. Delta = sensitivity to stock price movement. Gamma = rate of Delta change. Theta = time decay per day. Vega = sensitivity to volatility. The Options Greeks Calculator uses Black-Scholes to compute these for any option.',
      },
      {
        q: 'What is the Fibonacci Retracement tool?',
        a: 'Enter the high and low of a price move, and the tool calculates key Fibonacci levels (23.6%, 38.2%, 50%, 61.8%, 78.6%). These are commonly watched support and resistance areas where price may reverse or pause during a pullback.',
      },
      {
        q: 'Do my tool inputs save between sessions?',
        a: 'Most tools reset when you close the tab, as they\'re meant for quick, in-session calculations. The Trading Journal is the exception — it saves all data persistently in your browser (or cloud if signed in).',
      },
    ],
  },
  {
    id: 'support',
    category: 'Support',
    icon: '🛟',
    questions: [
      {
        q: 'How do I contact the TradVue support team?',
        a: 'Email us at support@tradvue.com. We typically respond within a few hours on weekdays (Mon–Fri, 9am–6pm ET). For urgent issues, describe the problem clearly and include your browser and OS version.',
      },
      {
        q: 'Are there any known issues I should be aware of?',
        a: 'We maintain a real-time status page at tradvue.com/status showing the health of our market data feeds, API, and web app. Check there first if something seems broken — it may already be on our radar.',
      },
      {
        q: 'How do I report a bug?',
        a: 'Email support@tradvue.com with: (1) what you were trying to do, (2) what happened instead, (3) your browser and OS. Screenshots help a lot. We aim to fix critical bugs within 24 hours.',
      },
      {
        q: 'Is there a roadmap or changelog I can follow?',
        a: 'Yes! Check out tradvue.com/changelog for a detailed history of features, fixes, and improvements. We ship updates frequently and list every change with dates.',
      },
      {
        q: 'How do I request a new feature?',
        a: 'Send your idea to support@tradvue.com with subject line "Feature Request". We prioritize based on how many users ask for the same thing, so be as specific as possible about what you need and why.',
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
        {/* ── Persistent Navigation ── */}
        <PersistentNav />

        {/* ── Page Header ── */}
        <header className="page-header">
          <Link href="/" className="back-link">
            <IconArrowLeft size={16} />
            TradVue
          </Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <div className="page-header-title">
            <span>❓</span>
            Help Center
          </div>
          <div className="page-header-desc">Find answers, guides, and support</div>
        </header>

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
