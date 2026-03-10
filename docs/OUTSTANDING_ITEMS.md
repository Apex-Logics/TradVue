# OUTSTANDING ITEMS — TradVue / ApexLogics

> Last updated: 2026-03-10
> Owner: Erick | Managed by: Axle

---

## 🔴 P0 — BLOCKING (Fix Immediately)

| Item | Description | Owner | Notes |
|------|-------------|-------|-------|
| **Railway Deploy** | Deploys failing — IPv6 intermittent + pipeline issues | Bolt/Erick | Root cause partially identified; requires Railway support or config fix |
| **Rate Limit Fix** | Rate limit was 100 req/min — too low for SPA. Fix committed but needs Railway deploy to go live | Bolt | Depends on Railway deploy being unblocked |

---

## 🟠 P1 — THIS WEEK

| Item | Description | Owner | Deadline |
|------|-------------|-------|----------|
| **Domain Redirect** | Redirect old domain(s) to tradvue.com | Erick | 3/16 |
| **Support Email Setup** | Set up support@tradvue.com; wire to ticket system | Erick | This week |
| **Vercel Team Rename** | Rename Vercel team from `chartgenius-projects` → `apexlogics` (or similar) in dashboard | Erick | This week |

### Vercel Rename Instructions
1. Go to [vercel.com/chartgenius-projects](https://vercel.com/chartgenius-projects)
2. Settings → General → Team Name
3. Change from `chartgenius-projects` → desired name (e.g. `apexlogics`)
4. Note: CLI cannot rename teams/orgs — dashboard only

---

## 🟡 P2 — NEXT WEEK

| Item | Description | Owner | Deadline |
|------|-------------|-------|----------|
| **Chartgenius Removal** | Remove all `chartgenius` references from codebase, env vars, configs | Bolt | 3/23 |
| **Ops Dashboard** | Build/deploy ops.apexlogics.com — agent status, deploy health, monitoring | Bolt/Axle | 3/23 |

---

## 🔵 P3 — BACKLOG (No Fixed Date)

| Item | Description | Owner | Notes |
|------|-------------|-------|-------|
| **Broker Auto-Sync** | Automatic broker account sync (positions, balances) | Bolt | Needs broker API research |
| **AI Support Bot** | AI-powered first-response for customer support tickets | Axle/Bolt | After support email is set up |
| **Real-Time Agent Status** | Live dashboard showing Axle/Bolt/Zip status and current tasks | Axle | Nice to have for ops visibility |

---

## ✅ Recently Completed

- Rate limit committed (100 → 1000) — awaiting deploy
- DB startup delay fix committed
- Vercel API URL corrected (`chartgenius-production` → correct endpoint)
- Memory watchdog script created
- Backup system operational (local + Google Drive)
- Nightly crons configured

---

_Maintained by Axle. Update when items ship or priorities change._
