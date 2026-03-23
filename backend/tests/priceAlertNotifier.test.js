/**
 * Price Alert Notifier — TDD Tests
 *
 * Tests cover:
 *   - buildPushPayload() — fields, no sensitive data
 *   - buildEmailHtml() — disclaimer + unsubscribe link
 *   - buildBatchEmailHtml() — multi-alert summary
 *   - generateUnsubToken() / validateUnsubToken()
 *   - shouldRateLimit() — max 10/hr per user
 *   - PREFS_DEFAULTS — opt-in off by default
 */

'use strict';

process.env.UNSUB_TOKEN_SECRET = 'test-unsub-secret';

jest.mock('../services/db', () => ({ query: jest.fn() }));
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email-abc' }) },
  })),
}));

const {
  buildPushPayload,
  buildEmailHtml,
  buildBatchEmailHtml,
  generateUnsubToken,
  validateUnsubToken,
  shouldRateLimit,
  PREFS_DEFAULTS,
} = require('../services/priceAlertNotifier');

afterEach(() => jest.clearAllMocks());

// ─── buildPushPayload() ───────────────────────────────────────────────────────

describe('buildPushPayload()', () => {
  const alert = { symbol: 'AAPL', direction: 'above', target_price: 185.0 };
  const currentPrice = 185.50;

  test('includes title with ticker', () => {
    const p = buildPushPayload(alert, currentPrice);
    expect(p.title).toContain('AAPL');
  });

  test('body contains current and target price', () => {
    const p = buildPushPayload(alert, currentPrice);
    expect(p.body).toContain('185.50');
    expect(p.body).toContain('185.00');
  });

  test('url points to /portfolio?tab=alerts', () => {
    const p = buildPushPayload(alert, currentPrice);
    expect(p.url).toBe('/portfolio?tab=alerts');
  });

  test('tag is price-alert-SYMBOL', () => {
    const p = buildPushPayload(alert, currentPrice);
    expect(p.tag).toBe('price-alert-AAPL');
  });

  test('does NOT contain balance / P&L / position-size fields', () => {
    const payload = JSON.stringify(buildPushPayload(alert, currentPrice));
    ['balance', 'pnl', 'profit', 'loss', 'position_size', 'quantity'].forEach(f => {
      expect(payload.toLowerCase()).not.toContain(f);
    });
  });

  test('below direction uses correct wording', () => {
    const p = buildPushPayload({ symbol: 'TSLA', direction: 'below', target_price: 200 }, 195);
    expect(p.body.toLowerCase()).toContain('below');
  });
});

// ─── buildEmailHtml() ─────────────────────────────────────────────────────────

describe('buildEmailHtml()', () => {
  const alert = { symbol: 'MSFT', direction: 'above', target_price: 400.0 };
  const unsubUrl = 'https://www.tradvue.com/api/alerts/price/unsubscribe?token=abc123';

  test('contains ticker, direction, target and current price', () => {
    const html = buildEmailHtml(alert, 401.25, unsubUrl);
    expect(html).toContain('MSFT');
    expect(html).toContain('400.00');
    expect(html).toContain('401.25');
    expect(html).toContain('Above');
  });

  test('contains disclaimer text', () => {
    const html = buildEmailHtml(alert, 401.25, unsubUrl).toLowerCase();
    expect(html).toContain('not financial advice');
    expect(html).toContain('informational only');
  });

  test('contains unsubscribe link', () => {
    const html = buildEmailHtml(alert, 401.25, unsubUrl);
    expect(html).toContain(unsubUrl);
    expect(html.toLowerCase()).toContain('unsubscribe');
  });

  test('does NOT include balance, P&L, or position data', () => {
    const html = buildEmailHtml(alert, 401.25, unsubUrl).toLowerCase();
    ['balance', 'profit', 'position size', 'shares held'].forEach(f => {
      expect(html).not.toContain(f);
    });
  });
});

// ─── buildBatchEmailHtml() ────────────────────────────────────────────────────

describe('buildBatchEmailHtml()', () => {
  const batch = [
    { alert: { symbol: 'AAPL', direction: 'above', target_price: 185 }, currentPrice: 185.5 },
    { alert: { symbol: 'TSLA', direction: 'below', target_price: 200 }, currentPrice: 195 },
  ];
  const unsubUrl = 'https://www.tradvue.com/api/alerts/price/unsubscribe?token=xyz';

  test('contains all tickers', () => {
    const html = buildBatchEmailHtml(batch, unsubUrl);
    expect(html).toContain('AAPL');
    expect(html).toContain('TSLA');
  });

  test('contains disclaimer and unsubscribe link', () => {
    const html = buildBatchEmailHtml(batch, unsubUrl);
    expect(html.toLowerCase()).toContain('not financial advice');
    expect(html).toContain(unsubUrl);
  });
});

// ─── generateUnsubToken() / validateUnsubToken() ──────────────────────────────

describe('unsubscribe token', () => {
  test('generates a non-empty string token', () => {
    const tok = generateUnsubToken('user-uuid-123');
    expect(typeof tok).toBe('string');
    expect(tok.length).toBeGreaterThan(10);
  });

  test('validates a valid token and returns userId', () => {
    const tok = generateUnsubToken('user-uuid-456');
    expect(validateUnsubToken(tok)).toBe('user-uuid-456');
  });

  test('returns null for an invalid / tampered token', () => {
    expect(validateUnsubToken('totally-invalid-token')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(validateUnsubToken('')).toBeNull();
  });
});

// ─── shouldRateLimit() ───────────────────────────────────────────────────────

describe('shouldRateLimit()', () => {
  test('allows sending when under limit', () => {
    const userId = 'rl-' + Date.now() + '-a';
    expect(shouldRateLimit(userId)).toBe(false);
  });

  test('blocks after 10 emails in same hour', () => {
    const userId = 'rl-' + Date.now() + '-b';
    for (let i = 0; i < 10; i++) shouldRateLimit(userId);
    expect(shouldRateLimit(userId)).toBe(true);
  });

  test('different users share no rate limit buckets', () => {
    const u1 = 'rl-' + Date.now() + '-c';
    const u2 = 'rl-' + Date.now() + '-d';
    for (let i = 0; i < 10; i++) shouldRateLimit(u1);
    expect(shouldRateLimit(u2)).toBe(false);
  });
});

// ─── PREFS_DEFAULTS ──────────────────────────────────────────────────────────

describe('PREFS_DEFAULTS', () => {
  test('email is OFF by default (opt-in required)', () => {
    expect(PREFS_DEFAULTS.email_enabled).toBe(false);
  });

  test('push price alerts are OFF by default (opt-in required)', () => {
    expect(PREFS_DEFAULTS.push_price_alerts).toBe(false);
  });
});
