const Redis = require('redis');

class CacheService {
  constructor() {
    this.client = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) return false; // Give up after 3 attempts
          return Math.min(retries * 500, 3000);
        },
      },
    });

    this.client.on('error', (err) => {
      // Only log once to avoid spam when Redis isn't running
      if (!this._redisErrorLogged) {
        console.warn('[Cache] Redis unavailable — using in-memory fallback. Start Redis to enable persistence.');
        this._redisErrorLogged = true;
      }
    });

    this.client.on('connect', () => {
      console.info('[Cache] ✅ Redis connected');
      this._redisErrorLogged = false;
    });

    // Fallback in-memory cache when Redis is unavailable
    this.memoryCache = new Map();
    this.isRedisAvailable = false;
    
    this.connect();
  }

  /**
   * Attempt to connect to Redis. Falls back to in-memory cache on failure.
   */
  async connect() {
    try {
      await this.client.connect();
      this.isRedisAvailable = true;
    } catch (error) {
      console.warn('[Cache] Redis unavailable, using memory cache:', error.message);
      this.isRedisAvailable = false;
    }
  }

  /**
   * Get a cached value by key.
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or null if not found / expired
   */
  async get(key) {
    try {
      if (this.isRedisAvailable) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          return cached.value;
        }
        this.memoryCache.delete(key);
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Store a value in cache with optional TTL.
   * @param {string} key - Cache key
   * @param {*} value - Value to cache (must be JSON-serialisable)
   * @param {number} [ttlSeconds=300] - Time-to-live in seconds
   */
  async set(key, value, ttlSeconds = 300) {
    try {
      if (this.isRedisAvailable) {
        await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      } else {
        // Memory cache with TTL
        this.memoryCache.set(key, {
          value,
          expiry: Date.now() + (ttlSeconds * 1000)
        });
        
        // Clean up expired entries periodically
        if (this.memoryCache.size > 1000) {
          this.cleanupMemoryCache();
        }
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete a cached entry by key.
   * @param {string} key - Cache key to remove
   */
  async del(key) {
    try {
      if (this.isRedisAvailable) {
        await this.client.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Evict all expired entries from the in-memory fallback cache.
   */
  cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expiry <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Execute an API call with caching: returns cached result if available,
   * otherwise calls `apiCall`, caches the result, and returns it.
   *
   * @param {string} key - Cache key
   * @param {() => Promise<*>} apiCall - Async function that fetches fresh data
   * @param {number} [ttlSeconds=300] - Cache TTL in seconds
   * @returns {Promise<*>} Cached or freshly fetched data
   */
  async cacheAPICall(key, apiCall, ttlSeconds = 300) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await apiCall();
    if (result !== null && result !== undefined) {
      await this.set(key, result, ttlSeconds);
    }
    return result;
  }

  /**
   * Returns cache stats for a list of keys (useful for /cache-stats endpoint).
   * Only works accurately with in-memory cache; Redis returns remaining TTL via PTTL.
   *
   * @param {string[]} keys
   * @returns {Promise<Record<string, 'cached'|'miss'>>}
   */
  async multiGet(keys) {
    const results = {};
    await Promise.all(
      keys.map(async key => {
        const val = await this.get(key);
        results[key] = val !== null ? 'cached' : 'miss';
      })
    );
    return results;
  }

  /**
   * Returns the number of entries currently in the in-memory cache.
   * Useful for monitoring.
   */
  memoryCacheSize() {
    return this.memoryCache.size;
  }
}

module.exports = new CacheService();