'use strict';

const { numberOrNull, isPricedQuote, normalizeQuote } = require('../lib/quoteNormalize');

describe('quoteNormalize', () => {
  test('numberOrNull accepts finite numbers and numeric strings', () => {
    expect(numberOrNull(523.41)).toBe(523.41);
    expect(numberOrNull('10.5')).toBe(10.5);
    expect(numberOrNull(null)).toBeNull();
    expect(numberOrNull(undefined)).toBeNull();
    expect(numberOrNull(NaN)).toBeNull();
    expect(numberOrNull('')).toBeNull();
  });

  test('isPricedQuote is false for unavailable stubs', () => {
    expect(isPricedQuote(null)).toBe(false);
    expect(isPricedQuote({ symbol: 'SPY', current: null, changePct: null, source: 'unavailable' })).toBe(false);
    expect(isPricedQuote({ symbol: 'SPY' })).toBe(false);
  });

  test('normalizeQuote maps Alpaca { current, changePct } through', () => {
    const q = normalizeQuote({
      symbol: 'spy',
      current: 523.41,
      change: 1.2,
      changePct: 0.23,
      source: 'alpaca',
    });
    expect(q).toMatchObject({ symbol: 'SPY', current: 523.41, change: 1.2, changePct: 0.23 });
  });

  test('normalizeQuote maps Finnhub raw { c, d, dp } onto current/changePct', () => {
    const q = normalizeQuote({ c: 150.25, d: 2.5, dp: 1.69, h: 151, l: 149, o: 149.8, pc: 147.75 }, 'AAPL');
    expect(q).toMatchObject({
      symbol: 'AAPL',
      current: 150.25,
      change: 2.5,
      changePct: 1.69,
      c: 150.25,
    });
  });

  test('normalizeQuote returns null for stubs that would render as watchlist dashes', () => {
    expect(normalizeQuote({ symbol: 'QQQ', current: null, changePct: null, source: 'unavailable' })).toBeNull();
    expect(normalizeQuote({ symbol: 'DIA', c: 0 })).toBeNull();
    expect(normalizeQuote(null, 'IWM')).toBeNull();
  });
});
