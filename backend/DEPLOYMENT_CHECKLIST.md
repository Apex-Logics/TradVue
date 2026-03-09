# TradVue Backend — Railway Deployment Checklist

## 🔴 Why Auth Is Broken

The `/api/auth/register` and `/api/auth/login` endpoints return **500 Internal Server Error**
when `DATABASE_URL` is not set. The DB pool (`services/db.js`) fails to connect silently at startup,
then every `db.query()` call throws — caught by the route's try/catch and returned as a generic 500.

---

## ✅ Pre-Deployment Checklist

### 1. Railway Environment Variables (set in Railway dashboard)

Go to your Railway project → **Variables** tab and add all of these:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | 🔴 **CRITICAL** | Supabase Postgres connection string (Transaction mode, port 6543) |
| `JWT_SECRET` | 🔴 **CRITICAL** | Random 256-bit string — generate with `openssl rand -hex 32` |
| `NODE_ENV` | ✅ Yes | Set to `production` |
| `PORT` | ⚪ Optional | Railway injects this automatically — do not override |
| `FINNHUB_API_KEY` | ✅ Yes | From https://finnhub.io — real-time market data |
| `ALPHA_VANTAGE_API_KEY` | Optional | From https://www.alphavantage.co |
| `NEWS_API_KEY` | Optional | From https://newsapi.org (RSS feeds work without it) |
| `FRED_API_KEY` | Optional | From https://fred.stlouisfed.org/docs/api/api_key.html |
| `JWT_EXPIRE` | Optional | Default: `24h` |
| `JWT_REFRESH_EXPIRE` | Optional | Default: `7d` |

### 2. Getting the Supabase DATABASE_URL

In Supabase dashboard → **Settings → Database → Connection string**:
- Choose **Transaction** mode (port **6543**) for Railway's serverless-friendly pooler
- Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- ⚠️ Do NOT use port 5432 (direct connection) — Railway containers may time out

### 3. Verify railway.json is committed

The `railway.json` in this directory tells Railway how to build and start the service:
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```
This file is already committed. ✅

---

## 🚀 Deployment Steps

1. **Set env vars** in Railway dashboard (see table above — `DATABASE_URL` and `JWT_SECRET` are must-haves)
2. **Trigger redeploy** — Railway will pick up the new vars
3. **Verify health check**: `GET https://your-app.railway.app/health` → should return `{ "status": "OK" }`
4. **Test auth**:
   ```bash
   curl -X POST https://your-app.railway.app/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpass123"}'
   ```
   Expect: `201` with a JWT token.

---

## 🔍 Debugging

If you still get 500s after setting vars:

1. **Check Railway logs** — look for:
   - `[DB] ❌ PostgreSQL connection failed:` → DATABASE_URL is wrong or unreachable
   - `[DB] ✅ PostgreSQL connected` → DB is fine, the bug is elsewhere

2. **Common mistakes**:
   - Using Supabase direct URL (port 5432) instead of pooler (6543)
   - Forgetting to URL-encode special characters in the password
   - `DATABASE_URL` has a trailing space or newline

3. **Quick test** — hit `/health` first. If that returns OK, the server is running.
   If auth still fails, it's definitely the DB connection.

---

## 📁 File Reference

| File | Purpose |
|---|---|
| `railway.json` | Build + deploy config for Railway |
| `.env.example` | All env vars documented with descriptions |
| `services/db.js` | PostgreSQL pool — reads `DATABASE_URL` |
| `routes/auth.js` | Register + login endpoints |
| `server.js` | App entrypoint |

---

_Last updated: 2026-03-06 — Bolt, ApexLogics_
