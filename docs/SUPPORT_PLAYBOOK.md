# TradVue Beta Support Playbook

**Version:** 1.0  
**Last Updated:** March 6, 2026  
**Maintained By:** Support Team (Erick, Bolt)  
**Status:** Active

---

## 1. Common Issues & Responses

### Issue: Can't Log In

**Symptoms:**
- Authentication failure / "Invalid credentials"
- Password reset emails not arriving
- Account locked after multiple attempts
- "Database connection error" on login

**Root Causes:**
- Incorrect email/password
- Email verification not completed
- Railway backend temporarily down
- Browser cache/cookies issue
- Account not yet provisioned

**Troubleshooting Steps:**
1. Verify email address is correct (case-insensitive)
2. Try password reset → check spam/promotions folder
3. Clear browser cache and cookies, try incognito/private mode
4. Confirm email was verified (check signup confirmation email)
5. Check [status page] for backend availability
6. Try a different browser if issue persists

**Workaround:**
- If reset email not received after 5 mins: have user check spam folder, then resend
- If still failing: escalate to Erick for manual database check

---

### Issue: Data Not Loading

**Symptoms:**
- Dashboard shows empty charts
- Watchlist items load but no prices
- "Loading..." spinner stuck > 10 seconds
- 500 error or network timeout

**Root Causes:**
- Railway backend stalled/crashed
- Finnhub API quota exceeded
- Supabase connection timeout
- Browser JavaScript error (broken state)
- Very large watchlist (>1000 items)

**Troubleshooting Steps:**
1. Check internet connection (ping a known site)
2. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Log out and log back in
4. Clear local storage: open DevTools → Application → Local Storage → Clear all
5. Check [status page] for known outages
6. Try with a smaller watchlist (remove 100+ items)
7. If error persists, share browser console error (Ctrl+Shift+J)

**Workaround:**
- If a specific watchlist causes hang: temporarily remove problematic symbols
- Can export data if needed while investigating

---

### Issue: Alerts Not Working

**Symptoms:**
- Alert created but no notification received
- Price hits threshold but no alert triggered
- "Alert set" indicator missing
- Browser notifications disabled

**Root Causes:**
- Browser notification permissions denied
- Alert syntax error (invalid symbol, bad threshold)
- Real-time data feed delay
- Alert deleted/expired
- Notification channel misconfigured
- User dismissed notification center access

**Troubleshooting Steps:**
1. Verify browser notifications enabled:
   - Settings → Privacy & Security → Notifications → TradVue ✓
2. Check alert details:
   - Is the symbol correct? (AAPL not Apple)
   - Is threshold realistic? (not $0.01 below current price)
3. Test with a nearby price trigger first (within 2%)
4. Check Settings → Notifications:
   - Email alerts turned on?
   - Push enabled?
   - Quiet hours set too wide?
5. Try creating a new alert from scratch
6. Refresh dashboard and re-enable notifications

**Workaround:**
- Use email alerts as backup if push not working
- Pin alert to Always Show in browser
- Known issue: delays up to 2-5 min on some news sources (by design)

---

### Issue: App is Slow / High Latency

**Symptoms:**
- Page takes 5+ seconds to load
- Clicking buttons has 2+ second delay
- Charts render slowly
- Network requests taking >3s

**Root Causes:**
- Railway backend overloaded
- Finnhub API slow response
- Browser running too many tabs (memory leak)
- Very large dataset (10k+ prices in one watchlist)
- User's ISP/network issue
- Supabase query timeout

**Troubleshooting Steps:**
1. Check network tab (DevTools → Network):
   - Which requests are slow? (API, assets, images?)
2. Reduce watchlist size temporarily:
   - Archive older watchlists, keep active ones only
3. Check browser memory:
   - DevTools → Performance → take heap snapshot
   - Look for abnormal data structures
4. Restart browser (clear memory)
5. Switch networks (WiFi ↔ mobile hotspot)
6. Check time of day — if ~3pm EST, market peak might cause spikes

**Workaround:**
- Limit watchlists to <500 items per list
- Close unused tabs
- Use incognito mode (tests if extensions are culprit)
- Check [status page] — may be planned maintenance

---

### Issue: Feature Requests

**Symptoms:**
- User wants X feature
- Missing functionality in UI
- Workflow requires multiple steps

**Examples Received:**
- Mobile app (known, Q2 2026)
- Google Calendar sync (launching next week)
- TradingView integration
- Discord/Slack alerts
- More data sources (Crypto options, futures, forex edge cases)

**Response:**
1. Acknowledge the request with specific language:
   - "Great idea — this would [benefit]...."
   - Link to public roadmap if relevant
2. Ask for context:
   - How often would you use this?
   - Would this replace an existing workflow or add new one?
   - Any specific use case?
3. Log it: Add to `/docs/PRODUCT_ROADMAP.md` under "Community Requests"
4. Set expectation:
   - If in roadmap: estimated timeline
   - If not yet discussed: will review in next sprint
5. Offer workaround if available

**Note:** Prioritize requests that 2+ beta users mention independently.

---

### Issue: Bug Reports

**Symptoms:**
- UI doesn't match expected behavior
- Incorrect data displayed
- Visual glitches
- API returns wrong values
- Feature partially broken

**Response Protocol:**
1. **Immediate response** (< 5 min):
   - Acknowledge receipt
   - Ask for reproduction steps
   - Request screenshot/video if visual
2. **Triage** (within 30 min):
   - Can you reproduce it?
   - Is it blocking? (P0-P3)
   - Frontend vs backend issue?
3. **Log it**:
   - Title: "Bug: [Component] [Symptom]"
   - Add to GitHub Issues with reproduction steps
   - Tag with `[BUG]` and priority
4. **Keep user updated**:
   - Daily progress update if P0
   - Every 48h if P1/P2
   - Weekly if P3

**Example:**
- **P0 (Critical):** Can't log in at all → immediate Slack to Erick
- **P1 (High):** Alerts not triggering → 4-hour response time
- **P2 (Medium):** Chart color rendering wrong → 24-hour response time
- **P3 (Low):** UI spacing looks off → can wait for next sprint

---

## 2. Response Templates

### Template A: Initial Acknowledgment

```
Hi [NAME],

Thanks for reaching out! I'm looking into [ISSUE DESCRIPTION].

To help you faster, could you share:
- Your username / email
- What device/browser you're using
- When this started happening

I'll get back to you within [TIME WINDOW] with next steps.

—[YOUR NAME]
```

### Template B: Troubleshooting Steps

```
Let's get this sorted. Try these steps in order:

1. [STEP 1]
2. [STEP 2]
3. [STEP 3]

After each step, let me know if it's resolved. If you're stuck, reply with a screenshot of the error and I'll dig deeper.

You've got this! 💪
```

### Template C: Escalation to Erick (Backend/Auth)

```
I need Erick on this one. You're hitting [ISSUE], which requires a database-level check.

[SUMMARY OF WHAT WE'VE TRIED]

Erick — can you check [USER]'s account for [SPECIFIC THING]?
```

### Template D: Escalation to Bolt (Frontend/Deployment)

```
Bolt — need your eyes on this. Looks like a [FRONTEND/DEPLOYMENT] issue:

[ISSUE DESCRIPTION + ERROR LOG]

User is on [DEVICE/BROWSER]. Reproduction: [STEPS].

Can you check [SPECIFIC COMPONENT]?
```

### Template E: Issue Resolved

```
Great news! We found the issue: [ROOT CAUSE].

[WHAT WE DID TO FIX IT]

You're all set now. Try [VERIFICATION STEP] and let me know if everything looks good.

If you hit any other snags, I'm here to help.

—[YOUR NAME]
```

### Template F: Feature Request Logged

```
Love the idea. This would [IMPACT].

I've added it to our roadmap under [SECTION]. Here's where we're prioritizing it based on user demand:

- [X] Similar requests from other beta users
- [X] Complexity: [QUICK WIN / MEDIUM / BIG FEATURE]
- [X] Timeline: Likely [TIMEFRAME]

I'll flag you when we start work on it. In the meantime, here's a workaround: [WORKAROUND].

Cheers!
```

### Template G: Known Issue Workaround

```
Ah, I know this one. Here's what's happening:

[EXPLANATION OF KNOWN ISSUE]

**Workaround:**
1. [STEP 1]
2. [STEP 2]
3. [STEP 3]

We're fixing this in [TIMELINE]. Until then, this should keep you moving.

Let me know if it helps!
```

---

## 3. Escalation Matrix

### When to Escalate to Erick (Backend/Database)

**Escalate immediately if:**
- User can't log in and reset email isn't working
- Account data missing or corrupted
- Database query errors in logs
- Authentication failing for subset of users
- Data not persisting (watchlists, alerts disappear)
- API returning 500 errors consistently

**Slack format:**
```
@Erick — Can you check [USER EMAIL]'s account?

Issue: [SYMPTOM]
Steps taken: [TROUBLESHOOTING]
Error log: [PASTE LOG]

User says it started [WHEN]. Blocking them from [WHAT].
```

**Response time:** < 30 minutes for P0, < 2 hours for P1

---

### When to Escalate to Bolt (Frontend/Deployment)

**Escalate immediately if:**
- Frontend not loading (white screen, JS error)
- Deployment broken (site down for >5% of users)
- Build failed on Vercel
- CSS/UI completely broken
- Browser compatibility issue (only on Safari, Firefox, etc.)
- Performance degraded significantly

**Slack format:**
```
@Bolt — Frontend issue needs your eyes.

Issue: [SYMPTOM]
Affected: [SAFARI / CHROME / ALL BROWSERS]
Reproduction: [EXACT STEPS]
Error: [CONSOLE ERROR]
Environment: [STAGING / PROD]

Started: [WHEN]. Affects [HOW MANY USERS].
```

**Response time:** < 30 minutes for P0, < 1 hour for P1

---

### Priority Levels (P0-P3)

| Level | Definition | Response Time | Resolution Time |
|-------|-----------|---|---|
| **P0 (Critical)** | Service down for multiple users OR blocks core workflow (login, alerts, data access) | **15 min** | **2 hours** |
| **P1 (High)** | Feature partially broken, workaround exists, affects 1-5 users | **1 hour** | **24 hours** |
| **P2 (Medium)** | Minor feature issue, cosmetic glitch, single user impact | **4 hours** | **3 days** |
| **P3 (Low)** | Enhancement idea, UI polish, no impact on functionality | **Next business day** | **Next sprint** |

**How to decide:**
- Can the user still trade? → P2 or higher
- Is it a widespread outage? → P0
- Does it affect login? → P0
- Is there a workaround? → Drop priority by 1 level
- Only one user? → P2 max (unless blocking critical path)

---

### Response Time Targets (SLA)

**Acknowledgment:**
- P0: 5 minutes
- P1: 30 minutes
- P2: 2 hours
- P3: Next business day

**Update (if not resolved):**
- P0: Every 30 minutes
- P1: Every 2 hours
- P2: Daily
- P3: Every 3 days or end of sprint

---

## 4. Support Channels

### Email: tradvueadmin@gmail.com

**Use for:** Primary contact method (monitored continuously)

**Process:**
1. Check inbox every 15 minutes during market hours
2. Reply to all requests within SLA
3. Tag subject with `[P0]`, `[P1]`, etc. if from internal team
4. Move resolved threads to archive
5. Weekly review: search for unanswered emails

**Email signature:**
```
[YOUR NAME]
TradVue Support
tradvueadmin@gmail.com

Having issues? See our help center: https://[HELP URL]
Report a bug: GitHub Issues or reply here
Feature request? Let us know what would help!
```

---

### Discord (Upcoming)

**Channel structure (when launched):**
- `#support` — General help requests
- `#bugs` — Bug reports (monitored hourly)
- `#feature-requests` — Ideas & voting
- `#status` — Outages & maintenance updates
- `#beta-announcements` — New features, updates

**Process (when live):**
1. Check `#support` every 30 minutes
2. React with ✅ when acknowledging
3. Move to threads to keep main clean
4. Escalate P0 issues immediately to Slack

**For now:** Mention Discord is coming; direct beta users to email

---

### In-App Feedback

**Current implementation:**
- "?" icon in top right → feedback modal
- Collects user message + browser info + screenshot (optional)
- Submitted to `/admin/feedback` endpoint

**Process:**
1. Review dashboard weekly: [admin panel]
2. Log all feedback in Airtable `Feedback` tab
3. Respond to urgent issues within 24h
4. Categorize: Bug / Feature Request / UX Issue / Other
5. Tag with username and timestamp

**Note:** Users expect lower response time here (it's literally built into the app)

---

### Twitter/X Mentions

**Monitoring:**
- Set up saved search: `TradVue OR @TradVue_io -filter:retweets`
- Check daily during market hours
- Respond within 2 hours if public complaint

**Response template:**
```
Hey! Sorry you hit that. DM us your email and we'll dig in right away.
```

**Escalate to Erick if:**
- Public criticism / viral thread
- Technical issue needs backend investigation
- Feature request with significant engagement

---

## 5. Known Issues

### Issue 1: Database Auth Pending Railway Fix

**Status:** In Progress (ETA: March 12, 2026)

**Description:**
- Sporadic authentication failures during peak hours (2-4pm EST)
- Caused by Railway connection pool exhaustion
- Affects ~2-3% of login attempts

**Symptoms:**
- "Database connection timeout" error on login
- User can retry 1-2 minutes later and succeed
- Not user account specific

**Workaround:**
- Retry login after 1-2 minutes
- Use different browser if immediate access needed
- Escalate to Erick if failure persistent >5 minutes

**Tracking:** GitHub Issue #47 (Railway pool optimization)

---

### Issue 2: Mobile Responsiveness on Tablets

**Status:** Known, Low Priority (no estimated fix)

**Description:**
- iPad landscape mode has layout issues
- Some buttons cut off on smaller screens
- Charts don't reflow correctly

**Symptoms:**
- Text overflow in settings panel
- Buy/sell buttons hidden on mobile view
- Watchlist columns compressed

**Workaround:**
- Use desktop browser for trading
- Mobile app launching Q2 2026
- Rotate to portrait mode (better than landscape)

**Not blocking** since this is web-only beta

---

### Issue 3: News Source Delay (2-5 minutes)

**Status:** Known, Accepted limitation

**Description:**
- Some news sources (Yahoo Finance, CNBC) have aggregation delay
- Finnhub data is real-time, RSS feeds lag

**Symptoms:**
- News alert fires 2-5 minutes after event
- User sees old news in feed

**Workaround:**
- Set price alerts (triggered real-time) alongside news monitoring
- Use Finnhub directly for absolute latest data
- This is acceptable in beta; will optimize in v1.0

**Note:** Not a bug—architectural limitation we're tracking

---

### Issue 4: Social Sentiment (US-Only)

**Status:** Known limitation

**Description:**
- Reddit and Twitter sentiment tracking only monitors US-based communities
- International tickers have limited sentiment coverage

**Symptoms:**
- Crypto tracked globally, but stocks only US
- Missing data for TSX, LSE, ASX stocks
- European users request more coverage

**Workaround:**
- Suggest users rely on price/news alerts for international assets
- Focus sentiment tracking on US markets for now
- Feature request: Global sentiment (Q3 2026 roadmap)

---

### Issue 5: Very Large Watchlists Cause Slowdown

**Status:** Known, Performance issue

**Description:**
- Watchlists with >1000 items load slowly
- App freezes when rendering that many chart rows
- Supabase query times out

**Symptoms:**
- "Loading..." stuck for 30+ seconds
- Browser memory usage spikes >500MB
- Chrome crash on some devices

**Workaround:**
- Split into multiple watchlists (500 items max each)
- Archive old/inactive watchlists
- Remove duplicate symbols
- Close other browser tabs to free memory

**Tracking:** GitHub Issue #52 (pagination/virtualization)

---

## 6. Feedback Collection & Management

### How to Log Feature Requests

**From Email:**
1. User suggests feature → Save email in folder `Feature Requests`
2. Add to Airtable (`Feedback` tab) with columns:
   - User email
   - Date received
   - Feature description
   - Use case
   - Priority vote (user interest level)
   - Status (New / Reviewed / Scheduled / Done)

**From In-App Feedback:**
1. Review dashboard at: [admin panel URL]
2. Click "Log to Airtable" button (auto-syncs)
3. If auto-sync fails: manually enter in Airtable

**From Discord (when live):**
1. React with 🎉 to acknowledge
2. Add to Airtable with source = "Discord #feature-requests"
3. Post voting emoji (👍 👎) on popular requests

**Template entry:**
```
| User | Date | Idea | Use Case | Vote | Status |
|------|------|------|----------|------|--------|
| user@email.com | 2026-03-06 | Google Calendar sync | Sync alerts to calendar | 3+ requests | Reviewed |
```

---

### How to Categorize Feedback

**Use these categories in Airtable:**

| Category | Examples | Action |
|----------|----------|--------|
| **Feature Request** | "Can you add X?" | Add to PRODUCT_ROADMAP.md |
| **Enhancement** | "Make X faster/prettier" | Review in design sprint |
| **Bug Report** | "X is broken" | Create GitHub issue, P0-P3 |
| **UX Issue** | "Hard to find X" | Review in UX sprint |
| **Integration** | "Connect to X service" | Discuss in product meeting |
| **Pricing** | "Price is high" | Share with Erick (ignore unless pattern) |
| **Other** | Compliments, offtopic | Archive / respond politely |

---

### Where to Store Feedback

**Central location:** `Airtable` (Feedback base)
- **Table 1:** All feedback (searchable, filterable)
- **Table 2:** Feature roadmap (linked to feedback)
- **Table 3:** Known issues (linked to feedback)

**Sync process:**
- In-app feedback auto-syncs to Airtable (nightly)
- Email feedback: manually add each week
- Discord feedback: manual copy (until bot built)

**Weekly process (Monday 9am EST):**
1. Filter Airtable for `New` status
2. Review & categorize
3. Mark as `Reviewed`
4. If 2+ users mention same idea: promote to roadmap
5. Respond to user (template: "Thanks for the idea...")

**Monthly review (1st of month):**
1. Export top 10 requested features
2. Share with Erick & Bolt in product meeting
3. Update PRODUCT_ROADMAP.md with next priorities

---

## Appendix A: Quick Links

- **Status Page:** [TBD - set up status.io]
- **Help Center:** [TBD - pending launch]
- **Product Roadmap:** `/docs/PRODUCT_ROADMAP.md`
- **Known Issues:** This document (Section 5)
- **API Docs:** `/docs/API_DOCUMENTATION.md`
- **Architecture:** `/docs/ARCHITECTURE.md`

---

## Appendix B: Escalation Contact Info

| Person | Role | Contact | Available |
|--------|------|---------|-----------|
| **Erick** | Founder / Backend | [Email / Slack] | 9am-9pm EST |
| **Bolt** | DevOps / Frontend Lead | [Email / Slack] | 8am-10pm EST |
| **You** | Support Lead | tradvueadmin@gmail.com | Market hours |

---

## Appendix C: Useful Diagnostics

### Browser Console Commands (Share with users)

```javascript
// Check local storage
localStorage.getItem('authToken')

// Check service worker
navigator.serviceWorker.getRegistrations()

// Network timing
performance.getEntriesByType('navigation')[0]

// Memory usage (Chrome)
performance.memory
```

### Server Diagnostics (Backend check)

```bash
# Check Railway logs
railway logs

# Test API health
curl https://api.tradvue.io/health

# Check Supabase connection
psql -h db.supabase.co -U postgres -d tradvue -c "SELECT NOW();"
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.0** | 2026-03-06 | Initial playbook created |
| | | - 6 issue categories defined |
| | | - 7 response templates |
| | | - Escalation matrix with SLAs |
| | | - 5 known issues documented |
| | | - Feedback collection process |

---

## How to Update This Playbook

**When to update:**
- New issue discovered by 2+ users
- Template used but felt wrong (revise for clarity)
- Team workflow changes (SLA, escalation path)
- Known issue resolved (move to archive)

**Process:**
1. Edit this file locally
2. Commit to git with message: `docs: update support playbook - [reason]`
3. Notify Erick & Bolt in Slack with changes
4. Update version number and date (top of file)

---

**Last reviewed:** March 6, 2026 | **Next review:** March 20, 2026
