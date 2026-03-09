# TradVue - Technical Specification

## Architecture Overview

```
Frontend (React/Next.js) 
    ↓
API Gateway (Node.js/Express)
    ↓
Database Layer (PostgreSQL + Redis)
    ↓
External Data Sources (APIs + Web Scraping)
```

## Backend API Structure

### Core Services
1. **Authentication Service** - User management, JWT tokens, subscription tiers
2. **Market Data Service** - Real-time price feeds, historical data  
3. **News Aggregation Service** - Multi-source news collection + AI processing
4. **Social Sentiment Service** - Social media analysis and scoring
5. **Watchlist Service** - User portfolio tracking and alerts
6. **Notification Service** - Email, push, and in-app notifications

### Database Schema (PostgreSQL)

```sql
-- Users and subscriptions
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Market instruments  
CREATE TABLE instruments (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'forex', 'crypto', 'stock', 'commodity'
    exchange VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Price data
CREATE TABLE price_data (
    id SERIAL PRIMARY KEY,
    instrument_id INTEGER REFERENCES instruments(id),
    price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8),
    timestamp TIMESTAMP NOT NULL,
    source VARCHAR(50) NOT NULL
);

-- News articles
CREATE TABLE news_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    summary TEXT,
    source VARCHAR(100) NOT NULL,
    url VARCHAR(500),
    impact_score DECIMAL(3,2), -- AI-generated 0-10 impact rating
    sentiment_score DECIMAL(3,2), -- -1 to 1 sentiment
    published_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User watchlists
CREATE TABLE watchlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    instrument_id INTEGER REFERENCES instruments(id),
    alert_threshold_up DECIMAL(10,4),
    alert_threshold_down DECIMAL(10,4),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login  
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/profile` - User profile

### Market Data
- `GET /api/markets/instruments` - List available instruments
- `GET /api/markets/price/:symbol` - Current price
- `GET /api/markets/history/:symbol` - Historical price data
- `GET /api/markets/movers` - Top movers (gainers/losers)

### News & Analysis  
- `GET /api/news` - Latest news articles
- `GET /api/news/search` - Search news by keywords/symbols
- `GET /api/news/sentiment/:symbol` - Sentiment analysis for symbol
- `GET /api/news/impact` - High-impact news alerts

### Watchlist
- `GET /api/watchlist` - User's watchlist
- `POST /api/watchlist` - Add to watchlist
- `DELETE /api/watchlist/:id` - Remove from watchlist
- `PUT /api/watchlist/:id/alerts` - Update alert thresholds

## External Data Sources

### Market Data APIs
1. **Alpha Vantage** - Stocks, forex, crypto (free tier: 5 calls/min)
2. **Polygon.io** - Real-time market data ($99/month)
3. **CoinGecko API** - Crypto data (free tier available)
4. **FRED API** - Economic indicators (free)

### News Sources
1. **NewsAPI** - Multi-source news aggregation ($449/month)
2. **RSS Feeds** - Financial Times, Reuters, Bloomberg (free)
3. **Reddit API** - r/investing, r/cryptocurrency sentiment (free)
4. **Twitter API** - Financial influencers tracking ($100/month)

## AI/ML Components

### News Processing Pipeline
```
RSS/API → Content Extraction → NLP Processing → Impact Scoring → Database
```

### Sentiment Analysis
- TextBlob for basic sentiment  
- Custom model for financial context
- Social media mention volume tracking

### Alert System
- Price movement alerts
- News impact alerts
- Volume spike detection
- Pattern recognition (future enhancement)

## Security & Performance

### Security
- JWT authentication with refresh tokens
- Rate limiting per subscription tier
- Input validation and sanitization
- HTTPS only in production

### Performance  
- Redis caching for frequently accessed data
- WebSocket connections for real-time updates
- Database indexing on timestamp and symbol columns
- CDN for static assets

## Subscription Tiers

### Free Tier Limitations
- 15-minute delayed data
- 5 news articles per day
- Basic watchlist (10 assets)
- Email alerts only

### Professional Tier ($19/month)
- Real-time data access
- Unlimited news + AI summaries
- Advanced watchlist (unlimited)
- Push notifications
- Social sentiment scores

### Enterprise Tier ($99/month)  
- API access (1000 calls/hour)
- Custom alerts
- Priority support
- Advanced analytics dashboard
- Data export capabilities

---

*Next: Implementation starts with backend API development*