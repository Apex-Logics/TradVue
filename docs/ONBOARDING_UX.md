# TradVue Onboarding UX Specification

**Document Version:** 1.0  
**Last Updated:** 2026-03-06  
**Status:** Ready for Implementation  
**Owner:** Design / Product

---

## Executive Summary

The TradVue onboarding flow is designed to activate new users in under 5 minutes through progressive disclosure, quick wins, and subtle guidance. The experience guides users from "empty state" → "first watchlist symbol" → "first alert" → "enabled notifications" in a linear, confidence-building sequence.

---

## 1. First-Time User Flow

### 1.1 Entry Point: The Welcome Screen (10 seconds max)

**When:** First app open after signup/login  
**Duration:** 2–3 swipes, 10 seconds reading time

**Visual Design:**
- Full-screen, single prominent visual (chart trending up, or simple animated candlestick)
- No more than 3 lines of copy
- CTA button below (can't miss it)

**Copy Approach:**
```
Headline: "Track Any Stock in Seconds"
Subheading: "Get alerts. See trends. Trade smarter."
CTA: "Let's Get Started"
```

**Why it works:**
- "Track any stock in seconds" = speed (traders value this)
- "Get alerts. See trends. Trade smarter." = 3 concrete benefits in 10 words
- Single CTA removes friction

**Technical Notes:**
- Show only once (`onboarding_completed` = false in user profile)
- Option to dismiss with skip, but position it subtly (small, gray text at bottom)
- No ads, no upsells

---

### 1.2 Progressive Disclosure: 3-Step Intro Flow

After welcome screen, present **one task at a time**, not a checklist. Checklists overwhelm.

#### Step 1: Add First Symbol (The Hook)
**Copy:** "Pick a stock you follow"  
**Input:** Search bar that filters top 100 stocks + user's recent searches  
**Interaction:**
- User types ticker (e.g., "AAPL") or selects a suggested symbol
- Instant feedback: chart loads, 1-year sparkline visible
- Confirmation: "Great! AAPL is in your watchlist. Next?"

**Why:**
- Immediate visual feedback builds confidence
- No empty state — they see data instantly
- Momentum carries them to step 2

#### Step 2: Set Up Your First Alert (The Safety Net)
**Copy:** "Get notified when AAPL moves"  
**Input:** Price target + direction (above/below/exact)  
**Defaults:**
- Direction: "above current price" (bullish bias appeals to long traders)
- Price: current price ± 2% (reasonable, not distracting)
- User can adjust, but defaults reduce friction

**Interaction:**
- Slider or +/- buttons to set price
- Real-time label: "Alert me when AAPL goes above $175"
- CTA: "Set Alert" (or "Skip for now")

**Why:**
- Alerts solve a real problem (traders can't watch 24/7)
- Step-by-step removes complexity
- Skip option = no guilt if user wants to explore alone

#### Step 3: Enable Notifications (The Reminder)
**Copy:** "We'll let you know when your alerts trigger"  
**Interaction:**
- Single toggle: "Enable notifications"
- Show permission dialog (OS-level)
- Reassurance copy below: "You can turn these off anytime"

**Why:**
- Notifications = the real value (data is useless if user doesn't see it)
- Single toggle = binary decision, no overload
- Reassurance copy reduces notification anxiety

**End State:**
- Confetti or subtle celebration animation (feels good)
- Copy: "You're all set! Explore the app or we'll ping you when things move."
- CTA: "Explore" or "Close"

---

## 2. Onboarding Checklist

**Location:** Settings → Onboarding (or Onboarding tab in home)  
**Visibility:** Show on home screen as a collapsible card for first 7 days, then hide  
**Format:** Horizontal progress bar + list items (show 1–2 at a time to avoid overwhelm)

### Checklist Items (in order):

| # | Task | Status | Triggered By | Value Prop |
|---|------|--------|--------------|-----------|
| 1 | Add first symbol | ✓ Auto-complete on step 1 | First watchlist add | See real-time data |
| 2 | Set up alerts | ✓ Auto-complete on step 2 | First alert created | Get notified proactively |
| 3 | Enable notifications | ✓ Auto-complete on step 3 | Permission granted | Never miss an alert |
| 4 | Customize ticker bar | Optional | User toggles visibility | Quick glance at favorites |
| 5 | Explore the chart | Self-paced | User scrolls/zooms | Learn technical details |

### Checklist UI Rules:

- **Completed items:** Checkmark + grayed out copy
- **Current item:** Highlight + accessible CTA ("Do this now")
- **Future items:** Dimmed, not clickable
- **Progress bar:** Shows 3/5 (not 100% — keeps user engaged)
- **Dismissal:** Collapsible after first task, hide after day 7 or when 4/5 completed

### Example Checklist Copy:

```
✓ Add first symbol          [DONE]
  Set up your first alert   [DO THIS]
  Enable notifications      [Next]
  Customize ticker bar      [Later]
  Explore the chart        [When ready]

Progress: 1/5 • You're just getting started! Complete the next step to unlock smarter trading.
```

---

## 3. Tooltips and Hints Strategy

### 3.1 First-Time UI Elements That Need Tooltips

| Element | Trigger | Copy | Duration | Type |
|---------|---------|------|----------|------|
| Watchlist icon | Home tab, first load | "Add stocks to track" | 4 sec | Pulse + text |
| Alert bell | Top right, if no alerts | "Set up alerts so you don't miss moves" | 4 sec | Pulse + text |
| Ticker bar | Bottom, if empty | "Swipe to see your favorite symbols at a glance" | 4 sec | Animated arrow |
| Chart timeframe buttons | First chart view, after step 1 | "Switch between 1D, 1W, 1M, 1Y views" | 3 sec | Highlight + label |
| Technical indicators icon | Chart tools, if never tapped | "Add moving averages, RSI, MACD, more" | 3 sec | Pulsing icon |

### 3.2 Tooltip Delivery Rules

**When to show:**
- First time a screen is visited (not on subsequent visits)
- When a section is empty (no watchlist, no alerts)
- Only 1 tooltip visible at a time (avoid visual noise)
- After first 3 tooltips, assume user can explore

**When NOT to show:**
- If user is clearly doing something (actively tapping, typing)
- After 3 days of app usage (user is past onboarding)
- In the first 2 seconds of screen load (let UI settle)

**Design:**
- Light background with rounded corners (not harsh)
- Checkmark + "Got it" dismiss button
- Small animated arrow pointing to element
- Fade in smoothly (not jarring)

**Copy approach:**
- Action-oriented: "Add stocks to track" (not "This is your watchlist")
- Benefit-first: "so you don't miss moves" (not "to configure alerts")
- Short: 6–10 words max

---

## 4. Empty States

### 4.1 Empty Watchlist

**Trigger:** First login, before any symbols added  
**Location:** Home → Watchlist tab

**Visual:**
- Centered illustration: outline of a chart with a "+" symbol
- No scary icons or sad faces

**Copy:**
```
Headline: "Your Watchlist is Empty"
Subtext: "Add a stock you're watching and get real-time insights."
CTA: "Add Your First Stock"
```

**Secondary CTA:** "Show me an example" (auto-populates with AAPL, lets user preview experience)

**Why:**
- Not blaming the user ("You haven't added anything yet" → "Your watchlist is empty")
- "Real-time insights" = concrete benefit, not vague
- Example CTA = low-commitment preview

---

### 4.2 No Alerts Configured

**Trigger:** Watchlist has symbols, but no alerts set  
**Location:** Alerts tab or settings

**Visual:**
- Icon: bell with a slash (not active)
- Soft, inviting color (not error red)

**Copy:**
```
Headline: "You're Not Getting Alerted Yet"
Subtext: "Set up price alerts so you catch moves even when you're away."
CTA: "Create Your First Alert"
```

**Secondary copy:** "Optional: You can always check in manually." (removes guilt)

**Why:**
- "You're not getting alerted yet" = gently encouraging (FOMO without being toxic)
- "Catch moves even when you're away" = solves real trader problem
- Optional copy = respects user autonomy

---

### 4.3 No Notifications Enabled

**Trigger:** Alerts set, but notifications disabled  
**Location:** Settings or alert detail view

**Visual:**
- Icon: notification bell with a dot

**Copy:**
```
Headline: "Alerts Won't Reach You"
Subtext: "Turn on notifications so we can alert you in real-time."
CTA: "Enable Notifications"
```

**Technical note:**
- Request OS permission only when user taps CTA
- Handle rejection gracefully: "You can enable this in Settings → Notifications anytime"

---

## 5. Gamification (Subtle, Purpose-Driven)

### 5.1 Achievement Badges

**Philosophy:** Badges should celebrate real milestones, not artificial grinding.

| Badge | Trigger | Copy | Icon |
|-------|---------|------|------|
| **First Catch** | Create first alert | "You set up your first alert" | 🎯 |
| **Collector** | Add 5 symbols to watchlist | "You're tracking 5 stocks" | 📊 |
| **Alert Master** | Create 10 alerts | "You've got 10 price alerts active" | 🔔 |
| **Charts Analyst** | View 20+ different charts | "You're exploring the data" | 📈 |
| **Notification Pro** | Enable notifications + receive 5 alerts | "You caught 5 price moves" | ⚡ |

**Display Rules:**
- Pop-up on earn (small, not intrusive)
- Collect in a "Badges" section (Settings → Profile → Badges)
- No notification spam for badges
- No badge for things unrelated to trading (e.g., "opened the app 7 days in a row")

### 5.2 Streak Tracking

**Concept:** Lightweight, not mandatory.

- **Definition:** "Days you checked your alerts or viewed a chart"
- **Display:** Small flame icon in top right (similar to Duolingo)
- **Cap at 30:** After 30 days, reset (prevents analysis paralysis)
- **No notifications for streak loss** (too toxic for a financial app)

**Copy (if broken):**
```
"Your 7-day streak is over. No worries — start fresh tomorrow!"
```

**Why restrained?**
- Streaks drive habit-building (valuable for traders)
- But don't punish inactivity (markets close on weekends, people take breaks)
- Keep it in the background (opt-in view, not forced celebration)

---

## 6. Implementation Specifics for Bolt

### 6.1 Data Structures

**Onboarding state (user profile):**
```json
{
  "onboarding": {
    "completed": false,
    "current_step": 1,
    "steps_completed": {
      "welcome_shown": true,
      "first_symbol_added": true,
      "first_alert_created": false,
      "notifications_enabled": false
    },
    "started_at": "2026-03-06T21:10:00Z",
    "last_touched_at": "2026-03-06T21:12:00Z"
  }
}
```

**Tooltip tracking (per user):**
```json
{
  "tooltips_shown": [
    "watchlist_icon",
    "alert_bell"
  ],
  "tooltip_suppress_after": "2026-03-13" // 7 days
}
```

**Badges:**
```json
{
  "badges": [
    {
      "id": "first_catch",
      "earned_at": "2026-03-06T21:15:00Z",
      "viewed": true
    }
  ]
}
```

### 6.2 Feature Flags

Use feature flags to enable/disable each step:

```yaml
onboarding:
  welcome_screen_enabled: true
  step1_add_symbol: true
  step2_create_alert: true
  step3_notifications: true
  checklist_enabled: true
  tooltips_enabled: true
  gamification_enabled: true
  badge_notifications: false  # Don't spam
  streak_enabled: true
```

### 6.3 A/B Testing Hooks

**Testable variations:**
1. **Copy variant:** "Track any stock in seconds" vs. "Get smarter market insights instantly"
2. **Step order:** Alert → Symbol (reverse) vs. Symbol → Alert (current)
3. **Checklist visibility:** Always visible vs. collapsible vs. hidden after day 3
4. **Tooltip aggressiveness:** All tooltips vs. only on empty states vs. none

**Tracking:**
- Log each onboarding event with variant ID
- Measure: time to complete, drop-off rates, feature adoption at day 7/30

---

## 7. Post-Onboarding (Days 1–30)

### 7.1 Retention Hooks

**Day 1–3:**
- Checklist visible (collapsible)
- "You're set up! Now explore..." suggestion on home

**Day 7:**
- Email: "You've created 3 alerts. Here's how they performed." (if applicable)

**Day 14:**
- In-app: "Ready to dive deeper? Try custom indicators." (if user hasn't explored chart tools)

**Day 30:**
- If no logins: "Your alerts are waiting. Check in to catch the next move."

### 7.2 Onboarding Exit Criteria

Mark `onboarding.completed = true` when:
- User completes all 3 main steps (symbol → alert → notification), **OR**
- 7 days have passed (auto-graduate)

After completion, hide checklist and onboarding hints.

---

## 8. Edge Cases & Error Handling

### 8.1 What if user skips notifications step?

**Current behavior:** Set `notifications_enabled = false`, but don't block progress  
**Follow-up:** Show empty state in Alerts tab reminding them to enable notifications

### 8.2 What if user signs up but never adds a symbol?

**Day 1:** Show welcome screen (assume they forgot)  
**Day 3:** Email: "Get started with TradVue"  
**Day 7:** Re-onboard with fresh welcome screen (reset `onboarding.completed = false`)

### 8.3 What if user has alerts but deletes them?

**Don't reset onboarding**  
But consider a soft re-engagement: "Want to set up new alerts?" as a card in home

---

## 9. Accessibility & Localization

### 9.1 Accessibility Rules

- All tooltips and modals must have ARIA labels
- Color is never the only indicator (use icons + text)
- Buttons must be 48×48px minimum (mobile touch target)
- Copy must be scannable (headings, short paragraphs)

### 9.2 Localization Hooks

All copy must be marked for translation. Key strings:
- `onboarding.welcome.headline`
- `onboarding.welcome.subheading`
- `onboarding.step1.cta`
- `empty_state.watchlist.copy`
- Etc.

---

## 10. Success Metrics

Track these from day 0:

| Metric | Target | Why |
|--------|--------|-----|
| Welcome screen completion | >90% | If <90%, copy/design isn't resonating |
| Step 1 (symbol) completion | >85% | Core feature; if low, search UX is broken |
| Step 2 (alert) completion | >75% | Optional but valuable; 75% is solid |
| Step 3 (notifications) completion | >60% | OS permissions are a blocker; 60% is realistic |
| Checklist completion (4/5) | >50% | Shows sustained engagement |
| Day 7 active users | >70% | Retention baseline |
| Feature adoption at day 30 | >40% (indicators, advanced charts) | Indicates graduation from onboarding |

---

## Implementation Checklist for Bolt

- [ ] Create `onboarding` object in user profile schema
- [ ] Build welcome screen modal (swipe-able, single CTA)
- [ ] Build 3-step flow screens (symbol → alert → notification)
- [ ] Implement checklist card (with collapsible logic)
- [ ] Add tooltip system (pulse, arrow, copy, dismiss button)
- [ ] Create 5 empty state screens (watchlist, alerts, etc.)
- [ ] Build badge system (earn + display in settings)
- [ ] Add streak counter (flame icon, reset logic)
- [ ] Implement feature flags for each step
- [ ] Add tracking events (GA/Segment): `onboarding_step_complete`, `onboarding_badge_earned`, etc.
- [ ] QA: Test on iOS and Android (touch targets, permissions)
- [ ] Set up A/B test framework for copy variants
- [ ] Create post-onboarding email templates (day 1, 7, 14, 30)

---

## Final Notes

**Philosophy:**
This onboarding prioritizes **speed** and **early wins**. New traders are anxious; they want to see their data work for them immediately. By completing 3 actions in <5 minutes, we build confidence and momentum for deeper exploration.

**Tone:**
Copy is encouraging but not cheerleader-ish. We're helping traders solve a real problem (staying informed), not pretending this is a game.

**Flexibility:**
If data shows drop-offs at any step, adjust copy or defaults, not the flow. The sequence is right; the words might not be.

---

**Document Status:** Ready for dev handoff. Ping Bolt with questions on implementation details.
