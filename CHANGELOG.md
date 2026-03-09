# Changelog

All notable changes to TradVue are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en-release.md) and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### 🤖 Dashboard Agent Integration
- **Agent status tracking** — Real-time status (online/busy/offline), current task, tokens used, tasks completed today
- **Notifications system** — Full CRUD with type badges (info/warning/success/error), mark read, mark all read
- **Real dashboard stats** — Overview cards wired to actual DB counts (total tasks, completed today, active agents, unread notifications)
- **Activity auto-logging** — Task create/complete automatically generates activity feed entries
- **Migration 008** — `dashboard_agents` and `dashboard_notifications` tables
- **API routes** — `/api/dashboard/agents`, `/api/dashboard/notifications`, `/api/dashboard/stats`
- **Sidebar notification badge** — Unread count shown on 🔔 Notifications nav item
- **Overview notifications widget** — Top 4 recent notifications in sidebar panel

---

## [0.1.0-beta] - 2026-03-06

### 🎉 Major Features

#### Real-Time Market Intelligence
- **Live price feeds** for stocks, forex, cryptocurrencies, and commodities
- **Intraday charts** with multiple timeframes (1m, 5m, 15m, 1h, 4h, daily, weekly, monthly)
- **Stock search** with autocomplete and detailed ticker information
- **Top movers** display (gainers/losers) across asset classes
- **20+ years of historical data** available for backtesting and analysis
- Real data integration with Alpha Vantage, FinnHub, and Polygon.io APIs

#### AI-Powered News Aggregation & Analysis
- **Multi-source news collection** (NewsAPI, RSS feeds, custom scrapers)
- **Automatic sentiment analysis** with -1 to 1 sentiment scoring
- **Impact scoring** (0-10 scale) for news relevance to trading
- **AI-generated summaries** for quick insights
- **Symbol-specific news feeds** with smart filtering
- News feed integration in main dashboard with real-time updates

#### Smart Watchlist & Alert System
- **Unlimited watchlists** for organizing tracked assets
- **Price-based alerts** with configurable thresholds
- **Volume spike detection** for unusual trading activity
- **Real-Time Market Alerts System** with multi-channel notifications
- **Alert history** and notification preferences management
- Persistent watchlist sync across sessions

#### User Experience & Interface
- **Professional dark-mode UI** with FinancialJuice-inspired design
- **Responsive mobile layout** optimized for all screen sizes
- **Interactive onboarding flow** with welcome modal, feature checklist, tooltips
- **Empty states** with helpful guidance for new users
- **Celebration animations** for milestone achievements
- **Settings panel** for customization and preferences
- **Shimmer loaders** for smooth data loading states
- **Detail modals** for in-depth ticker information

#### Authentication & User Management
- **JWT-based authentication** with secure refresh tokens
- **Session management** with persistent login
- **User profiles** with customizable settings
- **Privacy-first OAuth integration** for social signup

#### Legal & Compliance
- **Terms of Service** page with full legal text
- **Privacy Policy** with GDPR compliance details
- **Cookie Policy** with consent management
- **Trading Disclaimer** for liability protection

#### Landing Page & Growth
- **Public landing page** with product overview and CTA
- **Waitlist system** with email confirmation
- **Analytics integration** (GA4) with privacy-first consent gate
- Marketing-optimized copy and value propositions

#### Technical Infrastructure
- **Offline detection** with graceful degradation
- **WebSocket integration** for real-time price updates
- **Redis caching** for performance optimization
- **Background job queue** (Bull) for async operations
- **Comprehensive logging** with structured console methods
- **TypeScript** for type safety throughout codebase
- **TDD approach** with route-level tests for watchlist and news aggregation

### Added
- Authentication system with JWT and refresh tokens
- Real-time price ticker bar with live market data
- News feed sidebar with sentiment indicators
- Market quotes sidebar showing key metrics
- Watchlist persistence to localStorage and database
- Alert notification system (in-app and email ready)
- Social sentiment tracking framework
- Economic calendar integration scaffolding
- Dark mode toggle with system preference detection
- Mobile navigation drawer
- Search functionality with debouncing
- User settings/preferences panel
- Data validation and error handling across API endpoints
- Request logging middleware
- Response standardization across endpoints
- Rate limiting preparation (scaffolding)

### Changed
- **UI Redesign**: Complete visual overhaul from basic layout to professional trading terminal
- **Navigation**: Improved top bar with ticker, notifications, and user menu
- **Watchlist UX**: Moved to dedicated sidebar with drag-and-drop support
- **News Integration**: Migrated from static mock data to real NewsAPI integration
- **Authentication Flow**: Updated auth UI with improved form validation and feedback
- **Settings Panel**: Reorganized preferences for clarity and discoverability
- **Color Scheme**: Moved to fintech-professional dark palette with accent colors
- **Typography**: Improved readability with better font hierarchy and spacing
- **Form Components**: Upgraded to Shadcn/ui for consistency

### Fixed
- Mobile responsive layout issues on iOS and Android devices
- Auth UI spacing and alignment problems
- Settings panel scrolling behavior
- Watchlist sync inconsistencies between sessions
- Shimmer loader animation performance
- Chart rendering lag on large datasets
- News feed pagination bugs
- Missing market data fallbacks
- Form validation timing issues
- WebSocket connection stability

### Security
- **Privacy-First Analytics**: GA4 consent gate prevents tracking until user opt-in
- **Secure token storage**: JWT tokens in httpOnly cookies (when backend ready)
- **CORS configuration**: Restricted API access to approved domains
- **Input sanitization**: All user inputs validated and escaped
- **Environment variables**: Sensitive data moved to .env
- **Trading Disclaimer**: Added liability protection copy
- **Data encryption ready**: Scaffolding for HTTPS and data at rest encryption

### Removed
- Mock API responses (replaced with real data integration)
- Hardcoded test data from components
- Legacy authentication form components
- Console.log statements (replaced with console.info)
- Static news items (now using dynamic API)

---

## [Unreleased] - Coming Soon

### Planned Features
- **Advanced Technical Indicators**: Bollinger Bands, MACD, Stochastic Oscillator
- **Social Sentiment Analysis**: Real-time tracking from Reddit, Twitter, Discord
- **Influencer Tracking**: Monitor signals from trading influencers
- **API Access**: RESTful API for enterprise integrations
- **Custom Alert Rules**: Pattern-based and condition-based alerts
- **Data Export**: CSV and JSON export for analysis
- **Advanced Analytics Dashboard**: Custom metrics and performance tracking
- **Subscription Tiers**: Free, Professional ($19/mo), Enterprise ($99/mo)
- **Calendar Sync**: Google Calendar and Outlook integration
- **Mobile App**: Native iOS and Android applications
- **Voice Alerts**: SMS and voice notifications
- **Backtesting Engine**: Historical testing of trading strategies
- **Community Features**: Discussion forums, shared watchlists, strategy sharing

---

## Version Naming & Release Strategy

### Semantic Versioning
- **MAJOR** (X.0.0): Breaking changes, significant architectural changes
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, performance improvements
- **Beta/RC**: Pre-release versions (0.1.0-beta, 0.1.0-rc.1)

### Release Cadence
- **Beta phase** (v0.x.x): Rapid iteration, feature releases every 1-2 weeks
- **Stable release** (v1.0.0): Feature-complete, production-ready
- **Maintenance**: Patch releases as needed for critical bugs

### Tagging & Commits
- Commits must follow conventional commit format: `type(scope): message`
- Release tags: `v0.1.0-beta`, `v1.0.0`, etc.
- Each release requires a commit updating this CHANGELOG.md

### Links to Commits & PRs

| Commit | Feature | PR |
|--------|---------|-----|
| [c19742f](https://github.com/mini1/tradvue/commit/c19742f) | GA4 analytics with privacy-first consent | [Link to PR] |
| [7e036ff](https://github.com/mini1/tradvue/commit/7e036ff) | Product, API, security docs | [Link to PR] |
| [706b60f](https://github.com/mini1/tradvue/commit/706b60f) | Legal pages (terms, privacy, cookies) | [Link to PR] |
| [2315609](https://github.com/mini1/tradvue/commit/2315609) | Landing page + waitlist backend | [Link to PR] |
| [8c86a91](https://github.com/mini1/tradvue/commit/8c86a91) | Onboarding flow with UX polish | [Link to PR] |
| [a9a1978](https://github.com/mini1/tradvue/commit/a9a1978) | Deployment checklist & .env setup | [Link to PR] |
| [587756d](https://github.com/mini1/tradvue/commit/587756d) | Real-Time Market Alerts System | [Link to PR] |
| [785e2b7](https://github.com/mini1/tradvue/commit/785e2b7) | UX polish, auth UI, settings, watchlist sync | [Link to PR] |
| [dbd688b](https://github.com/mini1/tradvue/commit/dbd688b) | Stock search, detail modal, watchlist persistence | [Link to PR] |
| [2553c9d](https://github.com/mini1/tradvue/commit/2553c9d) | Mobile responsive layout | [Link to PR] |
| [e17064f](https://github.com/mini1/tradvue/commit/e17064f) | Real data integration (ticker, news, quotes) | [Link to PR] |
| [267c5ac](https://github.com/mini1/tradvue/commit/267c5ac) | UI redesign - FinancialJuice style | [Link to PR] |
| [abf4065](https://github.com/mini1/tradvue/commit/abf4065) | Dark mode UI overhaul | [Link to PR] |

---

## How to Read This Changelog

- **🎉 Major Features**: Significant new functionality
- **Added**: New features and capabilities
- **Changed**: Modifications to existing features
- **Fixed**: Bug fixes and corrections
- **Security**: Security improvements and fixes
- **Removed**: Removed features or deprecated functionality
- **Planned**: Upcoming features in roadmap

**Status**: Each release is marked with its version number and release date.

---

For detailed documentation, see [Release Process](/docs/RELEASE_PROCESS.md).
