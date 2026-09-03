# Staging vs Production Plan — 2026-09

**For:** Axle / Bolt / Erick  
**Context:** P0 shipped to prod (`master` `30d019c`, migration `019` live). Next work must not risk prod DB with migrations or write tests.  
**Posture:** Wrong data is worse than missing features. Migrate-first still applies: **staging → verify → prod**.
**Current master (ops):** `5c2b5c3` (Q11 intel namespace live). Staging infra is still **not** provisioned.

---

## Goal

Separate staging from production so:

- Schema migrations and destructive/write tests never touch the live Supabase project used by customers.
- Preview deploys can exercise sync, webhooks, portfolio, and CSV against disposable data.
- Rollback and backup are practiced on staging before any prod migration.

---

## Current stack (prod)

| Layer | Provider | Identity |
|-------|----------|----------|
| Frontend | Next.js on **Vercel** | Production = `master` / approved prod branch |
| Backend | Express on **Render** (`tradvue-api`) | Production service pointed at prod Supabase |
| Database | **Supabase** project `ryckpsjmsrxbiylddqnb` (us-east-2, **Pro**) | Sole live data plane today |

**Risk today:** One Supabase project + one Render service + Vercel prod means any “try the migration” or “run write integration tests” path can hit real user journals.

---

## Recommended topology

### 1) Database — pick one (Erick cost gate on paid branch)

| Option | Pros | Cons | Cost note |
|--------|------|------|-----------|
| **A. Supabase preview / branch DB** (preferred if budget OK) | Schema clone, close to prod, branch-linked workflows | Paid branch on Pro — **not free** | **Creating a paid Supabase branch requires explicit cost confirmation from Erick. Do not assume it has been created.** |
| **B. Second Supabase project** (staging) | Clear isolation; no branch pricing surprise | Manual schema sync; separate keys/URLs | Usually cheaper predictability; still a second billable project |

**Decision rule:** Axle proposes A vs B with rough monthly cost from dashboard. Erick confirms cost **before** anyone creates a paid branch or second project. Until then, treat prod project as **read-only for experiments** (no write tests, no experimental migrations).

### 2) Frontend — Vercel Preview

- Keep **Production** env vars pointed at prod API + prod Supabase (unchanged).
- Add **Preview** env group: staging API URL, staging Supabase URL/anon key, staging-only flags.
- Preview deployments (PR branches) must never inherit prod `DATABASE_URL` / service role / webhook secrets that can mutate prod.
- Smoke: Preview build hits staging `/health` and staging Supabase only.

### 3) Backend — Render staging

Pick one:

| Option | When |
|--------|------|
| **Staging web service** (`tradvue-api-staging`) | Ongoing P1 write tests, webhook replay, migration dry-runs |
| **Render Preview Environments** | If already enabled / cheaper for PR-scoped spikes |

Staging service env: staging Supabase URL + keys, separate webhook tokens, `NODE_ENV`/`APP_ENV=staging`, distinct `ADMIN_EMAILS` if needed. **No shared write credentials with prod.**

---

## Migrate-first rule (unchanged, now enforced by env)

1. Author migration in repo (`backend/migrations` / `database/migrations` — keep numbering unambiguous).
2. Apply on **staging** DB only.
3. Run Bolt/Nova write tests + smoke against staging.
4. Backup prod (see checklist).
5. Apply same migration to **prod** with recorded window + rollback plan.
6. Post-deploy smoke: `/health` build identity, one authenticated sync read, one webhook dry-path on staging first.

Never “run it on prod to see if it works.”

---

## Rollback + backup checklist

### Before any staging→prod migration

- [ ] Confirm target: staging project/branch id ≠ prod `ryckpsjmsrxbiylddqnb` for test writes.
- [ ] GitHub Actions Supabase dump (or dashboard backup) **green** for prod; artifact age known.
- [ ] Manual snapshot / PITR window noted (Pro project).
- [ ] Migration SQL reviewed for irreversible drops; prefer additive + backfill.
- [ ] Rollback SQL drafted (or restore-from-backup procedure if non-reversible).
- [ ] Render + Vercel deploy SHAs recorded (prod identity).
- [ ] Feature flag / env kill-switch known if new code path is risky.

### During / after prod apply

- [ ] Apply migration; verify `schema_migrations` / equivalent includes new version (e.g. post-`019`).
- [ ] Smoke: `https://tradvue-api.onrender.com/health` (prefer root `/health` for build stamp).
- [ ] Spot-check: no empty journal blobs newly written; no duplicate webhook storm.
- [ ] If bad: stop deploys; restore from backup / run rollback SQL; keep staging as repro.

### Ongoing

- [ ] Staging receives every migration **before** prod.
- [ ] Write integration tests default to staging connection strings only (CI secrets scoped).
- [ ] Prod service role / DB URL never in Preview or local `.env.example` as copy-paste defaults.

---

## Concrete next actions

### Erick (approval / cost / dashboards)

1. Confirm whether to fund **Supabase branch** vs **second project** (cost confirmation required before paid branch create).
2. Create the chosen staging DB **after** cost OK; issue staging anon/service keys to Axle (redacted handoff — no secrets in chat).
3. Confirm Render: create `tradvue-api-staging` (or enable Preview) and Vercel Preview env group.
4. Verify prod dump workflow still green; note last successful backup time.
5. Do **not** paste secrets in chat; Axle gets status only.

### Axle (orchestration)

1. Lock this plan; block Bolt write-tests against prod URLs.
2. After Erick provisions staging: wire env matrix doc (Preview vs Production vs Render staging).
3. Gate P1 merges: “migration proven on staging” checklist item.
4. Keep docs re-lock / GTM blocked until data-path QA green on staging.

### Bolt (engineering — after staging exists)

1. Point local + CI integration tests at staging only.
2. Dry-run next migration on staging; add rollback notes in PR.
3. Webhook replay / sync adversarial suites against staging DB.
4. Until staging exists: unit tests + mocks only; **no** live write against `ryckpsjmsrxbiylddqnb`.

### Nova

1. Validate staging wiring (Preview → staging API → staging DB) before signing off P1.
2. Adversarial sync/webhook cases on staging disposable data only.

---

## Explicit non-assumptions

- Paid Supabase branch: **not created** until Erick confirms cost.
- Staging Render service / Vercel Preview env: **not live** until Erick/Axle complete provisioning.
- Prod P0 + migration `019`: treated as current prod schema baseline; further schema work waits on staging path.
- Current live API identity: `5c2b5c3` (Q11). That does **not** mean staging exists.

---

## Success criteria

- A developer can run migrations and write tests with **zero** path to prod DB credentials.
- Prod migrations only follow a green staging apply + backup checklist.
- Axle can refuse any PR that targets prod DB for experimentation.
