# TradVue CURRENT_REALITY — 2026-09-02

**Prepared for:** Axle / Erick  
**Prepared by:** Executor subagent (Grok Bot; Cloud Agents unavailable on plan)  
**Assessment mode:** Read-only via user-Github MCP + Shell curl (no git clone, no npm install, no secrets pasted)  
**Repo:** Apex-Logics/TradVue  
**Branch:** master  
**SoT compared:** `/workspace/tradvue-docs/FIRST_WORK_ITEMS.md`, `SUMMARY.md`, zip2 `core/PLATFORM_MAP.md` (2026-03-27)

---

## 1. State snapshot

| Item | Evidence |
|------|----------|
| **HEAD** | `319b6889ed86d0edb0403882b8c8a198a03ade57` — Bolt, *"Fix admin login auth hydrate and response"* |
| **HEAD date** | 2026-04-12T15:41:53Z ≈ **11:41 AM ET** |
| **Commits after HEAD** | **None.** Freeze continues (~4.5 months idle as of 2026-09-02 ET). |
| **Open issues** | **0** |
| **Open PRs** | **0** (before this assessment PR attempt) |
| **Product posture** | Live journal / trader OS at code level; root README still market-intel MVP framing |
| **Erick QA freeze** | Still correct: wrong data worse than missing features |

### Recent commits (master, newest first)

| SHA (short) | Date (UTC) | Message |
|-------------|------------|---------|
| `319b688` | 2026-04-12 | Fix admin login auth hydrate and response |
| `ff6d251` | 2026-03-25 | feat(launch): close all remaining launch checklist gaps (28/28) |
| `f8efa2c` | 2026-03-25 | fix(ci): upload only SQL dump artifacts |
| `3bf66a4` | 2026-03-25 | fix(ci): prefer PostgreSQL 17 client in PATH |
| `eadfb60` | 2026-03-24 | fix(ci): call pg_dump-17 explicitly |
| `54b1f16` | 2026-03-24 | fix(ci): use PostgreSQL 17 client for Supabase dump |
| `4f12f4c` | 2026-03-24 | fix(ci): repair Supabase dump workflow yaml |
| `5b71995` | 2026-03-24 | Fix workflow indentation |
| `093d6c0` | 2026-03-24 | Add manual Supabase dump workflow (#1) |
| `12b1c2b` | 2026-03-24 | refactor: align landing and SEO positioning |

---

## 2. Production HTTP checks (2026-09-02 ~3:59–4:00 PM ET / ~19:59 UTC)

Checked with `curl -L` from agent box. Latencies are wall-clock for this run (warm enough; not a cold-start stress test).

| Target | HTTP | Latency (total) | Body / notes |
|--------|------|-----------------|--------------|
| `https://www.tradvue.com` | **200** | **~0.094 s** | HTML Next.js app (`theme-dark`), ~40 KB first document. Effective URL `https://www.tradvue.com/` |
| `https://tradvue-api.onrender.com/health` | **200** | **~0.146 s** | `{"status":"OK","timestamp":"2026-09-02T19:59:33.310Z","service":"TradVue API","build":"2026-03-12-v4-supabase-rest"}` |
| `https://tradvue-api.onrender.com/api/health` | **200** | **~0.331 s** | `{"status":"OK","service":"TradVue API"}` — **no `build` field** |

### Health endpoint nuance
- **SoT correction vs FIRST_WORK_ITEMS:** `/health` (root) **does** still expose build stamp `2026-03-12-v4-supabase-rest`. `/api/health` does not. Prefer `/health` when verifying build identity.
- Build stamp date (2026-03-12) is **older than** HEAD (2026-04-12). That implies either (a) stamp is static/hardcoded and not bumped on Apr admin-login deploy, or (b) production Render is not running the Apr 12 commit. **Cannot distinguish without Render dashboard / deploy history (Erick).** Treat as **P1 ops identity gap**.

---

## 3. Route / surface inventory

### 3a. Frontend `frontend/app` (master @ 319b688)

**Present (dirs / key files):**  
account, admin, auth, best-trading-journal, calendar, changelog, coach, components, constants, context, dashboard, futures-trading-journal, help, hooks, integrations, journal, landing, legal, lib, market-intel, news, ops, options-trading-journal, playbooks, portfolio, post-trade-ritual, pricing, prop-firm-tracker, propfirm, ritual, rules, status, stock, tools, trading-calculators, types, utils, verify, plus root `page.tsx` / `HomeClient.tsx` / layout / error / loading / not-found / globals.css.

**vs PLATFORM_MAP (Mar 27 SoT) — core product pages:**

| SoT page | Repo | Status |
|----------|------|--------|
| `/` Dashboard (HomeClient) | yes | present |
| `/journal` | yes | present |
| `/portfolio` | yes | present |
| `/integrations` | yes | present |
| `/account` | yes | present |
| `/propfirm` | yes | present (+ `/prop-firm-tracker` SEO/alias) |
| `/rules` | yes | present |
| `/ritual` | yes | present (+ `/post-trade-ritual`) |
| `/coach` | yes | present |
| `/market-intel` | yes | present |
| `/playbooks` | yes | present |
| `/help` | yes | present |
| `/news` | yes | present |
| `/calendar` | yes | present |
| `/tools` | yes | present (+ `/trading-calculators`) |

**Extra vs PLATFORM_MAP Other Pages list:** admin, auth, dashboard, ops, verify, pricing, status, changelog, legal, stock, SEO landers (`best-trading-journal`, `futures-trading-journal`, `options-trading-journal`). Expected growth; not drift failures.

### 3b. Backend `backend/routes` (master @ 319b688)

**Files:** admin, aggregatedNews, alerts, announcements, auth, backup, badges, brokerSync, calendar, crypto, dashboard, feedback, journal, marketAlerts, marketData, marketIntel, marketMovers, markets, news, **news_new.js**, portfolio, priceAlerts, push, sentiment, stockInfo, stocks, stripe, support, tools, userData, userManagement, verify, waitlist, watchlist, webhooks, **webhooks.js.bak**.

**vs PLATFORM_MAP mount table:**

| SoT mount | Route file | Status |
|-----------|------------|--------|
| `/api/alerts/price` | priceAlerts.js | file present |
| `/api/alerts` | alerts.js | file present |
| `/api/auth` | auth.js | file present |
| `/api/admin` | admin.js | file present |
| `/api/feedback` | feedback.js | file present |
| `/api/journal/import` | journal.js | file present |
| `/api/market-data` | marketData.js | file present |
| `/api/insider-trades` | marketIntel.js | file present |
| `/api/news` | news.js | file present |
| `/api/portfolio` | portfolio.js | file present |
| `/api/stock-info` | stockInfo.js | file present |
| `/api/stripe` | stripe.js | file present |
| `/api/user/data` | userData.js | file present |
| `/api/watchlist` | watchlist.js | file present |
| webhook TV/NT / webhook-trades / tokens | webhooks.js | file present |
| `/api/health` | (inline) | live 200 OK |

**Extras / leftovers (flagged):**
- `news_new.js` — duplicate/legacy candidate (PLATFORM_MAP / FIRST_WORK_ITEMS callout)
- `webhooks.js.bak` — backup leftover in routes tree
- `backend/railway.json` still in repo (code search hit) — Railway-era leftover; hosting SoT is Render
- Many additional route modules (badges, brokerSync, push, dashboard, waitlist, etc.) beyond PLATFORM_MAP abbreviated table — code ahead of abbreviated map, not missing core mounts

### 3c. Stack from package.json (truth vs README)

| Layer | package.json | README claim | Verdict |
|-------|--------------|--------------|---------|
| Frontend | **Next `^16.1.6`**, React `^19.2.4` | Next.js **14**, React 18 | **README WRONG** |
| Backend | Express `^5.2.1`, `@supabase/supabase-js`, **resend**, stripe, redis | Express, SendGrid, Redis/Bull | **Email vendor WRONG** (Resend in deps); Redis still listed |
| Clone URL | N/A | `github.com/TradVue/tradvue.git` | **WRONG** (real: Apex-Logics/TradVue) |

---

## 4. Doc drift

| Topic | SoT (PLATFORM_MAP / GAME_PLAN / Erick) | Repo root docs / observed |
|-------|----------------------------------------|---------------------------|
| Product | Trading journal + trader OS | README still market-intel / news / watchlist heavy (Last updated Mar 11 2026) |
| Frontend | Next 16 App Router | package.json OK (16.1.6); README badge/table say 14 |
| Backend host | Render | README Render OK; `backend/railway.json` leftover |
| Email | Resend | backend deps Resend; README **SendGrid** |
| Pricing | ~$24/mo lock (GAME_PLAN) | README Free / Professional **$19** / Enterprise **$99** |
| Auth | Supabase JWT via API | README JWT+refresh framing (partial/legacy) |
| CHANGELOG | Should track journal OS + Apr 12 admin-login fix | Tops at **Unreleased** Mission-Control-ish Dashboard Agent Integration + **0.1.0-beta 2026-03-06**; no journal/portfolio/webhooks/admin hydrate |
| Health build stamp | Noted historically | Present on `/health` only; stamp date lags HEAD |
| Issues/PRs | N/A | Empty board — work from QA matrix |
| Keep-alive | Mac Mini cron every 5 min | Almost certainly dead post-OpenClaw/Mac Mini exit |
| Clone URL | Apex-Logics/TradVue | README TradVue/tradvue |

---

## 5. Test scripts and run status

### Scripts found

**frontend/package.json**
- `test` → `jest --runInBand`
- `test:e2e` → `playwright test`
- `typecheck`, `lint`, `verify` (= test + typecheck + build)

**backend/package.json**
- `test` → `jest --runInBand --forceExit` (match `**/tests/**/*.test.js`)
- `test:watch`, `test:coverage`, `verify` (= NODE_ENV=test npm test)

### Run matrix

| Check | Result | Notes |
|-------|--------|-------|
| Frontend unit (jest) | **BLOCKED** | No checkout; Cloud Agents unavailable; no local npm install by design |
| Frontend e2e (playwright) | **BLOCKED** | Needs checkout + env; do not invent prod credentials |
| Backend jest | **BLOCKED** | Same — no runner without checkout/cloud agent |
| Remote smoke HTTP (site + health) | **PASS** | See section 2 |
| Auth hydrate / admin login regression | **BLOCKED** | Needs authenticated session + app runtime |
| Journal cloud-sync / CSV | **BLOCKED** | Needs app + env |
| Portfolio / dividends math unit | **BLOCKED** | Tests exist in-repo per SoT intent; not executable here |
| Webhooks shape (route files present) | **PASS (inventory only)** | Files present; live token/IP behavior not exercised |
| Stripe config-only | **BLOCKED** | No dashboard; do not flip live |
| Backups (GH Actions Supabase dump) | **BLOCKED** | Needs Actions history / ownership (Erick) |

**Explicit:** Automated suite execution is **blocked without checkout or Cloud Agent**. Do not treat "scripts exist" as "green."

---

## 6. Pass / fail / blocked matrix (data-path QA freeze)

| Area | Status | Evidence / gap |
|------|--------|----------------|
| Site reachable | **PASS** | HTTP 200, ~94 ms |
| API `/health` | **PASS** | 200 + build stamp |
| API `/api/health` | **PASS** | 200 (no build field) |
| Build identity vs HEAD | **FAIL / UNKNOWN** | Stamp `2026-03-12-v4…` vs HEAD 2026-04-12 — deploy identity unverified |
| Journal sync (login-pull / change-push) | **BLOCKED** | No runner / no auth |
| CSV import/export | **BLOCKED** | No runner |
| Portfolio / dividends / DRIP / tax lots | **BLOCKED** | No runner |
| Webhooks NT/TV → journal | **BLOCKED** (inventory PASS) | Route files present; live path not tested |
| Price alerts cron | **BLOCKED** | Mac Mini keep-alive likely dead; server setInterval unknown on Render sleep |
| Auth / admin (Apr 12 fix) | **BLOCKED** | Fix is HEAD of code; prod deploy of that SHA unverified |
| Stripe | **BLOCKED** | Code present; live/test + KYC = Erick |
| Backups | **BLOCKED** | Dump workflow exists historically; success unknown |
| README / CHANGELOG accuracy | **FAIL** | Severe drift (section 4) |
| Credential hygiene | **FAIL (process)** | Historical docs/archives may embed material — rotate from dashboards; none echoed here |

---

## 7. Risks ranked P0–P2

### P0
1. **Credential hygiene / hosting access inventory** — Historical JWT/DB/API/deploy-hook material in archives; agents blocked on dashboards; rotate before any ship.
2. **Data-path QA freeze baseline** — Journal sync, CSV, portfolio/dividends, webhooks, alerts unverified after 4.5-month idle; silent wrong P&L destroys trust.
3. **Production deploy identity** — Health build stamp ≠ HEAD date; confirm Render is on `319b688` (or redeploy intentionally).

### P1
4. **Ops after Mac Mini loss** — Keep-alive cron gone; confirm Render cold starts, in-process crons/setIntervals, GitHub Actions Supabase dump still green.
5. **SoT / README / CHANGELOG re-lock** — Agents trusting root docs will rebuild wrong product (Next 14, SendGrid, $19/$99, market-intel MVP).
6. **Route leftovers** — `news_new.js`, `webhooks.js.bak`, `railway.json` increase confusion and maintenance surface.

### P2
7. **Stripe live readiness** — Only after QA green + KYC/bank (Erick-owned).
8. **LLM coach claims** — Attorney/SEC-FINRA gate remains.
9. **Empty GitHub board** — No issues/PRs; work must be driven from this matrix, not triage board.

---

## 8. Erick-only blockers (agents cannot clear)

| Blocker | Why |
|---------|-----|
| Vercel project access (env, deploy hooks, which branch auto-deploys) | Frontend ship/verify |
| Render `tradvue-api` dashboard (env, logs, manual deploy, plan, confirm SHA) | Backend identity + cold starts |
| Supabase project access (Auth, RLS, DB; rotate if leaked) | Journal/portfolio cloud truth |
| Stripe KYC + bank + live vs test keys | Pre-revenue until Erick flips |
| Credential rotation for historical DEPLOYMENT / backup / deploy-hook material | Treat as compromised until rotated |
| Resend / Cloudflare / Finnhub (etc.) ownership | Email + DNS/WAF + market data |
| GitHub Actions credentials for Supabase dump | Confirm backup still succeeding |
| Pricing re-lock (~24 vs README 19/99 vs older 12.99) | No customer-facing pricing change without Erick |
| Attorney gate for LLM AI Coach | Statistical coach only until green light |

---

## 9. Recommended next P0 (single)

**Confirm production deploy identity + open Erick dashboard access for credential rotation** — specifically:

1. Erick opens Render dashboard → confirm which commit/SHA `tradvue-api` is running; if not `319b688`, decide redeploy vs accept and bump health build stamp.
2. Erick inventories Vercel / Supabase / Stripe / Resend / Actions credentials and rotates anything that appeared in early docs/archives (do not paste into chat).
3. **Only after** identity + access: next engineering P0 is a **staging/read-only QA pass** on journal sync + CSV + portfolio dividend math + webhook auth shape (with tests), still **no feature work**.

**Non-goals this week:** new features, LLM coach, Robinhood/SnapTrade live, marketing blitz, Mission Control rebuild, pricing/copy changes.

---

## 10. Method and limits

- GitHub MCP: `list_commits`, `get_file_contents` (README, CHANGELOG, package.json x2, dir listings), `list_issues`, `list_pull_requests`, `search_code` (railway leftovers).
- Shell: curl only for public HTTP; memo also saved under `/workspace/tradvue-docs/`.
- **Did not:** git clone, npm install, paste credentials, invent credentials, deploy, or change pricing/features.
- Cloud Agents unavailable on Erick's plan → test execution blocked; PR via GitHub MCP file/PR APIs.

---

## 11. Artifact locations

| Artifact | Path |
|----------|------|
| This memo (local SoT copy) | `/workspace/tradvue-docs/CURRENT_REALITY_2026-09.md` |
| Intended repo path | `docs/CURRENT_REALITY_2026-09.md` (this PR) |
| Prior planning | `FIRST_WORK_ITEMS.md`, `SUMMARY.md` |

---

*End of CURRENT_REALITY assessment — 2026-09-02 ET.*
