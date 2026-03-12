# QA Regression Report — 2026-03-12

**Run by:** Zip (QA/Ops Agent)
**Date:** 2026-03-12
**Task:** Railway shutdown + CORS cleanup + full regression test

---

## 1. Railway Reference Cleanup

### `backend/server.js` (CORS + CSP)
- ✅ `allowedOrigins` — **Already clean.** Contains only `tradvue.com`, `www.tradvue.com`, and localhost in dev. No Railway URL present.
- ✅ `connectSrc` (CSP) — **Already clean.** Contains only `'self'` and `https://tradvue-api.onrender.com`.

### Full codebase scan (`.js`, `.tsx`, `.ts`, `.json`)
```
grep -rn "railway" backend/ frontend/ --include="*.js|*.tsx|*.ts|*.json"
```
| Location | Finding | Action |
|---|---|---|
| `backend/server.js` | No Railway refs in CORS/CSP | ✅ Already clean |
| `backend/railway.json` | `$schema` field (Railway's own schema URL) | ✅ Kept — deployment config, not stale code |
| `frontend/app/`, `components/`, `lib/`, `utils/` | No Railway refs in any source file | ✅ Clean |
| `frontend/.env.production.local` | `NEXT_PUBLIC_API_URL="https://chartgenius-production.up.railway.app\n"` + `\n` artifact in GA ID | **🔧 Fixed** |
| `frontend/.next/` (old build) | Legacy Railway/ChartGenius URLs in static chunks | ✅ Cleared by fresh build |

### Key Fix: `frontend/.env.production.local`
This gitignored file (created by Vercel CLI) contained the old Railway URL with a literal `\n` artifact, which was contaminating all compiled JS chunks:
```diff
- NEXT_PUBLIC_API_URL="https://chartgenius-production.up.railway.app\n"
+ NEXT_PUBLIC_API_URL="https://tradvue-api.onrender.com"
- NEXT_PUBLIC_GA_MEASUREMENT_ID="G-S86BS36L9X\n"
+ NEXT_PUBLIC_GA_MEASUREMENT_ID="G-S86BS36L9X"
```

**Note:** This file is in `.gitignore` (`**/.env.*.local`). The git-tracked codebase was already clean — the Railway URL only leaked through this local env override.

---

## 2. Frontend Build

```
cd frontend && npx next build
```

| Result | Details |
|---|---|
| **Status** | ✅ PASSED |
| **Errors** | 0 |
| **TypeScript** | Clean |
| **Pages generated** | 18 (17 static + 1 dynamic) |
| **Railway refs in new build** | 0 (grep confirmed) |

### Pages in build output:
`/`, `/_not-found`, `/auth/callback`, `/calendar`, `/changelog`, `/dashboard`, `/help`, `/journal`, `/landing`, `/legal/cookies`, `/legal/disclaimer`, `/legal/privacy`, `/legal/terms`, `/news`, `/portfolio`, `/status`, `/stock/[ticker]`, `/tools`

---

## 3. Live API Endpoint Tests (https://tradvue-api.onrender.com)

| Endpoint | Method | Expected | Result |
|---|---|---|---|
| `/health` | GET | 200 OK | ✅ 200 — `{"status":"OK","service":"TradVue API"}` |
| `/api/auth/signup` | POST | 201 | ✅ 201 — User created |
| `/api/market-data/quote/AAPL` | GET | 200 | ✅ 200 — `{"symbol":"AAPL","current":182.34,...}` |
| `/api/news` | GET | 200 | ✅ 200 — Articles returned |
| `/api/calendar/today` | GET | 200 | ✅ 200 — 101 events returned |

All live endpoints operational. ✅

---

## 4. Frontend Pages (Build Output Verification)

| Page | Status |
|---|---|
| `/` | ✅ |
| `/journal` | ✅ |
| `/portfolio` | ✅ |
| `/tools` | ✅ |
| `/news` | ✅ |
| `/help` | ✅ |
| `/status` | ✅ |
| `/changelog` | ✅ |
| `/legal/terms` | ✅ |
| `/legal/privacy` | ✅ |
| `/legal/disclaimer` | ✅ |
| `/legal/cookies` | ✅ |

All 12 required pages present in build output. ✅

---

## 5. TradingView Charts

- TradingView iframe source present in `frontend/app/page.tsx` at line 668:
  ```
  src="https://s.tradingview.com/widgetembed/?..."
  ```
- No restrictive `frame-src` CSP on the frontend (Next.js serves HTML, not the backend).
- Backend CSP only applies to API responses (not HTML pages).
- **TradingView charts: ✅ Not blocked**

---

## Summary

| Check | Result |
|---|---|
| Railway removed from `allowedOrigins` | ✅ Was already clean |
| Railway removed from CSP `connectSrc` | ✅ Was already clean |
| Stale Railway URL in `.env.production.local` | ✅ Fixed → Render URL |
| `\n` artifact removed from env values | ✅ Fixed |
| Zero Railway refs in new frontend build | ✅ Confirmed |
| Frontend build passes 0 errors | ✅ 18 pages |
| All 5 live API endpoints healthy | ✅ |
| All 12 frontend pages in build | ✅ |
| TradingView charts not blocked | ✅ |
| Git commit | N/A — all changes were in gitignored files |

**Overall: ✅ PASS — All systems green. Railway cleanup complete.**
