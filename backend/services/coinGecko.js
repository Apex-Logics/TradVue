/**
 * CoinGecko API Service
 *
 * Free tier — no API key required for basic endpoints.
 * Rate limit: ~10-50 calls/minute (conservative: 1 call / 6s on free tier).
 *
 * Endpoints used:
 *   GET /api/v3/coins/markets         — top coins by market cap
 *   GET /api/v3/simple/price          — quick multi-coin price lookup
 *   GET /api/v3/trending              — trending coins (24h)
 *   GET /api/v3/coins/{id}/market_chart — price history
 *   GET /api/v3/search/trending       — trending search terms
 *
 * Attribution required: "Powered by CoinGecko"
 */

const axios = require('axios');
const cache = require('./cache');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Map common symbols to CoinGecko IDs
const SYMBOL_TO_ID = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LTC: 'litecoin',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  XLM: 'stellar',
};

// Reverse map: id → symbol
const ID_TO_SYMBOL = Object.fromEntries(
  Object.entries(SYMBOL_TO_ID).map(([sym, id]) => [id, sym])
);

// Default top coins to track
const DEFAULT_COINS = [
  'bitcoin', 'ethereum', 'binancecoin', 'solana', 'ripple',
  'cardano', 'dogecoin', 'avalanche-2', 'chainlink', 'polkadot'
];

class CoinGeckoService {
  constructor() {
    this.baseURL = COINGECKO_BASE;
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 12000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TradVue/1.0 (tradvue.io; market-data)',
      },
    });

    // Add response interceptor for rate limit handling
    this.httpClient.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 429) {
          console.warn('[CoinGecko] Rate limited — using cached/mock data');
          err.isRateLimit = true;
        }
        return Promise.reject(err);
      }
    );
  }

  /**
   * Get top N coins by market cap with price, change, volume
   */
  async getTopCoins({ limit = 10, currency = 'usd' } = {}) {
    const cacheKey = `coingecko:markets:${currency}:${limit}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      try {
        const { data } = await this.httpClient.get('/coins/markets', {
          params: {
            vs_currency: currency,
            ids: DEFAULT_COINS.slice(0, Math.max(limit, DEFAULT_COINS.length)).join(','),
            order: 'market_cap_desc',
            per_page: Math.min(limit, 100),
            page: 1,
            sparkline: false,
            price_change_percentage: '1h,24h,7d',
          },
        });

        return data.map(coin => this._normalizeCoin(coin));
      } catch (err) {
        if (err.isRateLimit) return this._getMockPrices(limit);
        console.error('[CoinGecko] getTopCoins error:', err.message);
        return this._getMockPrices(limit);
      }
    }, 60); // Cache 1 minute — crypto moves fast
  }

  /**
   * Quick price lookup for specific symbols
   * e.g. getPrice(['BTC', 'ETH']) → { BTC: { usd: 67420, usd_24h_change: -1.2 }, ... }
   */
  async getPrices(symbols = ['BTC', 'ETH'], currency = 'usd') {
    const ids = symbols
      .map(s => SYMBOL_TO_ID[s.toUpperCase()])
      .filter(Boolean)
      .join(',');

    if (!ids) return {};

    const cacheKey = `coingecko:prices:${ids}:${currency}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      try {
        const { data } = await this.httpClient.get('/simple/price', {
          params: {
            ids,
            vs_currencies: currency,
            include_24hr_change: true,
            include_24hr_vol: true,
            include_market_cap: true,
          },
        });

        // Re-key by symbol instead of CoinGecko ID
        const result = {};
        for (const [id, priceData] of Object.entries(data)) {
          const symbol = ID_TO_SYMBOL[id] || id.toUpperCase();
          result[symbol] = {
            price: priceData[currency],
            change24h: priceData[`${currency}_24h_change`] || 0,
            volume24h: priceData[`${currency}_24h_vol`] || 0,
            marketCap: priceData[`${currency}_market_cap`] || 0,
          };
        }
        return result;
      } catch (err) {
        if (err.isRateLimit) return {};
        console.error('[CoinGecko] getPrices error:', err.message);
        return {};
      }
    }, 30); // Cache 30 seconds
  }

  /**
   * Get trending coins (by search volume in last 24h)
   */
  async getTrending() {
    const cacheKey = 'coingecko:trending';

    return await cache.cacheAPICall(cacheKey, async () => {
      try {
        const { data } = await this.httpClient.get('/search/trending');
        return (data.coins || []).slice(0, 7).map(item => ({
          id: item.item.id,
          symbol: item.item.symbol.toUpperCase(),
          name: item.item.name,
          rank: item.item.market_cap_rank,
          thumb: item.item.thumb,
          score: item.item.score,
        }));
      } catch (err) {
        console.error('[CoinGecko] getTrending error:', err.message);
        return [];
      }
    }, 300); // Cache 5 minutes
  }

  /**
   * Get price history for a coin (OHLC-style daily data)
   */
  async getPriceHistory(symbol, { days = 7, currency = 'usd' } = {}) {
    const id = SYMBOL_TO_ID[symbol.toUpperCase()];
    if (!id) return null;

    const cacheKey = `coingecko:history:${id}:${days}:${currency}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      try {
        const { data } = await this.httpClient.get(`/coins/${id}/market_chart`, {
          params: {
            vs_currency: currency,
            days,
            interval: days <= 1 ? 'hourly' : 'daily',
          },
        });

        return {
          symbol: symbol.toUpperCase(),
          currency,
          days,
          prices: data.prices.map(([ts, price]) => ({
            timestamp: new Date(ts).toISOString(),
            price,
          })),
        };
      } catch (err) {
        console.error('[CoinGecko] getPriceHistory error:', err.message);
        return null;
      }
    }, 300); // Cache 5 minutes
  }

  /**
   * Get a full snapshot: top coins + trending
   */
  async getCryptoSnapshot({ limit = 10 } = {}) {
    const cacheKey = `coingecko:snapshot:${limit}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      const [topCoins, trending] = await Promise.allSettled([
        this.getTopCoins({ limit }),
        this.getTrending(),
      ]);

      return {
        topCoins: topCoins.status === 'fulfilled' ? topCoins.value : [],
        trending: trending.status === 'fulfilled' ? trending.value : [],
        source: 'CoinGecko',
        attribution: 'Powered by CoinGecko',
        timestamp: new Date().toISOString(),
      };
    }, 60);
  }

  /**
   * Normalize raw CoinGecko markets response to our schema
   */
  _normalizeCoin(coin) {
    return {
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      image: coin.image,
      price: coin.current_price,
      marketCap: coin.market_cap,
      marketCapRank: coin.market_cap_rank,
      volume24h: coin.total_volume,
      change1h: coin.price_change_percentage_1h_in_currency || 0,
      change24h: coin.price_change_percentage_24h || 0,
      change7d: coin.price_change_percentage_7d_in_currency || 0,
      high24h: coin.high_24h,
      low24h: coin.low_24h,
      ath: coin.ath,
      athDate: coin.ath_date,
      circulatingSupply: coin.circulating_supply,
      lastUpdated: coin.last_updated,
    };
  }

  /**
   * Mock data for when CoinGecko is rate limited or down
   */
  _getMockPrices(limit = 10) {
    const mockCoins = [
      { id: 'bitcoin',       symbol: 'BTC',  name: 'Bitcoin',   price: 67420.50, change24h: -1.23, change7d: 3.45, marketCap: 1320000000000, volume24h: 28500000000, marketCapRank: 1  },
      { id: 'ethereum',      symbol: 'ETH',  name: 'Ethereum',  price: 3512.80,  change24h: 2.14,  change7d: 5.67, marketCap: 422000000000,  volume24h: 15200000000, marketCapRank: 2  },
      { id: 'binancecoin',   symbol: 'BNB',  name: 'BNB',       price: 412.30,   change24h: 0.87,  change7d: 2.10, marketCap: 63500000000,   volume24h: 1800000000,  marketCapRank: 4  },
      { id: 'solana',        symbol: 'SOL',  name: 'Solana',    price: 182.40,   change24h: 4.32,  change7d: 8.90, marketCap: 82000000000,   volume24h: 3200000000,  marketCapRank: 5  },
      { id: 'ripple',        symbol: 'XRP',  name: 'XRP',       price: 0.6124,   change24h: -0.54, change7d: 1.23, marketCap: 34500000000,   volume24h: 1500000000,  marketCapRank: 6  },
      { id: 'cardano',       symbol: 'ADA',  name: 'Cardano',   price: 0.4821,   change24h: 1.05,  change7d: -2.1, marketCap: 17200000000,   volume24h: 580000000,   marketCapRank: 9  },
      { id: 'dogecoin',      symbol: 'DOGE', name: 'Dogecoin',  price: 0.1642,   change24h: 3.21,  change7d: 12.4, marketCap: 23800000000,   volume24h: 2100000000,  marketCapRank: 8  },
      { id: 'avalanche-2',   symbol: 'AVAX', name: 'Avalanche', price: 38.72,    change24h: -1.87, change7d: 4.56, marketCap: 15900000000,   volume24h: 720000000,   marketCapRank: 10 },
      { id: 'chainlink',     symbol: 'LINK', name: 'Chainlink', price: 17.83,    change24h: 2.43,  change7d: 6.78, marketCap: 10500000000,   volume24h: 620000000,   marketCapRank: 12 },
      { id: 'polkadot',      symbol: 'DOT',  name: 'Polkadot',  price: 8.41,     change24h: -0.32, change7d: 1.89, marketCap: 11300000000,   volume24h: 350000000,   marketCapRank: 13 },
    ];

    return mockCoins.slice(0, limit).map(c => ({
      ...c,
      change1h: 0,
      image: null,
      high24h: c.price * 1.03,
      low24h: c.price * 0.97,
      ath: c.price * 2.1,
      athDate: '2021-11-10T00:00:00.000Z',
      circulatingSupply: c.marketCap / c.price,
      lastUpdated: new Date().toISOString(),
    }));
  }
}

module.exports = new CoinGeckoService();
