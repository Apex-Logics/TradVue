# P1 Data-Path Queue — 2026-09

**For:** Axle / Bolt / Nova / Erick  
**Context:** P0 shipped to prod (`master` `30d019c`, migration `019` live). This queue is **residuals from earlier static reviews** (`REVIEW_sync_webhooks_auth.md`, `REVIEW_portfolio_csv.md`, `LAUNCH_READINESS_QUEUE_2026-09.md`). Do not invent new bugs; items labeled **hunch** need confirmation.  
**Posture:** Prioritize by **data-corruption risk**. Staging preferred for all write verification (`STAGING_VS_PROD_PLAN_2026-09.md`).  
**Owners:** Axle (gate), Bolt (code), Nova (validate), Erick (approval / dashboards / cost).

**Shipped this cycle:** **Q11** (PR #6, master `5c2b5c3` — intel namespaced to `/api/intel`, health unambiguous). **Q12** (PR #5, master `b753d99` — `authContextPersistence` CI green).

---

## Priority legend

| Tier | Meaning |
|------|---------|
| **P1-A** | Can still lose or corrupt user journal / P&L / holdings |
| **P1-B** | Security / authz / spoof that enables bad writes or token leak |
| **P1-C** | Wrong numbers / import loss (portfolio, CSV) |
| **P1-D** | Known tradeoffs / by-design / CI hygiene (track, don’t pretend fixed) |

**Approval:** Items that change sync semantics, webhook contract, schema, or paid infra need **Erick approval** before merge/deploy.

---

## Queue (corruption risk → lower)

| ID | Tier | Residual | Source | Owner | Needs approval? | Notes / done bar |
|----|------|----------|--------|-------|-----------------|------------------|
| **Q1** | P1-A | **Mount-push vs login-pull race** — push can still race slow pull / fresh device if any ungated path remains | Review A3; was P0 core | **Bolt** fix → **Nova** validate → **Axle** gate | **Erick** if behavior changes empty-local UX | Confirm P0 guard covers all call sites (`AuthContext` + journal page). Tests: slow pull, empty localStorage, cold Render. Re-open if any push before `pullComplete`. |
| **Q2** | P1-A | **Last-write-wins journal blob** — full upsert, no version / per-trade merge | Review A4 | **Bolt** | **Erick** (schema/API contract) | Add version/`updated_at` precondition or merge-by-stable-id. Two-device test must not silently drop trades. |
| **Q3** | P1-A | **Deletions don’t sync** — empty arrays keep local for guarded keys (templates, propfirm, etc.) | Review A5 | **Bolt** | **Erick** (tombstone semantics) | Explicit tombstones/`null` sentinels; deleting last template on A stays deleted on B. |
| **Q4** | P1-A | **Direct `pg` vs Supabase REST split-brain** — watchlist/portfolio/dashboard still `db.query`; journal via REST `user_data` | Review cross-cutting; A6 | **Bolt** | **Erick** if consolidating stores | Pick one authority per domain; stop triple-writing `cg_wl`. Prefer REST for request path (IPv6/`DATABASE_URL` fragility). |
| **Q5** | P1-B | **TV IP allowlist spoofable** via `X-Forwarded-For` first hop; **NT tokens in URL + morgan logs**; **TV returns 200 before token validation** | Review B3–B5 | **Bolt** | **Erick** (security + TV ack behavior) | Trust proxy correctly; redact token path in logs; hash-at-rest for tokens; validate before ack where possible; record event even on auth fail so Events log isn’t empty. |
| **Q6** | P1-C | **DRIP not compounding** in backfill; **DRIP not atomic**; sold-position dividend attribution symbol-wide | Review portfolio P1s | **Bolt** | **Erick** for lot model | Payment-order share updates; txn/RPC for `processDRIP`; lot-linked attribution. Deterministic tests. |
| **Q7** | P1-C | **FIFO/LIFO/SpecificLot cosmetic** — sorts aggregates; does not allocate lots | Review TaxTab | **Bolt** | **Erick** (tax UX claims) | Real lot allocation from transactions before gain/term. Until fixed: UI must not imply tax-engine correctness (**Axle** copy gate). |
| **Q8** | P1-C | **CSV dupes** (same-file duplicate tickers) / **fingerprint drops same-day fills** (date\|symbol\|side\|qty\|price only) | Review portfolio CSV | **Bolt** | Soft — **Erick** if changing drop vs review UX | Reject/aggregate in-file dupes; prefer broker order ids; “possible duplicate” reviewable, not silent drop. |
| **Q9** | P1-D | **Empty-cloud sync won’t propagate intentional empties** | P0 tradeoff (guard vs wipe) | **Bolt** design note → **Axle** track | **Erick** before changing | Documented P0 safety: non-empty local not replaced by empty cloud. Intentional clear needs explicit user action / tombstone (ties Q3). **Do not “fix” by re-enabling silent empty overwrite.** |
| **Q10** | P1-D | **No-order-id webhooks still can duplicate** | P0 idempotency by design when `order_id` absent | **Bolt** harden fallback → **Nova** | **Erick** if changing fallback key | P0 added idempotency for stable `order_id`. Residual: payloads without `order_id` still rely on weaker fallback (or none). Document; tighten hash fallback if approved. **By design until contract requires order_id.** |
| **Q11** | P1-B/ops | **Generic `app.use('/api', marketIntel)` above `GET /api/health`** — shadowing hazard | Review route ordering | **Bolt** | No (low risk refactor) | **Done (shipped)** PR #6, master `5c2b5c3`. Intel at `/api/intel/*`; `/health` and `/api/health` unambiguous. Old `/api/economic-indicators` 404s. |
| **Q12** | P1-D | **`frontend` `authContextPersistence` CI red** | Launch queue / test inventory | **Bolt** fix → **Nova** confirm CI | No | **Done (shipped)** PR #5, master `b753d99`. Real test fix (background `apiGetMe`); frontend unit tests 444/0. |

---

## Suggested sequencing (Axle)

1. **Confirm P0 residual surface (Q1)** — Nova adversarial pass on staging (or mocked) for race/empty matrices; reopen only if holes found.  
2. **Stand up staging** (`STAGING_VS_PROD_PLAN`) — **Erick cost confirm** before paid Supabase branch.  
3. **Q2 + Q3** (blob versioning + deletion semantics) — highest remaining silent divergence.  
4. **Q5** (webhook auth/logging) — security + invisible failed TV events.  
5. **Q4** (split-brain stores) — structural; pair with watchlist single-writer.  
6. **Q6–Q8** (portfolio/CSV) — wrong money, not silent journal wipe.  
7. **Q11–Q12** — **done** this cycle (ops/CI).  
8. **Q9–Q10** — track as known tradeoffs; change only with Erick-approved design.

---

## Owner cheat-sheet

| Owner | Owns |
|-------|------|
| **Axle** | Priority order, merge gate, no-prod-write enforcement, UX/copy when tax/sync semantics change |
| **Bolt** | Implementation + tests for Q1–Q8, Q11–Q12; design notes for Q9–Q10 |
| **Nova** | Independent validation on staging; CI evidence; fail closed to Bolt |
| **Erick** | Cost (Supabase branch/project), security/sync/tax/webhook contract approvals, dashboard backups, secret hygiene (never paste secrets in chat) |

---

## Explicitly out of scope here

- Re-opening full P0 punch list unless Nova finds a hole (Q1).  
- Docs re-lock, pricing page, GTM (still blocked on data-path green — see launch queue).  
- New feature work.
- Product code for **Q2 / Q3 / Q5** in this docs PR (needs Erick).
- Staging infra provisioning or paid Supabase branch create (needs Erick cost confirm).

---

## Success for this doc

Axle can assign the next Bolt PR from **Q2/Q3/Q5** (or Q1 reopen) without re-reading the full reviews; every residual is sourced; tradeoffs Q9/Q10 are labeled so nobody “fixes” them into data loss.
