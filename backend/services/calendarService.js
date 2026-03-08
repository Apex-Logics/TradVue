/**
 * Comprehensive Calendar Service
 * 
 * Aggregates events from:
 *  1. ForexFactory JSON API (economic events + speakers)
 *  2. Finnhub Earnings Calendar
 *  3. Federal Reserve RSS feed (speeches, statements)
 * 
 * Unified endpoint returns typed events:
 *   economic | earnings | speech | holiday
 */

const axios = require('axios');
const RSSParser = require('rss-parser');
const cache = require('./cache');

const rssParser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'ChartGenius/1.0 (chartgenius.io; calendar-bot)' }
});

// ─── Type Classification ────────────────────────────────────────────────────

const SPEECH_KEYWORDS = [
  'speaks', 'speech', 'testimony', 'chair', 'governor', 'president',
  'member', 'comments', 'statement', 'press conference', 'press briefing',
  'remarks', 'forum', 'panel', 'interview', 'hearing', 'speaks at',
  'hawker', 'dove', 'minutes', 'reserve bank', 'central bank',
  'fomc', 'mpc', 'ecb', 'boe', 'boc', 'rba', 'rbnz', 'boj',
  'lagarde', 'powell', 'bailey', 'waller', 'bowman', 'jefferson',
  'kashkari', 'bostic', 'logan', 'daly', 'kugler', 'cook', 'williams',
  'barkin', 'harker', 'mester', 'collins', 'schmid'
];

function classifyEventType(title, source, impact) {
  const lower = title.toLowerCase();

  if (lower.includes('holiday')) return 'holiday';
  if (impact === 'Holiday') return 'holiday';
  if (source === 'Finnhub') return 'earnings';

  for (const kw of SPEECH_KEYWORDS) {
    if (lower.includes(kw)) return 'speech';
  }

  return 'economic';
}

// ─── ForexFactory ────────────────────────────────────────────────────────────

async function fetchForexFactory() {
  const CACHE_KEY = 'calendar:ff:events';
  const cached = await cache.get(CACHE_KEY).catch(() => null);
  if (cached) return cached;

  try {
    const url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'ChartGenius/1.0 (chartgenius.io; calendar-bot)' }
    });

    const events = (Array.isArray(data) ? data : []).map(e => {
      const title = e.title || '';
      const impact = e.impact || 'Low';
      const type = classifyEventType(title, 'ForexFactory', impact);

      // Build ISO date from FF format (e.g. "03-11-2026T08:30:00-0500")
      let dateStr = e.date || '';
      // FF returns: "03-11-2026T08:30:00-0500" → convert to standard ISO
      // format is MM-DD-YYYYTHH:MM:SS±HHMM
      let isoDate = dateStr;
      const ffMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})T(.+)$/);
      if (ffMatch) {
        isoDate = `${ffMatch[3]}-${ffMatch[1]}-${ffMatch[2]}T${ffMatch[4]}`;
        // normalize timezone offset from -0500 to -05:00
        isoDate = isoDate.replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3');
      }

      const id = `ff-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${dateStr.slice(0, 10)}`;

      return {
        id,
        title,
        date: isoDate,
        type,
        impact,
        country: (e.country || 'USD').toUpperCase(),
        forecast: e.forecast || null,
        previous: e.previous || null,
        actual: e.actual || null,
        source: 'ForexFactory'
      };
    });

    await cache.set(CACHE_KEY, events, 1800).catch(() => {});
    return events;
  } catch (err) {
    console.error('[CalendarService] ForexFactory fetch failed:', err.message);
    return [];
  }
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
      // hour: 'bmo' (before market open), 'amc' (after market close), or time string
      const hour = e.hour || '';
      let timeStr = dateStr;
      if (hour === 'bmo') timeStr = `${dateStr}T09:30:00`;
      else if (hour === 'amc') timeStr = `${dateStr}T16:00:00`;
      else timeStr = `${dateStr}T12:00:00`;

      return {
        id: `fh-${symbol.toLowerCase()}-${dateStr}`,
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
        const date = item.pubDate || item.isoDate || new Date().toISOString();
        const lower = title.toLowerCase();

        let impact = 'Medium';
        if (lower.includes('chair') || lower.includes('fomc') || lower.includes('minutes')) impact = 'High';
        else if (lower.includes('speech') || lower.includes('remarks')) impact = 'Medium';
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

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(str) {
  return new Date(str);
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
  const [ffEvents, finnhubEvents, fedEvents] = await Promise.all([
    fetchForexFactory(),
    fetchFinnhubEarnings(fromStr, toStr),
    fetchFedRSS()
  ]);

  // Merge + filter by date range
  const all = [...ffEvents, ...finnhubEvents, ...fedEvents].filter(e => {
    try {
      const d = parseDate(e.date);
      return d >= fromDate && d <= toDate;
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

module.exports = { getEvents, getEarnings, fetchForexFactory, fetchFinnhubEarnings, fetchFedRSS };
