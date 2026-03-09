/**
 * Alert Service
 *
 * Real-time market alert engine for TradVue.
 *
 * Responsibilities:
 *   1. Poll RSS feeds for high-impact market-moving news
 *   2. Filter & score articles against keyword taxonomy
 *   3. Classify into categories (POLITICAL, FED, ECONOMIC, EARNINGS, BREAKING)
 *   4. Score urgency (HIGH / MEDIUM / LOW)
 *   5. Persist new alerts to the DB (dedup via external_id)
 *   6. Broadcast to connected SSE clients in real-time
 *
 * Uses the existing rssFeedAggregator for feed parsing so we don't duplicate
 * HTTP logic. Adds the market-alert–specific keyword layer on top.
 */

const db = require('./db');
const rss = require('./rssFeedAggregator');

// ─────────────────────────────────────────────────────────────────────────────
// Keyword taxonomy
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS = {
  POLITICAL: [
    'trump', 'biden', 'congress', 'senate', 'house representatives',
    'white house', 'executive order', 'sanctions', 'geopolitical',
    'tariff', 'trade war', 'trade deal', 'import tax', 'export ban',
    'election', 'president', 'administration', 'regulatory', 'antitrust',
  ],
  FED: [
    'federal reserve', 'fed rate', 'fomc', 'powell', 'interest rate',
    'rate hike', 'rate cut', 'rate hold', 'basis points', 'bps',
    'monetary policy', 'quantitative easing', 'qe', 'tapering',
    'central bank', 'treasury yield', 'yield curve', 'bond market',
    'fed minutes', 'fed meeting', 'dot plot',
  ],
  ECONOMIC: [
    'inflation', 'cpi', 'consumer price', 'pce', 'deflation',
    'jobs report', 'nonfarm payroll', 'unemployment', 'jobless claims',
    'gdp', 'gross domestic product', 'recession', 'economic growth',
    'retail sales', 'housing starts', 'pmi', 'ism manufacturing',
    'consumer confidence', 'trade deficit', 'current account',
    'wage growth', 'labor market', 'supply chain',
  ],
  EARNINGS: [
    'earnings', 'quarterly results', 'q1 results', 'q2 results',
    'q3 results', 'q4 results', 'eps', 'revenue beat', 'revenue miss',
    'guidance', 'raised guidance', 'lowered guidance', 'outlook',
    'profit', 'loss', 'ipo', 'initial public offering', 'merger',
    'acquisition', 'buyout', 'dividend', 'stock split', 'buyback',
  ],
  BREAKING: [
    'breaking', 'urgent', 'flash crash', 'circuit breaker',
    'market halt', 'trading halt', 'black swan', 'systemic risk',
    'bank run', 'contagion', 'liquidity crisis', 'credit crisis',
    'default', 'bankruptcy', 'chapter 11', 'bailout', 'intervention',
    'war', 'conflict', 'attack', 'earthquake', 'pandemic', 'outbreak',
  ],
};

// Urgency thresholds per category
const HIGH_URGENCY_KEYWORDS = new Set([
  // Fed
  'fomc', 'rate hike', 'rate cut', 'emergency meeting', 'fed rate',
  // Political
  'tariff', 'sanctions', 'executive order', 'trade war',
  // Economic
  'nonfarm payroll', 'jobs report', 'cpi', 'inflation', 'recession', 'gdp',
  // Breaking
  'breaking', 'urgent', 'flash crash', 'circuit breaker', 'market halt',
  'default', 'bankruptcy', 'bailout', 'war', 'pandemic',
  // Earnings
  'earnings', 'revenue beat', 'revenue miss',
]);

// ─────────────────────────────────────────────────────────────────────────────
// SSE Client Registry
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, import('http').ServerResponse>} */
const sseClients = new Map();

let clientIdCounter = 0;

/**
 * Register a new SSE client connection.
 * @param {import('http').ServerResponse} res
 * @returns {string} clientId
 */
function registerSSEClient(res) {
  const id = `sse-${++clientIdCounter}-${Date.now()}`;
  sseClients.set(id, res);

  res.on('close', () => {
    sseClients.delete(id);
    console.info(`[Alerts] SSE client disconnected: ${id} (${sseClients.size} remaining)`);
  });

  console.info(`[Alerts] SSE client connected: ${id} (${sseClients.size} total)`);
  return id;
}

/**
 * Broadcast a market alert to all connected SSE clients.
 * @param {Object} alert
 */
function broadcastAlert(alert) {
  const payload = `data: ${JSON.stringify(alert)}\n\n`;
  let dead = [];

  for (const [id, res] of sseClients) {
    try {
      res.write(payload);
    } catch (err) {
      console.warn(`[Alerts] Failed to write to SSE client ${id}:`, err.message);
      dead.push(id);
    }
  }

  dead.forEach(id => sseClients.delete(id));

  if (sseClients.size > 0) {
    console.info(`[Alerts] Broadcast to ${sseClients.size} SSE clients: [${alert.urgency}] ${alert.title?.slice(0, 60)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Classification & Scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify an article's category based on keyword hits.
 * Returns the category with the most keyword matches.
 * Falls back to BREAKING if no keywords match but impact is high enough.
 *
 * @param {string} text - Lowercased combined title+summary
 * @returns {{ category: string, keywordsHit: string[] }}
 */
function classifyCategory(text) {
  const scores = {};

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = keywords.filter(kw => text.includes(kw));
    if (hits.length > 0) {
      scores[cat] = { count: hits.length, hits };
    }
  }

  if (Object.keys(scores).length === 0) {
    return { category: 'BREAKING', keywordsHit: [] };
  }

  // Pick category with most keyword hits; tie-break by priority order
  const priority = ['FED', 'ECONOMIC', 'POLITICAL', 'EARNINGS', 'BREAKING'];
  const sorted = Object.entries(scores).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return priority.indexOf(a[0]) - priority.indexOf(b[0]);
  });

  const [category, { hits }] = sorted[0];
  return { category, keywordsHit: hits };
}

/**
 * Score urgency based on keyword hits and RSS impact score.
 *
 * @param {string} text
 * @param {string[]} keywordsHit
 * @param {number} rssImpactScore - 0..10 from rssFeedAggregator
 * @returns {{ urgency: string, urgencyScore: number }}
 */
function scoreUrgency(text, keywordsHit, rssImpactScore) {
  const highHits = keywordsHit.filter(kw => HIGH_URGENCY_KEYWORDS.has(kw)).length;
  const totalHits = keywordsHit.length;

  // Base urgency score (0-100)
  let score = (rssImpactScore / 10) * 50;  // RSS score contributes up to 50 pts
  score += highHits * 15;                  // Each high-urgency keyword adds 15 pts
  score += totalHits * 5;                  // Each keyword hit adds 5 pts

  score = Math.min(score, 100);

  let urgency;
  if (score >= 60 || highHits >= 1) {
    urgency = 'HIGH';
  } else if (score >= 30 || totalHits >= 2) {
    urgency = 'MEDIUM';
  } else {
    urgency = 'LOW';
  }

  return { urgency, urgencyScore: parseFloat(score.toFixed(2)) };
}

/**
 * Transform a raw RSS article into a market alert.
 * Returns null if the article doesn't qualify as a market alert.
 *
 * @param {Object} article - From rssFeedAggregator
 * @returns {Object|null}
 */
function transformToAlert(article) {
  const text = `${article.title} ${article.summary || ''}`.toLowerCase();

  const { category, keywordsHit } = classifyCategory(text);
  if (keywordsHit.length === 0 && article.impactScore < 4) {
    return null; // Not market-moving enough
  }

  const { urgency, urgencyScore } = scoreUrgency(text, keywordsHit, article.impactScore || 0);

  return {
    external_id: article.id || article.url,
    title: article.title,
    summary: article.summary || null,
    url: article.url || null,
    source: article.source,
    category,
    urgency,
    urgency_score: urgencyScore,
    keywords_hit: keywordsHit,
    symbols: article.symbols || [],
    tags: article.tags || [],
    sentiment: article.sentimentLabel || 'neutral',
    sentiment_score: article.sentimentScore || 0,
    published_at: article.publishedAt || new Date().toISOString(),
    fetched_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a batch of alerts. Skips duplicates via ON CONFLICT DO NOTHING.
 * Returns the newly inserted alerts (for SSE broadcast).
 *
 * @param {Object[]} alerts
 * @returns {Promise<Object[]>}
 */
async function persistAlerts(alerts) {
  if (!alerts.length) return [];

  const newAlerts = [];

  for (const alert of alerts) {
    try {
      const result = await db.query(
        `INSERT INTO market_alerts
          (external_id, title, summary, url, source, category, urgency, urgency_score,
           keywords_hit, symbols, tags, sentiment, sentiment_score, published_at, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (external_id) DO NOTHING
         RETURNING *`,
        [
          alert.external_id,
          alert.title,
          alert.summary,
          alert.url,
          alert.source,
          alert.category,
          alert.urgency,
          alert.urgency_score,
          alert.keywords_hit,
          alert.symbols,
          alert.tags,
          alert.sentiment,
          alert.sentiment_score,
          alert.published_at,
          alert.fetched_at,
        ]
      );

      if (result.rows.length > 0) {
        newAlerts.push(result.rows[0]);
      }
    } catch (err) {
      console.error('[Alerts] DB insert error:', err.message);
    }
  }

  return newAlerts;
}

/**
 * Fetch recent alerts from DB.
 *
 * @param {Object} opts
 * @param {number} opts.limit
 * @param {string|null} opts.category - Filter by category
 * @param {string|null} opts.urgency  - Filter by urgency
 * @param {number} opts.offsetMinutes - Look back this many minutes
 * @returns {Promise<Object[]>}
 */
async function getRecentAlerts({ limit = 50, category = null, urgency = null, offsetMinutes = 1440 } = {}) {
  const conditions = ['created_at > NOW() - $1::interval', 'is_dismissed = FALSE'];
  const params = [`${offsetMinutes} minutes`];
  let i = 2;

  if (category) {
    conditions.push(`category = $${i++}`);
    params.push(category.toUpperCase());
  }

  if (urgency) {
    conditions.push(`urgency = $${i++}`);
    params.push(urgency.toUpperCase());
  }

  params.push(limit);

  const sql = `
    SELECT * FROM market_alerts
    WHERE ${conditions.join(' AND ')}
    ORDER BY urgency_score DESC, created_at DESC
    LIMIT $${i}
  `;

  const result = await db.query(sql, params);
  return result.rows;
}

/**
 * Get unread HIGH-urgency alert count (for badge).
 * @returns {Promise<number>}
 */
async function getUnreadCount() {
  try {
    const result = await db.query(
      `SELECT COUNT(*) FROM market_alerts
       WHERE is_read = FALSE AND urgency = 'HIGH'
       AND created_at > NOW() - INTERVAL '24 hours'`
    );
    return parseInt(result.rows[0].count, 10);
  } catch {
    return 0;
  }
}

/**
 * Mark alerts as read.
 * @param {number[]} ids
 */
async function markAsRead(ids) {
  if (!ids?.length) return;
  await db.query(
    'UPDATE market_alerts SET is_read = TRUE WHERE id = ANY($1)',
    [ids]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Poll Loop
// ─────────────────────────────────────────────────────────────────────────────

let pollIntervalId = null;
let isPolling = false;
let tableCheckDone = false;
let tableExists = false;

/**
 * Check if market_alerts table exists.
 */
async function checkTableExists() {
  if (tableCheckDone) return tableExists;
  try {
    await db.query('SELECT 1 FROM market_alerts LIMIT 1');
    tableExists = true;
  } catch (err) {
    if (err.message.includes('does not exist')) {
      console.warn('[Alerts] market_alerts table not found — polling disabled. Run migrations to enable.');
      tableExists = false;
    } else {
      throw err;
    }
  }
  tableCheckDone = true;
  return tableExists;
}

/**
 * Run one poll cycle: fetch RSS → filter → score → persist → broadcast.
 */
async function runPollCycle() {
  if (isPolling) return; // Prevent concurrent runs
  isPolling = true;

  // Skip if table doesn't exist
  if (!(await checkTableExists())) {
    isPolling = false;
    return;
  }

  try {
    console.info('[Alerts] Running poll cycle…');

    let articles;
    try {
      articles = await rss.getAggregatedNews({ limit: 100, minImpact: 2 });
    } catch (err) {
      console.warn('[Alerts] RSS fetch failed:', err.message);
      isPolling = false;
      return;
    }

    const candidates = articles
      .map(transformToAlert)
      .filter(Boolean);

    if (candidates.length === 0) {
      console.info('[Alerts] No qualifying alerts in this cycle.');
      isPolling = false;
      return;
    }

    const newAlerts = await persistAlerts(candidates);

    if (newAlerts.length > 0) {
      console.info(`[Alerts] Persisted ${newAlerts.length} new alert(s). Broadcasting…`);
      // Broadcast HIGH first, then MEDIUM, then LOW
      const sorted = newAlerts.sort((a, b) => {
        const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return order[a.urgency] - order[b.urgency];
      });
      sorted.forEach(broadcastAlert);
    } else {
      console.info('[Alerts] All articles already processed (deduped).');
    }
  } catch (err) {
    console.error('[Alerts] Poll cycle error:', err.message);
  } finally {
    isPolling = false;
  }
}

/**
 * Start the alert poll loop.
 * @param {number} intervalMs - Default 5 minutes
 */
function startPolling(intervalMs = 5 * 60 * 1000) {
  if (pollIntervalId) {
    console.warn('[Alerts] Poll loop already running.');
    return;
  }

  console.info(`[Alerts] Starting poll loop (interval: ${intervalMs / 1000}s)`);

  // Run once immediately on start
  runPollCycle();

  pollIntervalId = setInterval(runPollCycle, intervalMs);
}

/**
 * Stop the alert poll loop (for clean shutdown / tests).
 */
function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
    console.info('[Alerts] Poll loop stopped.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User Subscription CRUD
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SUBSCRIPTION = {
  categories: ['POLITICAL', 'FED', 'ECONOMIC', 'EARNINGS', 'BREAKING'],
  urgencies: ['HIGH', 'MEDIUM'],
  sound_enabled: true,
  email_enabled: false,
  push_enabled: true,
};

/**
 * Get or create subscription for a user.
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getSubscription(userId) {
  try {
    const result = await db.query(
      'SELECT * FROM alert_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length > 0) return result.rows[0];

    // Auto-create defaults
    const insert = await db.query(
      `INSERT INTO alert_subscriptions (user_id, categories, urgencies, sound_enabled, email_enabled, push_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        DEFAULT_SUBSCRIPTION.categories,
        DEFAULT_SUBSCRIPTION.urgencies,
        DEFAULT_SUBSCRIPTION.sound_enabled,
        DEFAULT_SUBSCRIPTION.email_enabled,
        DEFAULT_SUBSCRIPTION.push_enabled,
      ]
    );

    return insert.rows[0];
  } catch (err) {
    console.error('[Alerts] getSubscription error:', err.message);
    throw err;
  }
}

/**
 * Upsert user alert subscription preferences.
 * @param {number} userId
 * @param {Object} prefs
 * @returns {Promise<Object>}
 */
async function upsertSubscription(userId, prefs) {
  const {
    categories = DEFAULT_SUBSCRIPTION.categories,
    urgencies = DEFAULT_SUBSCRIPTION.urgencies,
    sound_enabled = true,
    email_enabled = false,
    push_enabled = true,
  } = prefs;

  const result = await db.query(
    `INSERT INTO alert_subscriptions (user_id, categories, urgencies, sound_enabled, email_enabled, push_enabled)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       categories    = EXCLUDED.categories,
       urgencies     = EXCLUDED.urgencies,
       sound_enabled = EXCLUDED.sound_enabled,
       email_enabled = EXCLUDED.email_enabled,
       push_enabled  = EXCLUDED.push_enabled,
       updated_at    = NOW()
     RETURNING *`,
    [userId, categories, urgencies, sound_enabled, email_enabled, push_enabled]
  );

  return result.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // SSE
  registerSSEClient,
  broadcastAlert,
  getSSEClientCount: () => sseClients.size,

  // Classification (exported for testing)
  classifyCategory,
  scoreUrgency,
  transformToAlert,

  // DB ops
  persistAlerts,
  getRecentAlerts,
  getUnreadCount,
  markAsRead,

  // Subscriptions
  getSubscription,
  upsertSubscription,

  // Poll loop
  startPolling,
  stopPolling,
  runPollCycle,

  // Constants (exported for testing)
  CATEGORY_KEYWORDS,
  HIGH_URGENCY_KEYWORDS,
};
