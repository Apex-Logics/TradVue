# TradVue System Architecture

**Last Updated:** March 6, 2026  
**Status:** Production (Vercel → Railway → Supabase)

---

## 1. High-Level Overview

TradVue is a **full-stack trading intelligence platform** that aggregates real-time market data, financial news, and economic events into actionable insights for traders.

### Technology Stack

| Component | Technology | Hosting |
|-----------|-----------|---------|
| **Frontend** | Next.js 14 (React 18) + TypeScript + TailwindCSS | Vercel |
| **Backend API** | Node.js/Express + PostgreSQL client | Railway |
| **Primary Database** | PostgreSQL 15+ (Supabase) | Supabase |
| **Cache/Real-Time** | Redis (planned for v2) | _(currently mock)_ |
| **External APIs** | Finnhub (quotes), RSS feeds, NewsAPI, Alpha Vantage | Third-party |
| **DNS & WAF** | Cloudflare | Cloudflare |
| **Auth** | JWT (access + refresh tokens) | In-database |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT BROWSER                             │
│                        (Next.js Frontend)                           │
│  - Landing page      - Dashboard       - Watchlist     - Settings   │
│  - Auth modal        - Market charts   - Alerts        - Onboarding │
└────────────────────┬────────────────────────────────────────────────┘
                     │ HTTPS via Cloudflare WAF
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│                   VERCEL (Frontend Deployment)                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Next.js App Router (/app)                                   │  │
│  │  - /landing                 (marketing page)                 │  │
│  │  - /dashboard               (main trading UI)                │  │
│  │  - /watchlist               (user's tracked assets)          │  │
│  │  - /alerts                  (notifications center)           │  │
│  │  - /settings                (user preferences)               │  │
│  │  - /legal/*                 (terms, privacy, disclaimer)     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  State Management (Zustand + React Context)                  │  │
│  │  - AuthContext              (JWT token, user profile)        │  │
│  │  - SettingsContext          (theme, preferences)             │  │
│  │  - OnboardingContext        (checklist state)                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  UI Components (Shadcn/ui + TailwindCSS)                     │  │
│  │  - Modals       - Charts (Recharts)  - Forms     - Tables    │  │
│  │  - Alerts       - Tooltips           - Panels    - Cards     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────────┘
                     │ API calls (HTTPS)
                     │ Environment: NEXT_PUBLIC_API_URL
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│               RAILWAY (Backend API Server)                          │
│                    Node.js/Express                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API Routes (/routes)                                        │  │
│  │  GET/POST  /api/auth                (register, login)        │  │
│  │  GET/POST  /api/watchlist           (CRUD watchlists)        │  │
│  │  GET       /api/market-data/batch   (stock/forex/crypto)     │  │
│  │  GET       /api/feed/news           (aggregated news)        │  │
│  │  GET       /api/calendar/today      (economic events)        │  │
│  │  SSE GET   /api/alerts/live         (real-time alerts)       │  │
│  │  GET       /api/health              (health check)           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Business Logic Services (/services)                         │  │
│  │  ├─ finnhub.js         → Real-time quotes + WebSocket        │  │
│  │  ├─ rssFeedAggregator  → RSS feed polling & parsing          │  │
│  │  ├─ alertService       → Price & news alert engine (SSE)     │  │
│  │  ├─ economicCalendar   → Economic events from multiple sources│ │
│  │  ├─ rateLimit.js       → Express rate-limit middleware       │  │
│  │  ├─ cache.js           → In-memory cache (planned: Redis)     │  │
│  │  └─ db.js              → PostgreSQL pool manager             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Middleware (/middleware)                                    │  │
│  │  - JWT authentication   - CORS headers     - Rate limiting   │  │
│  │  - Request logging      - Security headers - Error handling  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────────────────┐
    │                │                            │
    ▼                ▼                            ▼
┌─────────────┐ ┌──────────────┐  ┌───────────────────┐
│ SUPABASE    │ │ EXTERNAL      │  │ CLOUDFLARE        │
│ PostgreSQL  │ │ APIs          │  │ (DNS + DDoS)      │
│             │ │               │  │                   │
│ Tables:     │ │ • Finnhub     │  │ • Global CDN      │
│ - users     │ │ • NewsAPI     │  │ • WAF rules       │
│ - instruments
│ │ • RSS feeds   │  │ • SSL/TLS     │
│ - price_data│ │ • Alpha Vantage
│ │ • Analytics   │
│ - news_articles
│ │ • FRED API    │  │                   │
│ - watchlists│ │ • Twitter API │  │                   │
│ - alerts    │ │ • Reddit API  │  │                   │
│ - calendar  │ │               │  │                   │
│ - auth      │ │               │  │                   │
└─────────────┘ └──────────────┘  └───────────────────┘
```

---

## 3. Component Details

### 3.1 Frontend (Vercel)

**Framework:** Next.js 14 with App Router  
**Language:** TypeScript  
**Styling:** TailwindCSS + Shadcn/ui  
**Hosting:** Vercel (auto-deploy from git)

#### Pages & Routes

```
/app
├── /landing          → Marketing homepage (hero, features, CTA)
├── /dashboard        → Main trading interface
│   ├── market charts (Recharts)
│   ├── watchlist panel (live prices)
│   ├── news feed (scrollable)
│   └── calendar events (upcoming)
├── /watchlist        → User's tracked assets
│   ├── add/remove symbols
│   ├── set price alerts
│   └── alert history
├── /alerts           → Notification center
│   ├── new alerts (unread)
│   ├── history (read)
│   └── settings (email/push toggle)
├── /settings         → User preferences
│   ├── theme (light/dark)
│   ├── notification methods
│   └── data export
├── /auth             → Authentication
│   ├── register (modal)
│   ├── login (modal)
│   └── password reset
├── /legal
│   ├── /privacy
│   ├── /terms
│   └── /disclaimer
└── /layout.tsx       → Root layout (auth context, providers)
```

#### State Management

**AuthContext:**
```typescript
{
  user: {
    id: number,
    email: string,
    subscription_tier: 'free' | 'pro' | 'enterprise'
  },
  accessToken: string,
  refreshToken: string,
  isAuthenticated: boolean
}
```

**SettingsContext:**
```typescript
{
  theme: 'light' | 'dark',
  notifications: {
    email: boolean,
    push: boolean,
    inApp: boolean
  },
  dataRetention: 'auto' | 'manual'
}
```

**OnboardingContext:**
```typescript
{
  step: 'welcome' | 'setup' | 'watchlist' | 'alerts' | 'complete',
  checklist: {
    watchlistCreated: boolean,
    alertSet: boolean,
    profileComplete: boolean
  }
}
```

#### Components

- **WelcomeModal** - First-time user onboarding
- **OnboardingOverlay** - Step-by-step checklist
- **AuthModal** - Login/register UI
- **SettingsPanel** - User preferences
- **AlertSystem** - Toast notifications
- **EmptyState** - Fallback UI for empty data
- **Charts** - Recharts integration for price data

#### API Integration

```typescript
// app/lib/api.ts - Fetch wrapper with JWT handling
const api = {
  auth: {
    register(email, password),
    login(email, password),
    logout()
  },
  watchlist: {
    list(),
    add(symbol),
    remove(symbol),
    setAlert(symbol, threshold)
  },
  market: {
    getQuote(symbol),
    getHistorical(symbol, timeframe),
    getBatch(symbols)
  },
  news: {
    getFeed(filters),
    getBySymbol(symbol)
  },
  calendar: {
    getToday(),
    getMonth(date)
  },
  alerts: {
    subscribe() // SSE
  }
}
```

#### Build & Deployment

```bash
npm run build    # next build → .next/ directory
npm start        # next start → production server
vercel deploy    # Auto-deploy to Vercel
```

---

### 3.2 Backend (Railway)

**Framework:** Express.js  
**Language:** JavaScript (Node.js 18+)  
**Hosting:** Railway (auto-deploy from git)

#### Entrypoint

**`server.js`** - Initializes Express app, routes, middleware, and alert polling loop.

```javascript
// Middleware stack
app.use(helmet());        // Security headers
app.use(cors());          // Cross-origin requests
app.use(morgan('combined')); // Request logging
app.use(express.json());  // JSON parsing
app.use(generalLimiter);  // Global rate limiting
```

#### Routes

```
POST   /api/auth/register          → User signup
POST   /api/auth/login             → JWT token
POST   /api/auth/refresh           → Refresh token
GET    /api/auth/me                → User profile

GET    /api/market-data/batch      → Multi-symbol quotes
GET    /api/market-data/quote/:symbol
GET    /api/market-data/historical/:symbol

GET    /api/feed/news              → Aggregated articles
GET    /api/feed/news/:symbol      → Symbol-specific news

GET    /api/watchlist              → User's watchlist
POST   /api/watchlist              → Add to watchlist
DELETE /api/watchlist/:id          → Remove from watchlist
PUT    /api/watchlist/:id          → Update alert thresholds

GET    /api/calendar/today         → Today's economic events
GET    /api/calendar/month         → Monthly calendar

SSE GET /api/alerts/live           → Real-time alert stream

POST   /api/waitlist               → Landing page email signup

GET    /health                     → Health check (always OK)
```

#### Services

**`finnhub.js`** - Real-time market data  
- WebSocket subscriptions for live quotes
- Fallback to Alpha Vantage (5 min delay)
- Mock data for development
- Free tier: 60 API calls/min

**`rssFeedAggregator.js`** - News aggregation  
- RSS feed polling (Reuters, CNBC, MarketWatch, etc.)
- NewsAPI integration (optional paid)
- Deduplication by URL/title
- Cached for 10 minutes

**`alertService.js`** - Real-time alert engine  
- Polls watchlists every 5 minutes
- Checks price thresholds
- Monitors news for high-impact articles
- Broadcasts alerts to SSE clients
- Persists alerts to DB

**`economicCalendar.js`** - Economic events  
- FRED API integration (free, no rate limits)
- Economic indicators (CPI, NFP, GDP, etc.)
- Event impact scores (Low/Medium/High)
- Cached hourly

**`db.js`** - PostgreSQL connection pool  
```javascript
const pool = new (require('pg')).Pool({
  connectionString: process.env.DATABASE_URL
});
```

**`cache.js`** - In-memory cache (planned: Redis)  
- TTL support
- Key expiration
- Cache invalidation on data updates

**`rateLimit.js`** - Rate limiting middleware  
- Tier-based limits (free: 100 req/15min, pro: 1000, enterprise: 5000)
- Per-user or per-IP tracking
- Returns 429 when exceeded

#### Middleware

**Authentication (`middleware/auth.js`)**
```javascript
// Validates JWT in Authorization header
// Extracts user from token, attaches to req.user
```

**Error Handler**
```javascript
// Catches all errors, returns JSON error response
// Development: includes error message
// Production: generic "Internal Server Error"
```

#### Testing

```bash
npm test              # Jest test runner
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Test structure: `tests/**/*.test.js`

---

### 3.3 Database (Supabase PostgreSQL)

**Engine:** PostgreSQL 15+  
**Hosting:** Supabase (AWS-backed, managed)  
**Connection:** Transaction mode (port 6543) for serverless/Railway compatibility

#### Schema Overview

```sql
-- Users & Authentication
users
  ├─ id (PK)
  ├─ email (UNIQUE)
  ├─ password_hash
  ├─ subscription_tier (free/pro/enterprise)
  ├─ verified (boolean)
  ├─ created_at, updated_at (TIMESTAMPTZ)
  
refresh_tokens
  ├─ id (PK)
  ├─ user_id (FK → users)
  ├─ token (UNIQUE)
  ├─ expires_at

-- Market Instruments
instruments
  ├─ id (PK)
  ├─ symbol (UNIQUE)
  ├─ name
  ├─ type (forex/crypto/stock/commodity/index)
  ├─ exchange
  ├─ currency (default: USD)
  ├─ active (boolean)

-- Price Data (time-series)
price_data
  ├─ id (BIGSERIAL PK)
  ├─ instrument_id (FK)
  ├─ price, open, high, low, close, volume
  ├─ resolution (1/5/15/30/60/D/W)
  ├─ timestamp (TIMESTAMPTZ)
  ├─ source (Finnhub/Alpha Vantage/etc)
  ├─ Indexes: (instrument_id, timestamp DESC), (timestamp DESC)
  ├─ Future: Partition by month for > 1 year data

-- News Articles
news_articles
  ├─ id (BIGSERIAL PK)
  ├─ external_id (UNIQUE, for dedup)
  ├─ title, summary, content
  ├─ url
  ├─ source (NewsAPI/Reuters/CNBC/etc)
  ├─ category, image_url
  ├─ impact_score (0-10, AI/keyword ranked)
  ├─ sentiment_score (-1.0 to 1.0)
  ├─ sentiment_label (bullish/bearish/neutral)
  ├─ tags (TEXT[])
  ├─ symbols (VARCHAR[30][], e.g., {AAPL, NVDA})
  ├─ published_at, fetched_at
  ├─ Indexes: (published_at DESC), (impact_score DESC), GIN (symbols), GIN (tags)
  ├─ Full-text search on title + summary

-- Economic Calendar
calendar_events
  ├─ id (BIGSERIAL PK)
  ├─ external_id (UNIQUE)
  ├─ title, currency
  ├─ impact (1/2/3 = Low/Medium/High)
  ├─ event_time, actual, forecast, previous
  ├─ description, source, url
  ├─ Indexes: (event_time), (currency), (impact)

-- User Watchlists
watchlists
  ├─ id (PK)
  ├─ user_id (FK)
  ├─ instrument_id (FK)
  ├─ alert_threshold_up (price alert above)
  ├─ alert_threshold_down (price alert below)
  ├─ notes
  ├─ UNIQUE (user_id, instrument_id)
  ├─ Index: (user_id)

-- Alert Notifications Log
alert_notifications
  ├─ id (PK)
  ├─ user_id (FK)
  ├─ watchlist_id (FK)
  ├─ alert_type (price_up/price_down/news/calendar)
  ├─ message, delivered
  ├─ delivery_method (email/push/in_app)
  ├─ created_at
  ├─ Index: (user_id, delivered)

-- Triggers
update_updated_at()
  └─ Auto-updates `updated_at` on users, calendar_events
```

#### Query Patterns

```sql
-- Get user's watchlist with latest prices
SELECT 
  w.id, i.symbol, i.name, i.type,
  pd.price, pd.high, pd.low, pd.close,
  w.alert_threshold_up, w.alert_threshold_down
FROM watchlists w
JOIN instruments i ON w.instrument_id = i.id
LEFT JOIN LATERAL (
  SELECT price, high, low, close, timestamp
  FROM price_data
  WHERE instrument_id = i.id
  ORDER BY timestamp DESC
  LIMIT 1
) pd ON TRUE
WHERE w.user_id = $1
ORDER BY i.symbol;

-- Get high-impact news articles
SELECT * FROM news_articles
WHERE published_at > NOW() - INTERVAL '7 days'
  AND impact_score > 7.0
ORDER BY published_at DESC
LIMIT 20;

-- Find news for specific symbols
SELECT * FROM news_articles
WHERE symbols @> ARRAY['AAPL', 'NVDA']::VARCHAR[]
ORDER BY published_at DESC;
```

#### Connection Configuration

**Development (local):**
```
postgresql://postgres:password@localhost:5432/tradvue
```

**Production (Railway):**
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

⚠️ **Important:** Use port **6543** (transaction mode) not 5432 (direct) for Railway/serverless compatibility.

---

## 4. Data Flow

### 4.1 User Authentication Flow

```
Frontend                      Backend                  Database
─────────                     ──────                   ────────

1. User clicks Register/Login
   ↓
2. Opens AuthModal (email + password)
   │
   ├─POST /api/auth/register
   │  {email, password}         ─→  Hash password (bcryptjs)
   │                               ├─ Check email not exists
   │                               ├─ Insert into users table
   │  ←─ JWT + refreshToken    ←─  Generate tokens
   │
3. Stores tokens in localStorage
   │
4. AuthContext updated
   │
5. Auto-redirect to /dashboard

[Refresh Token Flow]
─────────────────
When JWT expires:
- POST /api/auth/refresh {refreshToken}
- Backend validates refresh_tokens table
- Issues new JWT (valid 24h)
- Frontend uses new token for next requests
```

### 4.2 Real-Time Market Data Flow

```
Frontend                Backend                   External API           Database
─────────               ───────                   ────────────           ────────

[User views dashboard]
         │
         ├─GET /api/market-data/batch?symbols=AAPL,GOOGL,BTC/USD
         │                                         │
         │                     [finnhub.js]        │
         │                     ├─ Check cache      │
         │                     ├─ If stale: call Finnhub WS
         │                     │                   ├─→ Real-time quotes
         │                     │  ←─────────────────
         │                     ├─ Update cache (TTL: 5s)
         │                     ├─ Optionally: INSERT price_data
         │  ←──────────────────
         │
    Display live prices
    with % change + color coding

[WebSocket Subscription (planned)]
────────────────────────────────
GET /api/market-data/subscribe?symbols=AAPL
         │
         ├─ Opens WS to /ws/quotes
         │
         ├─→ Server connects to Finnhub WebSocket
         │   (aggregates subscriptions)
         │
         ├─ Streams live ticks in real-time
    ←───┤
    Update chart data every tick
```

### 4.3 News Aggregation Flow

```
Frontend              Backend                  External Services
─────────             ───────                  ──────────────────

[1] RSS Feed Polling (every 5 minutes)
    
    [alertService.js] ──→ [rssFeedAggregator.js]
    
    ├─ Poll Reuters, CNBC, MarketWatch, etc.
    ├─ Parse RSS XML, extract articles
    ├─ Dedup by URL/title + external_id
    │
    ├─ For each new article:
    │   ├─ Score keywords (see alertService.js)
    │   ├─ Classify (POLITICAL, FED, ECONOMIC, EARNINGS, BREAKING)
    │   ├─ Extract symbol references (AAPL, BTC/USD, etc.)
    │   ├─ Sentiment analysis (TextBlob or ML model)
    │   ├─ Impact score (0-10)
    │   └─ INSERT into news_articles
    │
    └─ Broadcast HIGH urgency alerts to SSE clients

[2] User requests news
    
    GET /api/feed/news?symbols=AAPL
         │
         ├─ Query news_articles WHERE symbols @> {AAPL}
         │ ORDER BY published_at DESC
         │
    ←───┤ Return top 20 articles with scores
         │
    Display in news panel with sentiment color
```

### 4.4 Price Alert Processing Flow

```
Frontend                Backend                Database
─────────               ───────                ────────

[1] User sets alert
    
    PUT /api/watchlist/123
    {alert_threshold_up: 185, alert_threshold_down: 175}
         │
         ├─ Validate thresholds
         ├─ UPDATE watchlists table
    ←───┤ 200 OK

[2] Backend polling (every 5 minutes)
    
    [alertService.js]
    
    ├─ Query all watchlists with thresholds
    ├─ GET current price from Finnhub
    ├─ Check if price > threshold_up or < threshold_down
    │
    ├─ If triggered:
    │   ├─ INSERT into alert_notifications
    │   ├─ Send email (via SendGrid) or push (FCM)
    │   ├─ Broadcast to SSE stream
    │
    └─ Alert marked as delivered = true

[3] Frontend receives alert via SSE
    
    GET /api/alerts/live
         │
         ├─ Server sends: event: alert, data: {symbol, type, price}
         │
    ←────┤
    AlertSystem toast notification
    (user sees: "AAPL above $185!")
```

### 4.5 Economic Calendar Flow

```
Frontend              Backend                  External API
─────────             ───────                  ────────────

[1] Daily sync (at midnight UTC)
    
    [economicCalendar.js]
    
    ├─ Call FRED API for economic indicators
    ├─ Call other calendar sources (Investing.com, etc.)
    ├─ For each event:
    │   ├─ external_id dedup check
    │   ├─ INSERT into calendar_events
    │   └─ If impact >= 2: queue notification
    │
    └─ Cache result (TTL: 24h)

[2] User requests calendar
    
    GET /api/calendar/today
         │
         ├─ Query calendar_events WHERE event_time >= today
         │ ORDER BY event_time
         │
    ←───┤ Return upcoming events
         │
    Display in calendar widget with impact badges
    (RED for high impact, etc.)
```

---

## 5. Infrastructure

### 5.1 Hosting Platforms

| Layer | Service | Region | Notes |
|-------|---------|--------|-------|
| **Frontend** | Vercel | iad1 (N. Virginia) | Auto-deploy from git, CDN, edge functions |
| **Backend** | Railway | US (auto-select) | Node.js service, auto-scaling, webhook deploys |
| **Database** | Supabase | AWS (us-east-1) | Transaction pooler on port 6543 for serverless |
| **DNS/WAF** | Cloudflare | Global | DDoS protection, SSL/TLS, caching |

### 5.2 Environment Variables

#### Frontend (Vercel)

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://tradvue-production.up.railway.app
```

#### Backend (Railway)

```bash
# Critical (must be set in Railway dashboard)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
JWT_SECRET=<random 256-bit: openssl rand -hex 32>
NODE_ENV=production

# API Keys
FINNHUB_API_KEY=<from https://finnhub.io>
ALPHA_VANTAGE_API_KEY=<from alphavantage.co> (optional)
NEWS_API_KEY=<from newsapi.org> (optional)
FRED_API_KEY=<from fred.stlouisfed.org> (optional)

# Auth
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# Rate Limiting
RATE_LIMIT_WINDOW=15       # minutes
RATE_LIMIT_FREE=100        # requests per window
RATE_LIMIT_PRO=1000
RATE_LIMIT_ENTERPRISE=5000
```

### 5.3 Deployment Checklist

**Frontend (Vercel):**
1. ✅ Connect GitHub repo
2. ✅ Set `NEXT_PUBLIC_API_URL` in Vercel dashboard
3. ✅ Auto-deploy on push to `main` branch
4. ✅ Check build logs for errors

**Backend (Railway):**
1. ✅ Add to Railway project
2. ✅ Set all env vars in Railway → Variables tab (see table above)
3. ✅ Verify `railway.json` is committed
4. ✅ Trigger redeploy
5. ✅ Test: `GET https://your-app.railway.app/health`
6. ✅ Test auth: `POST /api/auth/register` with test email
7. ✅ Check Railway logs for DB connection errors

**Database (Supabase):**
1. ✅ Create new Postgres project
2. ✅ Run `schema.sql` in SQL editor
3. ✅ Verify tables created
4. ✅ Get connection string (Transaction mode, port 6543)
5. ✅ Add to Railway env vars as `DATABASE_URL`

### 5.4 Monitoring & Health Checks

**Frontend:**
- Vercel Analytics (performance, Core Web Vitals)
- Sentry (error tracking) — planned

**Backend:**
- `GET /health` endpoint returns `{ status: "OK", timestamp, service: "TradVue API" }`
- Railway logs (stderr, stdout)
- Database connection status logged on startup

**Database:**
- Supabase monitoring (slow queries, storage)
- Connection pool stats (active connections, idle)

### 5.5 Backups

**Database:**
- Supabase automated daily backups (free tier: 7 days retention)
- Manual backups via `pg_dump` before major migrations
- Local backup script: `scripts/backup-db.sh` (planned)

**Frontend:**
- Vercel git history (unlimited)
- No backup needed (static assets, code in git)

**Backend:**
- Railway automatic backups (deployment history)
- Environment variables backed up in Railway dashboard
- Code in git, deployments immutable

---

## 6. Scaling Considerations

### 6.1 Current Bottlenecks

| Issue | Impact | When to Fix | Solution |
|-------|--------|-------------|----------|
| In-memory cache | Restart = lost cache | 10+ concurrent users | Add Redis |
| No WebSocket real-time | SSE polling based | Heavy trading volume | WebSocket upgrade |
| Single DB instance | No read replicas | 1000+ concurrent users | Supabase read replica |
| Price data inserts | Bulk writes slow | High-frequency data | TimescaleDB partitioning |
| News dedup in-memory | Memory leak risk | 10k+ articles/day | Move to DB |

### 6.2 Scaling Steps

**Phase 1 (Current):** ~100 concurrent users
- Single Vercel instance (auto-scales)
- Single Railway instance
- Single Supabase database (max connections: 100)
- In-memory cache + SSE streaming

**Phase 2 (When needed):** ~1k concurrent users
- ✅ Multiple Railway instances (load balancer)
- ✅ Redis cache layer (5-10 GB)
- ✅ Database connection pooling (PgBouncer)
- ✅ Price data partitioning (TimescaleDB)

**Phase 3 (Enterprise):** 10k+ concurrent users
- ✅ WebSocket server (Socket.io + Redis adapter)
- ✅ Database read replicas (hot standby)
- ✅ Message queue (Bull/BullMQ) for async jobs
- ✅ CDN caching for static news/calendar
- ✅ Elasticsearch for full-text search

### 6.3 Redis Integration (Planned)

```javascript
// services/cache.js → Redis backend
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL // e.g., redis://localhost:6379
});

// Cache patterns
await client.setEx(`quote:${symbol}`, 5, JSON.stringify(price)); // 5s TTL
await client.setEx(`news:${timestamp}`, 600, JSON.stringify(articles)); // 10min
```

### 6.4 Database Scaling

**Current schema:** Traditional rows + indexes  
**Bottleneck:** `price_data` table grows 10k+ rows/day

**Solution:** TimescaleDB (PostgreSQL extension)
```sql
SELECT create_hypertable('price_data', 'timestamp');
-- Auto-partitions by time, efficient compression
-- Dramatically faster range queries
```

---

## 7. Architecture Decision Records

### ADR-001: Next.js for Frontend

**Decision:** Use Next.js 14 (App Router) instead of bare React  
**Rationale:**
- Server-side rendering (SEO, performance)
- Built-in image optimization
- Edge middleware for auth
- Vercel native integration
- Incremental static regeneration for news

### ADR-002: Express.js for Backend

**Decision:** Minimal Express instead of NestJS/Fastify  
**Rationale:**
- Lightweight, fast
- Familiar to Node.js teams
- Sufficient for current scale
- Easy to swap out later

### ADR-003: PostgreSQL + Supabase

**Decision:** Managed PostgreSQL instead of Firebase/DynamoDB  
**Rationale:**
- Relational schema fits data model
- Full-text search (native)
- Rich indexing (GIN, BRIN)
- ACID guarantees for watchlists
- Supabase handles auth, real-time (future)

### ADR-004: JWT Tokens + Refresh

**Decision:** JWT access + database refresh tokens  
**Rationale:**
- Stateless, scales horizontally
- No session storage needed
- Refresh token revocation possible (check DB)
- Standard OAuth 2.0 pattern

---

## 8. Local Development Setup

### 8.1 Prerequisites

```bash
Node.js 18+
PostgreSQL 15+ (or use Supabase for testing)
Redis (optional, for caching)
npm or yarn
```

### 8.2 Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:3001

npm run dev        # Runs on http://localhost:3000
npm run build      # Build for production
npm run lint       # Check for errors
```

### 8.3 Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env:
#   DB_HOST=localhost, DB_NAME=tradvue, etc.
#   FINNHUB_API_KEY=your_key
#   JWT_SECRET=dev_secret_123

npm run dev        # Nodemon, runs on http://localhost:3001
npm test           # Jest tests
npm run test:watch # Watch mode
```

### 8.4 Database Setup (Local PostgreSQL)

```bash
# Create database
createdb tradvue

# Run schema
psql -U postgres -d tradvue -f database/schema.sql

# Seed instruments
psql -U postgres -d tradvue -c "INSERT INTO instruments ..."
```

Or use Supabase cloud for dev:
```bash
# Get connection string from Supabase dashboard
psql postgresql://postgres:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres < database/schema.sql
```

### 8.5 Testing

```bash
# Backend unit tests
cd backend
npm test

# Frontend component tests
cd frontend
npm test

# API integration (manual)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

---

## 9. Common Tasks

### Deploy Frontend to Vercel

```bash
git push origin main
# Vercel auto-detects, builds, deploys
# Check: https://vercel.com/dashboard
```

### Deploy Backend to Railway

```bash
git push origin main
# Railway webhook auto-triggers
# Check: Railway dashboard → Deployments
```

### Add New API Endpoint

```javascript
// 1. Create route handler in backend/routes/
// routes/myfeature.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  res.json({ message: 'Hello from myfeature' });
});

module.exports = router;

// 2. Register in server.js
app.use('/api/myfeature', require('./routes/myfeature'));

// 3. Call from frontend
// app/lib/api.ts
myfeature: {
  getInfo: () => fetch(`${API_URL}/api/myfeature`)
}
```

### Add New Database Table

```sql
-- 1. Create table in database/schema.sql
CREATE TABLE my_table (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add indexes
CREATE INDEX idx_my_table_user ON my_table (user_id);

-- 3. Run migration
psql -d tradvue -f database/schema.sql

-- 4. Update Node DB queries
const db = require('./db');
const result = await db.query(
  'SELECT * FROM my_table WHERE user_id = $1',
  [userId]
);
```

---

## 10. Troubleshooting

### Frontend Can't Reach Backend

**Symptom:** Network errors in browser console  
**Cause:** `NEXT_PUBLIC_API_URL` mismatch  
**Fix:**
```bash
# Check frontend .env.local
NEXT_PUBLIC_API_URL=https://your-railway-url.railway.app  # Production
NEXT_PUBLIC_API_URL=http://localhost:3001                  # Local dev
```

### Backend Database Connection Fails

**Symptom:** `[DB] ❌ PostgreSQL connection failed`  
**Cause:** Bad `DATABASE_URL`  
**Fix:**
```bash
# Check Railway env vars
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
#                                                                                      ^^^^
#                                                                              Port 6543 (not 5432)
```

### Authentication Returns 500

**Symptom:** POST /api/auth/register → 500 Internal Server Error  
**Cause:** Database connection not working  
**Fix:**
1. Check DATABASE_URL in Railway vars
2. Verify Supabase connection string is correct
3. Check Railway logs for DB errors
4. Test with: `GET /health` (should return OK)

### News Feed Not Updating

**Symptom:** Articles are stale  
**Cause:** RSS aggregator not polling  
**Fix:**
1. Check `services/alertService.js` startPolling interval
2. Verify RSS feed URLs are valid
3. Check Railway logs for fetch errors
4. Manual test: `GET /api/feed/news`

---

## 11. Resources & Links

- **Frontend Docs:** https://nextjs.org
- **Backend Docs:** https://expressjs.com
- **Database:** https://supabase.com/docs
- **Hosting:**
  - Vercel: https://vercel.com/docs
  - Railway: https://railway.app/docs
- **APIs:**
  - Finnhub: https://finnhub.io/docs/api
  - NewsAPI: https://newsapi.org
  - FRED: https://fred.stlouisfed.org/docs/api
  - Alpha Vantage: https://www.alphavantage.co
- **Auth:** https://jwt.io
- **Monitoring:** Sentry (planned)

---

## 12. Team Roles & Responsibilities

| Role | Focus | Repos |
|------|-------|-------|
| **Frontend Dev** | React, Next.js, UI | `/frontend` |
| **Backend Dev** | Express, APIs, services | `/backend` |
| **DevOps** | Hosting, scaling, monitoring | Railway, Vercel, Supabase config |
| **Data** | SQL, schema design, scaling | `/database`, schema.sql |

---

## Appendix: File Structure

```
tradvue/
├── frontend/                 # Next.js app
│   ├── app/
│   │   ├── layout.tsx        # Root layout
│   │   ├── landing/          # Marketing page
│   │   ├── dashboard/        # Main app
│   │   ├── watchlist/        # User watchlist
│   │   ├── alerts/           # Notifications
│   │   ├── settings/         # Preferences
│   │   ├── auth/             # Auth modals
│   │   ├── legal/            # Privacy, terms
│   │   ├── context/          # Auth, Settings, Onboarding contexts
│   │   ├── components/       # Shared React components
│   │   └── lib/
│   │       └── api.ts        # API client
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── vercel.json           # Vercel config
│   └── .env.example
│
├── backend/                  # Express.js API
│   ├── server.js             # Entry point
│   ├── routes/               # API endpoints
│   │   ├── auth.js           # Login, register
│   │   ├── watchlist.js      # Watchlist CRUD
│   │   ├── marketData.js     # Real-time quotes
│   │   ├── aggregatedNews.js # News feed
│   │   ├── alerts.js         # Alert stream (SSE)
│   │   ├── calendar.js       # Economic events
│   │   └── waitlist.js       # Email signup
│   ├── services/             # Business logic
│   │   ├── finnhub.js        # Market data
│   │   ├── rssFeedAggregator.js # News
│   │   ├── alertService.js   # Alert engine
│   │   ├── economicCalendar.js  # Events
│   │   ├── db.js             # PostgreSQL pool
│   │   ├── cache.js          # In-memory (→ Redis)
│   │   └── rateLimit.js      # Rate limiting
│   ├── middleware/           # Express middleware
│   │   └── auth.js           # JWT validation
│   ├── tests/                # Jest unit tests
│   ├── package.json
│   ├── .env.example
│   ├── railway.json          # Railway config
│   └── DEPLOYMENT_CHECKLIST.md
│
├── database/                 # Schema & migrations
│   ├── schema.sql            # Full DDL
│   └── migrations/           # (future)
│
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md       # This file
│   ├── API.md                # API reference (WIP)
│   └── DEPLOYMENT.md         # Hosting guide (WIP)
│
├── README.md                 # Project overview
└── .gitignore
```

---

**Last Updated:** March 6, 2026  
**Next Review:** When scaling beyond 1k concurrent users

---

_This document is the single source of truth for TradVue architecture. Update it when making structural changes._
