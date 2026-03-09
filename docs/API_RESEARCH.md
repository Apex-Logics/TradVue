# API Research Reference for TradVue
**Compiled for:** Bolt's integration development  
**Date:** March 5, 2026  
**Status:** Active Research

---

## 1. Alpha Vantage

### Overview
Alpha Vantage provides real-time and historical stock market data, Forex, cryptocurrencies, and 50+ technical indicators via JSON REST API.

### Free Tier Limits
- **Daily Request Limit:** 25 API requests per day (hard limit for free tier)
- **Intraday Data:** Last 100 data points (compact), or 30 days (full) — requires monthly parameter for historical
- **No WebSocket Support:** REST only

### Rate Limits
- **Free:** 5 requests per minute (implied from daily limits)
- **Premium:** 75 to 1,200 requests/min depending on plan

### Key Endpoints (Free Tier)
```
GET https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&apikey=YOUR_KEY
GET https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&apikey=YOUR_KEY
GET https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=EUR&apikey=YOUR_KEY
GET https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=YOUR_KEY
GET https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=IBM&apikey=YOUR_KEY
```

### Supported Data Types
- **Stocks:** Intraday, Daily, Weekly, Monthly (raw & adjusted)
- **Forex:** Intraday, Daily, Weekly, Monthly + Exchange Rates
- **Cryptocurrencies:** Daily, Weekly, Monthly + Exchange Rates
- **Commodities:** Gold, Silver, Crude Oil, Natural Gas, etc.
- **Economic Indicators:** GDP, CPI, Treasury Yields, Unemployment
- **Technical Indicators:** 50+ indicators (SMA, EMA, MACD, RSI, Bollinger Bands, etc.)

### Authentication
- **Method:** API Key in query parameter (`apikey=YOUR_KEY`)
- **No Registration Required:** Free key available at https://www.alphavantage.co/support/#api-key

### Gotchas
⚠️ **Major:** Free tier has 25 calls/day hard limit — not viable for production  
⚠️ **Intraday Data:** Requires `month=YYYY-MM` parameter for historical data (not continuous)  
⚠️ **Realtime Data:** Realtime and 15-min delayed intraday requires premium + data entitlement  
⚠️ **Premium:** Starting at $49.99/month for 75 req/min; scales to $2,499/month for 1,200 req/min  
✓ **Good:** 20+ years of historical data available  
✓ **Good:** Comprehensive endpoint coverage

### Pricing
- **Free:** 25 requests/day
- **Premium Monthly:** $49.99–$249.99/month (75–1,200 req/min)
- **Premium Annual:** 2 months discount on monthly plans

---

## 2. FinnHub

### Overview
FinnHub provides real-time stock prices, company fundamentals, earnings estimates, and alternative data. Supports WebSocket for real-time updates.

### Free Tier Limits
- **API Calls:** 60 per minute (generous for free)
- **WebSocket Support:** Yes, real-time quote & trade data
- **Data Coverage:** Global stocks, Forex, Crypto
- **Delay:** Real-time for free tier

### Rate Limits
- **Free:** 60 requests/minute
- **Pro/Premium:** Higher limits available (details vary by plan)

### Key Endpoints (Free Tier)
```
GET https://finnhub.io/api/v1/quote?symbol=AAPL&token=YOUR_TOKEN
GET https://finnhub.io/api/v1/company-profile2?symbol=AAPL&token=YOUR_TOKEN
GET https://finnhub.io/api/v1/stock/earnings?symbol=AAPL&token=YOUR_TOKEN
GET https://finnhub.io/api/v1/calendar/earnings?token=YOUR_TOKEN
GET https://finnhub.io/api/v1/news?category=forex&token=YOUR_TOKEN
GET https://finnhub.io/api/v1/crypto/candle?symbol=BINANCE:BTCUSDT&resolution=D&from=X&to=Y&token=YOUR_TOKEN
```

### Supported Data Types
- **Stocks:** Real-time quotes, OHLC, company profiles, earnings
- **Forex:** Currency data and news
- **Crypto:** Candlestick data
- **Alternative Data:** Insider transactions, option flow, estimates
- **News:** Stock/Forex/Crypto news feeds

### Authentication
- **Method:** API Token in query parameter (`token=YOUR_TOKEN`)
- **Registration:** Free account at https://finnhub.io

### WebSocket
- **Real-time Quotes:** Yes (upgrade plan required for advanced)
- **Trade Data:** Available on certain plans

### Gotchas
✓ **Excellent:** 60 req/min is solid for free tier  
✓ **Good:** Real-time data on free tier  
⚠️ **Advanced Data:** Some endpoints (options, alternative data) may require paid plans  
⚠️ **Documentation:** Pricing page may not load directly; check docs carefully  
✓ **Good:** WebSocket support out of the box

### Pricing
- **Free:** 60 API calls/minute, includes real-time quotes
- **Pro/Premium:** Paid plans available (visit site for current pricing)

---

## 3. NewsAPI

### Overview
Aggregates news articles from 150,000+ sources globally. Simple keyword-based search with sorting by relevance, popularity, or publish date.

### Free Tier Limits
- **Monthly Requests:** 1,500 per month (50/day average, ~2 requests/minute)
- **Article History:** Last 30 days only
- **Article Content:** Snippets only (max 200 chars), full content requires scraping
- **Sources:** 150,000+ news outlets and blogs

### Rate Limits
- **Free:** ~50 per day (1,500/month)
- **Developer:** ~450/day for paid plans
- **Business:** Unlimited on subscription

### Key Endpoints
```
GET https://newsapi.org/v2/everything?q=bitcoin&apiKey=YOUR_KEY
GET https://newsapi.org/v2/top-headlines?country=us&category=business&apiKey=YOUR_KEY
GET https://newsapi.org/v2/top-headlines?sources=bbc-news,bloomberg&apiKey=YOUR_KEY
GET https://newsapi.org/v2/sources?apiKey=YOUR_KEY
```

### Query Capabilities
- **Keywords:** Full-text search with advanced operators
  - `+term` = must include
  - `-term` = exclude
  - `"exact phrase"` = exact match
  - `AND/OR/NOT` with parentheses for complex queries
- **Search Fields:** title, description, content
- **Date Range:** `from` and `to` parameters (ISO 8601)
- **Languages:** 15 languages supported
- **Sorting:** relevancy, popularity, publishedAt

### Supported Data Types
- **Top Headlines:** Breaking news by country/category
- **Everything Search:** Deep search across article history (30 days)
- **Sources Directory:** Browse available news sources

### Authentication
- **Method:** API Key in query parameter or X-Api-Key header
- **Registration:** Free account at https://newsapi.org

### Gotchas
⚠️ **Major:** Free tier only covers last 30 days of articles — not suitable for historical sentiment analysis  
⚠️ **Major:** Only article snippets (200 chars), must scrape for full content  
⚠️ **Rate Limit:** 1,500 requests/month is tight for active trading platform (~2 req/min)  
⚠️ **Development Only:** Developer plan is for development/testing only; production requires paid subscription  
✓ **Good:** Advanced search operators available
✓ **Good:** Covers mainstream and niche sources

### Pricing
- **Developer (Free):** 1,500 req/month, development only
- **Starter:** ~$449/month (100k req/month)
- **Professional:** Custom pricing for higher volumes

---

## 4. ForexFactory Calendar

### Overview
ForexFactory provides the most comprehensive economic calendar for forex traders. **No official API exists**, but calendar data is available via HTML parsing or unofficial methods.

### Free Tier Limits
- **Official API:** None — ForexFactory does not offer an API
- **Web Scraping:** Technically possible but **violates Terms of Service**
- **Calendar Data:** Available publicly on website (HTML tables)

### Rate Limits
- N/A (no official API)

### How to Access (Legally)
#### Option 1: Embed Calendar (Unofficial)
```
https://www.forexfactory.com/calendar.php
```
- Can be embedded via iframe or scraped (at own risk)
- HTML table contains:
  - Date/Time (GMT)
  - Country
  - Event name
  - Impact level (High/Medium/Low)
  - Forecast value
  - Previous value
  - Actual value (post-release)

#### Option 2: Trading Economics API (Alternative)
**Recommended official alternative:**
```
https://tradingeconomics.com/calendar
```
- **Not free**, but has official API with economic calendar
- Covers global economic indicators
- More reliable than scraping ForexFactory

#### Option 3: RSS Feed (Unofficial)
```
https://www.forexfactory.com/calendar.php?content=rss&type=events
```
- XML/RSS format available
- May work but not officially supported

### Data Available (If Accessible)
- Economic events: Non-farm Payrolls, CPI, GDP, Jobs Reports, etc.
- Impact ratings (High/Medium/Low)
- Forecast vs. Actual comparisons
- Release dates/times in GMT

### Authentication
- None (public web data)

### Gotchas
⚠️ **Critical:** No official API — ForexFactory explicitly does not provide programmatic access  
⚠️ **ToS Risk:** Web scraping violates their Terms of Service; IP may be blocked  
⚠️ **Data Quality:** RSS feed format unstable; may break without notice  
✗ **Unreliable:** Not recommended for production trading systems  

### Recommendation for TradVue
**Use Trading Economics API instead:**
- Official, maintained API
- Same calendar data
- Legal and reliable
- Pricing available for different tiers

---

## 5. CoinGecko

### Overview
CoinGecko provides comprehensive cryptocurrency data, market data, on-chain analytics, and DEX data. Free tier is generous with no API key required.

### Free Tier Limits
- **API Calls:** 10–50 calls/minute (varies by endpoint)
- **API Key:** Not required for free tier
- **Data:** Most endpoints available
- **Rate Limit Window:** Per-minute basis

### Rate Limits
- **Free (No Key):** 10–50 calls/min depending on endpoint
- **Pro API Key (Paid):** Higher rate limits + additional endpoints
- **Failed Requests:** Count toward rate limit but not credit usage

### Key Endpoints (Free)
```
GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd
GET https://api.coingecko.com/api/v3/coins/bitcoin
GET https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30
GET https://api.coingecko.com/api/v3/markets?vs_currency=usd&order=market_cap_desc&per_page=250
GET https://api.coingecko.com/api/v3/global
GET https://api.coingecko.com/api/v3/derivatives
```

### Supported Data Types
- **Price Data:** Real-time prices in multiple currencies
- **Market Data:** Market cap, volume, dominance rankings
- **Historical Data:** Full market chart history (daily, hourly)
- **On-Chain Data:** (Pro API) DEX trading data via GeckoTerminal
- **Derivatives:** Futures, perpetuals, options
- **NFT Data:** Floor prices, volume, collection data

### Authentication
- **Free Tier:** No authentication required
- **Pro API:** API Key via header (`x-cg-pro-api-key`) or query parameter
- **Root URL (Free):** `https://api.coingecko.com/api/v3/`
- **Root URL (Pro):** `https://pro-api.coingecko.com/api/v3/`

### Gotchas
✓ **Excellent:** Free tier works without API key  
✓ **Excellent:** No rate limit on some endpoints (10–50 req/min typical)  
✓ **Good:** Extensive historical data available for free  
⚠️ **Pro Features:** On-chain DEX data, advanced analytics require Pro API  
⚠️ **Limited Realtime:** Free tier updates may lag by 1–2 minutes  
✓ **Good:** Broad crypto coverage (10,000+ coins)

### Pricing
- **Free:** Unlimited (rate-limited to 10–50 req/min)
- **Pro API:** Paid plans available
  - Starting ~$500+/month
  - Higher rate limits
  - Exclusive endpoints (on-chain data, DEX analytics)
  - Visit https://www.coingecko.com/en/api/pricing for current rates

---

## Quick Comparison Table

| API | Free Tier Rate Limit | Historical Data | Real-Time | WebSocket | Ease of Use | Cost | Best For |
|-----|---------------------|-----------------|-----------|-----------|-------------|------|----------|
| **Alpha Vantage** | 5 req/min (25/day) | ✓ 20+ years | Delayed (paid) | ✗ | Medium | $49.99+/mo | Stocks/Forex/Crypto OHLC |
| **FinnHub** | 60 req/min | ✓ Varies | ✓ Yes | ✓ | Easy | Free-Premium | Real-time quotes + fundamentals |
| **NewsAPI** | 50 req/day (1.5k/mo) | ✗ 30 days only | ✓ | ✗ | Easy | Free-$449+/mo | News sentiment analysis |
| **ForexFactory** | ✗ None (no API) | ✗ | ✓ (web) | ✗ | Hard (scrape) | Free | Economic calendar (not recommended) |
| **CoinGecko** | 10–50 req/min | ✓ Full | ✓ | ✗ | Easy | Free-Premium | Crypto market data + derivatives |

---

## Integration Recommendations for TradVue

### Data Layer Strategy
1. **Stocks & ETFs:** FinnHub (free tier, real-time, 60 req/min)
   - Fallback: Alpha Vantage (if daily data sufficient)
2. **Cryptocurrency:** CoinGecko (free, generous limits, no auth required)
3. **Forex:** FinnHub (covered in free tier)
4. **News/Sentiment:** NewsAPI (limited but functional for free)
   - Consider: Alpaca News API or other alternatives for higher volumes
5. **Economic Calendar:** Trading Economics API (official, not ForexFactory)
   - Alternative: Calendar scraping if essential (at ToS risk)

### Cost-Effective Setup (MVP)
```
- FinnHub Free: $0 (60 req/min is sufficient for MVP)
- CoinGecko Free: $0
- NewsAPI Free: $0 (1.5k req/month — enough for basic sentiment)
- Total: $0
```

### Production Scaling
```
- FinnHub Pro: ~$100–500/mo (for additional endpoints)
- CoinGecko Pro: ~$500+/mo (if on-chain data needed)
- NewsAPI Paid: ~$450+/mo (for higher volumes)
- Alpha Vantage Premium: $49.99–249.99/mo (if primary stock source)
- Total: $1,100–1,500/mo baseline
```

---

## Notes for Development
- **No API Key Required (Initially):** FinnHub, NewsAPI, CoinGecko all support free tier without keys
- **Rate Limiting:** Design queues and caching to respect per-minute limits
- **Fallback Strategy:** Have primary + secondary sources for critical data
- **Error Handling:** All APIs return errors; implement exponential backoff
- **Data Freshness:** Real-time requirement determines which tier to use

---

_Last Updated: March 5, 2026_  
_Compiled for: TradVue Trading Platform_
