# Stripe Subscription Integration — TradVue

> Built: 2026-03-15 | Status: Complete, test mode

## Overview

TradVue uses Stripe Checkout + Customer Portal for all billing. No custom payment forms — full PCI compliance. Tier changes are enforced exclusively via the Supabase service role, never via direct user input.

---

## Architecture

```
User clicks "Subscribe"
  → Frontend calls GET /api/stripe/prices (no auth required)
  → Frontend calls POST /api/stripe/create-checkout-session (auth required)
  → Backend returns Stripe Checkout URL
  → User redirected to Stripe-hosted checkout
  → Stripe sends webhook to POST /api/stripe/webhook
  → Backend updates user tier via service_role
  → User redirected to /account?session_id=xxx
```

---

## Environment Variables — Set in Render Dashboard

| Variable | Description | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_... or sk_live_...) | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (whsec_...) | Stripe Dashboard → Developers → Webhooks → your endpoint |
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — used for tier updates (bypasses RLS) | Supabase Dashboard → Project Settings → API |

### Optional (auto-created on first boot)

| Variable | Description |
|---|---|
| `STRIPE_PRICE_MONTHLY` | price_... for $24/month plan (auto-created if absent) |
| `STRIPE_PRICE_ANNUAL` | price_... for $201.60/year plan (auto-created if absent) |

> **Note:** Price IDs are logged on server startup when auto-created. You can hardcode them after the first boot for determinism.

---

## Stripe Webhook Configuration

1. In Stripe Dashboard → Developers → Webhooks, add endpoint:
   - URL: `https://tradvue-api.onrender.com/api/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
2. Copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` on Render.

> ⚠️ The webhook endpoint uses `express.raw()` (registered before the JSON body parser in `server.js`). Signature verification is mandatory and will reject all requests with invalid signatures.

---

## Pricing

| Plan | Price | Billing |
|---|---|---|
| Monthly | $24.00/month | Billed monthly |
| Annual | $201.60/year ($16.80/mo) | Billed annually — **30% off** |

Products and prices are auto-created in Stripe on first boot using idempotency keys. They will not be duplicated on restart.

---

## Trial System

- **Duration:** 21 days (3 weeks) from account creation
- **Access:** Full Pro access during trial — same as paid tier
- **Enforcement:** `requirePaid` middleware checks `trial_ends_at` column in `user_profiles`
- **Expiry:** After trial ends, users are restricted to free-tier limits
- **Column:** `trial_ends_at TIMESTAMPTZ` on `user_profiles` — set by `handle_new_user()` trigger on signup

---

## Database Migration

Run `backend/migrations/015_stripe_trial.sql` in the Supabase SQL Editor before deploying.

**What it does:**
1. Adds `stripe_customer_id TEXT` to `user_profiles` (with unique index)
2. Adds `trial_ends_at TIMESTAMPTZ` to `user_profiles`
3. Updates `handle_new_user()` trigger to set `trial_ends_at = NOW() + 21 days`
4. Backfills `trial_ends_at` for existing users (based on `created_at`)
5. Revokes `UPDATE(tier)` from the `authenticated` role (belt+suspenders for tier lock)

---

## Backend Routes

### `GET /api/stripe/prices` — Public
Returns monthly and annual price IDs. No auth required.

```json
{
  "monthly": { "priceId": "price_...", "amount": 24, "interval": "month" },
  "annual":  { "priceId": "price_...", "amount": 201.60, "amountPerMonth": 16.80, "savingsPercent": 30 }
}
```

### `POST /api/stripe/create-checkout-session` — Auth required
Creates a Stripe Checkout session. Accepts `{ priceId }` in body.
Returns `{ url, sessionId }`. Frontend redirects to `url`.

### `POST /api/stripe/create-portal-session` — Auth required
Creates a Stripe Customer Portal session.
Returns `{ url }`. Frontend redirects to `url`.

### `GET /api/stripe/subscription-status` — Auth required
Returns current subscription info for the authenticated user.

### `POST /api/stripe/webhook` — Stripe only
Handles Stripe events. Signature verification mandatory.

---

## Feature Gating Middleware

```js
const { requirePaid } = require('../middleware/requirePaid');

// Protect a route:
router.get('/pro-only', requireAuth, requirePaid, handler);
```

**Access matrix:**
| Condition | Result |
|---|---|
| `tier === 'pro'` | ✅ Allow |
| `tier === 'free'` + `trial_ends_at > NOW()` | ✅ Allow (trial) |
| `tier === 'free'` + trial expired or null | ❌ 403 |

**403 response:**
```json
{
  "error": "Pro subscription required",
  "message": "This feature requires a TradVue Pro subscription.",
  "upgradeUrl": "https://www.tradvue.com/pricing",
  "tier": "free",
  "trialExpired": true
}
```

Use `requirePaidStrict` for high-value endpoints where you want to fail closed on DB errors.

---

## Frontend Pages

| Path | Description |
|---|---|
| `/pricing` | Full pricing page with monthly/annual toggle + compare table |
| `/account` | Subscription status, Manage Billing button, upgrade CTA |

### Components
- `PricingCard` — Two pricing cards with Stripe checkout integration
- `UpgradePrompt` — Paywall modal (gated feature + pricing)
- `TrialBanner` — Top-of-page banner showing trial status/days remaining

All frontend components use the Bearer token from `AuthContext` — no Stripe keys in frontend code.

---

## Security Notes

- Stripe secret key is **backend-only** — never sent to the frontend
- Webhook signature is verified on every webhook request
- `priceId` is validated against known TradVue prices before creating sessions
- User identity comes from the validated JWT — never from the request body
- Tier changes only go through the Stripe webhook handler using the service role
- The `tier` column is protected by RLS + column-level privilege revocation

---

## Testing

```bash
cd backend
npx jest tests/stripe.test.js
```

**23 tests covering:**
- Webhook signature validation (invalid/missing/valid)
- All 4 webhook event handlers
- Duplicate webhook idempotency
- Auth guards on all protected endpoints
- Input validation (invalid priceId format/unknown)
- Portal session creation (with/without stripe_customer_id)
- requirePaid middleware (pro / active trial / expired trial / no trial)
