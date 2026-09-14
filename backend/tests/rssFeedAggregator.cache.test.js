/**
 * RSS aggregator cache TTL + force-refresh bust.
 * Mocks cache / Marketaux / Finnhub / rss-parser so no network I/O.
 */

jest.mock('../services/cache', () => ({
  cacheAPICall: jest.fn(async (_key, fn) => fn()),
  delByPrefix: jest.fn(async () => {}),
  del: jest.fn(async () => {}),
  get: jest.fn(async () => null),
  set: jest.fn(async () => {}),
}));

jest.mock('../services/marketaux', () => ({
  getNews: jest.fn(async () => []),
}));

jest.mock('../services/finnhub', () => ({
  getGeneralNews: jest.fn(async () => []),
  getCompanyNews: jest.fn(async () => []),
}));

jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: jest.fn(async () => ({ items: [] })),
  }));
});

const cache = require('../services/cache');
const rss = require('../services/rssFeedAggregator');

describe('RSSFeedAggregator cache policy', () => {
  beforeEach(() => jest.clearAllMocks());

  test('aggregated TTL is 60s and symbol TTL is 90s', () => {
    expect(rss.AGGREGATED_CACHE_TTL_SEC).toBe(60);
    expect(rss.SYMBOL_CACHE_TTL_SEC).toBe(90);
  });

  test('getAggregatedNews uses the 60s TTL', async () => {
    await rss.getAggregatedNews({ limit: 10 });
    expect(cache.cacheAPICall).toHaveBeenCalledWith(
      expect.stringMatching(/^rss:aggregated:/),
      expect.any(Function),
      60,
    );
    expect(cache.delByPrefix).not.toHaveBeenCalled();
  });

  test('force refresh busts rss:* keys before the next cache fill', async () => {
    await rss.getAggregatedNews({ limit: 10, force: true });
    expect(cache.delByPrefix).toHaveBeenCalledWith('rss:');
    expect(cache.cacheAPICall).toHaveBeenCalled();
  });

  test('getNewsBySymbol uses 90s TTL and busts rss:* on force', async () => {
    await rss.getNewsBySymbol('AAPL', { limit: 15, force: true });
    expect(cache.delByPrefix).toHaveBeenCalledWith('rss:');
    expect(cache.cacheAPICall).toHaveBeenCalledWith(
      'rss:symbol:AAPL:15',
      expect.any(Function),
      90,
    );
  });
});

describe('HTTP cache on GET /api/feed/news', () => {
  test('server mounts the feed with 60s public cache (FE also sends no-store)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    expect(src).toMatch(/app\.use\('\/api\/feed\/news',\s*cachePublic60s/);
    expect(src).toMatch(/max-age=60/);
  });
});
