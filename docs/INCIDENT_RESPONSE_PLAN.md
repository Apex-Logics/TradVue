# TradVue Incident Response Plan

**Status:** Active  
**Owner:** Bolt (engineering) + Erick (escalation)  
**Last updated:** 2026-03-25

---

## 1) Severity Levels

| Level | Definition | Examples | Response SLA |
|---|---|---|---|
| P1 — Critical | Service fully down or data breach | Backend 500s for all users, DB unreachable, credential leak | Acknowledge < 15 min, mitigate < 1 hour |
| P2 — Major | Feature partially broken for many users | Auth flow failing, webhook ingestion down, Stripe checkout broken | Acknowledge < 30 min, mitigate < 4 hours |
| P3 — Minor | Feature degraded for some users, workaround exists | Slow page loads, stale cache, one calculator broken | Acknowledge < 2 hours, fix within 24 hours |
| P4 — Low | Cosmetic or non-blocking issue | Typo, minor UI glitch, non-critical log noise | Fix in next release cycle |

---

## 2) On-Call & Escalation

### Current team (pre-revenue)
| Role | Person | Contact | Backup |
|---|---|---|---|
| First responder (engineering) | Bolt (AI agent) | Automated via cron monitoring | — |
| Escalation / business owner | Erick | Telegram @7809934450 | Email: apexlogicsfl@gmail.com |

### Escalation path
1. **Automated detection** — security monitor cron (every 30 min), Render health ping (every 10 min), external uptime monitor
2. **Bolt** — assess severity, attempt automated fix, post to #security or #server on Discord
3. **Erick** — notified for P1/P2 via Telegram/Discord; makes public comms decisions
4. **Public** — update /status page if P1 lasts > 30 min; post to X/Discord if user-facing impact > 1 hour

---

## 3) Incident Workflow

### Detection
- External uptime monitor alerts (UptimeRobot → email/SMS)
- Security monitor cron posts to #security on alert-level events
- User reports via feedback widget or support@tradvue.com
- Render dashboard alerts

### Response
1. **Acknowledge** — confirm the issue exists, log severity
2. **Communicate** — post initial status in Discord #server
3. **Investigate** — check Render logs, Supabase dashboard, recent deploys
4. **Mitigate** — rollback deploy if caused by recent push; restart service; scale if load-related
5. **Resolve** — fix root cause, verify fix in production
6. **Post-mortem** — write brief incident note in `memory/YYYY-MM-DD.md` for P1/P2

### Rollback procedure
```bash
# Render: rollback to previous deploy
# Go to Render dashboard → service → Deploys → click "Rollback" on last known good deploy

# Vercel (frontend): rollback
# Go to Vercel dashboard → Deployments → Promote previous deployment

# Git rollback (if needed)
git revert HEAD --no-edit && git push
```

---

## 4) Data Breach Response

Per GDPR, breaches must be reported within **72 hours** of discovery.

### If a breach is suspected:
1. Rotate all compromised credentials immediately
2. Assess what data was exposed (user emails, trade data, payment info?)
3. Notify Erick within 1 hour
4. If personal data was exposed:
   - Notify affected users via email within 72 hours
   - File report with relevant authority if required (ICO for UK/EU users)
5. Document timeline and response in `docs/security/`

---

## 5) Communication Templates

### Discord #server (internal)
```
🚨 [P1/P2] — [Brief description]
Status: Investigating
Impact: [what users see]
ETA: [estimated fix time or "assessing"]
```

### Public status update (if needed)
```
We're aware of an issue affecting [feature]. We're actively working on it.
Current status: [investigating / identified / fixing / resolved]
Updates: tradvue.com/status
```

---

## 6) Post-Incident Checklist

- [ ] Root cause identified
- [ ] Fix deployed and verified
- [ ] Incident note written in `memory/YYYY-MM-DD.md`
- [ ] Monitoring updated if detection gap existed
- [ ] User communication sent (if P1 with user impact)
- [ ] Any credential rotation completed
