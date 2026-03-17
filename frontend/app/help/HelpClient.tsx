'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import Breadcrumbs from '../components/Breadcrumbs'
import PersistentNav from '../components/PersistentNav'
import {
  IconArrowLeft, IconHouse, IconEye, IconBook, IconChart, IconWrench,
  IconSettings, IconRocket, IconZap, IconCreditCard, IconShield, IconLifeBuoy,
  IconTrendingUp, IconSatellite, IconQuestionCircle, IconMap, IconKeyboard,
  IconSearch, IconLightbulb, IconTool, IconBarChart, IconCalendar, IconNews,
  IconAlert, IconCoin, IconGlobe,
} from '../components/Icons'

// ─── Shared type ─────────────────────────────────────────────────────────────

type IconComponent = React.FC<{ size?: number; style?: React.CSSProperties }>

// ─────────────────────────────────────────────────────────────────────────────
// Getting Started Guide steps
// ─────────────────────────────────────────────────────────────────────────────

const GETTING_STARTED_STEPS = [
  {
    step: 1,
    Icon: IconHouse,
    title: 'Explore the Dashboard',
    desc: 'Start with the market overview — live indices, trending tickers, top news, and the economic calendar all in one place. Get a feel for what\'s moving today.',
    href: '/dashboard',
    linkLabel: 'Open Dashboard',
  },
  {
    step: 2,
    Icon: IconEye,
    title: 'Set Up Your Watchlist',
    desc: 'Go to Portfolio → Watchlist tab and add your favorite tickers. Set optional target buy prices. TradVue will track live prices and performance automatically.',
    href: '/portfolio',
    linkLabel: 'Go to Portfolio',
  },
  {
    step: 3,
    Icon: IconBook,
    title: 'Log Your First Trade',
    desc: 'Head to the Journal and click "+ New Trade." Fill in your entry/exit prices, position size, and stop loss. P&L and R-Multiple are calculated for you. Add a setup tag to unlock analytics.',
    href: '/journal',
    linkLabel: 'Open Journal',
  },
  {
    step: 4,
    Icon: IconChart,
    title: 'Track Holdings',
    desc: 'Add your current positions under Portfolio → Holdings. Enter your shares, buy date, and average cost. TradVue shows unrealized gains, allocation %, yield on cost, and projected dividends.',
    href: '/portfolio',
    linkLabel: 'Go to Portfolio',
  },
  {
    step: 5,
    Icon: IconWrench,
    title: 'Use the Tools',
    desc: 'The Tools page has a position size calculator, risk/reward calculator, options Greeks, Fibonacci levels, and more. Run quick math before entering a trade.',
    href: '/tools',
    linkLabel: 'Open Tools',
  },
  {
    step: 6,
    Icon: IconSettings,
    title: 'Customize Settings',
    desc: 'Click the settings gear (top-right) to switch themes (dark/light/system), set your timezone, adjust ticker bar size, and configure your preferred defaults.',
    href: '/',
    linkLabel: 'Open Settings',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard shortcuts
// ─────────────────────────────────────────────────────────────────────────────

const KEYBOARD_SHORTCUTS = [
  { keys: '/', description: 'Focus search bar', category: 'Navigation' },
  { keys: '⌘K', description: 'Focus search bar', category: 'Navigation' },
  { keys: 'Esc', description: 'Close modal / dismiss panel', category: 'Navigation' },
  { keys: '?', description: 'Show keyboard shortcuts overlay', category: 'Navigation' },
  { keys: 'g h', description: 'Go to Home / Dashboard', category: 'Go To' },
  { keys: 'g a', description: 'Go to Alerts', category: 'Go To' },
  { keys: 'g s', description: 'Open Settings panel', category: 'Go To' },
]

// ─────────────────────────────────────────────────────────────────────────────
// FAQ data
// ─────────────────────────────────────────────────────────────────────────────

const FAQ_DATA: {
  id: string
  category: string
  Icon: IconComponent
  questions: { q: string; a: string }[]
}[] = [
  {
    id: 'getting-started',
    category: 'Getting Started',
    Icon: IconRocket,
    questions: [
      {
        q: 'What is TradVue?',
        a: 'TradVue is a browser-based trading platform and research toolkit. It combines a real-time market dashboard, trading journal with analytics, portfolio tracker, financial tools (calculators, screener), news feed, and economic calendar — all in one place. No download required.',
      },
      {
        q: 'Is TradVue free?',
        a: 'TradVue has three access levels. (1) No Account: Dashboard, news, economic calendar, 30+ calculators, and watchlist are free to use with no account required. (2) Free Account: Create a free account (no credit card) for a 3-week full trial of all Pro features, then a limited free tier with a 30-day view window. (3) Pro: $24/month (or $16.80/month billed annually) — everything unlimited.',
      },
      {
        q: 'Do I need an account?',
        a: "No account is needed to use the dashboard, news feed, economic calendar, trading calculators, and watchlist. To access the trading journal, portfolio tracker, playbooks, AI Coach, prop firm tracker, and trade rules, you need a free account. Sign up in seconds — no credit card required.",
      },
      {
        q: 'What can I do without an account?',
        a: 'Without an account, you can access the market dashboard (live indices, quotes, market status), news feed, economic calendar, all 30+ trading calculators, and the watchlist. No sign-up, no credit card required.',
      },
      {
        q: 'What do I need an account for?',
        a: 'A free account is required for the trading journal, portfolio tracker, playbooks, post-trade ritual, AI Trade Coach, prop firm tracker, and trade rules. Create a free account in seconds — no credit card required.',
      },
      {
        q: "What's included in the free trial?",
        a: "When you create a free account, you get 3 weeks of full Pro features from the day you sign up — trading journal, portfolio tracker, AI Coach, playbooks, rituals, prop firm tracker, trade rules, full CSV import/export, cloud sync, advanced reports, and unlimited price alerts. No credit card required.",
      },
      {
        q: 'What happens after my trial ends?',
        a: 'After your 3-week trial, your account moves to the free tier: a 30-day rolling view window (data older than 30 days is locked but not deleted), limited CSV import/export (last 30 days only), 3 price alerts, and community support. Upgrade to Pro anytime to restore full access to your entire history.',
      },
      {
        q: 'What markets and assets are supported?',
        a: 'TradVue covers US equities (NYSE, NASDAQ, AMEX), ETFs, and mutual funds for the journal and portfolio. The Tools section includes crypto calculators (Fear & Greed, Gas Tracker, Staking Calculator). International equities and options chains are on the roadmap.',
      },
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
        a: 'Desktop gives you full charting tools, sentiment data, and advanced filters. Mobile focuses on watchlist monitoring and quick alerts. Both sync regularly, so your data stays current across devices.',
      },
    ],
  },
  {
    id: 'features',
    category: 'Features',
    Icon: IconZap,
    questions: [
      {
        q: 'How do alerts work?',
        a: 'Set a price alert by clicking the bell icon on any ticker. Choose "above" or "below" a price, and we\'ll notify you via email or in-app when it hits. Upgrade to Pro for SMS and webhook alerts.',
      },
      {
        q: 'What data sources do you use?',
        a: 'We pull market data from licensed sources including Alpaca, Finnhub, and others. Data may be delayed up to 15 minutes depending on the source and your plan. Sentiment comes from news aggregators and social signals.',
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
    Icon: IconCreditCard,
    questions: [
      {
        q: 'What are the differences between Free and Pro?',
        a: 'Free Account (post-trial): 30-day rolling view window for journal/portfolio, limited CSV (last 30 days), 3 price alerts, community support. Pro ($24/month, or $16.80/month billed annually at $201.60/year): unlimited trade history, cloud sync across all devices, full CSV import/export (any date range), broker auto-sync (coming soon), advanced reports & AI pattern detection, unlimited price alerts, and priority support. All new accounts get a 3-week full Pro trial — no credit card required.',
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
    id: 'data-privacy',
    category: 'Data & Privacy',
    Icon: IconShield,
    questions: [
      {
        q: 'Where is my data stored?',
        a: 'Your data is stored locally in your browser\'s localStorage by default — nothing leaves your device without your consent. Cloud sync is a Pro feature: when you have an active Pro subscription, your journal, settings, and data sync automatically across all your devices. During your 3-week free trial, cloud sync is also available. After the trial, cloud sync requires a Pro plan. You can always export a backup as JSON or CSV anytime.',
      },
      {
        q: 'Do you sell my data?',
        a: 'No. Never. We do not sell, share, or monetize your personal data or trading activity. Your journal and portfolio data never leaves your browser unless you explicitly export it.',
      },
      {
        q: 'What data sources do you use?',
        a: 'TradVue pulls data from Finnhub (stock quotes, fundamentals), CoinGecko (crypto), ForexFactory (economic calendar), NewsAPI (news feed), Yahoo Finance (supplemental), and RSS feeds from major financial publishers. See the Data Sources section below for full details.',
      },
      {
        q: 'Can I export my data?',
        a: 'Yes — you can export everything as JSON or CSV. In the Journal, click the Export button to download your trade log. In the Portfolio, use the Export button for holdings and watchlist. JSON exports can be re-imported to restore your data.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    category: 'Technical',
    Icon: IconWrench,
    questions: [
      {
        q: 'Why is some data delayed?',
        a: 'Free API tiers from some data providers include a 15-minute delay on certain data streams. Real-time quotes from Finnhub are available during trading hours, but some supplemental sources (extended hours, certain market indices) may lag. We display delay notices where applicable.',
      },
      {
        q: "The site is slow / data isn't loading — what should I do?",
        a: 'Try these steps in order: (1) Check your internet connection. (2) Hard-refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows). (3) Clear your browser cache. (4) Try a different browser (Chrome, Firefox, Edge all work well). (5) Disable browser extensions or ad blockers — these can block API calls. (6) Check tradvue.com/status for any known outages.',
      },
      {
        q: 'How do I report a bug?',
        a: 'Email support@tradvue.com with: (1) what you were trying to do, (2) what happened instead, (3) your browser name and version, (4) your operating system, and (5) any screenshots or screen recordings. We aim to respond within 24 hours.',
      },
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
    Icon: IconTrendingUp,
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
    Icon: IconSatellite,
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
    Icon: IconBarChart,
    questions: [
      {
        q: 'How do I add holdings?',
        a: 'Go to Portfolio → Holdings tab → click "+ Add Position". Enter ticker, number of shares, buy date, and average cost per share. The company name, sector, current price, and dividend data populate automatically.',
      },
      {
        q: "What's the privacy toggle?",
        a: 'The privacy toggle (eye icon in the portfolio header) hides all dollar amounts and percentages, replacing them with "••••". Useful when sharing your screen or working in a public place. Your data is not deleted — just masked until you toggle it off.',
      },
      {
        q: 'How is performance calculated?',
        a: 'Unrealized gain/loss = (current price − average cost) × shares. Total return % = (current market value − total cost basis) / total cost basis × 100. Projected dividend income = most recent dividend rate × share count × payment frequency. All figures are estimates — verify against your broker for tax purposes.',
      },
      {
        q: 'How do I add a stock to my watchlist?',
        a: 'Go to Portfolio → Watchlist tab → click "+ Add to Watchlist". Enter the ticker symbol (e.g. AAPL) and an optional target buy price. Company info, current price, and key metrics are fetched automatically.',
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
        a: 'Without an account, data is stored in your browser\'s local storage (device-specific). Cloud sync is a Pro feature — with an active Pro subscription (or during your 3-week free trial), your data syncs automatically across all your devices. After the trial, cloud sync requires a Pro plan. Use the Export button to back up your data as JSON or CSV anytime.',
      },
      {
        q: 'How accurate are the dividend calculations?',
        a: 'Dividend data is pulled from historical payment records. Projected annual income is estimated from the most recent dividend rate × share count. Always verify against your broker statements — forward dividends can change.',
      },
    ],
  },
  {
    id: 'journal',
    category: 'Trading Journal',
    Icon: IconBook,
    questions: [
      {
        q: 'How do I log a trade?',
        a: 'Go to Journal → Trade Log tab → click "+ New Trade". Fill in the symbol, entry price, exit price, position size, and stop loss. P&L, R-Multiple, and % gain/loss are calculated automatically. Add a setup tag and rating to enable analytics.',
      },
      {
        q: 'Can I import trades from my broker?',
        a: 'Yes — CSV import supports three formats: Robinhood (exported from the app or website), IBKR / Interactive Brokers (trade confirmations), and a Generic format (download the template from the import dialog). Most brokers that export CSV can be mapped to the Generic format.',
      },
      {
        q: 'What analytics are available?',
        a: 'The Analytics tab shows win rate, profit factor, average R-multiple, P&L by setup tag, P&L by mistake tag, trade distribution by day/hour, and streak analysis. The more consistently you tag your trades, the more useful the analytics become.',
      },
      {
        q: 'How do tags work?',
        a: 'There are two types: Setup tags label the trade type (e.g. "Breakout", "Pullback", "VWAP Bounce") and Mistake tags track errors (e.g. "FOMO", "Oversize", "Held Too Long"). Tag every trade consistently — the Analytics tab will show which setups have the best win rate and which mistakes cost you the most.',
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
    Icon: IconTool,
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
    Icon: IconLifeBuoy,
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
// Data sources
// ─────────────────────────────────────────────────────────────────────────────

const DATA_SOURCES: {
  name: string
  url: string
  Icon: IconComponent
  desc: string
}[] = [
  {
    name: 'Finnhub',
    url: 'https://finnhub.io',
    Icon: IconTrendingUp,
    desc: 'Real-time US stock quotes, company profiles, earnings, and financial news. Powers our equity market data.',
  },
  {
    name: 'CoinGecko',
    url: 'https://www.coingecko.com',
    Icon: IconCoin,
    desc: 'Cryptocurrency prices, market caps, and trading volumes. Powers all crypto market data and the ticker bar.',
  },
  {
    name: 'ForexFactory',
    url: 'https://www.forexfactory.com',
    Icon: IconCalendar,
    desc: 'Economic calendar events, central bank announcements, and macroeconomic news releases.',
  },
  {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com',
    Icon: IconChart,
    desc: 'Supplemental stock data, historical prices, and market indices for broader coverage.',
  },
  {
    name: 'NewsAPI',
    url: 'https://newsapi.org',
    Icon: IconNews,
    desc: 'Financial news aggregation from hundreds of sources. Powers the news feed and market sentiment analysis.',
  },
  {
    name: 'RSS Feeds',
    url: '#',
    Icon: IconGlobe,
    desc: 'Direct RSS feeds from major financial publishers including Reuters, Bloomberg, and MarketWatch.',
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
    <div style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
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

      <div style={{ overflow: 'hidden', maxHeight: isOpen ? '400px' : '0', transition: 'max-height 0.3s ease' }}>
        <div style={{ padding: '0 20px 20px 20px', fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.75 }}>
          <div style={{ background: 'var(--bg-2)', borderLeft: '3px solid #4a9eff', borderRadius: '0 6px 6px 0', padding: '14px 16px' }}>
            {highlighted(answer)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header helper (consistent across all sections)
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  Icon,
  title,
  desc,
  descIndent = true,
}: {
  Icon: IconComponent
  title: string
  desc: string
  descIndent?: boolean
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div className="tv-card-icon" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
          <Icon size={18} />
        </div>
        <h2 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-0)', margin: 0 }}>
          {title}
        </h2>
      </div>
      <p style={{
        fontSize: 14,
        color: 'var(--text-2)',
        marginBottom: 32,
        lineHeight: 1.6,
        maxWidth: 640,
        marginLeft: descIndent ? 48 : 0,
      }}>
        {desc}
      </p>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function HelpClient() {
  const [search, setSearch] = useState('')
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const toggle = (key: string) =>
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))

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

      <div style={{ fontFamily: 'var(--font)', background: 'var(--bg-0)', color: 'var(--text-0)', minHeight: '100vh' }}>
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
            <IconQuestionCircle size={18} />
            Help & Support
          </div>
          <div className="page-header-desc">Find answers, guides, and support</div>
        </header>

        {/* ── Breadcrumbs ── */}
        <Breadcrumbs
          items={[{ label: 'Home', href: '/' }, { label: 'Help & Support' }]}
        />

        {/* ── Hero ── */}
        <div style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(74,158,255,0.04) 0%, transparent 100%)',
          padding: 'clamp(48px, 8vw, 80px) 24px clamp(40px, 6vw, 64px)',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            marginBottom: '16px',
            color: 'var(--text-0)',
          }}>
            How can we help you?
          </h1>
          <p style={{
            fontSize: 'clamp(14px, 2vw, 16px)',
            color: 'var(--text-2)',
            maxWidth: '520px',
            margin: '0 auto 36px',
            lineHeight: 1.65,
          }}>
            Find answers to common questions about TradVue. Browse by category or search below.
          </p>

          {/* Search box */}
          <div style={{ maxWidth: '540px', margin: '0 auto', position: 'relative' }}>
            <IconSearch
              size={16}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--text-3)',
              }}
            />
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
          <div style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '28px 24px 0',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}>
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
            {FAQ_DATA.map(cat => {
              const CatIcon = cat.Icon
              return (
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
                  <CatIcon size={13} />
                  <span>{cat.category}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Getting Started Guide ── */}
        {!isSearching && (
          <div id="getting-started-guide" style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(40px, 5vw, 60px) 24px' }}>
              <SectionHeader
                Icon={IconMap}
                title="Getting Started Guide"
                desc="New to TradVue? Follow these six steps to get fully set up in under 10 minutes."
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {GETTING_STARTED_STEPS.map(step => (
                  <div
                    key={step.step}
                    style={{
                      background: 'var(--card-bg)',
                      border: 'var(--card-border)',
                      borderRadius: 'var(--card-radius)',
                      boxShadow: 'var(--card-shadow)',
                      padding: '20px 20px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em' }}>
                      STEP {step.step}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 36, height: 36, borderRadius: 9,
                        background: 'var(--bg-3)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <step.Icon size={20} />
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)', lineHeight: 1.3 }}>
                        {step.title}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, margin: 0, flex: 1 }}>
                      {step.desc}
                    </p>
                    <a
                      href={step.href}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12, fontWeight: 600, color: '#4a9eff',
                        textDecoration: 'none', marginTop: 4,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {step.linkLabel}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FAQ sections ── */}
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {filteredData.length === 0 && isSearching && (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-3)' }}>
                <IconSearch size={40} />
              </div>
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
            .map(cat => {
              const CatIcon = cat.Icon
              return (
                <section key={cat.id} id={cat.id}>
                  <div style={{
                    background: 'var(--card-bg)',
                    border: 'var(--card-border)',
                    borderRadius: 'var(--card-radius)',
                    boxShadow: 'var(--card-shadow)',
                    overflow: 'hidden',
                  }}>
                    {/* Category header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <div className="tv-card-icon">
                        <CatIcon size={18} />
                      </div>
                      <div>
                        <h2 className="tv-card-title" style={{ fontSize: '15px', margin: 0 }}>
                          {cat.category}
                        </h2>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2, display: 'block' }}>
                          {cat.questions.length} question{cat.questions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Accordion items */}
                    <div style={{ background: 'var(--bg-1)' }}>
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
                  </div>
                </section>
              )
            })}
        </div>

        {/* ── Keyboard Shortcuts ── */}
        <div id="keyboard-shortcuts" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-0)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(40px, 5vw, 60px) 24px' }}>
            <SectionHeader
              Icon={IconKeyboard}
              title="Keyboard Shortcuts"
              desc={`Speed up your workflow with these keyboard shortcuts. Press ? anywhere on the site to show the shortcuts overlay.`}
            />

            {(['Navigation', 'Go To'] as const).map(category => {
              const shortcuts = KEYBOARD_SHORTCUTS.filter(s => s.category === category)
              return (
                <div key={category} style={{
                  background: 'var(--card-bg)',
                  border: 'var(--card-border)',
                  borderRadius: 'var(--card-radius)',
                  boxShadow: 'var(--card-shadow)',
                  marginBottom: 16,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 18px',
                    background: 'var(--bg-2)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: '#4a9eff',
                  }}>
                    {category}
                  </div>
                  {shortcuts.map(s => (
                    <div key={s.keys} style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '11px 18px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <kbd style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 58, padding: '4px 10px',
                        background: 'var(--bg-3)', border: '1px solid var(--border)',
                        borderBottomWidth: 2, borderRadius: 6,
                        fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-0)',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {s.keys}
                      </kbd>
                      <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{s.description}</span>
                    </div>
                  ))}
                </div>
              )
            })}

            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              More shortcuts will be added as the platform grows. Shortcuts are disabled when typing in an input field.
            </p>
          </div>
        </div>

        {/* ── Contact Support ── */}
        <div id="contact-support" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(40px, 5vw, 60px) 24px' }}>
            <SectionHeader
              Icon={IconLifeBuoy}
              title="Contact Support"
              desc="Can't find what you're looking for? We're here to help."
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {/* Email card — entire card is clickable */}
              <a href="mailto:support@tradvue.com" style={{ background: 'var(--card-bg)', border: 'var(--card-border)', borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)', padding: '20px 22px', textDecoration: 'none', display: 'block', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="tv-card-icon" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-0)' }}>Email Support</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#4a9eff', display: 'block', marginBottom: 10 }}>
                  support@tradvue.com
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <span style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span>Response within <strong style={{ color: 'var(--text-1)' }}>24 hours</strong> on weekdays (Mon–Fri)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <IconZap size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                    <span>Urgent issues? Include <strong style={{ color: 'var(--text-1)' }}>"URGENT"</strong> in the subject line</span>
                  </div>
                </div>
              </a>

              {/* Bug Reports card */}
              <div style={{ background: 'var(--card-bg)', border: 'var(--card-border)', borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)', padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="tv-card-icon" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }}>
                    <IconAlert size={18} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-0)' }}>Bug Reports</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>
                  When reporting a bug, please include:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {['Your browser (Chrome 120, Safari 17, etc.)', 'Steps to reproduce the issue', 'What you expected vs. what happened', 'Screenshots or screen recordings if possible'].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'rgba(74,158,255,0.15)', border: '1px solid rgba(74,158,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#4a9eff',
                        flexShrink: 0, marginTop: 1,
                      }}>{i + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Requests card */}
              <div style={{ background: 'var(--card-bg)', border: 'var(--card-border)', borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)', padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="tv-card-icon" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }}>
                    <IconLightbulb size={18} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-0)' }}>Feature Requests</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>
                  Got an idea? We'd love to hear it.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <span style={{ color: '#4a9eff', flexShrink: 0, marginTop: 1 }}>→</span>
                    <span>Email subject: <strong style={{ color: 'var(--text-1)' }}>"Feature Request: [short description]"</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <span style={{ color: '#4a9eff', flexShrink: 0, marginTop: 1 }}>→</span>
                    <span>Describe the use case and why it matters to you</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <span style={{ color: '#4a9eff', flexShrink: 0, marginTop: 1 }}>→</span>
                    <span>We prioritize based on request volume — the more people ask, the faster it ships</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Data Sources & Attribution ── */}
        <div id="data-sources" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-0)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(40px, 5vw, 60px) 24px' }}>
            <SectionHeader
              Icon={IconSatellite}
              title="Data Sources & Attribution"
              desc="TradVue aggregates data from multiple trusted providers. We're grateful to these services for powering our platform."
              descIndent={false}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {DATA_SOURCES.map(source => {
                const SourceIcon = source.Icon
                return (
                  <div key={source.name} style={{ background: 'var(--card-bg)', border: 'var(--card-border)', borderRadius: 10, padding: '16px 20px', boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div className="tv-card-icon" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}>
                        <SourceIcon size={16} />
                      </div>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', textDecoration: 'none' }}>
                        {source.name}
                      </a>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{source.desc}</p>
                  </div>
                )
              })}
            </div>
            <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>
              Data is provided for informational purposes only and is not intended as financial advice. Prices may be delayed.
              TradVue is not affiliated with any of the above data providers. All trademarks belong to their respective owners.
            </p>
          </div>
        </div>

        {/* ── Still need help? ── */}
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(48px, 6vw, 72px) 24px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(74,158,255,0.1)',
              border: '1px solid rgba(74,158,255,0.2)',
              marginBottom: '20px',
              color: '#4a9eff',
            }}>
              <IconLifeBuoy size={24} />
            </div>
            <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-0)', marginBottom: '12px' }}>
              Still need help?
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '400px', margin: '0 auto 28px', lineHeight: 1.65 }}>
              Can't find what you're looking for? Our support team typically responds within a few hours.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                href="/help"
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
                Browse Help Center
              </a>
            </div>

            <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-3)' }}>
              support@tradvue.com · Mon–Fri, 9am–6pm ET
            </p>
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
              TradVue is a trading journal and analytics tool — not a financial advisor. Market data and analytics are provided for informational purposes only and may be delayed or incomplete. This is not financial advice. Trading involves substantial risk of loss.
            </p>
          </div>
        </div>

        {/* ── Page Footer ── */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', background: 'var(--bg-0)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
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
                <Link key={l.href} href={l.href} style={{ fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none' }}>
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
