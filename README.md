# ChartGenius 📊

**Real-time market intelligence, AI-powered news analysis, and social sentiment tracking for traders.**

ChartGenius is a comprehensive trading intelligence platform that aggregates market data, financial news, and social sentiment into actionable insights. Track multiple asset classes, set intelligent alerts, and make data-driven trading decisions.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000?logo=vercel)](https://chartgenius.io)

---

## ✨ Features

### 🔄 Real-Time Market Data
- Live price feeds for **stocks, forex, cryptocurrencies, and commodities**
- Intraday charts with multiple timeframes (1m, 5m, 1h, 1d, 1w)
- 20+ years of historical data available
- Top movers (gainers/losers) across all markets
- Advanced technical indicators: SMA, EMA, MACD, RSI, Bollinger Bands, and more

### 📰 AI-Powered News Aggregation
- Multi-source news collection (NewsAPI, RSS feeds, Reddit, financial wires)
- **Automatic sentiment analysis** (−1 to +1 score)
- **Impact scoring** (0–10) for news relevance to trading
- AI-generated summaries for quick insights
- Symbol-specific news feeds with relevance filtering

### 🎯 Smart Watchlist & Alerts
- Create unlimited watchlists (Professional+ tier)
- Price-based alerts with custom threshold configuration
- Volume spike detection
- News impact alerts when important stories break
- Multi-channel notifications: email, push, in-app

### 👥 Social Sentiment Analysis
- Real-time social media mention tracking
- Sentiment aggregation across multiple platforms
- Community sentiment vs. price correlation charts

### 📅 Economic Calendar
- Earnings announcements with countdown timers
- Macro economic events (Fed meetings, CPI, jobs reports)
- Custom event reminders for trading setups
- Calendar sync integration

### ⌨️ Keyboard Shortcuts
Power-user navigation — press `?` anywhere in the app to see the full shortlist:

| Shortcut | Action |
|----------|--------|
| `G D` | Go to Dashboard |
| `G W` | Go to Watchlist |
| `G N` | Go to News |
| `G C` | Go to Calendar |
| `/` | Focus search |
| `?` | Toggle shortcuts panel |

### 💼 Subscription Tiers

| Feature | Free | Professional ($19/mo) | Enterprise ($99/mo) |
|---------|------|----------------------|---------------------|
| Market data | 15-min delayed | ✅ Real-time | ✅ Real-time |
| News articles | 5/day | ✅ Unlimited + AI summaries | ✅ Unlimited |
| Watchlist | 10 assets | ✅ Unlimited | ✅ Unlimited |
| Notifications | Email only | ✅ Push + email | ✅ All channels |
| Social sentiment | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ 1000 calls/hr |
| Data export | ❌ | ❌ | ✅ CSV / JSON |
| Priority support | ❌ | ❌ | ✅ Dedicated manager |

---

## 🛠 Tech Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org) (App Router) + React 18 |
| Language | TypeScript 5 |
| Styling | TailwindCSS + custom design tokens |
| State | React Context + Zustand |
| Charts | Recharts |
| Real-time | WebSocket (live price feeds) |
| Deployment | [Vercel](https://vercel.com) (region: `iad1`) |

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | PostgreSQL via [Supabase](https://supabase.com) |
| Cache | Redis |
| Auth | JWT with refresh tokens |
| Job Queue | Bull (background tasks) |
| Deployment | Railway |

### External APIs
| Service | Purpose |
|---------|---------|
| [Finnhub](https://finnhub.io) | Real-time stock/forex quotes |
| [CoinGecko](https://coingecko.com) | Cryptocurrency data (free tier) |
| [Alpha Vantage](https://alphavantage.co) | Historical equity data |
| [FRED](https://fred.stlouisfed.org) | Economic indicators |
| [NewsAPI](https://newsapi.org) | Financial news aggregation |
| RSS Feeds | Supplemental news sources |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 13+ (or a [Supabase](https://supabase.com) project)
- API keys — see [Environment Variables](#-environment-variables) below

### 1. Clone & Install

```bash
git clone https://github.com/ChartGenius/chartgenius.git
cd chartgenius
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env      # fill in your keys
npm run migrate           # deploy database schema
npm run dev               # starts on http://localhost:3001
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in API endpoint
npm run dev                   # starts on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) — you should see the landing page.

### 4. (Optional) Docker

```bash
# Run everything with Docker Compose from the repo root
docker-compose up -d

# Stream logs
docker-compose logs -f
```

---

## 🔑 Environment Variables

### Backend `.env`

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/chartgenius
REDIS_URL=redis://localhost:6379

# ── Market Data (at least one required) ────────────────────────────────────────
FINNHUB_TOKEN=your_token_here
ALPHA_VANTAGE_KEY=your_key_here
COINGECKO_API_KEY=optional_free_tier

# ── News ────────────────────────────────────────────────────────────────────────
NEWSAPI_KEY=your_key_here

# ── Auth ────────────────────────────────────────────────────────────────────────
JWT_SECRET=change_me_to_a_long_random_string
JWT_REFRESH_SECRET=change_me_to_another_long_random_string
JWT_EXPIRY=15m

# ── Email ───────────────────────────────────────────────────────────────────────
SENDGRID_API_KEY=your_key_here

# ── App ─────────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

> ⚠️ Never commit `.env` files. They are gitignored by default.

---

## 📁 Project Structure

```
chartgenius/
├── backend/
│   ├── controllers/         # Request handlers
│   ├── middleware/          # Auth, rate-limiting, error handling
│   ├── models/              # Database models
│   ├── routes/              # Express route definitions
│   ├── services/            # Business logic (finnhub, rss, economic calendar)
│   ├── tests/               # Test suites
│   └── server.js            # Entry point
├── database/
│   └── schema.sql           # PostgreSQL schema (8 tables, 20 instruments seeded)
├── docs/                    # 25+ guides, API specs, and templates
├── frontend/
│   ├── app/
│   │   ├── changelog/       # Public changelog page (/changelog)
│   │   ├── components/      # Shared UI components
│   │   │   ├── Spinner.tsx       # SVG arc spinner (5 sizes × 5 variants)
│   │   │   ├── PageLoader.tsx    # Full-viewport overlay for route transitions
│   │   │   ├── Skeleton.tsx      # Shimmer placeholders (Text, Card, Table, Avatar)
│   │   │   ├── KeyboardShortcuts.tsx  # In-app shortcut reference panel
│   │   │   ├── AlertSystem.tsx   # Toast notification manager
│   │   │   └── index.ts          # Barrel export with usage docs
│   │   ├── context/         # Auth, Settings, Onboarding context providers
│   │   ├── landing/         # Marketing landing page
│   │   ├── legal/           # Privacy, Terms, Cookie, Disclaimer pages
│   │   ├── status/          # System status page (/status)
│   │   └── help/            # Help center
│   ├── lib/                 # Utilities and API client
│   ├── public/              # Static assets
│   └── vercel.json          # Vercel deployment config
├── CHANGELOG.md             # Public-facing release history
└── README.md                # This file
```

---

## 🧩 UI Components

ChartGenius ships a small internal component library for consistent loading states:

```tsx
import Spinner from '@/app/components/Spinner'
import PageLoader from '@/app/components/PageLoader'
import Skeleton from '@/app/components/Skeleton'

// Inline spinner — size: xs | sm | md | lg | xl
// variant: primary | accent | gain | loss | muted
<Spinner />
<Spinner size="sm" variant="gain" />

// Full-page loading overlay (route transitions, auth guards)
if (!ready) return <PageLoader />
if (loading) return <PageLoader minimal message="Fetching positions…" />

// Skeleton placeholders
<Skeleton.Text />
<Skeleton.Text lines={3} width="80%" />
<Skeleton.Card />
<Skeleton.TableRow columns={6} rows={8} showHeader />
<Skeleton.Avatar size={48} shape="square" withLabel />
```

All components are exported from `@/app/components/index.ts` for tree-shaking.

---

## 📡 API Reference

Base URL: `http://localhost:3001/api`

### Authentication

```
POST /auth/register   — Create account
POST /auth/login      — Get access + refresh tokens
POST /auth/refresh    — Rotate access token
GET  /auth/profile    — Get current user
```

### Market Data

```
GET /markets/instruments?type=stock&limit=20
GET /markets/price/:symbol
GET /markets/history/:symbol?interval=daily&start=...&end=...
GET /markets/movers?type=gainers&limit=10
```

### News & Sentiment

```
GET /news?limit=20&sort=published_at
GET /news/search?q=bitcoin&symbols=BTC,ETH
GET /news/sentiment/:symbol?period=7d
GET /news/impact?minScore=7.5
```

### Watchlist

```
GET    /watchlist
POST   /watchlist/:id/items
DELETE /watchlist/:id/items/:itemId
PUT    /watchlist/:id/items/:itemId/alerts
```

Full API documentation is available in [`/docs`](./docs/).

---

## 🚢 Deployment

### Frontend — Vercel

The frontend auto-deploys on push to `master` via Vercel's GitHub integration.

**Manual deploy:**
```bash
cd frontend
vercel --prod --yes
```

Configuration lives in `frontend/vercel.json`:
- Framework: Next.js
- Region: `iad1` (US East)
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`

### Backend — Railway

```bash
cd backend
# Railway auto-deploys from the backend/ directory
# See backend/railway.json for config
```

---

## 🧪 Running Tests

```bash
# Backend unit + integration tests
cd backend && npm test

# Frontend lint
cd frontend && npm run lint
```

New features follow **Test-Driven Development** — write failing tests first, then implement.

---

## 📈 Roadmap

### Q1 2026
- ✅ Real-time market data pipeline
- ✅ News aggregation + sentiment analysis
- ✅ Watchlist & price alerts
- ✅ System status page
- ✅ Public changelog
- ✅ Loading components & UX polish
- ✅ Keyboard shortcuts for power users
- 🔄 Calendar sync (Google / iCal)
- 🔄 Mobile app (React Native)

### Q2 2026
- Social sentiment dashboard
- Advanced chart pattern recognition
- Community idea sharing
- Portfolio tracking

### Q3 2026
- AI trading signals
- Portfolio backtesting
- Risk assessment tools
- Institutional API tier

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests first (TDD)
4. Commit with clear messages: `git commit -m 'feat: add my feature'`
5. Push and open a Pull Request

### Code Style
- ESLint + Prettier (config in repo root)
- TypeScript strict mode
- Conventional commits format

---

## 📚 Documentation

| Resource | Link |
|----------|------|
| Full docs | [`/docs`](./docs/) |
| API spec | [`/docs/api`](./docs/) |
| Changelog | [`/CHANGELOG.md`](./CHANGELOG.md) |
| Status page | https://chartgenius.io/status |
| Support | support@chartgenius.io |
| Discord | https://discord.gg/chartgenius |

---

## ⚖️ License

ChartGenius is proprietary software. All rights reserved. Unauthorized use, distribution, or modification is prohibited.

---

## ⚠️ Disclaimer

ChartGenius is for informational and educational purposes only. It is **not** financial advice. Always consult a qualified financial advisor before making investment decisions. Past performance does not guarantee future results.

---

**Made with ❤️ by [ApexLogics](https://apexlogics.dev)**

*Last updated: March 7, 2026*
