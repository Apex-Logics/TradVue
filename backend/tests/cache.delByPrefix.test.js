/**
 * Cache prefix eviction (in-memory fallback — Redis is skipped in test).
 */

const cache = require('../services/cache');

describe('cache.delByPrefix', () => {
  beforeEach(() => {
    cache.memoryCache.clear();
    cache.isRedisAvailable = false;
  });

  test('deletes matching keys and leaves others', async () => {
    await cache.set('rss:aggregated:all:0:30', ['a'], 60);
    await cache.set('rss:symbol:AAPL:15', ['b'], 60);
    await cache.set('marketaux:news::15:1', ['c'], 60);

    await cache.delByPrefix('rss:');

    expect(await cache.get('rss:aggregated:all:0:30')).toBeNull();
    expect(await cache.get('rss:symbol:AAPL:15')).toBeNull();
    expect(await cache.get('marketaux:news::15:1')).toEqual(['c']);
  });

  test('no-ops on empty prefix', async () => {
    await cache.set('rss:aggregated:all:0:30', ['a'], 60);
    await cache.delByPrefix('');
    expect(await cache.get('rss:aggregated:all:0:30')).toEqual(['a']);
  });
});
