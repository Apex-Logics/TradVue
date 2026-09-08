/**
 * Yahoo Finance quoteSummary client.
 *
 * quoteSummary (/v10/...) requires a crumb + cookie. Without them Yahoo
 * returns 401 Invalid Crumb. The chart API (/v8/...) does not, which is why
 * stock quotes still load while TradVue Score / analyst coverage fail.
 *
 * Session is cached in memory and refreshed once on 401.
 */

const axios = require('axios');

const YAHOO_UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
};

const FC_URL = 'https://fc.yahoo.com';
const CRUMB_URL = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
const QUOTE_SUMMARY_URL = (ticker) =>
  `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}`;

const SESSION_TTL_MS = 55 * 60 * 1000;

let session = null; // { cookie, crumb, ts }
let sessionInFlight = null;

function cookieHeaderFromSetCookie(setCookie) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list
    .map((c) => String(c).split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function isUnauthorized(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.finance?.error?.code;
  return status === 401 || status === 403 || code === 'Unauthorized';
}

async function fetchFreshSession() {
  const fc = await axios.get(FC_URL, {
    headers: YAHOO_UA,
    timeout: 10000,
    maxRedirects: 5,
    validateStatus: () => true,
  });
  const cookie = cookieHeaderFromSetCookie(fc.headers['set-cookie']);
  if (!cookie) {
    throw new Error('Yahoo session cookie missing');
  }

  const crumbRes = await axios.get(CRUMB_URL, {
    headers: { ...YAHOO_UA, Cookie: cookie },
    timeout: 10000,
    transformResponse: [(data) => data],
  });
  const crumb = String(crumbRes.data || '').trim();
  if (!crumb || crumb.length > 80 || /<html/i.test(crumb)) {
    throw new Error('Yahoo crumb missing');
  }

  session = { cookie, crumb, ts: Date.now() };
  return session;
}

async function getSession({ force } = {}) {
  if (!force && session && Date.now() - session.ts < SESSION_TTL_MS) {
    return session;
  }
  if (sessionInFlight) return sessionInFlight;
  sessionInFlight = fetchFreshSession().finally(() => {
    sessionInFlight = null;
  });
  return sessionInFlight;
}

function resetYahooSession() {
  session = null;
  sessionInFlight = null;
}

async function fetchQuoteSummary(ticker, modules, { retryOnAuth = true } = {}) {
  const upper = String(ticker || '').toUpperCase();
  const auth = await getSession();
  try {
    const res = await axios.get(QUOTE_SUMMARY_URL(upper), {
      params: { modules, crumb: auth.crumb },
      headers: { ...YAHOO_UA, Cookie: auth.cookie },
      timeout: 12000,
    });
    return res.data?.quoteSummary?.result?.[0] || null;
  } catch (err) {
    if (retryOnAuth && isUnauthorized(err)) {
      resetYahooSession();
      await getSession({ force: true });
      return fetchQuoteSummary(upper, modules, { retryOnAuth: false });
    }
    throw err;
  }
}

module.exports = {
  fetchQuoteSummary,
  resetYahooSession,
  cookieHeaderFromSetCookie,
  isUnauthorized,
};
