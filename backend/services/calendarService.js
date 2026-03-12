/**
 * Comprehensive Calendar Service
 *
 * Aggregates events from:
 *  1. ForexFactory JSON API — this week  (economic events + speakers)
 *  2. ForexFactory JSON API — next week
 *  3. Finnhub Earnings Calendar
 *  4. Finnhub Economic Calendar (speeches, rate decisions, etc.)
 *  5. Federal Reserve RSS feed (speeches, statements)
 *
 * Unified endpoint returns typed events:
 *   economic | earnings | speech | holiday
 */

const axios = require('axios');
const RSSParser = require('rss-parser');
const cache = require('./cache');

const rssParser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'TradVue/1.0 (tradvue.com; calendar-bot)' }
});

// ─── Type Classification ────────────────────────────────────────────────────

const SPEECH_KEYWORDS = [
  'speaks', 'speech', 'testimony', 'chair', 'governor', 'president',
  'member', 'comments', 'statement', 'press conference', 'press briefing',
  'remarks', 'forum', 'panel', 'interview', 'hearing',
  'minutes', 'reserve bank', 'central bank',
  'fomc', 'mpc', 'ecb', 'boe', 'boc', 'rba', 'rbnz', 'boj',
  'lagarde', 'powell', 'bailey', 'waller', 'bowman', 'jefferson',
  'kashkari', 'bostic', 'logan', 'daly', 'kugler', 'cook', 'williams',
  'barkin', 'harker', 'mester', 'collins', 'schmid', 'goolsbee',
  'hammack', 'mueller', 'nagel', 'villeroy', 'lane', 'schnabel',
  'de guindos', 'elderson', 'panetta', 'cipollone'
];

const RATE_DECISION_KEYWORDS = [
  'interest rate', 'rate decision', 'monetary policy', 'rate statement',
  'fed decision', 'fomc decision', 'ecb decision', 'boe decision',
  'boc decision', 'rba decision', 'rbnz decision', 'boj decision',
  'cash rate', 'refinancing rate', 'bank rate'
];

function classifyEventType(title, source, impact) {
  const lower = title.toLowerCase();

  if (lower.includes('holiday') || lower.includes('daylight saving') || impact === 'Holiday') {
    return 'holiday';
  }
  if (source === 'Finnhub') return 'earnings';

  // Check rate decisions first (subset of speech but important to flag as speech)
  for (const kw of RATE_DECISION_KEYWORDS) {
    if (lower.includes(kw)) return 'speech';
  }

  for (const kw of SPEECH_KEYWORDS) {
    if (lower.includes(kw)) return 'speech';
  }

  return 'economic';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a Date to YYYY-MM-DD string in US Eastern Time (most financial events are ET).
 * This ensures "today" matches ForexFactory's ET-based dates.
 */
function toDateStr(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // en-CA gives YYYY-MM-DD
}

function parseDate(str) {
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch {
    return new Date(0);
  }
}

/**
 * Get start/end of a date in ET for proper "today" filtering.
 * ForexFactory events use ET dates, so we must compare in ET.
 */
function getETDayBounds(date) {
  const etDateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  // Create boundaries using ET midnight
  const start = new Date(`${etDateStr}T00:00:00-04:00`);
  const end = new Date(`${etDateStr}T23:59:59-04:00`);
  return { start, end, dateStr: etDateStr };
}

// ─── Request deduplication ───────────────────────────────────────────────────
// Prevents multiple simultaneous fetches to the same URL (startup stampede)
const inflight = new Map();

async function dedupedFetch(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * Normalize a ForexFactory date string to ISO 8601.
 * FF format: "03-11-2026T08:30:00-0500"  (MM-DD-YYYYTHH:MM:SS±HHMM)
 */
function normalizeFfDate(dateStr) {
  if (!dateStr) return dateStr;
  const ffMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})T(.+)$/);
  if (!ffMatch) return dateStr;
  let iso = `${ffMatch[3]}-${ffMatch[1]}-${ffMatch[2]}T${ffMatch[4]}`;
  // Normalize timezone offset: -0500 → -05:00
  iso = iso.replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3');
  return iso;
}

// ─── ForexFactory (JSON) ─────────────────────────────────────────────────────

async function fetchForexFactoryWeek(week = 'thisweek') {
  // Include today's ET date in cache key so cache auto-busts at midnight ET
  const todayET = toDateStr(new Date());
  const CACHE_KEY = `calendar:ff:${week}:${todayET}`;
  const cached = await cache.get(CACHE_KEY).catch(() => null);
  if (cached) return cached;

  return dedupedFetch(`ff:${week}:${todayET}`, async () => {
    // Double-check cache after acquiring dedup lock
    const cachedAgain = await cache.get(CACHE_KEY).catch(() => null);
    if (cachedAgain) return cachedAgain;

  try {
    const url = `https://nfs.faireconomy.media/ff_calendar_${week}.json`;
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'TradVue/1.0 (tradvue.com; calendar-bot)' }
    });

    const events = (Array.isArray(data) ? data : []).map(e => {
      const title = e.title || '';
      const impact = e.impact || 'Low';
      const type = classifyEventType(title, 'ForexFactory', impact);
      const isoDate = normalizeFfDate(e.date || '');

      const id = `ff-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${(e.date || '').slice(0, 10)}`;

      return {
        id,
        title,
        date: isoDate || e.date || '',
        type,
        impact,
        country: (e.country || 'USD').toUpperCase(),
        forecast: e.forecast || null,
        previous: e.previous || null,
        actual: e.actual || null,
        source: 'ForexFactory'
      };
    });

    // Cache aggressively — FF data rarely changes intraday
    const ttl = week === 'thisweek' ? 7200 : 14400; // 2h this week, 4h next week
    await cache.set(CACHE_KEY, events, ttl).catch(() => {});
    // Keep a long-lived stale copy for 429 fallback (24h)
    await cache.set(CACHE_KEY + ':stale', events, 86400).catch(() => {});
    return events;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      // Next week not published yet — cache empty result briefly
      await cache.set(CACHE_KEY, [], 600).catch(() => {});
    } else if (status === 429) {
      console.warn(`[CalendarService] ForexFactory ${week} rate limited (429) — keeping stale cache`);
      // Don't overwrite cache with empty — return stale data if we had any
      const stale = await cache.get(CACHE_KEY + ':stale').catch(() => null);
      if (stale) return stale;
    } else {
      console.error(`[CalendarService] ForexFactory ${week} fetch failed:`, err.message);
    }
    return [];
  }
  }); // end dedupedFetch
}

async function fetchForexFactory() {
  // Fetch both this week and next week in parallel
  const [thisWeek, nextWeek] = await Promise.all([
    fetchForexFactoryWeek('thisweek'),
    fetchForexFactoryWeek('nextweek')
  ]);

  // Deduplicate by ID (in case of overlap at week boundary)
  const seen = new Set();
  const all = [];
  for (const e of [...thisWeek, ...nextWeek]) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      all.push(e);
    }
  }
  return all;
}

// ─── Finnhub Earnings ────────────────────────────────────────────────────────

async function fetchFinnhubEarnings(from, to) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.warn('[CalendarService] FINNHUB_API_KEY not set, skipping earnings');
    return [];
  }

  const CACHE_KEY = `calendar:earnings:${from}:${to}`;
  const cached = await cache.get(CACHE_KEY).catch(() => null);
  if (cached) return cached;

  try {
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`;
    const { data } = await axios.get(url, { timeout: 15000 });

    const earningsList = data?.earningsCalendar || [];
    const events = earningsList.map(e => {
      const symbol = e.symbol || '';
      const dateStr = e.date || '';
      const hour = e.hour || '';
      let timeStr = dateStr;
      if (hour === 'bmo') timeStr = `${dateStr}T07:00:00-04:00`;       // Before market open (ET)
      else if (hour === 'amc') timeStr = `${dateStr}T16:30:00-04:00`; // After market close (ET)
      else timeStr = `${dateStr}T12:00:00-04:00`;                     // During market hours (ET)

      return {
        id: `fh-earn-${symbol.toLowerCase()}-${dateStr}`,
        title: `${symbol} Earnings`,
        date: timeStr,
        type: 'earnings',
        impact: 'High',
        country: 'USD',
        symbol,
        epsEstimate: e.epsEstimate ?? null,
        epsActual: e.epsActual ?? null,
        revenueEstimate: e.revenueEstimate ?? null,
        revenueActual: e.revenueActual ?? null,
        hour,
        forecast: e.epsEstimate != null ? `EPS: ${e.epsEstimate}` : null,
        previous: null,
        actual: e.epsActual != null ? `EPS: ${e.epsActual}` : null,
        source: 'Finnhub'
      };
    });

    await cache.set(CACHE_KEY, events, 3600).catch(() => {});
    return events;
  } catch (err) {
    console.error('[CalendarService] Finnhub earnings fetch failed:', err.message);
    return [];
  }
}

// ─── Finnhub Economic Calendar ───────────────────────────────────────────────

async function fetchFinnhubEconomic(from, to) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  const CACHE_KEY = `calendar:finnhub-econ:${from}:${to}`;
  const cached = await cache.get(CACHE_KEY).catch(() => null);
  if (cached) return cached;

  try {
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${apiKey}`;
    const { data } = await axios.get(url, { timeout: 15000 });

    const econList = data?.economicCalendar || [];
    const events = econList.map(e => {
      const title = e.event || '';
      const country = (e.country || 'USD').toUpperCase();

      // Map Finnhub impact (number) to string
      let impact = 'Low';
      if (e.impact != null) {
        if (e.impact >= 3) impact = 'High';
        else if (e.impact >= 2) impact = 'Medium';
        else impact = 'Low';
      }

      const type = classifyEventType(title, 'FinnhubEcon', impact);
      const dateStr = e.time || e.date || '';

      return {
        id: `fh-econ-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${dateStr.slice(0, 10)}`,
        title,
        date: dateStr,
        type,
        impact,
        country,
        forecast: e.estimate != null ? String(e.estimate) : null,
        previous: e.prev != null ? String(e.prev) : null,
        actual: e.actual != null ? String(e.actual) : null,
        unit: e.unit || null,
        source: 'Finnhub'
      };
    });

    await cache.set(CACHE_KEY, events, 3600).catch(() => {});
    return events;
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      console.warn('[CalendarService] Finnhub economic calendar returned 403 — API limit or endpoint blocked. Skipping gracefully.');
      // Cache empty result briefly to avoid hammering blocked endpoint
      await cache.set(CACHE_KEY, [], 600).catch(() => {});
    } else {
      console.error('[CalendarService] Finnhub economic calendar fetch failed:', err.message);
    }
    return [];
  }
}

// ─── Federal Reserve RSS ─────────────────────────────────────────────────────

async function fetchFedRSS() {
  const CACHE_KEY = 'calendar:fed:rss';
  const cached = await cache.get(CACHE_KEY).catch(() => null);
  if (cached) return cached;

  try {
    const url = 'https://www.federalreserve.gov/feeds/press_all.xml';
    const feed = await rssParser.parseURL(url);

    const cutoffBack = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const cutoffFwd = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    const events = (feed.items || [])
      .filter(item => {
        const d = new Date(item.pubDate || item.isoDate);
        return d >= cutoffBack && d <= cutoffFwd;
      })
      .map(item => {
        const title = item.title || '';
        // Parse pubDate through Date to normalize malformed strings like "Tue, 10 Ma"
        const rawDate = item.pubDate || item.isoDate || '';
        const parsedDate = rawDate ? new Date(rawDate) : new Date();
        const date = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
        const lower = title.toLowerCase();

        let impact = 'Medium';
        if (lower.includes('chair') || lower.includes('fomc') || lower.includes('minutes') ||
            lower.includes('rate decision') || lower.includes('monetary policy')) impact = 'High';
        else if (lower.includes('speech') || lower.includes('remarks') || lower.includes('governor') ||
                 lower.includes('president') || lower.includes('member')) impact = 'Medium';
        else impact = 'Low';

        const type = classifyEventType(title, 'FederalReserve', impact);

        return {
          id: `fed-${title.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${new Date(date).toISOString().slice(0, 10)}`,
          title,
          date,
          type,
          impact,
          country: 'USD',
          forecast: null,
          previous: null,
          actual: null,
          url: item.link || null,
          source: 'FederalReserve'
        };
      });

    await cache.set(CACHE_KEY, events, 1800).catch(() => {});
    return events;
  } catch (err) {
    console.error('[CalendarService] Fed RSS fetch failed:', err.message);
    return [];
  }
}

// ─── Unified getEvents ───────────────────────────────────────────────────────

/**
 * Get all calendar events within a date range.
 *
 * @param {Object} opts
 * @param {string} opts.from - YYYY-MM-DD
 * @param {string} opts.to   - YYYY-MM-DD
 * @param {string} opts.type - 'all' | 'economic' | 'earnings' | 'speech' | 'holiday'
 * @returns {Promise<Array>}
 */
async function getEvents({ from, to, type = 'all' } = {}) {
  const now = new Date();
  const fromDate = from ? new Date(from) : now;
  const toDate = to ? new Date(to) : new Date(now.getTime() + 30 * 24 * 3600 * 1000);

  const fromStr = toDateStr(fromDate);
  const toStr = toDateStr(toDate);

  // Fetch all sources in parallel
  const [ffEvents, finnhubEarnings, finnhubEcon, fedEvents] = await Promise.all([
    fetchForexFactory(),
    fetchFinnhubEarnings(fromStr, toStr),
    fetchFinnhubEconomic(fromStr, toStr),
    fetchFedRSS()
  ]);

  // Merge + filter by date range (compare date strings in ET to avoid timezone drift)
  const all = [...ffEvents, ...finnhubEarnings, ...finnhubEcon, ...fedEvents].filter(e => {
    try {
      const d = parseDate(e.date);
      if (isNaN(d.getTime())) return false;
      // Compare using ET date strings (YYYY-MM-DD) to match ForexFactory's ET-based dates
      const eventDateStr = toDateStr(d);
      return eventDateStr >= fromStr && eventDateStr <= toStr;
    } catch {
      return false;
    }
  });

  // Deduplicate by id
  const seen = new Set();
  const deduped = all.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  // Filter by type
  const filtered = type === 'all'
    ? deduped
    : deduped.filter(e => e.type === type);

  // Sort chronologically
  return filtered.sort((a, b) => parseDate(a.date) - parseDate(b.date));
}

/**
 * Get earnings only
 */
async function getEarnings({ from, to } = {}) {
  return getEvents({ from, to, type: 'earnings' });
}

/**
 * Get today's events
 */
async function getTodaysEvents({ currencies = null } = {}) {
  const { start, end, dateStr } = getETDayBounds(new Date());

  let events = await getEvents({
    from: dateStr,
    to: dateStr
  });

  if (currencies && currencies.length > 0) {
    const upper = currencies.map(c => c.toUpperCase());
    events = events.filter(e => upper.includes((e.country || '').toUpperCase()));
  }

  return events;
}

/**
 * Get upcoming events for next N days
 */
async function getUpcomingEvents({ days = 7, currencies = null, minImpact = 1 } = {}) {
  const now = new Date();
  const to = new Date(now.getTime() + days * 24 * 3600 * 1000);

  const IMPACT_RANK = { Low: 1, Medium: 2, High: 3, Holiday: 0 };
  const minRank = minImpact;

  let events = await getEvents({
    from: toDateStr(now),
    to: toDateStr(to)
  });

  // Apply impact filter
  events = events.filter(e => {
    const rank = IMPACT_RANK[e.impact] ?? 1;
    return rank >= minRank;
  });

  if (currencies && currencies.length > 0) {
    const upper = currencies.map(c => c.toUpperCase());
    events = events.filter(e => upper.includes((e.country || '').toUpperCase()));
  }

  return events;
}

/**
 * Get high-impact events only
 */
async function getHighImpactEvents({ days = 7 } = {}) {
  return getUpcomingEvents({ days, minImpact: 3 });
}

module.exports = {
  getEvents,
  getEarnings,
  getTodaysEvents,
  getUpcomingEvents,
  getHighImpactEvents,
  fetchForexFactory,
  fetchFinnhubEarnings,
  fetchFinnhubEconomic,
  fetchFedRSS
};
