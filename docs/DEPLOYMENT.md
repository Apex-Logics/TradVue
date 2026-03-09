# TradVue — Production Deployment Guide

> **Prepared by Bolt | Status: Ready to deploy — Erick just needs to run ~10 commands**

---

## Pre-flight Checklist ✅

- [x] Backend `package.json` has `"start": "node server.js"`
- [x] `backend/railway.json` configured (Nixpacks, healthcheck on `/health`)
- [x] `frontend/vercel.json` configured (Next.js, security headers)
- [x] `frontend/next.config.js` updated (removed deprecated `appDir` flag)
- [x] Frontend builds clean (`npm run build` — 0 errors)
- [x] All backend syntax validated (0 errors)
- [x] JWT secret generated (see below)
- [x] Code committed to git

---

## Generated Secrets

```
JWT_SECRET=3130b7ed2a7ea50a35f1a44d7c51911d2ff523e1dcf7750e4207e19c9f289b4dd0ed27e01557fd18aee3238f3ac7d1b1d81c038bdcf91b52a4f8bb06aeb1e706
```

> ⚠️ This is pre-generated for you. You can regenerate with:
> `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## Step 1: Push to GitHub (Required for both platforms)

Railway and Vercel both deploy from GitHub. If you don't have a remote yet:

```bash
cd /Users/mini1/.openclaw/workspace/tradingplatform

# Create a new GitHub repo at https://github.com/new
# Name it: tradvue (private recommended)
# Then:

git remote add origin https://github.com/YOUR_USERNAME/tradvue.git
git push -u origin master
```

---

## Step 2: Deploy Backend to Railway

### Option A — Railway Dashboard (Recommended, no CLI needed)

1. Go to **https://railway.app** → Sign in / Create account
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `tradvue` repo
4. Set **Root Directory** to: `backend`
5. Railway auto-detects Node.js via Nixpacks

**Set Environment Variables** (in Railway dashboard → Variables tab):

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `JWT_SECRET` | `3130b7ed2a7ea50a35f1a44d7c51911d2ff523e1dcf7750e4207e19c9f289b4dd0ed27e01557fd18aee3238f3ac7d1b1d81c038bdcf91b52a4f8bb06aeb1e706` |
| `JWT_EXPIRE` | `24h` |
| `FINNHUB_API_KEY` | `d6l0av1r01qugeic91i0d6l0av1r01qugeic91ig` |
| `DATABASE_URL` | `postgresql://postgres:ChartG3n1us_Pr0d_2026!@db.ryckpsjmsrxbiylddqnb.supabase.co:5432/postgres` |

6. Click **Deploy** — Railway will build and assign a URL like:
   `https://tradvue-backend-production.up.railway.app`

### Option B — Railway CLI

```bash
npm install -g @railway/cli   # already installed

railway login                 # Opens browser — log in with GitHub
cd /Users/mini1/.openclaw/workspace/tradingplatform/backend
railway init                  # Create new project, name it "tradvue-backend"
railway up                    # Deploy

# Set env vars:
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set JWT_SECRET=3130b7ed2a7ea50a35f1a44d7c51911d2ff523e1dcf7750e4207e19c9f289b4dd0ed27e01557fd18aee3238f3ac7d1b1d81c038bdcf91b52a4f8bb06aeb1e706
railway variables set JWT_EXPIRE=24h
railway variables set FINNHUB_API_KEY=d6l0av1r01qugeic91i0d6l0av1r01qugeic91ig
railway variables set DATABASE_URL="postgresql://postgres:ChartG3n1us_Pr0d_2026\!@db.ryckpsjmsrxbiylddqnb.supabase.co:5432/postgres"

railway domain   # Get your deployed URL
```

**Note:** Railway will auto-redeploy on every `git push` to master.

---

## Step 3: Deploy Frontend to Vercel

> ⚠️ **Do Step 2 first** — you need the Railway backend URL before deploying the frontend.

Replace `RAILWAY_BACKEND_URL` with your actual Railway URL (e.g., `https://tradvue-backend-production.up.railway.app`)

### Option A — Vercel Dashboard (Recommended)

1. Go to **https://vercel.com** → Sign in / Create account with GitHub
2. Click **"Add New Project"** → Import your `tradvue` repo
3. Set **Root Directory** to: `frontend`
4. Framework auto-detected as **Next.js**

**Set Environment Variable:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-RAILWAY-URL.up.railway.app/api` |

5. Click **Deploy** — Vercel assigns a URL like:
   `https://tradvue.vercel.app`

### Option B — Vercel CLI

```bash
npm install -g vercel   # already installed

vercel login            # Opens browser — log in with GitHub

cd /Users/mini1/.openclaw/workspace/tradingplatform/frontend
vercel --prod           # Follow prompts: link to your account, project name: tradvue

# Set environment variable:
vercel env add NEXT_PUBLIC_API_URL production
# Enter value: https://YOUR-RAILWAY-URL.up.railway.app/api

# Redeploy with env var:
vercel --prod
```

---

## Step 4: Verify Production

After both are deployed, test these endpoints:

```bash
# 1. Backend health check
curl https://YOUR-RAILWAY-URL.up.railway.app/health

# Expected:
# {"status":"OK","timestamp":"...","service":"TradVue API"}

# 2. Real market data (AAPL quote)
curl https://YOUR-RAILWAY-URL.up.railway.app/api/market-data/quote/AAPL

# Expected: {"success":true,"data":{"c":...,"h":...,"l":...},...}

# 3. Auth — Register
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@tradvue.io","password":"TestPass123!","name":"Test User"}'

# 4. Frontend
open https://YOUR-VERCEL-URL.vercel.app
```

---

## Step 5: Point tradvue.io DNS to Vercel

In your domain registrar (or Cloudflare if using that):

### Root domain (tradvue.io)
- Add **A record**: `@` → `76.76.19.61` (Vercel's IP)
- OR **CNAME** (if your registrar supports CNAME flattening): `@` → `cname.vercel-dns.com`

### www subdomain
- Add **CNAME**: `www` → `cname.vercel-dns.com`

### Then in Vercel Dashboard:
1. Go to your project → **Settings** → **Domains**
2. Add `tradvue.io` and `www.tradvue.io`
3. Vercel auto-provisions SSL (Let's Encrypt)

---

## Architecture Overview

```
tradvue.io (DNS → Vercel)
       │
       ▼
  Vercel (Next.js frontend)
  NEXT_PUBLIC_API_URL ──────────────────────────────────────►
                                                    Railway (Express backend)
                                                            │
                                              ┌─────────────┼──────────────┐
                                              ▼             ▼              ▼
                                          Supabase      Finnhub API    RSS/FRED
                                         PostgreSQL    (market data)   (news/calendar)
```

---

## Notes & Known Considerations

1. **Redis**: Backend uses in-memory cache fallback when Redis is unavailable — this is fine for initial production. Add Railway Redis plugin later for persistence.

2. **CORS**: Currently set to `cors()` (allow all). For production hardening, update `server.js` to:
   ```js
   app.use(cors({ origin: 'https://tradvue.io' }));
   ```

3. **Railway pricing**: Hobby plan ($5/mo) is enough for initial launch. Scales automatically.

4. **Vercel pricing**: Free Hobby tier handles the frontend fine. Pro needed only if >100GB bandwidth/mo.

5. **Supabase connection pooling**: DATABASE_URL already configured with `ssl: { rejectUnauthorized: false }` — works with Supabase out of the box.

---

## Summary of What Erick Needs

| Task | Time | What to do |
|------|------|-----------|
| Create GitHub repo | 2 min | https://github.com/new |
| Push code | 1 min | `git remote add origin ... && git push` |
| Deploy backend | 5 min | Railway dashboard — set 6 env vars |
| Deploy frontend | 3 min | Vercel dashboard — set 1 env var |
| DNS | 5 min | Add A/CNAME records in registrar |
| **Total** | **~16 min** | |

Everything is code-ready. The deploys are configuration, not development.

---

*Last updated: 2026-03-06 by Bolt*
