const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { generalLimiter } = require('./services/rateLimit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
app.use(generalLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/markets', require('./routes/markets'));        // Legacy mock routes (kept for compat)
app.use('/api/news', require('./routes/news'));              // Legacy mock news (kept for compat)
app.use('/api/watchlist', require('./routes/watchlist'));

// NEW: Data pipeline routes
app.use('/api/market-data', require('./routes/marketData'));      // Finnhub-backed real market data
app.use('/api/feed/news', require('./routes/aggregatedNews'));    // RSS + NewsAPI aggregated feed
app.use('/api/calendar', require('./routes/calendar'));           // Economic calendar
app.use('/api/waitlist', require('./routes/waitlist'));           // Landing page waitlist
app.use('/api/alerts', require('./routes/alerts'));               // Real-time market alerts + SSE
app.use('/api/crypto', require('./routes/crypto'));               // CoinGecko crypto prices & trending
app.use('/api/market-movers', require('./routes/marketMovers')); // High-impact news scanner
app.use('/api/stock-info', require('./routes/stockInfo'));         // Comprehensive stock info (Finnhub + Yahoo)

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'MarketPulse API'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 ChartGenius API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Market data:  http://localhost:${PORT}/api/market-data/batch`);
  console.log(`📰 News feed:    http://localhost:${PORT}/api/feed/news`);
  console.log(`📅 Calendar:     http://localhost:${PORT}/api/calendar/today`);
  console.log(`🚨 Alerts:       http://localhost:${PORT}/api/alerts`);
  console.log(`📡 Alert stream: http://localhost:${PORT}/api/alerts/live`);
  console.log(`₿  Crypto:       http://localhost:${PORT}/api/crypto/snapshot`);
  console.log(`🚨 Movers:       http://localhost:${PORT}/api/market-movers`);

  // Start real-time alert poll loop (every 5 minutes)
  const alertService = require('./services/alertService');
  alertService.startPolling(5 * 60 * 1000);
  
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