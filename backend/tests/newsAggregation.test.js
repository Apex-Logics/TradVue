/**
 * News Aggregation Routes Tests
 *
 * TDD: Tests written first to define expected behavior.
 * Covers: GET /api/feed/news, GET /api/feed/news/categories,
 *         GET /api/feed/news/symbol/:symbol, GET /api/feed/news/sentiment/:symbol
 *
 * Mocks: rssFeedAggregator (avoids live RSS network calls)
 */

const request = require('supertest');
const express = require('express');

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../services/rssFeedAggregator', () => ({
  getAggregatedNews: jest.fn(),
  getNewsBySymbol: jest.fn(),
  getSymbolSentiment: jest.fn(),
}));

const rss = require('../services/rssFeedAggregator');
const aggregatedNewsRouter = require('../routes/aggregatedNews');

const app = express();
app.use(express.json());
app.use('/api/feed/news', aggregatedNewsRouter);

afterEach(() => jest.clearAllMocks());

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MOCK_ARTICLES = [
  {
    id: 'art-1',
    title: 'Bitcoin Surges to New High',
    summary: 'BTC rallies on institutional demand.',
    url: 'https://coindesk.com/btc-rally',
    source: 'CoinDesk',
    category: 'crypto',
    publishedAt: new Date().toISOString(),
    sentimentScore: 0.7,
    sentimentLabel: 'bullish',
    impactScore: 8.2,
    impactLabel: 'High',
    tags: ['bitcoin', 'crypto'],
    symbols: ['BTC'],
    imageUrl: null,
  },
  {
    id: 'art-2',
    title: 'Fed Signals Rate Hold',
    summary: 'Federal Reserve keeps rates unchanged.',
    url: 'https://reuters.com/fed-hold',
    source: 'Reuters Business',
    category: 'economy',
    publishedAt: new Date().toISOString(),
    sentimentScore: -0.1,
    sentimentLabel: 'neutral',
    impactScore: 9.0,
    impactLabel: 'High',
    tags: ['federal-reserve', 'interest-rates'],
    symbols: [],
    imageUrl: null,
  },
];

// ── GET /api/feed/news ────────────────────────────────────────────────────────
describe('GET /api/feed/news', () => {
  test('returns aggregated articles list', async () => {
    rss.getAggregatedNews.mockResolvedValueOnce(MOCK_ARTICLES);

    const res = await request(app).get('/api/feed/news');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.sources).toContain('CoinDesk');
    expect(res.body.timestamp).toBeDefined();
  });

  test('passes limit, category, and minImpact to aggregator', async () => {
    rss.getAggregatedNews.mockResolvedValueOnce([MOCK_ARTICLES[0]]);

    await request(app).get('/api/feed/news?limit=5&category=crypto&minImpact=7');

    expect(rss.getAggregatedNews).toHaveBeenCalledWith({
      limit: 5,
      category: 'crypto',
      minImpact: 7,
    });
  });

  test('caps limit at 100', async () => {
    rss.getAggregatedNews.mockResolvedValueOnce([]);

    await request(app).get('/api/feed/news?limit=999');

    expect(rss.getAggregatedNews).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });

  test('returns 500 on aggregator failure', async () => {
    rss.getAggregatedNews.mockRejectedValueOnce(new Error('RSS timeout'));

    const res = await request(app).get('/api/feed/news');

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/feed/news/categories ────────────────────────────────────────────
describe('GET /api/feed/news/categories', () => {
  test('returns available categories', async () => {
    const res = await request(app).get('/api/feed/news/categories');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories.length).toBeGreaterThan(0);
    expect(res.body.categories).toContain('crypto');
    expect(res.body.categories).toContain('markets');
  });
});

// ── GET /api/feed/news/symbol/:symbol ─────────────────────────────────────────
describe('GET /api/feed/news/symbol/:symbol', () => {
  test('returns articles for a given symbol', async () => {
    rss.getNewsBySymbol.mockResolvedValueOnce([MOCK_ARTICLES[0]]);

    const res = await request(app).get('/api/feed/news/symbol/BTC');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.symbol).toBe('BTC');
    expect(res.body.count).toBe(1);
    expect(rss.getNewsBySymbol).toHaveBeenCalledWith('BTC', { limit: 15 });
  });

  test('returns empty array when no articles found for symbol', async () => {
    rss.getNewsBySymbol.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/feed/news/symbol/UNKN');

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  test('caps limit at 50', async () => {
    rss.getNewsBySymbol.mockResolvedValueOnce([]);

    await request(app).get('/api/feed/news/symbol/AAPL?limit=999');

    expect(rss.getNewsBySymbol).toHaveBeenCalledWith('AAPL', { limit: 50 });
  });

  test('returns 500 on service failure', async () => {
    rss.getNewsBySymbol.mockRejectedValueOnce(new Error('Feed error'));

    const res = await request(app).get('/api/feed/news/symbol/BTC');

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/feed/news/sentiment/:symbol ──────────────────────────────────────
describe('GET /api/feed/news/sentiment/:symbol', () => {
  test('returns sentiment analysis for a symbol', async () => {
    rss.getSymbolSentiment.mockResolvedValueOnce({
      symbol: 'BTC',
      score: 0.65,
      label: 'bullish',
      confidence: 0.8,
      articleCount: 16,
      topArticles: [MOCK_ARTICLES[0]],
    });

    const res = await request(app).get('/api/feed/news/sentiment/BTC');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.symbol).toBe('BTC');
    expect(res.body.data.label).toBe('bullish');
    expect(res.body.data.score).toBe(0.65);
  });

  test('returns 500 on service failure', async () => {
    rss.getSymbolSentiment.mockRejectedValueOnce(new Error('Sentiment error'));

    const res = await request(app).get('/api/feed/news/sentiment/BTC');

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── rssFeedAggregator unit-level tests ───────────────────────────────────────
// Test the NLP helper methods directly (without network I/O)
describe('RSSFeedAggregator NLP internals', () => {
  // Restore real module for these tests
  let realAggregator;

  beforeAll(() => {
    jest.resetModules();
    // Re-require the REAL aggregator (not the mock)
    jest.unmock('../services/rssFeedAggregator');
    realAggregator = require('../services/rssFeedAggregator');
  });

  afterAll(() => {
    // Re-mock for any subsequent test files
    jest.mock('../services/rssFeedAggregator', () => ({
      getAggregatedNews: jest.fn(),
      getNewsBySymbol: jest.fn(),
      getSymbolSentiment: jest.fn(),
    }));
  });

  test('_scoreSentiment returns positive score for bullish text', () => {
    const score = realAggregator._scoreSentiment(
      'bitcoin surges to record high as market rallies with strong gains'
    );
    expect(score).toBeGreaterThan(0);
  });

  test('_scoreSentiment returns negative score for bearish text', () => {
    const score = realAggregator._scoreSentiment(
      'market crash plunge collapse bear decline risk warning'
    );
    expect(score).toBeLessThan(0);
  });

  test('_scoreSentiment returns 0 for neutral text', () => {
    const score = realAggregator._scoreSentiment('the meeting was held today');
    expect(score).toBe(0);
  });

  test('_scoreImpact returns higher score for high-impact keywords', () => {
    const highScore = realAggregator._scoreImpact('federal reserve interest rate hike central bank');
    const lowScore = realAggregator._scoreImpact('apple released a new phone');
    expect(highScore).toBeGreaterThan(lowScore);
  });

  test('_extractTags includes source tags', () => {
    const tags = realAggregator._extractTags('bitcoin rallies', ['crypto', 'markets']);
    expect(tags).toContain('crypto');
    expect(tags).toContain('markets');
  });

  test('_detectSymbols detects BTC from bitcoin keyword', () => {
    const symbols = realAggregator._detectSymbols('bitcoin surges to all time high');
    expect(symbols).toContain('BTC');
  });
});
