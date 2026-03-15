/**
 * Stripe Payment Routes — TradVue Pro subscriptions
 *
 * POST   /api/stripe/create-checkout-session  — Initiate Stripe Checkout
 * POST   /api/stripe/webhook                  — Handle Stripe webhook events
 * POST   /api/stripe/create-portal-session    — Open Customer Portal
 * GET    /api/stripe/subscription-status      — Get current subscription info
 *
 * IMPORTANT: The webhook route MUST use express.raw() body parser.
 * In server.js this is registered BEFORE the JSON body parser.
 *
 * Pricing (locked):
 *   Monthly  — $24.00 / month
 *   Annual   — $201.60 / year  ($16.80/mo, 30% off)
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY       — sk_test_... / sk_live_...
 *   STRIPE_WEBHOOK_SECRET   — whsec_... (from Stripe dashboard)
 *   SUPABASE_URL            — https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// ── Stripe client (lazy-init so missing key only breaks stripe routes) ─────────
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  _stripe = require('stripe')(key);
  return _stripe;
}

// ── Supabase service-role client (bypasses RLS triggers) ──────────────────────
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  _supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return _supabaseAdmin;
}

// ── Stripe product/price IDs (cached in memory, seeded on first request) ──────
let _priceIds = null; // { monthly: 'price_...', annual: 'price_...' }

/**
 * getOrCreatePrices()
 * Idempotently ensures the TradVue Pro product + both prices exist in Stripe.
 * Uses Stripe idempotency keys + metadata search to avoid duplicates.
 */
async function getOrCreatePrices() {
  if (_priceIds) return _priceIds;

  const stripe = getStripe();

  // ── Look up existing product by metadata tag ──────────────────────────────
  const existingProducts = await stripe.products.search({
    query: "metadata['tradvue_product']:'pro'",
    limit: 1,
  });

  let product;
  if (existingProducts.data.length > 0) {
    product = existingProducts.data[0];
    console.log(`[Stripe] Using existing product: ${product.id}`);
  } else {
    product = await stripe.products.create(
      {
        name: 'TradVue Pro',
        description: 'Full access to all TradVue Pro features — unlimited trades, cloud sync, advanced analytics.',
        metadata: { tradvue_product: 'pro' },
      },
      { idempotencyKey: 'tradvue-pro-product-v1' }
    );
    console.log(`[Stripe] Created product: ${product.id}`);
  }

  // ── Look up existing prices by metadata tags ──────────────────────────────
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 10,
  });

  let monthlyPrice = existingPrices.data.find(
    p => p.metadata?.tradvue_plan === 'monthly'
  );
  let annualPrice = existingPrices.data.find(
    p => p.metadata?.tradvue_plan === 'annual'
  );

  if (!monthlyPrice) {
    monthlyPrice = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: 2400, // $24.00 in cents
        currency: 'usd',
        recurring: { interval: 'month' },
        nickname: 'TradVue Pro Monthly',
        metadata: { tradvue_plan: 'monthly' },
      },
      { idempotencyKey: 'tradvue-pro-monthly-v1' }
    );
    console.log(`[Stripe] Created monthly price: ${monthlyPrice.id}`);
  }

  if (!annualPrice) {
    annualPrice = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: 20160, // $201.60 in cents
        currency: 'usd',
        recurring: { interval: 'year' },
        nickname: 'TradVue Pro Annual ($16.80/mo)',
        metadata: { tradvue_plan: 'annual' },
      },
      { idempotencyKey: 'tradvue-pro-annual-v1' }
    );
    console.log(`[Stripe] Created annual price: ${annualPrice.id}`);
  }

  _priceIds = {
    monthly: monthlyPrice.id,
    annual: annualPrice.id,
    productId: product.id,
  };

  return _priceIds;
}

// ── Supabase user_profiles helpers ────────────────────────────────────────────

/**
 * Update user tier in user_profiles using service-role client.
 * Uses REST API (not direct Postgres) to avoid Render IPv6 issues.
 */
async function updateUserTier(userId, tier) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('user_profiles')
    .update({ tier, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(`Failed to update tier for ${userId}: ${error.message}`);
}

/**
 * Store stripe_customer_id on user_profiles.
 */
async function updateStripeCustomerId(userId, stripeCustomerId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('user_profiles')
    .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(`Failed to store customer ID for ${userId}: ${error.message}`);
}

/**
 * Get user_profiles row by user ID.
 */
async function getUserProfile(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, tier, stripe_customer_id')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

/**
 * Get user_profiles row by stripe_customer_id.
 */
async function getUserByStripeCustomer(stripeCustomerId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, tier, stripe_customer_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();
  if (error) return null;
  return data;
}

// ── POST /api/stripe/create-checkout-session ──────────────────────────────────
router.post('/create-checkout-session', async (req, res) => {
  try {
    const stripe = getStripe();
    const prices = await getOrCreatePrices();

    const { priceId, userId, email } = req.body;

    if (!priceId || !userId || !email) {
      return res.status(400).json({ error: 'priceId, userId, and email are required' });
    }

    // Validate priceId is one of our known prices
    if (priceId !== prices.monthly && priceId !== prices.annual) {
      return res.status(400).json({ error: 'Invalid priceId' });
    }

    // Lazy Stripe customer creation: check if user already has a customer ID
    let stripeCustomerId = null;
    const profile = await getUserProfile(userId).catch(() => null);
    if (profile?.stripe_customer_id) {
      stripeCustomerId = profile.stripe_customer_id;
    } else {
      // Create a new Stripe customer and store it
      const customer = await stripe.customers.create({
        email,
        metadata: { tradvue_user_id: userId },
      });
      stripeCustomerId = customer.id;
      await updateStripeCustomerId(userId, stripeCustomerId).catch(err => {
        console.warn('[Stripe] Failed to store customer ID (non-fatal):', err.message);
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://www.tradvue.com/account?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://www.tradvue.com/account?canceled=true',
      client_reference_id: userId,
      customer_email: stripeCustomerId ? undefined : email, // don't pass if customer already set
      subscription_data: {
        metadata: { tradvue_user_id: userId },
      },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Stripe] create-checkout-session error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session', details: err.message });
  }
});

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────
// NOTE: This handler expects express.raw() body, registered in server.js BEFORE
// the JSON body parser. The router-level handler here just processes the event.
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET is not set — cannot verify webhook');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log(`[Stripe] Webhook received: ${event.type}`);

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (!userId) {
          console.warn('[Stripe] checkout.session.completed: no client_reference_id');
          break;
        }
        // Store stripe_customer_id if not already saved
        if (session.customer) {
          await updateStripeCustomerId(userId, session.customer).catch(err =>
            console.warn('[Stripe] Failed to store customer ID on checkout:', err.message)
          );
        }
        await updateUserTier(userId, 'pro');
        console.log(`[Stripe] Upgraded user ${userId} to pro`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const profile = await getUserByStripeCustomer(customerId);
        if (!profile) {
          console.warn(`[Stripe] subscription.updated: no user found for customer ${customerId}`);
          break;
        }
        // Active or trialing → pro; anything else → free
        const activeTier = ['active', 'trialing'].includes(subscription.status) ? 'pro' : 'free';
        await updateUserTier(profile.id, activeTier);
        console.log(`[Stripe] Updated user ${profile.id} tier to ${activeTier} (sub status: ${subscription.status})`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const profile = await getUserByStripeCustomer(customerId);
        if (!profile) {
          console.warn(`[Stripe] subscription.deleted: no user found for customer ${customerId}`);
          break;
        }
        await updateUserTier(profile.id, 'free');
        console.log(`[Stripe] Downgraded user ${profile.id} to free (subscription cancelled)`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const profile = await getUserByStripeCustomer(customerId);
        if (!profile) {
          console.warn(`[Stripe] invoice.payment_failed: no user found for customer ${customerId}`);
          break;
        }
        // Flag the account — keep pro for now, Stripe will retry
        // Log prominently for manual follow-up
        console.warn(`[Stripe] ⚠️  Payment FAILED for user ${profile.id} (customer ${customerId}) — invoice ${invoice.id}`);
        // Optionally: could store a payment_failed flag in user_profiles here
        break;
      }

      default:
        // Silently ignore unhandled events
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`[Stripe] Error processing webhook ${event.type}:`, err.message);
    // Return 200 so Stripe doesn't retry — the error is on our side
    res.json({ received: true, warning: err.message });
  }
});

// ── POST /api/stripe/create-portal-session ────────────────────────────────────
router.post('/create-portal-session', async (req, res) => {
  try {
    const stripe = getStripe();
    const { customerId, returnUrl } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || 'https://www.tradvue.com/account',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] create-portal-session error:', err.message);
    res.status(500).json({ error: 'Failed to create portal session', details: err.message });
  }
});

// ── GET /api/stripe/subscription-status ───────────────────────────────────────
router.get('/subscription-status', async (req, res) => {
  try {
    const stripe = getStripe();
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query param is required' });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!profile.stripe_customer_id) {
      return res.json({
        tier: profile.tier || 'free',
        plan: null,
        status: 'none',
        renewalDate: null,
        cancelAt: null,
        amount: null,
        currency: null,
      });
    }

    // Fetch active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 5,
      expand: ['data.default_payment_method', 'data.items.data.price'],
    });

    const activeSub = subscriptions.data.find(s =>
      ['active', 'trialing', 'past_due'].includes(s.status)
    );

    if (!activeSub) {
      return res.json({
        tier: profile.tier || 'free',
        plan: null,
        status: 'none',
        renewalDate: null,
        cancelAt: null,
        amount: null,
        currency: null,
      });
    }

    const item = activeSub.items.data[0];
    const price = item?.price;
    const interval = price?.recurring?.interval;
    const planName = interval === 'year' ? 'TradVue Pro Annual' : 'TradVue Pro Monthly';
    const amount = price?.unit_amount ? price.unit_amount / 100 : null;

    res.json({
      tier: profile.tier || 'free',
      plan: planName,
      status: activeSub.status,
      renewalDate: activeSub.current_period_end
        ? new Date(activeSub.current_period_end * 1000).toISOString()
        : null,
      cancelAt: activeSub.cancel_at
        ? new Date(activeSub.cancel_at * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: activeSub.cancel_at_period_end,
      amount,
      currency: price?.currency || 'usd',
      interval,
      customerId: profile.stripe_customer_id,
    });
  } catch (err) {
    console.error('[Stripe] subscription-status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscription status', details: err.message });
  }
});

// ── GET /api/stripe/prices ────────────────────────────────────────────────────
// Returns the priceIds so the frontend can pass them to create-checkout-session
router.get('/prices', async (req, res) => {
  try {
    const prices = await getOrCreatePrices();
    res.json({
      monthly: {
        priceId: prices.monthly,
        amount: 24,
        currency: 'usd',
        interval: 'month',
        label: 'Monthly',
      },
      annual: {
        priceId: prices.annual,
        amount: 201.60,
        amountPerMonth: 16.80,
        currency: 'usd',
        interval: 'year',
        label: 'Annual',
        savingsPercent: 30,
      },
    });
  } catch (err) {
    console.error('[Stripe] /prices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch prices', details: err.message });
  }
});

module.exports = router;
module.exports.getOrCreatePrices = getOrCreatePrices;
