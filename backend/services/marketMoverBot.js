/**
 * Market Mover Bot
 * 
 * Actively monitors for market-affecting news and events.
 * Posts headlines + links for high-impact items.
 * 
 * Legal compliance:
 * - Uses only public RSS feeds and official APIs
 * - Posts headlines + links only (fair use, no full content)
 * - Respects rate limits
 * - Attributes all sources
 * 
 * Run via cron every 5-15 minutes for real-time alerts.
 */

const RSSParser = require('rss-parser');
const axios = require('axios');
const cache = require('./cache');

const parser = new RSSParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'TradVue/1.0 (tradvue.io; market-mover-bot)'
  }
});

// ─────────────────────────────────────────────
// High-Impact Sources (prioritized for speed)
// ─────────────────────────────────────────────
const PRIORITY_FEEDS = [
  // Central Banks - Highest impact
  {
    name: 'Federal Reserve',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    impactMultiplier: 2.0,
    category: 'central-bank'
  },
  {
    name: 'ECB',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    impactMultiplier: 1.8,
    category: 'central-bank'
  },
  // Breaking news wires
  {
    name: 'MarketWatch Breaking',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',
    impactMultiplier: 1.3,
    category: 'breaking'
  },
  {
    name: 'WSJ Markets',
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    impactMultiplier: 1.3,
    category: 'breaking'
  },
  // Breaking/wire services
  {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    impactMultiplier: 1.1,
    category: 'breaking'
  },
  {
    name: 'Seeking Alpha',
    url: 'https://seekingalpha.com/market_currents.xml',
    impactMultiplier: 1.2,
    category: 'breaking'
  },
  // Crypto (moves fast)
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    impactMultiplier: 1.1,
    category: 'crypto'
  },
  {
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    impactMultiplier: 1.2,
    category: 'crypto'
  }
];

// ─────────────────────────────────────────────
// Market-Moving Keywords (triggers high impact score)
// ─────────────────────────────────────────────
const MARKET_MOVING_PATTERNS = [
  // Central Bank Actions
  { pattern: /\b(fed|federal reserve|fomc)\b.*\b(rate|hike|cut|decision|statement|powell)\b/i, score: 10, tag: 'fed' },
  { pattern: /\b(ecb|european central bank)\b.*\b(rate|decision|lagarde)\b/i, score: 9, tag: 'ecb' },
  { pattern: /\b(boj|bank of japan)\b.*\b(rate|yield|yen)\b/i, score: 9, tag: 'boj' },
  { pattern: /\binterest rate\b.*\b(hike|cut|increase|decrease|decision)\b/i, score: 9, tag: 'rates' },
  
  // Economic Data
  { pattern: /\b(cpi|inflation)\b.*\b(rise|fall|higher|lower|surprise|miss|beat)\b/i, score: 9, tag: 'inflation' },
  { pattern: /\b(non-?farm payroll|nfp|jobs report)\b/i, score: 9, tag: 'employment' },
  { pattern: /\b(gdp)\b.*\b(growth|contract|surprise|beat|miss)\b/i, score: 8, tag: 'gdp' },
  { pattern: /\bunemployment\b.*\b(rise|fall|jump|drop)\b/i, score: 8, tag: 'employment' },
  
  // Corporate Events
  { pattern: /\b(earnings|revenue)\b.*\b(beat|miss|surprise|guidance)\b/i, score: 7, tag: 'earnings' },
  { pattern: /\b(merger|acquisition|acquires?|buys?)\b.*\b(billion|million|deal)\b/i, score: 8, tag: 'ma' },
  { pattern: /\b(bankruptcy|chapter 11|default|insolvency)\b/i, score: 9, tag: 'bankruptcy' },
  { pattern: /\b(layoffs?|job cuts?)\b.*\b(thousand|million|\d{4,})\b/i, score: 7, tag: 'layoffs' },
  
  // Market Events
  { pattern: /\bmarket\b.*\b(crash|plunge|surge|rally|halt)\b/i, score: 9, tag: 'market-move' },
  { pattern: /\b(s&p|dow|nasdaq|russell)\b.*\b(record|crash|plunge|surge)\b/i, score: 8, tag: 'indices' },
  { pattern: /\b(bitcoin|btc|ethereum|eth)\b.*\b(surge|crash|plunge|rally|all-?time high|ath)\b/i, score: 8, tag: 'crypto' },
  
  // Geopolitical
  { pattern: /\b(war|invasion|sanctions|tariff)\b.*\b(russia|china|iran|trade)\b/i, score: 9, tag: 'geopolitical' },
  { pattern: /\b(opec)\b.*\b(cut|production|output|supply)\b/i, score: 8, tag: 'oil' },
  
  // Breaking Urgency
  { pattern: /\bbreaking\b/i, score: 3, tag: 'breaking' },  // Additive
  { pattern: /\burgent\b/i, score: 2, tag: 'urgent' },
  { pattern: /\bjust in\b/i, score: 2, tag: 'breaking' }
];

// ─────────────────────────────────────────────
// Bot Class
// ─────────────────────────────────────────────
class MarketMoverBot {
  constructor() {
    this.seenArticles = new Map();  // URL -> timestamp (for dedup)
    this.lastRun = null;
    this.ARTICLE_TTL = 24 * 60 * 60 * 1000;  // 24 hours
  }

  /**
   * Main scan function - call this on a cron
   * Returns array of high-impact news items found since last scan
   */
  async scan({ impactThreshold = 7, maxAge = 30 } = {}) {
    const startTime = Date.now();
    const maxAgeMs = maxAge * 60 * 1000;  // Convert minutes to ms
    
    // Clean old entries from seen cache
    this._cleanSeenCache();

    // Fetch all priority feeds concurrently
    const feedResults = await Promise.allSettled(
      PRIORITY_FEEDS.map(feed => this._fetchFeed(feed))
    );

    const allArticles = [];
    feedResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      } else {
        console.warn(`[MarketMover] Feed "${PRIORITY_FEEDS[i].name}" failed: ${result.reason?.message}`);
      }
    });

    // Filter: only new articles within maxAge
    const cutoff = Date.now() - maxAgeMs;
    const newArticles = allArticles.filter(article => {
      // Skip if already seen
      if (this.seenArticles.has(article.url)) return false;
      
      // Check age
      const pubDate = new Date(article.publishedAt).getTime();
      if (pubDate < cutoff) return false;
      
      // Mark as seen
      this.seenArticles.set(article.url, Date.now());
      return true;
    });

    // Filter by impact threshold and sort
    const highImpact = newArticles
      .filter(a => a.impactScore >= impactThreshold)
      .sort((a, b) => b.impactScore - a.impactScore);

    this.lastRun = new Date().toISOString();
    
    return {
      found: highImpact.length,
      articles: highImpact,
      scannedFeeds: PRIORITY_FEEDS.length,
      scanDuration: Date.now() - startTime,
      timestamp: this.lastRun
    };
  }

  /**
   * Get all recent market movers (cached for display)
   */
  async getRecentMovers({ limit = 20, hours = 4 } = {}) {
    const cacheKey = `market-movers:recent:${hours}`;
    
    return await cache.cacheAPICall(cacheKey, async () => {
      // Scan with lower threshold to get more results
      const scan = await this.scan({ impactThreshold: 5, maxAge: hours * 60 });
      return scan.articles.slice(0, limit);
    }, 300);  // Cache 5 minutes
  }

  /**
   * Fetch and score a single feed
   */
  async _fetchFeed(feedConfig) {
    const feed = await parser.parseURL(feedConfig.url);
    
    return (feed.items || []).slice(0, 15).map(item => {
      const title = item.title || '';
      const summary = item.contentSnippet || item.content || '';
      const text = `${title} ${summary}`.toLowerCase();
      
      // Calculate impact score
      let impactScore = 0;
      const tags = [];
      
      for (const pattern of MARKET_MOVING_PATTERNS) {
        if (pattern.pattern.test(title) || pattern.pattern.test(summary)) {
          impactScore += pattern.score;
          tags.push(pattern.tag);
        }
      }
      
      // Apply source multiplier
      impactScore *= feedConfig.impactMultiplier;
      
      // Normalize to 0-10 scale
      impactScore = Math.min(impactScore, 10);
      
      return {
        id: item.guid || item.link || `mm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: title.trim(),
        summary: summary.slice(0, 300).trim(),
        url: item.link || null,
        source: feedConfig.name,
        category: feedConfig.category,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        impactScore: parseFloat(impactScore.toFixed(1)),
        impactLabel: impactScore >= 8 ? 'Critical' : impactScore >= 6 ? 'High' : impactScore >= 4 ? 'Medium' : 'Low',
        tags: [...new Set(tags)],
        isMarketMover: impactScore >= 7
      };
    });
  }

  /**
   * Clean old entries from the seen cache
   */
  _cleanSeenCache() {
    const cutoff = Date.now() - this.ARTICLE_TTL;
    for (const [url, timestamp] of this.seenArticles.entries()) {
      if (timestamp < cutoff) {
        this.seenArticles.delete(url);
      }
    }
  }

  /**
   * Format alert for posting (headline + link)
   */
  formatAlert(article) {
    const impactEmoji = article.impactScore >= 8 ? '🚨' : article.impactScore >= 6 ? '⚠️' : '📰';
    const tags = article.tags.length > 0 ? ` [${article.tags.slice(0, 3).join(', ')}]` : '';
    
    return {
      text: `${impactEmoji} **${article.title}**${tags}\n_${article.source}_\n${article.url}`,
      markdown: `${impactEmoji} **${article.title}**${tags}\n\n_Source: ${article.source}_\n[Read more](${article.url})`,
      plain: `${impactEmoji} ${article.title} [${article.source}] - ${article.url}`
    };
  }
}

module.exports = new MarketMoverBot();
