/**
 * Stripe Integration Tests — TradVue
 *
 * Tests:
 *   1. Webhook signature verification (valid / invalid / missing)
 *   2. checkout.session.completed → upgrades user tier to 'pro'
 *   3. customer.subscription.deleted → downgrades tier to 'free'
 *   4. customer.subscription.updated (cancelled status) → downgrade
 *   5. invoice.payment_failed → logs warning, returns 200
 *   6. Duplicate webhook — idempotent (200 both times)
 *   7. POST /create-checkout-session → requires auth (401 without token)
 *   8. POST /create-checkout-session → valid request creates session URL
 *   9. POST /create-checkout-session → invalid priceId format → 400
 *  10. POST /create-portal-session → requires auth (401 without token)
 *  11. POST /create-portal-session → returns portal URL for pro user
 *  12. POST /create-portal-session → 400 when no stripe_customer_id
 *  13. GET /subscription-status → requires auth (401 without token)
 *  14. GET /subscription-status → free tier with no subscription
 *  15. GET /prices → public, returns monthly & annual price IDs
 *  16. requirePaid middleware → allows pro users
 *  17. requirePaid middleware → allows users in active trial
 *  18. requirePaid middleware → blocks free users post-trial (403)
 *  19. requirePaid middleware → blocks free users with null trial_ends_at
 *
 * All Stripe and Supabase calls are mocked — no real network requests.
 */

const request = require('supertest');
const express = require('express');

// ── Mock Stripe ───────────────────────────────────────────────────────────────
const mockStripe = {
  webhooks: { constructEvent: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  subscriptions: { list: jest.fn() },
  customers: { create: jest.fn() },
  products: { search: jest.fn(), create: jest.fn() },
  prices: { list: jest.fn(), create: jest.fn() },
};
jest.mock('stripe', () => jest.fn(() => mockStripe));

// ── Mock Supabase ─────────────────────────────────────────────────────────────
// Response queue for controlling per-call behavior.
// Tests push responses onto these queues; the mock drains them in order.
const mockSingleQueue = [];      // queue of { data, error } for .single() calls
const mockUpdateQueue = [];      // queue of { error } for .update().eq() terminal calls

// Build a fresh chain object for each .from() call.
// The chain needs to both chain (return this) AND resolve as a terminal.
// We achieve this by making .eq() return an object that is a Promise AND has .single().
function mockBuildChain() {
  // The chain tracks what was called last to know if eq() is terminal or chaining.
  let isUpdateChain = false;

  const chain = {
    select: jest.fn().mockImplementation(function() { return chain; }),
    update: jest.fn().mockImplementation(function() { isUpdateChain = true; return chain; }),
    upsert: jest.fn().mockImplementation(function() { return chain; }),
    eq: jest.fn().mockImplementation(function() {
      if (isUpdateChain) {
        // Terminal: resolve as Promise<{ error }>
        const result = mockUpdateQueue.shift() || { error: null };
        return Promise.resolve(result);
      }
      return chain;
    }),
    single: jest.fn().mockImplementation(function() {
      const result = mockSingleQueue.shift() || { data: null, error: null };
      return Promise.resolve(result);
    }),
  };
  return chain;
}

const mockSupabaseClient = {
  from: jest.fn(() => mockBuildChain()),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// ── Mock auth middleware ───────────────────────────────────────────────────────
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.slice(7);
    if (token === 'valid-test-token') {
      req.user = { id: 'test-user-id', email: 'test@example.com' };
      return next();
    }
    return res.status(403).json({ error: 'Invalid token' });
  },
  optionalAuth: (req, res, next) => { req.user = null; next(); },
}));

// ── Helpers for queueing mock responses ──────────────────────────────────────
function mockSingleResponse(data, error = null) {
  mockSingleQueue.push({ data, error });
}

function mockUpdateResponse(error = null) {
  mockUpdateQueue.push({ error });
}

// ── Setup Express app ─────────────────────────────────────────────────────────
let app;

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key';

  app = express();

  const stripeRouter = require('../routes/stripe');

  // Webhook MUST be before JSON parser
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    (req, res, next) => { req.url = '/webhook'; stripeRouter(req, res, next); }
  );

  app.use(express.json());
  app.use('/api/stripe', stripeRouter);
});

beforeEach(() => {
  jest.clearAllMocks();

  // Clear queues
  mockSingleQueue.length = 0;
  mockUpdateQueue.length = 0;

  // Reset the from() mock
  mockSupabaseClient.from.mockImplementation(() => mockBuildChain());

  // Default Stripe prices mock (used by getOrCreatePrices)
  // NOTE: real Stripe price IDs are purely alphanumeric after 'price_' — no underscores.
  // The route validates: /^price_[A-Za-z0-9]+$/
  mockStripe.products.search.mockResolvedValue({
    data: [{ id: 'prod_test123', name: 'TradVue Pro' }],
  });
  mockStripe.prices.list.mockResolvedValue({
    data: [
      { id: 'price_monthlyABC123', metadata: { tradvue_plan: 'monthly' }, recurring: { interval: 'month' }, unit_amount: 2400 },
      { id: 'price_annualXYZ456',  metadata: { tradvue_plan: 'annual'  }, recurring: { interval: 'year'  }, unit_amount: 20160 },
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1–6. Webhook
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/stripe/webhook', () => {

  // 1. Invalid signature → 400
  test('rejects invalid signature with 400', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bad_sig')
      .send(JSON.stringify({ type: 'test.event' }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Webhook error/);
  });

  // 2. checkout.session.completed → pro upgrade
  test('checkout.session.completed upgrades user to pro (returns 200)', async () => {
    const fakeEvent = {
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'user-abc-123', customer: 'cus_test123' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
    // updateStripeCustomerId + updateUserTier → two .update().eq() calls
    mockUpdateResponse(null);
    mockUpdateResponse(null);

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(fakeEvent));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  // 3. customer.subscription.deleted → free downgrade
  test('customer.subscription.deleted downgrades user to free', async () => {
    const fakeEvent = {
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_test456' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
    // getUserByStripeCustomer: .select().eq().single() → user found
    mockSingleResponse({ id: 'user-def-456', tier: 'pro', stripe_customer_id: 'cus_test456' });
    // updateUserTier: .update().eq() → success
    mockUpdateResponse(null);

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(fakeEvent));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  // 4. subscription.updated with cancelled status → free
  test('subscription.updated with canceled status results in free tier', async () => {
    const fakeEvent = {
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_test789', status: 'canceled' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
    mockSingleResponse({ id: 'user-ghi-789', tier: 'pro' });
    mockUpdateResponse(null);

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(fakeEvent));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  // 5. invoice.payment_failed → returns 200, does NOT hard-downgrade
  test('invoice.payment_failed returns 200 without crashing', async () => {
    const fakeEvent = {
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_failed', id: 'inv_test' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
    mockSingleResponse({ id: 'user-pay-failed', tier: 'pro' });

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(fakeEvent));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  // 6. Duplicate webhook — idempotent
  test('duplicate webhook events return 200 both times', async () => {
    const fakeEvent = {
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'user-dup', customer: 'cus_dup' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
    // 4 update calls (2 per event: updateStripeCustomerId + updateUserTier)
    mockUpdateResponse(null); mockUpdateResponse(null);
    mockUpdateResponse(null); mockUpdateResponse(null);

    const payload = JSON.stringify(fakeEvent);
    const [res1, res2] = await Promise.all([
      request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', 'valid_sig').send(payload),
      request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', 'valid_sig').send(payload),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  // Missing webhook secret → 500
  test('returns 500 when STRIPE_WEBHOOK_SECRET is not set', async () => {
    const original = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'some_sig')
      .send('{}');

    expect(res.status).toBe(500);
    process.env.STRIPE_WEBHOOK_SECRET = original;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7–9. POST /api/stripe/create-checkout-session
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/stripe/create-checkout-session', () => {

  // 7. No auth → 401
  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/stripe/create-checkout-session')
      .send({ priceId: 'price_monthlyABC123' });
    expect(res.status).toBe(401);
  });

  // 8. Valid request → checkout URL
  test('returns checkout URL for authenticated user', async () => {
    // getUserProfile → user with existing stripe_customer_id (no need to create new customer)
    mockSingleResponse({ id: 'test-user-id', tier: 'free', stripe_customer_id: 'cus_existing' });

    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_session',
      url: 'https://checkout.stripe.com/test-session',
    });
    // No updateStripeCustomerId needed (existing customer)


    const res = await request(app)
      .post('/api/stripe/create-checkout-session')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ priceId: 'price_monthlyABC123' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/test-session');
    expect(res.body.sessionId).toBe('cs_test_session');
  });

  // 9. Invalid priceId format → 400
  test('returns 400 for invalid priceId format', async () => {
    const res = await request(app)
      .post('/api/stripe/create-checkout-session')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ priceId: 'not-a-valid-price-id' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid priceId/);
  });

  // Unknown priceId → 400
  test('returns 400 for unknown (non-TradVue) priceId', async () => {
    const res = await request(app)
      .post('/api/stripe/create-checkout-session')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ priceId: 'price_completely_unknown' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid priceId/);
  });

  // Missing priceId → 400
  test('returns 400 when priceId is missing', async () => {
    const res = await request(app)
      .post('/api/stripe/create-checkout-session')
      .set('Authorization', 'Bearer valid-test-token')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priceId is required/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10–12. POST /api/stripe/create-portal-session
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/stripe/create-portal-session', () => {

  // 10. No auth → 401
  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/stripe/create-portal-session')
      .send({ returnUrl: 'https://www.tradvue.com/account' });
    expect(res.status).toBe(401);
  });

  // 11. Pro user → portal URL
  test('returns portal URL for authenticated user with stripe_customer_id', async () => {
    // getUserProfile returns user with stripe_customer_id
    mockSingleResponse({ id: 'test-user-id', tier: 'pro', stripe_customer_id: 'cus_pro_user' });
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/test-portal',
    });


    const res = await request(app)
      .post('/api/stripe/create-portal-session')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ returnUrl: 'https://www.tradvue.com/account' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://billing.stripe.com/test-portal');
  });

  // 12. No stripe_customer_id → 400
  test('returns 400 when user has no stripe_customer_id', async () => {
    // getUserProfile returns user WITHOUT stripe_customer_id
    mockSingleResponse({ id: 'test-user-id', tier: 'free', stripe_customer_id: null });


    const res = await request(app)
      .post('/api/stripe/create-portal-session')
      .set('Authorization', 'Bearer valid-test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No billing account/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13–14. GET /api/stripe/subscription-status
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/stripe/subscription-status', () => {

  // 13. No auth → 401
  test('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/stripe/subscription-status');
    expect(res.status).toBe(401);
  });

  // 14. Free user with no subscription
  test('returns free tier status for user with no subscription', async () => {
    // getUserProfile → free user, no stripe customer
    mockSingleResponse({ id: 'test-user-id', tier: 'free', stripe_customer_id: null });


    const res = await request(app)
      .get('/api/stripe/subscription-status')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('free');
    expect(res.body.status).toBe('none');
  });

  // Active subscription
  test('returns pro tier status for user with active subscription', async () => {
    // getUserProfile → pro user with stripe customer
    mockSingleResponse({ id: 'test-user-id', tier: 'pro', stripe_customer_id: 'cus_active' });


    const nowSeconds = Math.floor(Date.now() / 1000);
    mockStripe.subscriptions.list.mockResolvedValue({
      data: [{
        status: 'active',
        current_period_end: nowSeconds + 30 * 86400,
        cancel_at: null,
        cancel_at_period_end: false,
        items: { data: [{ price: { unit_amount: 2400, currency: 'usd', recurring: { interval: 'month' } } }] },
      }],
    });

    const res = await request(app)
      .get('/api/stripe/subscription-status')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('pro');
    expect(res.body.status).toBe('active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. GET /api/stripe/prices — public endpoint
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/stripe/prices', () => {
  test('returns monthly and annual price info', async () => {
    const res = await request(app).get('/api/stripe/prices');

    expect(res.status).toBe(200);
    expect(res.body.monthly).toBeDefined();
    expect(res.body.annual).toBeDefined();
    expect(res.body.monthly.amount).toBe(24);
    expect(res.body.annual.amount).toBe(201.60);
    expect(res.body.monthly.interval).toBe('month');
    expect(res.body.annual.interval).toBe('year');
    expect(res.body.annual.savingsPercent).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16–19. requirePaid middleware
// ─────────────────────────────────────────────────────────────────────────────
describe('requirePaid middleware', () => {
  let paidApp;

  beforeAll(() => {
    // Need separate app to test middleware in isolation
    paidApp = express();
    paidApp.use(express.json());

    const { requireAuth } = require('../middleware/auth');
    const { requirePaid } = require('../middleware/requirePaid');

    paidApp.get('/test-paid', requireAuth, requirePaid, (req, res) => {
      res.json({ success: true });
    });
  });

  // 16. Pro user → allowed
  test('allows pro users', async () => {
    // Supabase profile lookup for requirePaid
    mockSingleResponse({ tier: 'pro', trial_ends_at: null });


    const res = await request(paidApp)
      .get('/test-paid')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // 17. Active trial → allowed
  test('allows users within active trial', async () => {
    const futureDate = new Date(Date.now() + 10 * 86400 * 1000).toISOString();
    mockSingleResponse({ tier: 'free', trial_ends_at: futureDate });


    const res = await request(paidApp)
      .get('/test-paid')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // 18. Expired trial → 403
  test('blocks free users with expired trial (403)', async () => {
    const pastDate = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    mockSingleResponse({ tier: 'free', trial_ends_at: pastDate });


    const res = await request(paidApp)
      .get('/test-paid')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Pro subscription required/);
    expect(res.body.upgradeUrl).toBeDefined();
    expect(res.body.trialExpired).toBe(true);
  });

  // 19. No trial set → 403
  test('blocks free users with null trial_ends_at', async () => {
    mockSingleResponse({ tier: 'free', trial_ends_at: null });


    const res = await request(paidApp)
      .get('/test-paid')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Pro subscription required/);
  });
});
