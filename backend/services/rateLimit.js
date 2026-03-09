/**
 * Rate Limiting Services
 *
 * Provides Express middleware for per-IP request throttling and a helper class
 * for tracking outbound calls to third-party APIs (Finnhub, NewsAPI, etc.).
 *
 * Usage:
 *   const { generalLimiter, strictLimiter, externalAPILimiter } = require('./rateLimit');
 *   app.use(generalLimiter);
 *   await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);
 */
const rateLimit = require('express-rate-limit');
const Redis = require('redis');

// Redis client for distributed rate limiting
const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

// General API rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints (brute-force protection)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 requests per 15 minutes per IP
  message: {
    error: 'Too many attempts. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * In-process rate limiter for outbound external API calls.
 * Tracks request counts per named API within a rolling time window.
 * Throws if the limit would be exceeded, letting callers fall back to cache/mock.
 */
class ExternalAPILimiter {
  constructor() {
    /** @type {Map<string, number>} request counts keyed by API name */
    this.requestCounts = new Map();
    /** @type {Map<string, number>} window reset timestamps keyed by API name */
    this.resetTimes = new Map();
  }

  /**
   * Check whether a request to `apiName` is allowed under the rate limit.
   * Increments the counter when allowed.
   *
   * @param {string} apiName - Unique identifier for the external API
   * @param {number} [maxRequests=60] - Maximum requests allowed per window
   * @param {number} [windowMs=60000] - Window duration in milliseconds
   * @returns {Promise<true>} Resolves true if request is allowed
   * @throws {Error} If the rate limit for `apiName` has been exceeded
   */
  async canMakeRequest(apiName, maxRequests = 60, windowMs = 60000) {
    const now = Date.now();
    const resetTime = this.resetTimes.get(apiName) || now;
    
    if (now >= resetTime) {
      // Reset window
      this.requestCounts.set(apiName, 0);
      this.resetTimes.set(apiName, now + windowMs);
    }
    
    const currentCount = this.requestCounts.get(apiName) || 0;
    
    if (currentCount >= maxRequests) {
      const waitTime = this.resetTimes.get(apiName) - now;
      throw new Error(`API rate limit exceeded for ${apiName}. Wait ${Math.ceil(waitTime/1000)} seconds.`);
    }
    
    this.requestCounts.set(apiName, currentCount + 1);
    return true;
  }
}

const externalAPILimiter = new ExternalAPILimiter();

module.exports = {
  generalLimiter,
  strictLimiter,
  externalAPILimiter
};