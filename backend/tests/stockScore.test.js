/**
 * Yahoo quoteSummary crumb + stock score
 *
 * Yahoo /v10/quoteSummary returns 401 Invalid Crumb without a cookie+crumb.
 * That 401 was leaked into TradVue Score as "Request failed with status code 401".
 */

jest.mock('axios');

const axios = require('axios');
const {
  fetchQuoteSummary,
  resetYahooSession,
  cookieHeaderFromSetCookie,
} = require('../services/yahooQuoteSummary');

function mockYahooSessionAndSummary(result, { failFirstSummary = false } = {}) {
  let summaryCalls = 0;
  axios.get.mockImplementation(async (url) => {
    if (String(url).includes('fc.yahoo.com')) {
      return { headers: { 'set-cookie': ['A3=abc123; Path=/; Domain=.yahoo.com'] } };
    }
    if (String(url).includes('getcrumb')) {
      return { data: 'testcrumb' };
    }
    if (String(url).includes('quoteSummary')) {
      summaryCalls += 1;
      if (failFirstSummary && summaryCalls === 1) {
        const err = new Error('Request failed with status code 401');
        err.response = {
          status: 401,
          data: { finance: { result: null, error: { code: 'Unauthorized', description: 'Invalid Crumb' } } },
        };
        throw err;
      }
      return { data: { quoteSummary: { result: [result] } } };
    }
    throw new Error(`unexpected url ${url}`);
  });
  return () => summaryCalls;
}

describe('yahooQuoteSummary', () => {
  beforeEach(() => {
    resetYahooSession();
    axios.get.mockReset();
  });

  test('cookieHeaderFromSetCookie keeps name=value pairs', () => {
    expect(cookieHeaderFromSetCookie([
      'A3=abc; Path=/; HttpOnly',
      'A1=xyz; Secure',
    ])).toBe('A3=abc; A1=xyz');
  });

  test('fetchQuoteSummary sends crumb + cookie and returns the result', async () => {
    mockYahooSessionAndSummary({
      financialData: { currentPrice: { raw: 316.22 } },
    });

    const data = await fetchQuoteSummary('AAPL', 'financialData');
    expect(data.financialData.currentPrice.raw).toBe(316.22);

    const summaryCall = axios.get.mock.calls.find(([url]) => String(url).includes('quoteSummary/AAPL'));
    expect(summaryCall[1].params.crumb).toBe('testcrumb');
    expect(summaryCall[1].headers.Cookie).toContain('A3=abc123');
  });

  test('retries once after Yahoo 401 Invalid Crumb', async () => {
    const getSummaryCalls = mockYahooSessionAndSummary(
      { financialData: { recommendationMean: { raw: 2.1 } } },
      { failFirstSummary: true },
    );

    const data = await fetchQuoteSummary('MSFT', 'financialData');
    expect(data.financialData.recommendationMean.raw).toBe(2.1);
    expect(getSummaryCalls()).toBe(2);
  });
});

describe('getStockScore', () => {
  let fetchQuoteSummaryMock;
  let getStockScore;

  beforeEach(() => {
    jest.resetModules();
    fetchQuoteSummaryMock = jest.fn();
    jest.doMock('../services/yahooQuoteSummary', () => ({
      fetchQuoteSummary: fetchQuoteSummaryMock,
    }));
    ({ getStockScore } = require('../services/stockScore'));
  });

  afterEach(() => {
    jest.dontMock('../services/yahooQuoteSummary');
  });

  test('returns a numeric score from quoteSummary fundamentals', async () => {
    fetchQuoteSummaryMock.mockResolvedValue({
      financialData: {
        currentPrice: { raw: 316 },
        revenueGrowth: { raw: 0.12 },
        earningsGrowth: { raw: 0.1 },
        profitMargins: { raw: 0.25 },
        returnOnEquity: { raw: 1.4 },
        grossMargins: { raw: 0.46 },
      },
      defaultKeyStatistics: {},
      summaryDetail: {
        trailingPE: { raw: 28 },
        fiftyDayAverage: { raw: 310 },
        twoHundredDayAverage: { raw: 280 },
      },
      assetProfile: { sector: 'Technology' },
    });

    const score = await getStockScore('aapl');
    expect(score.symbol).toBe('AAPL');
    expect(score.totalScore).toEqual(expect.any(Number));
    expect(score.totalScore).toBeGreaterThanOrEqual(0);
    expect(score.totalScore).toBeLessThanOrEqual(100);
    expect(score.grade).toMatch(/^[A-F]$/);
    expect(score.error).toBeUndefined();
  });

  test('does not leak Yahoo 401 into the public score payload', async () => {
    fetchQuoteSummaryMock.mockRejectedValue(new Error('Request failed with status code 401'));

    const score = await getStockScore('ZZFAIL');
    expect(score.symbol).toBe('ZZFAIL');
    expect(score.totalScore).toBeNull();
    expect(score.error).toBe('Score unavailable');
    expect(JSON.stringify(score)).not.toMatch(/401/);
    expect(JSON.stringify(score)).not.toMatch(/Request failed/);
  });
});
