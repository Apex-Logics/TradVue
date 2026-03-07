# ApexLogics Beta User Feedback Surveys

Fast, actionable surveys designed for traders who don't have time to waste.

---

## Survey 1: Onboarding Survey (Day 1)

**Goal:** Understand user profile, expectations, and initial needs. Identify segments early.

**Delivery:** Triggered after account creation, embedded modal (2-3 min completion time)

**Questions:**

### Q1: How did you hear about us?
- [ ] Direct search / Google
- [ ] Twitter / social media
- [ ] Friend / referral
- [ ] Trading community (reddit, Discord, etc.)
- [ ] Other: ___________

**Goal:** Track acquisition channel effectiveness for marketing.

---

### Q2: What's your trading experience?
- [ ] New to trading (< 6 months)
- [ ] 6 months - 2 years
- [ ] 2-5 years
- [ ] 5+ years (experienced trader)

**Goal:** Segment users for feature prioritization and UX complexity.

---

### Q3: What type of trading interests you most?
- [ ] Day trading (intraday)
- [ ] Swing trading (days/weeks)
- [ ] Options trading
- [ ] Crypto trading
- [ ] Long-term investing
- [ ] Automated/algorithmic

**Goal:** Identify which trading style to optimize for first.

---

### Q4: Which features are you most interested in?
_(Select up to 3)_
- [ ] Real-time charting
- [ ] Alerts & notifications
- [ ] Portfolio analytics
- [ ] Community watchlists
- [ ] Backtesting tools
- [ ] Mobile app
- [ ] API access
- [ ] Social trading / copying

**Goal:** Validate product-market fit assumptions.

---

### Q5: How did you find the signup process?
- [ ] Very easy (0-2 min)
- [ ] Easy (2-5 min)
- [ ] OK (5-10 min)
- [ ] Confusing / too long

**Goal:** Identify onboarding friction points.

**Skip Logic:** If "confusing," show optional comment field: "What was confusing?"

---

## Survey 2: NPS Survey (Day 14)

**Goal:** Measure satisfaction and identify detractors early. Segment feedback by user type.

**Delivery:** Email or in-app after 2 weeks of usage. Tie to behavior (e.g., after 5+ logins).

**Questions:**

### Q1: How likely are you to recommend ApexLogics to a friend? (0-10)

**Scale:** 0 (Not likely) ← → 10 (Very likely)

**Segment:**
- **Promoters (9-10):** → "What's working best?"
- **Passives (7-8):** → "What would make it better?"
- **Detractors (0-6):** → "What's the main issue?"

---

### Q2: What's the main reason for your score?

_(Open text field)_

**Goal:** Identify specific pain points or wins. Use for feature roadmap.

**Skip Logic:** Show different prompt based on score:
- **Promoters:** "What features do you love most?"
- **Detractors:** "What's preventing you from recommending it?"

---

### Q3: What's one thing we could improve?

_(Open text field)_

**Goal:** Direct product feedback. Identify quick wins and blockers.

---

### Q4 (Optional): Would you continue using ApexLogics?
- [ ] Definitely yes
- [ ] Probably yes
- [ ] Unsure
- [ ] Probably no
- [ ] Definitely no

**Skip Logic:** If "Unsure" or below, ask: "What would help you decide?"

---

## Survey 3: Feature Feedback Survey

**Goal:** Validate feature adoption, identify gaps, prioritize roadmap.

**Delivery:** Triggered after user has used app for 7+ days or accessed 3+ features.

**Format:** In-app modal or dedicated feedback page (progressive disclosure).

---

### Q1: Which features have you used so far?
_(Checkboxes - multiple select)_
- [ ] Real-time charts
- [ ] Alerts
- [ ] Portfolio tracking
- [ ] Watchlists
- [ ] Community feed
- [ ] Backtesting
- [ ] Mobile app
- [ ] Other: ___________

**Goal:** Map feature adoption. Identify unused features for UX improvement.

---

### Q2: Rate each feature you've used:

_(Only show features they selected in Q1 - dynamic rating table)_

| Feature | Useless | Not Useful | OK | Useful | Essential |
|---------|---------|------------|-----|--------|-----------|
| [Feature 1] | ☐ | ☐ | ☐ | ☐ | ☐ |
| [Feature 2] | ☐ | ☐ | ☐ | ☐ | ☐ |

**Goal:** Prioritize polish on high-value features. Identify features to redesign or remove.

---

### Q3: Which features do you wish existed?

_(Open text, max 150 chars)_

**Goal:** Capture feature requests. Track patterns for product roadmap.

---

### Q4: Any other feedback on features?

_(Optional open text)_

**Goal:** Capture nuanced feedback (UX, performance, integrations, etc.).

---

## Survey 4: Exit Survey (Churn Prevention)

**Goal:** Understand why users leave and what might bring them back. Reduce churn.

**Delivery:** Triggered on account deletion or 30+ days of inactivity (with re-engagement email).

**Format:** Short survey blocking account deletion (or separate email for inactive users).

---

### Q1: Why are you leaving?

_(Select one primary reason)_
- [ ] Found a better alternative
- [ ] Missing features I need
- [ ] Too expensive / pricing
- [ ] Not user-friendly
- [ ] Performance/technical issues
- [ ] No longer trading
- [ ] Other: ___________

**Goal:** Identify top churn driver. Route to appropriate team (Product, Support, Sales).

**Skip Logic:**
- If "Better alternative" → "Which platform?"
- If "Missing features" → "What features?" (open text)
- If "Too expensive" → "What price would work?" (open numeric)
- If "Not user-friendly" → "What was confusing?" (open text)

---

### Q2: What would bring you back?

_(Open text, max 100 chars)_

**Goal:** Identify win-back conditions. Track for targeted re-engagement campaigns.

---

### Q3 (Optional): Would you recommend us to someone in a different situation?
- [ ] Yes, depending on their needs
- [ ] Maybe - if they fixed [issue]
- [ ] No, unlikely

**Goal:** Understand if issue is personal fit vs. product quality.

---

## Implementation Guide

### Tool Selection & Recommendation

**Recommended: Typeform or Jotform**
- ✅ Looks professional, mobile-friendly
- ✅ Skip logic (conditional branching)
- ✅ Easy integration with webhooks
- ✅ Clean analytics & export to CSV
- ❌ Small cost ($25-50/month for multiple forms)

**Alternative: Google Forms**
- ✅ Free, quick setup
- ✅ Basic skip logic (go to section)
- ✅ Auto-aggregates responses
- ❌ Looks generic, less polished
- ❌ Limited branching logic

**Best for ApexLogics: In-App Implementation (Long-term)**
- Embed surveys in product using modal/sidebar
- Higher completion rates (no external redirect)
- Collect signals: user segment, feature usage, cohort
- Consider: Segment.io, Pendo, or custom modal

---

### Delivery Schedule & Triggers

| Survey | Trigger | Delay | Frequency | Incentive |
|--------|---------|-------|-----------|-----------|
| **Onboarding (Q1)** | Account created | Immediate | Once | None needed |
| **NPS (Q2)** | Day 14 of signup | 14 days | Every 90 days | None |
| **Feature Feedback (Q3)** | 7+ days + used 3+ features | 7 days | Monthly | None |
| **Exit (Q4)** | Account deletion / 30+ days inactive | Immediate | Once | Re-engagement offer (10% discount?) |

---

### Incentivization Strategy

**For Completion:**
1. **Onboarding Survey:** Gamified - "Complete this to unlock [beginner guide / paper trading bonus]"
2. **NPS:** No incentive needed (2-min ask), but offer to enter raffle for $25 trading credit (if detractor)
3. **Feature Feedback:** "Help us build features you love" - framing as partnership, not burden
4. **Exit:** Final offer - "Before you go: Try 1 month free if you'll give us 5 min of feedback"

**Avoid:** Large incentives (skews feedback toward completion, not honesty)

---

### Analytics & Success Metrics

**What to Track:**

| Survey | KPI | Target | Cadence |
|--------|-----|--------|---------|
| Onboarding | Completion rate | >70% | Daily |
| Onboarding | Top 3 use cases | Identify top feature needs | Weekly |
| NPS | NPS score | >45 | Bi-weekly |
| NPS | Detractor feedback patterns | Group by theme (UX, missing features, bugs) | Weekly |
| Feature | Adoption rate (% using 5+ features) | >60% by day 30 | Monthly |
| Feature | Feature rating distribution | >60% of used features rated "OK" or higher | Monthly |
| Exit | Churn reason breakdown | Top 3 reasons | Monthly |
| Exit | Re-engagement conversion | <5% return (acceptable) | Monthly |

---

### Reporting & Actioning

**Weekly Review:**
- NPS & churn driver trends
- Top 3 feature requests
- Identify quick UX fixes
- Route detractor feedback to support

**Monthly Review:**
- Full survey analysis
- Product roadmap implications
- Segment-level insights (new traders vs. experienced)
- A/B test impact (if running feature experiments)

**Escalation:**
- NPS drops >5 points → Product investigation
- >20% detractors citing same issue → Priority bug/feature
- >3 requests for same feature → Roadmap candidate

---

### Template Copy (Trader-Friendly Tone)

Keep language direct and respectful of time:

**Avoid:** "We'd love to hear your valuable insights on leveraging our synergistic platform features..."

**Use:** "Quick question: What's working best for you so far?"

---

### Rollout Checklist

- [ ] Onboarding survey live (Day 1 of beta)
- [ ] NPS survey scheduled for Day 14
- [ ] Feature feedback form ready (Day 7+)
- [ ] Exit survey on account deletion page
- [ ] Slack/email notification for new feedback (real-time)
- [ ] Weekly feedback review process scheduled
- [ ] Incentive backend integrated (if offering rewards)
- [ ] Analytics dashboard set up (NPS trend, churn reasons, etc.)

---

**Created:** 2026-03-07  
**Next Review:** After first 10 beta users complete surveys
