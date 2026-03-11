# TradVue Backend: Railway → Render Migration Plan

**Created:** 2026-03-11  
**Author:** Zip (Infrastructure Agent)  
**Status:** Ready to Execute  
**Estimated migration time:** 2–3 hours (plus 48h stabilization window)

---

## Overview

We are migrating the TradVue Express backend from Railway to Render.com. The backend runs in Docker, serves on port 3001, uses Supabase for the database, and is consumed by a Vercel-hosted Next.js frontend.

**Current Railway URL:** `https://tradvue-production.up.railway.app`  
**New Render URL:** `https://tradvue-api.onrender.com` (exact subdomain set during service creation)

---

## Dockerfile Compatibility Assessment ✅

**Dockerfile location:** `/backend/Dockerfile`

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"
CMD ["node", "server.js"]
```

**Verdict: COMPATIBLE with one caveat.**

- ✅ `node:22-slim` — valid Docker base image, Render supports any Docker image
- ✅ `npm ci --omit=dev` — correct production install
- ✅ `CMD ["node", "server.js"]` — valid entrypoint
- ✅ Dockerfile HEALTHCHECK is native Docker — Render also runs its own HTTP health check
- ⚠️ **PORT issue:** Render's default expected port is `10000`, but we expose `3001`. **Fix:** Set `PORT=10000` as an environment variable on Render OR configure Render to use port `3001`. Setting `PORT=10000` is preferred since our app reads `process.env.PORT || 3001`.

**Recommended approach:** Set `PORT=10000` in Render environment variables. The app already uses `const PORT = process.env.PORT || 3001`, so no code changes needed.

---

## Complete Environment Variables Inventory

Discovered via `grep -rn "process.env"` across all backend JS files:

| Variable | Required | Source | Notes |
|----------|----------|--------|-------|
| `DATABASE_URL` | ✅ Critical | Supabase | Postgres connection string |
| `JWT_SECRET` | ✅ Critical | Generate | Server warns if missing (line 26 server.js) |
| `PORT` | ✅ | Set to `10000` | Render default; app falls back to 3001 |
| `NODE_ENV` | ✅ | `production` | Controls CORS, error messages |
| `FINNHUB_API_KEY` | ✅ | Finnhub | Stock market data |
| `NEWS_API_KEY` | ✅ | NewsAPI | News aggregation |
| `FRED_API_KEY` | ✅ | FRED (St. Louis Fed) | Economic data |
| `ALPHA_VANTAGE_API_KEY` | ✅ | Alpha Vantage | Stock data |
| `ADMIN_KEY` | ⚠️ | Internal | Admin endpoint auth key |
| `ETHERSCAN_API_KEY` | ⚠️ | Etherscan | Crypto data (routes/crypto.js) |
| `EXCHANGE_RATES_API_KEY` | ⚠️ | ExchangeRatesAPI | Currency conversion |
| `JWT_EXPIRE` | Optional | Default in code | JWT expiry duration |
| `REDIS_HOST` | Optional | Redis | If using Redis for caching |
| `REDIS_PORT` | Optional | Redis | If using Redis for caching |

> **Get current values from Railway:** Dashboard → TradVue Service → Variables tab. Copy all values before migration.

---

## 1. Pre-Migration Checklist

### Account & Access
- [ ] Create Render account at https://dashboard.render.com/register
- [ ] Connect GitHub account (or prepare manual deploy option)
- [ ] Verify the `ApexLogics/tradingplatform` repo is accessible

### Environment Variables
- [ ] Export all env vars from Railway (Dashboard → Service → Variables)
- [ ] Confirm `JWT_SECRET` value exists in Railway
- [ ] Confirm `DATABASE_URL` Supabase connection string is valid
- [ ] List any Redis host/port if currently active
- [ ] Store all values securely (1Password or local .env backup)

### Dockerfile Prep
- [ ] Confirm Dockerfile is committed to the repo (it is ✅)
- [ ] Confirm `server.js` is in the repo root of `/backend/`

### DNS / Domain Prep
- [ ] Note current Railway domain: `tradvue-production.up.railway.app`
- [ ] Decide on custom domain strategy:
  - Option A: Use Render's free subdomain (`tradvue-api.onrender.com`) — fastest
  - Option B: Point a custom domain (e.g., `api.tradvue.com`) — cleanest long-term
- [ ] If using custom domain: verify access to DNS provider (Cloudflare/Namecheap/etc.)

### Code Prep
- [ ] Update `connectSrc` in CSP (server.js line 45) to add new Render URL before cutover
- [ ] CORS `allowedOrigins` already targets `tradvue.com` domain — ✅ no changes needed post-cutover, but verify during test phase

---

## 2. Step-by-Step Migration

### Step 1: Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com) → **New → Web Service**
2. Select **Git Provider** → connect GitHub → select `ApexLogics/tradingplatform` repo
3. Configure the service:

| Field | Value |
|-------|-------|
| **Name** | `tradvue-api` |
| **Region** | `Oregon (US West)` or `Ohio (US East)` — pick closest to Supabase region |
| **Branch** | `main` |
| **Language** | `Docker` |
| **Dockerfile Path** | `./backend/Dockerfile` |
| **Build Context** | `./backend` |
| **Instance Type** | `Starter ($7/mo)` or `Standard ($25/mo)` — see cost section |

4. Click **Advanced** section before creating

### Step 2: Set Environment Variables

In the **Advanced** section, add all variables from the inventory above:

```
PORT=10000
NODE_ENV=production
DATABASE_URL=<from Railway>
JWT_SECRET=<from Railway>
JWT_EXPIRE=<from Railway, if set>
FINNHUB_API_KEY=<from Railway>
NEWS_API_KEY=<from Railway>
FRED_API_KEY=<from Railway>
ALPHA_VANTAGE_API_KEY=<from Railway>
ADMIN_KEY=<from Railway>
ETHERSCAN_API_KEY=<from Railway, if set>
EXCHANGE_RATES_API_KEY=<from Railway, if set>
REDIS_HOST=<from Railway, if set>
REDIS_PORT=<from Railway, if set>
```

> **Tip:** Render supports "Secret" variables (masked in logs). Mark `JWT_SECRET`, `DATABASE_URL`, and all API keys as secrets.

### Step 3: Configure Health Check

In **Advanced** settings:

| Field | Value |
|-------|-------|
| **Health Check Path** | `/health` |
| **Health Check Grace Period** | `60` seconds |

> Render will GET `https://tradvue-api.onrender.com/health` and expect HTTP 200. Our endpoint already handles this. ✅

### Step 4: Deploy and Verify

1. Click **Create Web Service** — Render starts the first build
2. Watch the **Logs** tab for build and startup output
3. Confirm you see: `Server running on port 10000` (or whatever PORT resolves to)
4. Once deployed, test the Render URL:

```bash
# Health check
curl https://tradvue-api.onrender.com/health

# Basic API test (adjust endpoint as needed)
curl https://tradvue-api.onrender.com/api/markets

# Auth test (requires valid token)
curl -H "Authorization: Bearer <token>" https://tradvue-api.onrender.com/api/portfolio
```

5. If health check passes and APIs respond → proceed to Step 5

### Step 5: Update Backend CSP (Before Cutover)

In `backend/server.js`, line 45, update `connectSrc` to include the new Render URL:

```js
// BEFORE:
connectSrc: ["'self'", "https://tradvue-production.up.railway.app"]

// AFTER (add both during transition):
connectSrc: ["'self'", "https://tradvue-production.up.railway.app", "https://tradvue-api.onrender.com"]
```

Deploy this change to Railway first (so existing frontend still works), then verify on Render.

### Step 6: Update Vercel Frontend API URL

1. Go to [Vercel Dashboard](https://vercel.com) → TradVue project → **Settings → Environment Variables**
2. Update `NEXT_PUBLIC_API_URL`:
   - **Old:** `https://tradvue-production.up.railway.app`
   - **New:** `https://tradvue-api.onrender.com` (or custom domain if configured)
3. Redeploy the frontend (trigger a new deployment or push a commit)
4. Verify the production frontend calls the new Render backend

### Step 7: (Optional) Custom Domain Setup

If using `api.tradvue.com` instead of `*.onrender.com`:

1. In Render Dashboard → tradvue-api service → **Settings → Custom Domains**
2. Click **+ Add Custom Domain** → enter `api.tradvue.com`
3. Render provides a CNAME target (e.g., `tradvue-api.onrender.com`)
4. Go to DNS provider → add CNAME record:
   - **Name:** `api`
   - **Target:** `tradvue-api.onrender.com`
   - **TTL:** 300 (or minimum allowed)
5. Remove any existing AAAA records for this subdomain
6. Click **Verify** in Render Dashboard
7. Wait for DNS propagation (5–30 minutes typically)
8. Render auto-issues TLS certificate (free, auto-renewed)

### Step 8: End-to-End Verification

Run through these scenarios before declaring success:

- [ ] Frontend loads at `tradvue.com`
- [ ] User can log in / JWT auth works
- [ ] Dashboard loads market data (Finnhub)
- [ ] News feed loads (NewsAPI)
- [ ] Portfolio page renders
- [ ] Watchlist CRUD operations work
- [ ] Journal entries save/load
- [ ] `/health` endpoint returns 200
- [ ] No CORS errors in browser console
- [ ] No CSP violations in browser console

---

## 3. Rollback Plan

**Golden rule: Keep Railway running until 48 hours of stable Render operation.**

### If issues are found during testing (before cutover):
- Railway is still live — users are unaffected
- Fix the issue on Render, redeploy, re-test
- No user-facing impact

### If issues arise after Vercel cutover:
```
Vercel Dashboard → TradVue → Settings → Environment Variables
→ Set NEXT_PUBLIC_API_URL back to: https://tradvue-production.up.railway.app
→ Trigger redeploy
```
Time to rollback: ~2 minutes.

### If custom domain was cut over:
```
DNS Provider → Revert CNAME api.tradvue.com → point back to Railway
(or simply delete the CNAME — Railway URL still works)
```
Time to rollback: 5–30 minutes (DNS propagation).

### Rollback decision criteria:
- Error rate > 1% on Render after cutover → rollback immediately
- Health check failures persisting > 5 minutes → rollback
- Auth/JWT failures → rollback
- Database connection errors → rollback (check DATABASE_URL was set correctly)

---

## 4. Post-Migration Cleanup

**Wait 48 hours of stable Render operation before any cleanup.**

### After 48h stability confirmed:

- [ ] **Disable Railway service** (don't delete yet — just suspend/pause it)
- [ ] **After 7 days:** Delete Railway service to stop billing
- [ ] **Update CSP** in server.js — remove old Railway URL from `connectSrc`
- [ ] **Update MEMORY.md / docs** to reflect new Render infrastructure
- [ ] **Update any monitoring** (UptimeRobot, etc.) URLs from Railway to Render
- [ ] **Update backup scripts** that reference Railway domain
- [ ] **Update cron jobs** that ping Railway health check URL
- [ ] **Update this document** status to "Completed"
- [ ] **Archive Railway env vars** securely (they're already in Render, but good to keep a backup)

### Documentation to update:
- `tradingplatform/docs/INFRASTRUCTURE.md` (if exists)
- Any runbook or ops docs referencing `railway.app`
- Discord #deploys channel pinned messages
- Any CI/CD scripts or GitHub Actions workflows

---

## 5. Cost Comparison

### Current: Railway

Railway pricing (as of 2026):
- **Hobby plan:** $5/month base + usage-based compute
- **Backend service (Node.js, ~512MB RAM):** ~$5–15/month depending on requests
- **Estimated current cost:** ~$10–20/month

> Get exact current cost from: Railway Dashboard → Billing → Current Cycle

### Expected: Render

Render web service pricing (Docker):

| Instance Type | RAM | CPU | Price |
|---------------|-----|-----|-------|
| Free | 512 MB | 0.1 | $0/mo (spins down after 15min inactivity ⚠️) |
| Starter | 512 MB | 0.5 | **$7/mo** |
| Standard | 2 GB | 1.0 | $25/mo |
| Pro | 4 GB | 2.0 | $85/mo |

**Recommended for TradVue backend:** **Starter ($7/mo)**
- 512 MB RAM is sufficient for an Express API with external API calls
- No spin-down (unlike Free tier)
- Upgrade to Standard if memory issues arise

> ⚠️ **Do NOT use Free tier for production** — it spins down after 15 minutes of inactivity, causing 30–60 second cold starts for first request.

### Cost Analysis

| | Railway (est.) | Render Starter |
|--|----------------|----------------|
| Monthly | ~$10–20 | $7.00 |
| Annual | ~$120–240 | $84.00 |
| **Savings** | — | **$36–156/year** |

**Break-even:** Immediate — Render is cheaper from day 1.

**Additional Render benefits:**
- Free TLS (auto-renewed) — same as Railway ✅
- Free custom domain — same as Railway ✅  
- Better observability (metrics, log retention)
- GitHub auto-deploy on push — same as Railway ✅
- No egress fees on standard plans

---

## Quick Reference: Key URLs

| Resource | URL |
|----------|-----|
| Render Dashboard | https://dashboard.render.com |
| Render Docs - Web Services | https://render.com/docs/web-services |
| Render Docs - Docker | https://render.com/docs/docker |
| Render Docs - Custom Domains | https://render.com/docs/custom-domains |
| Render Docs - Health Checks | https://render.com/docs/deploys#health-checks |
| Railway Dashboard (current) | https://railway.app/dashboard |
| Vercel Dashboard (frontend) | https://vercel.com/chartgenius-projects/tradvue |

---

## Migration Status Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Research & planning | ✅ Done | This document |
| Pre-migration checklist | ⬜ Pending | |
| Create Render service | ⬜ Pending | |
| Set env vars | ⬜ Pending | |
| First deploy | ⬜ Pending | |
| API testing | ⬜ Pending | |
| CSP update | ⬜ Pending | |
| Vercel cutover | ⬜ Pending | |
| Custom domain (optional) | ⬜ Pending | |
| E2E verification | ⬜ Pending | |
| 48h stability window | ⬜ Pending | |
| Railway cleanup | ⬜ Pending | |

---

*Generated by Zip — TradVue Infrastructure Agent | 2026-03-11*
