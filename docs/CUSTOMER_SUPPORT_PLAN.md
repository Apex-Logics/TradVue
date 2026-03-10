# TradVue Customer Support Infrastructure Plan

> **Document:** CUSTOMER_SUPPORT_PLAN.md
> **Created:** 2026-03-10
> **Owner:** Erick (TradVue)
> **Maintained by:** Zip (AI Agent)
> **Status:** Draft v1.0

---

## Overview

This plan establishes a complete customer support infrastructure for TradVue — scalable from early-stage (Erick + AI) through growth (dedicated support team). The system is designed to be AI-first: Zip monitors inboxes, drafts responses, and routes escalations, while Erick retains approval authority over all outbound communications.

---

## 1. Support Email Setup

### 1.1 Cloudflare Email Routing → Gmail

**Goal:** Route `support@tradvue.com` to Erick's Gmail without paying for a dedicated mail server.

#### Step-by-Step Setup (Erick does this once)

**In Cloudflare Dashboard:**

1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Select the `tradvue.com` domain
3. Go to **Email → Email Routing** in the left sidebar
4. Click **Enable Email Routing** (if not already enabled)
5. Cloudflare will prompt you to add MX records — click **Add Records Automatically**
6. Go to **Custom Addresses** → click **Create Address**
   - Custom Address: `support`
   - Action: `Send to an email`
   - Destination: `erick@gmail.com` (or whichever Gmail you want)
   - Click **Save**
7. Cloudflare will send a verification email to the destination — click the link in it
8. ✅ Done — `support@tradvue.com` now routes to Gmail

**Optional: Add a catch-all**
- Under **Catch-All Address**, set it to forward to the same Gmail
- This catches `anything@tradvue.com` so no support emails slip through

#### 1.2 Gmail Label & Filter Setup

Create organized filters so support emails are auto-labeled and don't drown the inbox.

**Labels to Create (in Gmail):**
- `TradVue/Support` (parent)
  - `TradVue/Support/New` — unread, needs response
  - `TradVue/Support/In Progress` — Zip drafted a response, awaiting approval
  - `TradVue/Support/Resolved` — closed tickets
  - `TradVue/Support/Bug` — confirmed bug reports
  - `TradVue/Support/Feature Request` — feature requests

**Filters to Create:**

1. Go to **Gmail → Settings → See all settings → Filters and Blocked Addresses → Create a new filter**

   Filter 1 — Tag all incoming support emails:
   ```
   To: support@tradvue.com
   Action: Apply label "TradVue/Support/New", Never send to spam, Star it
   ```

   Filter 2 — Catch forwarded emails (Cloudflare adds a header):
   ```
   From: (noreply@cloudflaremail.com OR has:header "X-Forwarded-To: support@tradvue.com")
   Action: Apply label "TradVue/Support/New"
   ```

2. Create a **Gmail filter** shortcut: star = needs reply, check = resolved

**Tip:** Set up a dedicated Gmail label color for TradVue (orange or teal) so it's visually distinct at a glance.

---

## 2. Agent-Monitored Support Workflow

### 2.1 How Zip Monitors the Inbox

Zip checks the support inbox on a scheduled cadence (via heartbeat or cron):

- **Frequency:** Every 2 hours during business hours (9 AM – 6 PM EST, Mon–Fri)
- **After hours:** Once at 10 PM, once at 7 AM to catch overnight messages
- **Tool:** `himalaya` CLI for reading emails via IMAP

**Monitoring routine:**
1. Zip reads new emails in `TradVue/Support/New`
2. Classifies each email by issue type (see templates below)
3. Drafts a response from the appropriate template, customized for the specific issue
4. Saves draft to `workspace/tradingplatform/support/drafts/YYYY-MM-DD-{ticket-id}.md`
5. Notifies Erick via Discord `#axle-log` or Telegram with a summary + link to draft
6. Moves email label to `TradVue/Support/In Progress`

### 2.2 Approval Queue

**Erick's workflow (takes ~2 min per ticket):**
1. Receives Discord/Telegram notification: "📧 Support draft ready — [Account issue] from user@email.com"
2. Reviews the draft file (linked or pasted in notification)
3. Replies with:
   - `approve` — Zip sends the response
   - `edit: [changes]` — Zip revises and re-queues
   - `skip` — Erick handles manually
   - `escalate` — flag for deeper investigation

**Draft file format:**
```
# Support Draft — [TICKET-001]
Date: 2026-03-10
From: user@example.com
Subject: Can't log in to my account
Category: Account Problem
Priority: Normal

## Summary
User is unable to log in. Reports password reset not working.

## Proposed Response
---
[Response text here]
---

## Notes for Erick
- Check if this email exists in our user DB
- May be a Gmail sign-in user trying to use password login
```

### 2.3 Response Templates

---

#### Template A: Account Problems

**Subject:** Re: [their subject]

```
Hi [Name],

Thanks for reaching out — happy to help get your account sorted.

[IF password issue:]
If you signed up using Google or another social login, you'll need to use that same method to sign in — password-based login won't work for those accounts. Try clicking "Sign in with Google" on the login page.

[IF account not found:]
I wasn't able to locate an account with this email address. Could you double-check the email you used to sign up? Sometimes a different address was used at registration.

[IF other:]
Can you tell me a bit more about what you're seeing? A screenshot or the exact error message would help me track this down quickly.

We typically respond within a few hours during business hours (9 AM–6 PM EST).

– TradVue Support
```

---

#### Template B: Data Not Loading

**Subject:** Re: [their subject]

```
Hi [Name],

Thanks for the report — let's figure out what's happening with your data.

A few quick things to try first:
1. Hard refresh the page (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac)
2. Clear your browser cache and cookies, then try again
3. Try a different browser (Chrome or Firefox work best)

If none of those help, could you share:
- Which section isn't loading (dashboard, journal, analytics)?
- What browser and OS you're on?
- Roughly when this started?

I'll dig into it from our end as well.

– TradVue Support
```

---

#### Template C: How to Import Trades

**Subject:** Re: [their subject]

```
Hi [Name],

Great question — here's how to import your trades into TradVue:

**Supported brokers / formats:**
- [List formats supported]

**Steps:**
1. Go to **Account → Import Trades**
2. Select your broker from the dropdown
3. Export your trade history from your broker (see link below for broker-specific instructions)
4. Upload the file — TradVue will parse and import it automatically

**Common issues:**
- Make sure the file is in CSV format (not XLS)
- Date range: some brokers limit exports to 90 days at a time
- Headers must match the expected format — don't edit the column names

[Link to import help article when KB is live]

If you run into any errors, paste the error message here and I'll help you troubleshoot.

– TradVue Support
```

---

#### Template D: Feature Requests

**Subject:** Re: [their subject]

```
Hi [Name],

Love this idea — thanks for taking the time to share it.

I've logged "[feature name]" as a feature request and it'll go into our roadmap review. We read every request, and popular ideas tend to bubble up faster.

[IF we're building something related:]
Coincidentally, we're working on something in that direction — no promises on timeline, but it's on our radar.

If you want to stay in the loop on TradVue updates, [subscribe to our changelog / follow us on X].

Thanks again for the feedback — it genuinely helps.

– TradVue Support
```

---

#### Template E: Bug Reports

**Subject:** Re: [their subject]

```
Hi [Name],

Thanks for the bug report — this is exactly the kind of feedback we need.

I've logged this as a bug (#[ID]) and it's been flagged for our dev team. 

To help us reproduce and fix it faster, could you share:
- Steps to reproduce (what you clicked, what happened)
- Browser + OS
- Any error messages or console errors (F12 → Console)
- Screenshots if possible

We'll follow up once we have an update. Bugs that affect core functionality are prioritized.

– TradVue Support
```

---

### 2.4 SLA Targets

| Priority | Type | Target Response | Target Resolution |
|----------|------|----------------|-------------------|
| P1 (Critical) | Login broken, data loss, payment issue | 1 hour (business hours) | 4 hours |
| P2 (High) | Feature not working, import errors | 4 hours (business hours) | 24 hours |
| P3 (Normal) | General questions, how-to | 8 hours (business hours) | 48 hours |
| P4 (Low) | Feature requests, feedback | 24 hours (business hours) | Roadmap |

**Business hours:** Monday–Friday, 9 AM – 6 PM Eastern Time

**After-hours:** Auto-reply acknowledges receipt and sets expectation:
> "Thanks for reaching out! We received your message and will reply by [next business day by noon]. If this is urgent, please describe the issue in detail and we'll prioritize."

---

## 3. AI Support Bot Spec

### 3.1 Overview

A lightweight AI chat widget embedded on the `/help` page. Users get instant answers to common questions; unresolved issues escalate to email.

### 3.2 Tech Stack

```
Frontend:        Vanilla JS + CSS (no framework dependency)
Widget:          Custom-built or open-source (e.g., Chatwoot, Tawk.to as base)
AI Backend:      OpenAI API (GPT-4o-mini for cost efficiency)
Knowledge Base:  Static JSON/markdown files bundled with the widget
Hosting:         Vercel Edge Function or Cloudflare Worker (serverless, free tier)
No DB required:  Conversations are session-only, not persisted
```

**Why not a third-party widget (Intercom, Zendesk)?**
- Expensive ($75–200+/mo) before you have revenue
- Privacy concerns — third parties store your user conversations
- Overkill for early stage
- Custom widget costs ~1 day of dev, is fully owned, and scales infinitely

### 3.3 Widget Features

**UI:**
- Floating chat bubble (bottom-right corner)
- Expands to a 380×500px chat window
- TradVue branding (colors, logo)
- "Powered by AI" disclaimer in footer

**Behavior:**
- Greets user: *"Hi! I'm TradVue's support bot. Ask me anything about the platform."*
- Searches knowledge base first (keyword match)
- Falls back to GPT-4o-mini with knowledge base context injected as system prompt
- Escalation trigger: if bot says "I'm not sure" or user types "talk to human" / "email support" → shows email form
- Email form: name, email, message → sends to `support@tradvue.com`

**Escalation flow:**
```
User asks question
  → KB search (fast, free)
  → If no match: GPT-4o-mini with KB context
  → If low confidence response: "I'm not 100% sure on this one."
  → Offer: "Would you like me to send this to our support team?"
  → Show inline form → submits to support@tradvue.com
```

### 3.4 Privacy Requirements (Non-Negotiable)

- ❌ No conversation storage — sessions are ephemeral, cleared on page close
- ❌ No PII in OpenAI prompts — strip names, emails, account IDs before sending
- ❌ No analytics on chat content — only aggregate metrics (# of chats started, escalation rate)
- ✅ Only send anonymized question text to OpenAI
- ✅ HTTPS only
- ✅ No cookies set by the widget
- Include in Privacy Policy: "Our help chat uses OpenAI's API. Messages are not stored and are not associated with your account."

### 3.5 Cost Estimate

**Assumptions (early-stage):**
- 200 chat sessions/month
- Average 6 messages per session (3 user, 3 bot)
- Average 150 tokens per message pair
- GPT-4o-mini pricing: ~$0.15/1M input tokens, ~$0.60/1M output tokens

**Monthly estimate:**
```
Sessions:           200
Messages/session:   6
Tokens/session:     ~900 (input) + ~300 (output)
Total input tokens: 200 × 900  = 180,000
Total output tokens:200 × 300  = 60,000

Cost:
  Input:  180,000 / 1,000,000 × $0.15  = $0.027
  Output:  60,000 / 1,000,000 × $0.60  = $0.036
  Total:   ~$0.06/month

At 10x scale (2,000 sessions/month): ~$0.60/month
At 100x scale (20,000 sessions/month): ~$6/month
```

**Verdict:** Essentially free until significant scale. OpenAI API is the right call here.

### 3.6 Implementation Phases

| Phase | What | When |
|-------|------|------|
| Phase 1 | Static FAQ page at /help (no bot) | Launch |
| Phase 2 | Add chat widget with KB-only answers | Week 2–3 |
| Phase 3 | Connect OpenAI API for dynamic answers | Month 1–2 |
| Phase 4 | Add escalation email form | Month 2 |
| Phase 5 | Analytics dashboard (escalation rate, top questions) | Month 3+ |

---

## 4. Feedback Collection

### 4.1 Thumbs Up / Down Widget

Embed on every page (or at least key features):

```html
<!-- Minimal feedback widget -->
<div class="feedback-widget">
  <p>Was this helpful?</p>
  <button onclick="sendFeedback('up')">👍</button>
  <button onclick="sendFeedback('down')">👎</button>
  <div id="feedback-comment" style="display:none">
    <textarea placeholder="Tell us more (optional)"></textarea>
    <button onclick="submitComment()">Send</button>
  </div>
</div>
```

**On thumbs down:** Show the comment box automatically.
**Data collected:** page URL, thumbs value, optional comment, timestamp (no user ID by default).
**Storage:** Simple Cloudflare Worker + D1 (free tier) or a Google Form/Sheet for MVP.

### 4.2 Feature Request Voting (Future)

**MVP approach:** Use a public Canny board or GitHub Discussions (free).
**When to build custom:** Once you have 500+ users and want tighter integration.

Feature request board should allow:
- Users to submit requests
- Upvote existing requests
- Comment on requests
- Status labels: Considering / Planned / In Progress / Shipped / Declined

**Recommendation:** Start with [Canny.io](https://canny.io) free tier — takes 10 minutes to set up, looks professional, and has built-in vote counting.

### 4.3 Bug Report Template

Use this on the site (or link to a GitHub Issue template if open-source):

```markdown
## Bug Report

**What happened?**
[Clear description of the bug]

**Steps to reproduce:**
1. Go to...
2. Click...
3. See error...

**Expected behavior:**
[What should have happened]

**Actual behavior:**
[What actually happened]

**Screenshots:**
[Attach if possible]

**Environment:**
- Browser: [Chrome 121 / Firefox 122 / Safari 17]
- OS: [Windows 11 / macOS 14 / iOS 17]
- Account type: [Free / Pro]

**Severity:**
- [ ] Critical (can't use the app)
- [ ] High (feature broken)
- [ ] Medium (annoying but workaround exists)
- [ ] Low (cosmetic)
```

---

## 5. Knowledge Base Structure

### 5.1 Article Organization

```
Knowledge Base
├── Getting Started
│   ├── Creating your account
│   ├── Setting up your profile
│   ├── Importing your first trades
│   └── Dashboard overview
│
├── Importing Trades
│   ├── Supported brokers and formats
│   ├── Manual trade entry
│   ├── CSV format requirements
│   ├── Fixing import errors
│   └── Broker-specific guides/
│       ├── TD Ameritrade / Thinkorswim
│       ├── Interactive Brokers
│       ├── Tastytrade
│       ├── Webull
│       └── [others]
│
├── Trade Journal
│   ├── How the journal works
│   ├── Adding notes to trades
│   ├── Tagging and categorizing trades
│   └── Filtering and searching
│
├── Analytics & Reports
│   ├── Understanding your stats
│   ├── Win rate and expectancy
│   ├── P&L calendar
│   ├── Streak analysis
│   └── Exporting reports
│
├── Account & Billing
│   ├── Managing your account
│   ├── Subscription plans
│   ├── Canceling your subscription
│   └── Data export / account deletion
│
├── Troubleshooting
│   ├── Data not loading
│   ├── Login issues
│   ├── Import errors
│   ├── Missing trades
│   └── Performance issues
│
└── FAQ
    ├── Is my data secure?
    ├── Can I use TradVue on mobile?
    ├── What brokers are supported?
    └── How do I cancel?
```

### 5.2 Article Schema

Each article stored as a markdown file with frontmatter:

```yaml
---
id: kb-001
title: "Importing Trades from TD Ameritrade"
category: importing-trades
subcategory: broker-guides
tags: [thinkorswim, TD Ameritrade, csv, import]
related:
  - kb-002  # CSV format requirements
  - kb-003  # Fixing import errors
last_updated: 2026-03-10
author: zip
status: published  # draft | published | archived
---

[Article content in markdown]
```

### 5.3 Search Functionality

**Phase 1 (Launch):** Simple client-side search
- Use [Fuse.js](https://fusejs.io/) — lightweight fuzzy search library (~10KB)
- Indexes article titles, tags, and first 200 chars of content
- No server needed

**Phase 2 (Growth):** Algolia or Cloudflare D1 + full-text search
- Algolia free tier: 10,000 searches/month (sufficient until scale)
- Stores article content, metadata, and search analytics

### 5.4 Auto-Suggest Based on Common Queries

**Implementation:**
1. Log all search queries (anonymized) — find what users actually search for
2. After 2–4 weeks, identify top 20 queries
3. Map those queries to canonical articles
4. Add "Did you mean...?" suggestions for common misspellings
5. Surface "Popular articles" on the KB home page based on traffic

**Query → Article mapping example:**
```json
{
  "can't log in": "kb-021-login-issues",
  "import csv": "kb-005-csv-requirements",
  "delete account": "kb-018-account-deletion",
  "cancel subscription": "kb-017-cancel-subscription",
  "missing trades": "kb-011-missing-trades"
}
```

---

## 6. Rollout Timeline

| Week | Milestone |
|------|-----------|
| Week 1 | Set up Cloudflare email routing, Gmail filters, Zip monitoring |
| Week 1 | Write first 10 KB articles (Getting Started + FAQ) |
| Week 2 | Launch static /help page with FAQ |
| Week 2 | Zip begins monitoring support inbox, approval queue live |
| Week 3 | Deploy chat widget (KB-only, no AI yet) |
| Month 2 | Connect OpenAI API to chat widget |
| Month 2 | Launch Canny feature request board |
| Month 3 | Review KB gaps from top support queries, fill articles |
| Month 3 | Analytics: escalation rate, resolution time, CSAT |

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| First response time (P2) | < 4 hours business hours | Gmail timestamp tracking |
| Resolution rate (bot) | > 40% without escalation | Widget analytics |
| CSAT (thumbs up rate) | > 80% | Feedback widget |
| Support volume per 100 users | < 5 tickets/month | Email count / user count |
| KB article coverage | Top 20 queries covered | Query log review |

---

## Appendix: Tools & Costs Summary

| Tool | Purpose | Cost |
|------|---------|------|
| Cloudflare Email Routing | Route support@tradvue.com | Free |
| Gmail | Inbox management | Free |
| OpenAI GPT-4o-mini | Chat widget AI | ~$0.06–$6/month |
| Cloudflare Worker + D1 | Feedback storage, bot backend | Free tier |
| Fuse.js | Client-side KB search | Free (open source) |
| Canny.io | Feature request voting | Free tier |
| Himalaya CLI | Zip reads/monitors email | Free (open source) |

**Total estimated monthly cost (early stage): < $10/month**

---

*Plan authored by Zip · TradVue · 2026-03-10*
*Review and update quarterly or after significant user growth*
