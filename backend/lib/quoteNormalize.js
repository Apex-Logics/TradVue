/**
 * Normalize market-data quote objects to { current, change, changePct }.
 *
 * Some upstream payloads still use Finnhub's raw { c, d, dp } keys. The
 * watchlist UI only reads `current` / `changePct`, so an otherwise-valid
 * quote with those missing renders as "—" / green "—".
 */

'use strict';

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isPricedQuote(quote) {
  if (!quote || typeof quote !== 'object') return false;
  const n = numberOrNull(quote.current ?? quote.c ?? quote.price);
  // Finnhub uses c=0 as "no trade"; never treat that as a last price.
  return n != null && n !== 0;
}

/**
 * @param {object|null|undefined} quote
 * @param {string} [symbol]
 * @returns {object|null} Priced quote with current/change/changePct, or null.
 */
function normalizeQuote(quote, symbol) {
  if (!isPricedQuote(quote)) return null;
  const current = numberOrNull(quote.current ?? quote.c ?? quote.price);
  const change = numberOrNull(quote.change ?? quote.d);
  const changePct = numberOrNull(quote.changePct ?? quote.dp ?? quote.percentChange);
  const sym = String(quote.symbol || symbol || '').toUpperCase();
  return {
    ...quote,
    symbol: sym,
    current,
    change,
    changePct,
  };
}

module.exports = { numberOrNull, isPricedQuote, normalizeQuote };
