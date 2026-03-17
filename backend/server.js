// Force IPv4 DNS resolution (Railway + Supabase IPv6 issue)
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Prevent unhandled rejections from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled rejection (non-fatal):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err.message);
  // Only exit on truly fatal errors, not DB connection issues
  if (err.message?.includes('EADDRINUSE') || err.message?.includes('FATAL')) {
    process.exit(1);
  }
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { generalLimiter } = require('./services/rateLimit');
require('dotenv').config();

// ── Startup safety checks ────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security: hide framework fingerprint ─────────────────────────────────────
app.disable('x-powered-by');

// ── Security headers (Helmet) ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://tradvue-api.onrender.com"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ── CORS — locked to known origins ───────────────────────────────────────────
const allowedOrigins = [
  'https://www.tradvue.com',
  'https://tradvue.com',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
}
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Response compression (gzip/deflate) — cuts response sizes 60-80% ─────────
app.use(compression());

// ── Request logging ───────────────────────────────────────────────────────────
app.use(morgan('combined'));

// ── Stripe webhook — MUST be registered BEFORE the JSON body parser ───────────
// Stripe needs the raw request body to verify the webhook signature.
// We mount this as a concrete path (not via router) so it bypasses json middleware.
try {
  const stripeRouter = require('./routes/stripe');
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
      // Delegate to the /webhook sub-route of the stripe router
      req.url = '/webhook';
      stripeRouter(req, res, next);
    }
  );
  console.log('[Stripe] Webhook endpoint registered at /api/stripe/webhook');
} catch (e) {
  console.warn('[Stripe] Webhook route failed to load:', e.message);
}

// ── Body parsing with size limit ──────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// ── Global rate limiting ──────────────────────────────────────────────────────
app.use(generalLimiter);

// ── Cache-control middleware helpers ─────────────────────────────────────────
// Applied per route group so each gets the right browser cache duration.
const cachePublic30s  = (_, res, next) => { res.set('Cache-Control', 'public, max-age=30');   next(); };
const cachePublic2m   = (_, res, next) => { res.set('Cache-Control', 'public, max-age=120');  next(); };
const cachePublic1h   = (_, res, next) => { res.set('Cache-Control', 'public, max-age=3600'); next(); };
const cachePrivate    = (_, res, next) => { res.set('Cache-Control', 'private, no-cache');    next(); };

// ── Routes ────────────────────────────────────────────────────────────────────
// Auth routes — wrapped in try/catch so missing Supabase deps don't crash the whole server
try {
  app.use('/api/auth',     cachePrivate, require('./routes/auth'));
  app.use('/api/user',     cachePrivate, require('./routes/userData'));
  app.use('/api/user',     cachePrivate, require('./routes/userManagement'));
} catch (e) {
  console.warn('[auth] Auth routes failed to load:', e.message);
  // Fallback: register a stub so users get a clear 503 instead of 404
  app.use('/api/auth', (req, res) => res.status(503).json({ error: 'Authentication service is not available yet. Coming soon!' }));
  app.use('/api/user', (req, res) => res.status(503).json({ error: 'Authentication service is not available yet. Coming soon!' }));
}
app.use('/api/markets',    cachePublic30s, require('./routes/markets'));   // Legacy mock routes (kept for compat)
app.use('/api/news',       cachePublic2m,  require('./routes/news'));      // Legacy mock news (kept for compat)
app.use('/api/watchlist',  cachePrivate, require('./routes/watchlist'));

// NEW: Data pipeline routes
// Note: marketData.js sets its own per-endpoint Cache-Control headers (more granular),
// so we don't add a blanket middleware here.
app.use('/api/market-data',   require('./routes/marketData'));      // Finnhub-backed real market data
app.use('/api/feed/news',     cachePublic2m,  require('./routes/aggregatedNews')); // RSS + NewsAPI aggregated feed
app.use('/api/calendar',      cachePublic2m,  require('./routes/calendar'));        // Economic calendar (2m to avoid stale date issues)
app.use('/api/waitlist',      cachePrivate,   require('./routes/waitlist'));        // Landing page waitlist
app.use('/api/alerts',        cachePrivate,   require('./routes/alerts'));          // Real-time market alerts + SSE
app.use('/api/crypto',        cachePublic30s, require('./routes/crypto'));          // CoinGecko crypto prices & trending
app.use('/api/market-movers', cachePublic2m,  require('./routes/marketMovers'));   // High-impact news scanner
app.use('/api/stock-info',    cachePublic30s, require('./routes/stockInfo'));       // Comprehensive stock info (Finnhub + Yahoo)
app.use('/api/portfolio',     cachePrivate,   require('./routes/portfolio'));       // Portfolio persistence (Supabase)
app.use('/api/alerts/price',  cachePrivate,   require('./routes/priceAlerts'));    // User price alerts
app.use('/api/tools',         cachePublic2m,  require('./routes/tools'));           // Trading tools (screener, fear-greed, gas, correlation)
app.use('/api/dashboard',     cachePrivate,   require('./routes/dashboard'));       // CEO dashboard persistence
app.use('/api/stocks',        cachePublic1h,  require('./routes/stocks'));          // Analyst ratings + stock scoring
app.use('/api/sentiment',     cachePublic1h,  require('./routes/sentiment'));       // Marketaux sentiment by ticker
app.use('/api/journal',       cachePrivate,   require('./routes/journal'));         // Journal CSV import & trade management
app.use('/api/backup',        cachePrivate,   require('./routes/backup'));          // Data export/backup/restore
app.use('/api/feedback',                      require('./routes/feedback'));        // User feedback & bug reports
app.use('/api/support',                       require('./routes/support'));          // AI support chatbot
app.use('/api/admin',         cachePrivate,   require('./routes/admin'));            // Admin dashboard (allowlisted only)
app.use('/api/announcements', cachePublic30s, require('./routes/announcements'));   // Public announcement banner
app.use('/api/stripe',        cachePrivate,   require('./routes/stripe'));           // Stripe payment integration
app.use('/api/push',          cachePrivate,   require('./routes/push'));             // PWA push notification subscriptions
// Market Intelligence routes (public — no auth required)
app.use('/api',               require('./routes/marketIntel'));         // FRED, SEC EDGAR, earnings/IPO calendars

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'TradVue API',
    build: '2026-03-12-v4-supabase-rest'
  });
});

// ── Error handling middleware ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 TradVue API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Market data:  http://localhost:${PORT}/api/market-data/batch`);
  console.log(`📰 News feed:    http://localhost:${PORT}/api/feed/news`);
  console.log(`📅 Calendar:     http://localhost:${PORT}/api/calendar/today`);
  console.log(`🚨 Alerts:       http://localhost:${PORT}/api/alerts`);
  console.log(`📡 Alert stream: http://localhost:${PORT}/api/alerts/live`);
  console.log(`₿  Crypto:       http://localhost:${PORT}/api/crypto/snapshot`);
  console.log(`🚨 Movers:       http://localhost:${PORT}/api/market-movers`);
  console.log(`🔔 Push:         http://localhost:${PORT}/api/push/vapid-public-key`);

  // Start push notification scheduler (fires at 4:05 PM ET on market days)
  try {
    const { startScheduler } = require('./services/notificationScheduler');
    startScheduler();
  } catch (err) {
    console.warn('[Server] Notification scheduler failed to start:', err.message);
  }

  // Delay DB-dependent background tasks by 5s to let healthcheck pass first.
  // By the time the first real user hits the site the data prefetcher will have
  // already warmed the cache, so they get sub-50ms responses instead of cold API calls.
  setTimeout(() => {
    console.log('[Startup] Initializing background services...');

    // ── Data prefetcher: warms cache for quotes, crypto, news, movers, etc. ──
    try {
      const dataPrefetcher = require('./services/dataPrefetcher');
      dataPrefetcher.start();
    } catch (err) {
      console.error('[Startup] Data prefetcher failed to start:', err.message);
    }

    // Start real-time alert poll loop (every 5 minutes)
    try {
      const alertService = require('./services/alertService');
      alertService.startPolling(5 * 60 * 1000);
    } catch (err) {
      console.error('[Startup] Alert service failed to start:', err.message);
    }

    // Start market price-move alert monitor (every 30 seconds)
    try {
      const marketAlerts = require('./services/marketAlerts');
      marketAlerts.start();
    } catch (err) {
      console.error('[Startup] Market alerts monitor failed to start:', err.message);
    }

    // Check user price alerts every 5 minutes
    try {
      const { checkAndTriggerAlerts } = require('./routes/priceAlerts');
      setInterval(async () => {
        try { await checkAndTriggerAlerts(); } catch {}
      }, 5 * 60 * 1000);
    } catch (err) {
      console.error('[Startup] Price alerts failed to start:', err.message);
    }
  }, 5000);

  // ── Keep-alive: ping ourselves every 10 minutes to prevent Render spin-down ──
  if (process.env.RENDER_EXTERNAL_URL || process.env.RENDER) {
    const KEEP_ALIVE_MS = 10 * 60 * 1000; // 10 minutes
    const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(() => {
      require('http').get(`${selfUrl}/health`, () => {}).on('error', () => {});
    }, KEEP_ALIVE_MS);
    console.log(`[Startup] Keep-alive ping every 10m → ${selfUrl}/health`);
  }
  
  // Start market mover scanner (every 10 minutes)
  const marketMoverBot = require('./services/marketMoverBot');
  setInterval(async () => {
    try {
      const result = await marketMoverBot.scan({ impactThreshold: 7, maxAge: 15 });
      if (result.found > 0) {
        console.log(`[MarketMover] Found ${result.found} high-impact items`);
        result.articles.forEach(a => {
          console.log(`  ${a.impactLabel}: ${a.title.slice(0, 60)}...`);
        });
      }
    } catch (err) {
      console.error('[MarketMover] Scan error:', err.message);
    }
  }, 10 * 60 * 1000);  // Every 10 minutes
  
  // Initial scan on startup
  setTimeout(async () => {
    const marketMoverBot = require('./services/marketMoverBot');
    const result = await marketMoverBot.scan({ impactThreshold: 6, maxAge: 60 });
    console.log(`[MarketMover] Initial scan: ${result.found} market movers found`);
  }, 5000);
});
