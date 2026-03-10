# TradVue API Documentation

**API Base URL:** `https://tradvue-production.up.railway.app/api`

---

## Table of Contents
1. [Authentication](#authentication)
2. [Rate Limits](#rate-limits)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [Endpoints](#endpoints)
   - [Authentication](#auth-endpoints)
   - [Market Data](#market-data-endpoints)
   - [News & Feed](#news--feed-endpoints)
   - [Watchlist](#watchlist-endpoints)
   - [Alerts](#alerts-endpoints)
   - [Economic Calendar](#economic-calendar-endpoints)
6. [Real-time Connections](#real-time-connections)
7. [Code Examples](#code-examples)

---

## Authentication

All protected endpoints require a JWT token passed in the `Authorization` header.

### JWT Token Format
```
Authorization: Bearer <your_jwt_token>
```

### Token Claims
```json
{
  "userId": "user-id",
  "email": "user@example.com",
  "subscription_tier": "free|pro|enterprise",
  "iat": 1709782740,
  "exp": 1709869140
}
```

### Token Expiration
- Default: 24 hours
- Tokens expire after the configured `JWT_EXPIRE` environment variable (default: `24h`)
- Invalid or expired tokens return `403 Forbidden`

---

## Rate Limits

| Tier | Requests/Minute | Requests/Hour | Concurrent Connections |
|------|-----------------|---------------|----------------------|
| Free | 30 | 500 | 1 |
| Pro | 100 | 2,000 | 5 |
| Enterprise | Unlimited | Unlimited | Unlimited |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1709783700
```

Exceeding limits returns `429 Too Many Requests`.

---

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

### HTTP Status Codes
- `200 OK` - Request successful
- `201 Created` - Resource created
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Missing/invalid authentication
- `403 Forbidden` - Expired token or insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists (e.g., duplicate watchlist item)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Auth Endpoints

### POST /auth/register
Create a new user account and receive JWT token.

**Request:**
```json
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "subscription_tier": "free"
}
```

**Parameters:**
- `email` (string, required) - User email address
- `password` (string, required) - Minimum 8 characters
- `subscription_tier` (string, optional) - Default: `"free"` | Options: `free`, `pro`, `enterprise`

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-1234",
    "email": "user@example.com",
    "subscription_tier": "free",
    "verified": false,
    "created_at": "2025-03-06T22:19:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Email and password required / Password too short
- `409` - User already exists
- `500` - Internal server error

---

### POST /auth/login
Authenticate user and receive JWT token.

**Request:**
```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Parameters:**
- `email` (string, required) - User email address
- `password` (string, required) - User password

**Success Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-1234",
    "email": "user@example.com",
    "subscription_tier": "free",
    "verified": false,
    "created_at": "2025-03-06T22:19:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Email and password required
- `401` - Invalid credentials
- `500` - Internal server error

---

### GET /auth/profile
Retrieve authenticated user's profile information.

**Request:**
```
GET /api/auth/profile
Authorization: Bearer <your_jwt_token>
```

**Success Response (200):**
```json
{
  "user": {
    "id": "uuid-1234",
    "email": "user@example.com",
    "subscription_tier": "pro",
    "verified": true,
    "created_at": "2025-03-06T22:19:00.000Z"
  }
}
```

**Error Responses:**
- `401` - Access token required
- `403` - Invalid or expired token
- `404` - User not found
- `500` - Internal server error

---

## Market Data Endpoints

### GET /market-data/quote/:symbol
Get real-time quote for a single symbol.

**Request:**
```
GET /api/market-data/quote/AAPL
```

**Parameters:**
- `symbol` (string, required, URL path) - Stock ticker (e.g., `AAPL`, `GOOGL`)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "current": 182.50,
    "change": 1.25,
    "changePct": 0.69,
    "high": 183.20,
    "low": 181.00,
    "open": 181.50,
    "close": 182.50,
    "volume": 52_000_000,
    "previousClose": 181.25,
    "timestamp": "2025-03-06T21:00:00.000Z"
  },
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `404` - Symbol not found
- `500` - Failed to fetch quote

---

### GET /market-data/batch
Get real-time quotes for multiple symbols in one request.

**Request:**
```
GET /api/market-data/batch?symbols=AAPL,TSLA,MSFT&type=stocks
```

**Parameters:**
- `symbols` (string, optional) - Comma-separated tickers (max 20). If omitted, returns default symbols.
- `type` (string, optional) - Asset type: `stocks` (default), `forex`, `crypto`

**Success Response (200):**
```json
{
  "success": true,
  "count": 3,
  "data": {
    "AAPL": {
      "symbol": "AAPL",
      "current": 182.50,
      "change": 1.25,
      "changePct": 0.69,
      "volume": 52_000_000
    },
    "TSLA": {
      "symbol": "TSLA",
      "current": 245.30,
      "change": -2.10,
      "changePct": -0.85,
      "volume": 45_000_000
    },
    "MSFT": {
      "symbol": "MSFT",
      "current": 410.75,
      "change": 3.50,
      "changePct": 0.86,
      "volume": 22_000_000
    }
  },
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch batch quotes

---

### GET /market-data/candles/:symbol
Get OHLCV (candlestick) data for charting.

**Request:**
```
GET /api/market-data/candles/AAPL?resolution=D&from=1700000000&to=1710000000
```

**Parameters:**
- `symbol` (string, required, URL path) - Stock ticker
- `resolution` (string, optional) - Candle interval: `1`, `5`, `15`, `30`, `60` (minutes), `D` (day), `W` (week), `M` (month). Default: `D`
- `from` (integer, optional) - Unix timestamp (seconds) for start date
- `to` (integer, optional) - Unix timestamp (seconds) for end date

**Success Response (200):**
```json
{
  "success": true,
  "symbol": "AAPL",
  "resolution": "D",
  "count": 30,
  "data": [
    {
      "time": 1700000000,
      "open": 175.50,
      "high": 176.20,
      "low": 175.10,
      "close": 175.85,
      "volume": 45_000_000
    },
    {
      "time": 1700086400,
      "open": 175.85,
      "high": 177.00,
      "low": 175.50,
      "close": 176.90,
      "volume": 52_000_000
    }
  ],
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid resolution
- `500` - Failed to fetch candle data

---

### GET /market-data/status
Get market open/close status for an exchange.

**Request:**
```
GET /api/market-data/status?exchange=US
```

**Parameters:**
- `exchange` (string, optional) - Exchange code: `US` (default), `UK`, `EU`, etc.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "exchange": "US",
    "isOpen": true,
    "openTime": "14:30:00",
    "closeTime": "21:00:00",
    "currentTime": "17:45:00",
    "nextOpen": "2025-03-07T14:30:00.000Z",
    "nextClose": "2025-03-07T21:00:00.000Z"
  },
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch market status

---

### GET /market-data/news/:symbol
Get company news from Finnhub.

**Request:**
```
GET /api/market-data/news/AAPL?days=7
```

**Parameters:**
- `symbol` (string, required, URL path) - Stock ticker
- `days` (integer, optional) - Days of news to fetch (max 30, default 7)

**Success Response (200):**
```json
{
  "success": true,
  "symbol": "AAPL",
  "count": 5,
  "data": [
    {
      "title": "Apple Announces New Product",
      "summary": "Apple unveils latest innovation...",
      "source": "Reuters",
      "url": "https://example.com/article",
      "sentiment": 0.8,
      "publishedAt": "2025-03-06T12:00:00.000Z"
    }
  ],
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch company news

---

### GET /market-data/movers
Get top gainers and losers.

**Request:**
```
GET /api/market-data/movers?symbols=AAPL,TSLA,MSFT
```

**Parameters:**
- `symbols` (string, optional) - Comma-separated tickers to analyze. Defaults to major indices if omitted.

**Success Response (200):**
```json
{
  "success": true,
  "gainers": [
    {
      "symbol": "NVDA",
      "current": 925.50,
      "change": 15.25,
      "changePct": 1.68
    },
    {
      "symbol": "AAPL",
      "current": 182.50,
      "change": 1.25,
      "changePct": 0.69
    }
  ],
  "losers": [
    {
      "symbol": "TSLA",
      "current": 245.30,
      "change": -5.20,
      "changePct": -2.08
    }
  ],
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch movers

---

## News & Feed Endpoints

### GET /feed/news
Get aggregated news from multiple sources (RSS, NewsAPI).

**Request:**
```
GET /api/feed/news?limit=30&category=stocks&minImpact=4
```

**Parameters:**
- `limit` (integer, optional) - Number of articles (max 100, default 30)
- `category` (string, optional) - Filter by category: `business`, `markets`, `crypto`, `forex`, `economy`, `stocks`, `general`
- `minImpact` (number, optional) - Minimum impact score (0-10, default 0)

**Success Response (200):**
```json
{
  "success": true,
  "count": 30,
  "data": [
    {
      "id": "article-1",
      "title": "Stock Market Hits Record High",
      "summary": "Major indices reach new peaks...",
      "content": "Full article content...",
      "source": "Bloomberg",
      "url": "https://bloomberg.com/article",
      "impact_score": 8.5,
      "sentiment_score": 0.7,
      "published_at": "2025-03-06T12:00:00.000Z",
      "tags": ["markets", "stocks", "economy"]
    }
  ],
  "sources": ["Bloomberg", "Reuters", "CNBC"],
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch news feed

---

### GET /feed/news/categories
Get available news categories.

**Request:**
```
GET /api/feed/news/categories
```

**Success Response (200):**
```json
{
  "success": true,
  "categories": ["business", "markets", "crypto", "forex", "economy", "stocks", "general"]
}
```

---

### GET /feed/news/symbol/:symbol
Get news specific to a symbol (stock, crypto, forex).

**Request:**
```
GET /api/feed/news/symbol/AAPL?limit=15
```

**Parameters:**
- `symbol` (string, required, URL path) - Ticker or symbol
- `limit` (integer, optional) - Number of articles (max 50, default 15)

**Success Response (200):**
```json
{
  "success": true,
  "symbol": "AAPL",
  "count": 15,
  "data": [
    {
      "id": "article-1",
      "title": "Apple Q1 Earnings Beat Expectations",
      "summary": "Apple reports strong Q1 results...",
      "source": "Financial Times",
      "url": "https://ft.com/article",
      "sentiment": 0.8,
      "published_at": "2025-03-06T10:30:00.000Z"
    }
  ],
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch symbol news

---

### GET /feed/news/sentiment/:symbol
Get sentiment analysis for a symbol based on recent news.

**Request:**
```
GET /api/feed/news/sentiment/AAPL
```

**Parameters:**
- `symbol` (string, required, URL path) - Ticker or symbol

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "sentiment_score": 0.65,
    "sentiment_label": "positive",
    "confidence": 0.85,
    "article_count": 12,
    "articles": [
      {
        "title": "Apple Q1 Earnings Beat",
        "sentiment": 0.8,
        "published_at": "2025-03-06T10:30:00.000Z"
      }
    ]
  },
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Sentiment Labels:**
- `positive` - Score > 0.2
- `neutral` - Score between -0.2 and 0.2
- `negative` - Score < -0.2

**Error Responses:**
- `500` - Failed to analyze sentiment

---

## Watchlist Endpoints

All watchlist endpoints require authentication.

### GET /watchlist
Retrieve user's complete watchlist with live prices.

**Request:**
```
GET /api/watchlist
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "watchlist": [
    {
      "id": 1,
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "type": "stock",
      "exchange": "NASDAQ",
      "current_price": 182.50,
      "change": 1.25,
      "change_pct": 0.69,
      "alert_threshold_up": 185.00,
      "alert_threshold_down": 180.00,
      "notes": "Buy signal on breakout",
      "added_at": "2025-03-01T10:00:00.000Z",
      "performance": {
        "purchase_price": 175.00,
        "current_value": 182.50,
        "change": 7.50,
        "change_percent": 4.29
      }
    }
  ],
  "total_items": 1
}
```

**Error Responses:**
- `401` - Access token required
- `403` - Invalid or expired token
- `500` - Failed to fetch watchlist

---

### POST /watchlist
Add an instrument to the user's watchlist.

**Request:**
```json
POST /api/watchlist
Authorization: Bearer <token>
Content-Type: application/json

{
  "symbol": "TSLA",
  "alert_threshold_up": 250.00,
  "alert_threshold_down": 230.00,
  "purchase_price": 240.00,
  "notes": "Tesla momentum play"
}
```

**Parameters:**
- `symbol` (string, required) - Stock ticker
- `alert_threshold_up` (number, optional) - Alert when price rises above
- `alert_threshold_down` (number, optional) - Alert when price falls below
- `purchase_price` (number, optional) - For performance tracking
- `notes` (string, optional) - User notes

**Success Response (201):**
```json
{
  "message": "Added to watchlist",
  "item": {
    "id": 2,
    "symbol": "TSLA",
    "name": "Tesla Inc.",
    "type": "stock",
    "exchange": "NASDAQ",
    "current_price": 245.30,
    "alert_threshold_up": 250.00,
    "alert_threshold_down": 230.00,
    "notes": "Tesla momentum play",
    "added_at": "2025-03-06T22:19:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Symbol is required
- `401` - Access token required
- `403` - Invalid or expired token
- `404` - Instrument not found
- `409` - Instrument already in watchlist
- `403` - Free tier limited to 10 items
- `500` - Failed to add item

---

### PUT /watchlist/:id/alerts
Update alert thresholds for a watchlist item.

**Request:**
```json
PUT /api/watchlist/2/alerts
Authorization: Bearer <token>
Content-Type: application/json

{
  "alert_threshold_up": 255.00,
  "alert_threshold_down": 235.00
}
```

**Parameters:**
- `alert_threshold_up` (number, optional) - Upper alert threshold
- `alert_threshold_down` (number, optional) - Lower alert threshold

**Success Response (200):**
```json
{
  "message": "Alert thresholds updated",
  "item": {
    "id": 2,
    "alert_threshold_up": 255.00,
    "alert_threshold_down": 235.00
  }
}
```

**Error Responses:**
- `401` - Access token required
- `404` - Watchlist item not found
- `500` - Failed to update alerts

---

### DELETE /watchlist/:id
Remove an instrument from the watchlist.

**Request:**
```
DELETE /api/watchlist/2
Authorization: Bearer <token>
```

**Parameters:**
- `id` (integer, required, URL path) - Watchlist item ID

**Success Response (200):**
```json
{
  "message": "Removed from watchlist",
  "removed_id": 2
}
```

**Error Responses:**
- `401` - Access token required
- `404` - Watchlist item not found
- `500` - Failed to remove item

---

### GET /watchlist/performance
Get portfolio performance summary.

**Request:**
```
GET /api/watchlist/performance
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "summary": {
    "total_items": 5,
    "tracked_items": 4,
    "total_investment": 5000.00,
    "total_current_value": 5275.50,
    "total_change": 275.50,
    "total_change_percent": 5.51
  },
  "items": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "type": "stock",
      "current_price": 182.50,
      "purchase_price": 175.00,
      "change": 7.50,
      "change_percent": 4.29
    }
  ]
}
```

**Error Responses:**
- `401` - Access token required
- `500` - Failed to calculate performance

---

## Alerts Endpoints

### GET /alerts
Get recent market alerts with optional filters.

**Request:**
```
GET /api/alerts?limit=50&category=FED&urgency=HIGH&hours=24
```

**Parameters:**
- `limit` (integer, optional) - Number of alerts (max 200, default 50)
- `category` (string, optional) - Filter by category: `POLITICAL`, `FED`, `ECONOMIC`, `EARNINGS`, `BREAKING`
- `urgency` (string, optional) - Filter by urgency: `HIGH`, `MEDIUM`, `LOW`
- `hours` (integer, optional) - Hours of history to fetch (default 24)

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "alert-1",
      "title": "Fed Interest Rate Decision",
      "description": "Federal Reserve announces policy decision...",
      "category": "FED",
      "urgency": "HIGH",
      "market_impact": 9.2,
      "sentiment": 0.5,
      "published_at": "2025-03-06T18:00:00.000Z",
      "related_symbols": ["SPY", "QQQ", "IWM"]
    }
  ],
  "meta": {
    "limit": 50,
    "category": "FED",
    "urgency": "HIGH",
    "hours": 24
  },
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid category or urgency
- `500` - Failed to fetch alerts

---

### GET /alerts/count
Get count of unread high-urgency alerts (useful for badge display).

**Request:**
```
GET /api/alerts/count
```

**Success Response (200):**
```json
{
  "success": true,
  "count": 3
}
```

---

### GET /alerts/live
Real-time alert stream via Server-Sent Events (SSE).

**Request:**
```
GET /api/alerts/live
```

**Connection Details:**
- Content-Type: `text/event-stream`
- Keep-Alive: Yes (heartbeat every 30s)
- Reconnection: Automatic with exponential backoff recommended

**Event Types:**

**Initial Connection:**
```
event: connected
data: {
  "message": "TradVue Alert Stream connected",
  "clientId": "client-uuid",
  "timestamp": "2025-03-06T22:19:00.000Z",
  "connectedClients": 42
}
```

**New Alert:**
```
event: alert
data: {
  "id": "alert-1",
  "title": "Market Moving Alert",
  "category": "FED",
  "urgency": "HIGH",
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Heartbeat (every 30 seconds):**
```
: heartbeat 2025-03-06T22:19:30.000Z
```

**Client Disconnection:**
- Close connection: Client sends `close` event
- Timeout: Server closes after 5 minutes of inactivity

---

### POST /alerts/subscribe
Configure user alert preferences (authentication required).

**Request:**
```json
POST /api/alerts/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "categories": ["FED", "ECONOMIC", "EARNINGS"],
  "urgencies": ["HIGH", "MEDIUM"],
  "sound_enabled": true,
  "email_enabled": true,
  "push_enabled": false
}
```

**Parameters:**
- `categories` (array, optional) - Alert categories to subscribe to: `POLITICAL`, `FED`, `ECONOMIC`, `EARNINGS`, `BREAKING`
- `urgencies` (array, optional) - Urgency levels: `HIGH`, `MEDIUM`, `LOW`
- `sound_enabled` (boolean, optional) - Enable sound notifications
- `email_enabled` (boolean, optional) - Enable email notifications
- `push_enabled` (boolean, optional) - Enable push notifications

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user_id": "user-1",
    "categories": ["FED", "ECONOMIC", "EARNINGS"],
    "urgencies": ["HIGH", "MEDIUM"],
    "sound_enabled": true,
    "email_enabled": true,
    "push_enabled": false,
    "updated_at": "2025-03-06T22:19:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid categories or urgencies
- `401` - Authentication required
- `500` - Failed to save subscription

---

### GET /alerts/subscription
Get user's current alert subscription preferences.

**Request:**
```
GET /api/alerts/subscription
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user_id": "user-1",
    "categories": ["FED", "ECONOMIC", "EARNINGS"],
    "urgencies": ["HIGH", "MEDIUM"],
    "sound_enabled": true,
    "email_enabled": true,
    "push_enabled": false,
    "created_at": "2025-02-01T10:00:00.000Z",
    "updated_at": "2025-03-06T22:19:00.000Z"
  }
}
```

**Error Responses:**
- `401` - Authentication required
- `500` - Failed to fetch subscription

---

### PATCH /alerts/read
Mark alerts as read.

**Request:**
```json
PATCH /api/alerts/read
Content-Type: application/json

{
  "ids": ["alert-1", "alert-2", "alert-3"]
}
```

**Parameters:**
- `ids` (array, required) - Array of alert IDs to mark as read

**Success Response (200):**
```json
{
  "success": true,
  "marked": 3
}
```

**Error Responses:**
- `400` - ids must be a non-empty array
- `500` - Failed to mark alerts as read

---

## Economic Calendar Endpoints

### GET /calendar/upcoming
Get upcoming economic events for the next N days.

**Request:**
```
GET /api/calendar/upcoming?days=7&currencies=USD,EUR&minImpact=2
```

**Parameters:**
- `days` (integer, optional) - Number of days to look ahead (max 30, default 7)
- `currencies` (string, optional) - Comma-separated currency codes (e.g., `USD,EUR,GBP`)
- `minImpact` (integer, optional) - Minimum impact level: 1 (Low), 2 (Medium), 3 (High). Default: 1

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "event-1",
      "title": "Non-Farm Payroll",
      "country": "US",
      "currency": "USD",
      "impact": 3,
      "forecast": "200,000",
      "previous": "185,000",
      "actual": null,
      "event_time": "2025-03-07T13:30:00.000Z",
      "related_symbols": ["DXY", "EURUSD"]
    }
  ],
  "filters": {
    "days": 7,
    "currencies": ["USD", "EUR"],
    "minImpact": 2
  },
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch calendar events

---

### GET /calendar/today
Get today's economic events.

**Request:**
```
GET /api/calendar/today?currencies=USD,EUR
```

**Parameters:**
- `currencies` (string, optional) - Comma-separated currency codes

**Success Response (200):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "event-1",
      "title": "ADP Employment Change",
      "country": "US",
      "currency": "USD",
      "impact": 2,
      "event_time": "2025-03-06T13:30:00.000Z"
    }
  ],
  "date": "2025-03-06",
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch events

---

### GET /calendar/high-impact
Get only high-impact economic events.

**Request:**
```
GET /api/calendar/high-impact?days=3
```

**Parameters:**
- `days` (integer, optional) - Days to look ahead (max 14, default 3)

**Success Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "event-1",
      "title": "Fed Interest Rate Decision",
      "country": "US",
      "impact": 3,
      "event_time": "2025-03-19T18:00:00.000Z"
    }
  ],
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch high-impact events

---

### GET /calendar/macro
Get macro economic snapshot (key indicators + upcoming high-impact events).

**Request:**
```
GET /api/calendar/macro
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "indicators": {
      "unemployment_rate": 3.7,
      "inflation_rate": 3.2,
      "gdp_growth": 2.5,
      "interest_rate": 4.75,
      "vix": 18.5,
      "us_dollar_index": 105.2
    },
    "upcoming_events": [
      {
        "title": "Fed Announcement",
        "impact": 3,
        "event_time": "2025-03-19T18:00:00.000Z"
      }
    ]
  },
  "timestamp": "2025-03-06T22:19:00.000Z"
}
```

**Error Responses:**
- `500` - Failed to fetch macro snapshot

---

## Real-time Connections

### Server-Sent Events (SSE) for Alerts

**WebSocket Alternative Coming Soon** — Currently, real-time alerts use Server-Sent Events.

#### JavaScript Example (Recommended)
```javascript
const eventSource = new EventSource('/api/alerts/live');

eventSource.addEventListener('connected', (event) => {
  const data = JSON.parse(event.data);
  console.log('Connected:', data.clientId);
});

eventSource.addEventListener('alert', (event) => {
  const alert = JSON.parse(event.data);
  console.log('New Alert:', alert);
});

eventSource.addEventListener('error', (event) => {
  console.error('Connection error:', event);
  eventSource.close();
});
```

#### Connection Retry Strategy
```javascript
let reconnectAttempts = 0;
const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

function connectToAlertStream() {
  try {
    eventSource = new EventSource('/api/alerts/live');

    eventSource.addEventListener('connected', () => {
      reconnectAttempts = 0; // Reset on successful connection
    });

    eventSource.onerror = () => {
      eventSource.close();
      if (reconnectAttempts < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, reconnectAttempts);
        reconnectAttempts++;
        console.log(`Reconnecting in ${delay}ms...`);
        setTimeout(connectToAlertStream, delay);
      }
    };
  } catch (error) {
    console.error('Failed to connect:', error);
  }
}

connectToAlertStream();
```

---

## Code Examples

### JavaScript (Fetch API)

#### Register and Login
```javascript
// Register
const registerResponse = await fetch('https://tradvue-production.up.railway.app/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123',
    subscription_tier: 'free'
  })
});

const { token, user } = await registerResponse.json();
localStorage.setItem('tradvue_token', token);

// Login
const loginResponse = await fetch('https://tradvue-production.up.railway.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123'
  })
});

const { token } = await loginResponse.json();
localStorage.setItem('tradvue_token', token);
```

#### Get Real-time Quote
```javascript
const token = localStorage.getItem('tradvue_token');

const response = await fetch(
  'https://tradvue-production.up.railway.app/api/market-data/quote/AAPL',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const { data } = await response.json();
console.log(`${data.symbol}: $${data.current} (${data.changePct}%)`);
```

#### Get Watchlist
```javascript
const token = localStorage.getItem('tradvue_token');

const response = await fetch(
  'https://tradvue-production.up.railway.app/api/watchlist',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const { watchlist } = await response.json();
watchlist.forEach(item => {
  console.log(`${item.symbol}: $${item.current_price} (${item.change_pct}%)`);
});
```

#### Add to Watchlist
```javascript
const token = localStorage.getItem('tradvue_token');

const response = await fetch(
  'https://tradvue-production.up.railway.app/api/watchlist',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      symbol: 'TSLA',
      alert_threshold_up: 250,
      alert_threshold_down: 230,
      notes: 'Momentum play'
    })
  }
);

const { item } = await response.json();
console.log(`Added ${item.symbol} to watchlist`);
```

#### Real-time Alerts Stream
```javascript
const token = localStorage.getItem('tradvue_token');

const eventSource = new EventSource(
  `https://tradvue-production.up.railway.app/api/alerts/live?token=${token}`
);

eventSource.addEventListener('alert', (event) => {
  const alert = JSON.parse(event.data);
  console.log('🚨 New Alert:', alert.title);
  
  // Show notification
  new Notification('TradVue Alert', {
    body: alert.title,
    badge: '/favicon.ico'
  });
});

eventSource.onerror = () => {
  console.error('Alert stream disconnected');
  eventSource.close();
};
```

---

### Python (Requests)

#### Login and Get Profile
```python
import requests
import json

BASE_URL = 'https://tradvue-production.up.railway.app/api'

# Login
response = requests.post(
    f'{BASE_URL}/auth/login',
    json={
        'email': 'user@example.com',
        'password': 'SecurePassword123'
    }
)

data = response.json()
token = data['token']

# Get Profile
headers = {'Authorization': f'Bearer {token}'}
profile_response = requests.get(f'{BASE_URL}/auth/profile', headers=headers)
print(profile_response.json()['user'])
```

#### Fetch Market Data
```python
import requests

BASE_URL = 'https://tradvue-production.up.railway.app/api'

# Get multiple quotes
response = requests.get(
    f'{BASE_URL}/market-data/batch',
    params={
        'symbols': 'AAPL,TSLA,MSFT',
        'type': 'stocks'
    }
)

quotes = response.json()['data']
for symbol, quote in quotes.items():
    print(f"{symbol}: ${quote['current']} ({quote['changePct']}%)")
```

#### Manage Watchlist
```python
import requests

BASE_URL = 'https://tradvue-production.up.railway.app/api'
token = 'your_jwt_token'
headers = {'Authorization': f'Bearer {token}'}

# Get watchlist
response = requests.get(f'{BASE_URL}/watchlist', headers=headers)
watchlist = response.json()['watchlist']
print(f"Watchlist items: {len(watchlist)}")

# Add item
add_response = requests.post(
    f'{BASE_URL}/watchlist',
    headers=headers,
    json={
        'symbol': 'NVDA',
        'alert_threshold_up': 900,
        'alert_threshold_down': 850
    }
)
print(f"Added: {add_response.json()['item']['symbol']}")

# Delete item
watchlist_id = watchlist[0]['id']
delete_response = requests.delete(
    f'{BASE_URL}/watchlist/{watchlist_id}',
    headers=headers
)
print(f"Deleted: {delete_response.json()['message']}")
```

#### Get News Feed
```python
import requests

BASE_URL = 'https://tradvue-production.up.railway.app/api'

# Get aggregated news
response = requests.get(
    f'{BASE_URL}/feed/news',
    params={
        'limit': 20,
        'category': 'stocks',
        'minImpact': 6
    }
)

articles = response.json()['data']
for article in articles:
    print(f"[{article['source']}] {article['title']}")
    print(f"  Impact: {article['impact_score']}, Sentiment: {article['sentiment_score']}\n")
```

#### Get Economic Calendar
```python
import requests

BASE_URL = 'https://tradvue-production.up.railway.app/api'

# High-impact events
response = requests.get(
    f'{BASE_URL}/calendar/high-impact',
    params={'days': 7}
)

events = response.json()['data']
for event in events:
    print(f"{event['event_time']}: {event['title']} ({event['country']})")
```

---

### cURL Examples

#### Authentication
```bash
# Register
curl -X POST https://tradvue-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'

# Login
curl -X POST https://tradvue-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'

# Get Profile (requires token)
curl -X GET https://tradvue-production.up.railway.app/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Market Data
```bash
# Get single quote
curl https://tradvue-production.up.railway.app/api/market-data/quote/AAPL

# Batch quotes
curl "https://tradvue-production.up.railway.app/api/market-data/batch?symbols=AAPL,TSLA,MSFT"

# Candlestick data
curl "https://tradvue-production.up.railway.app/api/market-data/candles/AAPL?resolution=D"

# Market status
curl "https://tradvue-production.up.railway.app/api/market-data/status?exchange=US"

# Movers
curl https://tradvue-production.up.railway.app/api/market-data/movers
```

#### Watchlist Operations
```bash
# Get watchlist
curl -X GET https://tradvue-production.up.railway.app/api/watchlist \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Add item
curl -X POST https://tradvue-production.up.railway.app/api/watchlist \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "alert_threshold_up": 900,
    "alert_threshold_down": 850
  }'

# Update alerts
curl -X PUT https://tradvue-production.up.railway.app/api/watchlist/1/alerts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alert_threshold_up": 920,
    "alert_threshold_down": 840
  }'

# Delete item
curl -X DELETE https://tradvue-production.up.railway.app/api/watchlist/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### News and Alerts
```bash
# Get news feed
curl "https://tradvue-production.up.railway.app/api/feed/news?limit=10&category=stocks"

# Get sentiment
curl "https://tradvue-production.up.railway.app/api/feed/news/sentiment/AAPL"

# Get alerts
curl "https://tradvue-production.up.railway.app/api/alerts?limit=20&category=FED"

# Subscribe to alerts
curl -X POST https://tradvue-production.up.railway.app/api/alerts/subscribe \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categories": ["FED", "EARNINGS"],
    "urgencies": ["HIGH"]
  }'
```

#### Economic Calendar
```bash
# Upcoming events
curl "https://tradvue-production.up.railway.app/api/calendar/upcoming?days=7&currencies=USD,EUR"

# Today's events
curl "https://tradvue-production.up.railway.app/api/calendar/today"

# High-impact only
curl "https://tradvue-production.up.railway.app/api/calendar/high-impact?days=3"

# Macro snapshot
curl https://tradvue-production.up.railway.app/api/calendar/macro
```

---

## Best Practices

### Authentication
- Store JWT tokens securely (HttpOnly cookies recommended for web)
- Refresh or re-authenticate before token expiration (< 24h)
- Never expose tokens in URLs or logs
- Use HTTPS for all requests

### Rate Limiting
- Implement exponential backoff for retries
- Cache responses when appropriate (market data doesn't change every millisecond)
- Batch requests (use `/market-data/batch` instead of multiple `/quote/:symbol` calls)

### Error Handling
```javascript
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`https://tradvue-production.up.railway.app/api${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('tradvue_token')}`,
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API Error');
  }

  return response.json();
}
```

### Real-time Alerts
- Use SSE with proper reconnection handling
- Monitor heartbeats; reconnect if missing > 60s
- Filter alerts client-side based on user preferences
- Show notifications with `Notification` API

### Data Validation
- Validate symbol format before API calls (e.g., 1-5 alphanumeric characters)
- Validate price inputs (positive, reasonable range)
- Handle null/missing data gracefully (prices might be unavailable during market hours)

---

## Changelog

### v1.0.0 (2025-03-06)
- Initial API release
- All endpoints documented and tested
- Authentication and rate limiting implemented
- Real-time alerts via SSE
- Economic calendar integration
- News feed aggregation

---

## Support

For issues, feature requests, or API documentation updates:
- Email: api-support@tradvue.com
- GitHub Issues: [tradvue/api-issues](https://github.com/apexlogics/tradvue/issues)
- Status Page: [status.tradvue.com](https://status.tradvue.com)

---

**Last Updated:** March 6, 2025  
**API Version:** 1.0.0  
**Base URL:** https://tradvue-production.up.railway.app/api
