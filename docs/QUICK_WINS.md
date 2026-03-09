# TradVue Quick-Win Features List

**Purpose:** 15–20 low-effort, high-impact features to ship in next 2–4 weeks  
**Created:** March 7, 2026  
**Effort Target:** All items ≤ 1 day each (S/M sizing)  
**Audience:** Beta users, product roadmap validation

---

## Prioritized Feature List (Ranked by Score)

### 1. 🌙 Dark Mode Toggle

| Attribute | Value |
|-----------|-------|
| **Name** | Dark Mode (Light/Dark theme switcher) |
| **Description** | One-click theme toggle with OS preference detection and persistent user setting. |
| **Effort** | S (Tailwind + CSS vars + localStorage) |
| **Impact** | High (UX expectation for web apps; traders use at all hours) |
| **Priority Score** | **9.5/10** |
| **Category** | UI/UX Improvements |
| **Implementation** | Toggle in settings or navbar. Use `next-themes` lib or custom Context. |
| **Acceptance Criteria** | - Toggle persists across sessions; - Respects system preference on first visit; - All charts/tables readable in both modes |

---

### 2. 📊 Market Heatmap (Top Gainers/Losers Grid)

| Attribute | Value |
|-----------|-------|
| **Name** | Market Heat Map Dashboard |
| **Description** | Visual grid showing top 20 gainers/losers with color-coded cells (green/red), % change, and volume. Single-click to add to watchlist. |
| **Effort** | M (API query + grid layout + cell interaction) |
| **Impact** | High (traders want "market at a glance"; replaces need to scan multiple pages) |
| **Priority Score** | **9.0/10** |
| **Category** | Data Features |
| **Implementation** | New `/dashboard/heatmap` page or widget. Reuse market movers API endpoint. |
| **Acceptance Criteria** | - Updates every 5 min; - Cells clickable to add to watchlist; - Color intensity = % change magnitude |

---

### 3. 💾 Export Watchlist to CSV/JSON

| Attribute | Value |
|-----------|-------|
| **Name** | Export Watchlist |
| **Description** | One-click download of watchlist items with current price, change %, and volume as CSV or JSON. |
| **Effort** | S (backend query + CSV generator) |
| **Impact** | High (power users backup/migrate; institutional traders need data portability) |
| **Priority Score** | **8.8/10** |
| **Category** | Data Features |
| **Implementation** | Button on watchlist page. Use `npm papaparse` (CSV) or native JSON. |
| **Acceptance Criteria** | - File name includes date/watchlist name; - All columns included; - Zero data loss |

---

### 4. 🔔 Earnings Surprise Alert

| Attribute | Value |
|-----------|-------|
| **Name** | Earnings Surprise Notifications |
| **Description** | Alert when actual EPS/revenue beats or misses consensus by >X%. Multi-channel (email, push, in-app). |
| **Effort** | M (calendar API + comparison logic + alert trigger) |
| **Impact** | High (earnings moves are major trader triggers; not common in free tiers) |
| **Priority Score** | **8.7/10** |
| **Category** | Data Features |
| **Implementation** | Add `earnings_surprise` field to calendar events. Trigger on market close when earnings released. |
| **Acceptance Criteria** | - Configurable threshold (default 5%); - Includes ticker, EPS delta, surprise %; - Sends within 2 min of release |

---

### 5. 🎯 Chart Snapshot Share (Twitter/Discord/Copy Link)

| Attribute | Value |
|-----------|-------|
| **Name** | Share Chart Snapshots |
| **Description** | Capture current chart + annotations, generate public link (7-day TTL), and share to Twitter/Discord with pre-filled text. |
| **Effort** | M (screenshot lib + link generation + social card) |
| **Impact** | High (viral loop; traders love sharing ideas; TradingView dominates here) |
| **Priority Score** | **8.6/10** |
| **Category** | Social Features |
| **Implementation** | Use `html2canvas` or Vercel's OG Image API. Add share button to chart toolbar. |
| **Acceptance Criteria** | - Image renders correctly; - Link shareable & works without auth; - Twitter card shows chart preview |

---

### 6. 📧 Daily Market Summary Email

| Attribute | Value |
|-----------|-------|
| **Name** | Daily Market Digest |
| **Description** | Opt-in email sent 8 AM (user TZ) with: top movers, news, watchlist changes, economic events. Customizable frequency. |
| **Effort** | M (email template + job scheduler + preferences) |
| **Impact** | High (habit-forming; increases daily active engagement; common in Benzinga, Yahoo Finance) |
| **Priority Score** | **8.5/10** |
| **Category** | Data Features |
| **Implementation** | Use Bull job queue + SendGrid template. Add frequency toggle to settings. |
| **Acceptance Criteria** | - Sends at user's preferred time; - Includes summary of user's watchlist; - Unsubscribe link works |

---

### 7. ⌨️ Watchlist Quick-Add Keyboard Shortcut

| Attribute | Value |
|-----------|-------|
| **Name** | Keyboard Shortcut for Add-to-Watchlist |
| **Description** | Press `W` on any chart or search result to instantly add symbol to default watchlist. Shows "Added ✓" toast. |
| **Effort** | S (event listener + existing UI) |
| **Impact** | Medium-High (power users save 3-5 seconds per action; competitive advantage vs. slow UI) |
| **Priority Score** | **8.3/10** |
| **Category** | UI/UX Improvements |
| **Implementation** | Add to `KeyboardShortcuts.tsx`. Update shortcuts reference panel. |
| **Acceptance Criteria** | - Works from chart & search pages; - Shows toast feedback; - Doesn't trigger when typing in search |

---

### 8. 📊 Side-by-Side Chart Comparison

| Attribute | Value |
|-----------|-------|
| **Name** | Compare Two Symbols |
| **Description** | Select second symbol to overlay or place side-by-side. Sync timeframes across both charts. Quick way to compare correlated pairs. |
| **Effort** | M (multi-chart state + sync logic) |
| **Impact** | Medium-High (common in TradingView; traders compare stocks, crypto, forex frequently) |
| **Priority Score** | **8.1/10** |
| **Category** | UI/UX Improvements |
| **Implementation** | New `/dashboard/compare` route or modal overlay. Reuse Recharts component. |
| **Acceptance Criteria** | - Both charts sync on timeframe change; - Can add to watchlist from either chart; - Mobile-friendly layout |

---

### 9. 🏆 Most-Watched Symbols Leaderboard

| Attribute | Value |
|-----------|-------|
| **Name** | Trending/Most-Watched Leaderboard |
| **Description** | Public leaderboard showing top 50 symbols by watchlist additions this week. Shows trend direction + user count. |
| **Effort** | M (aggregation query + cached rank + UI) |
| **Impact** | Medium (social proof; FOMO drives engagement; not common in competitors) |
| **Priority Score** | **8.0/10** |
| **Category** | Social Features |
| **Implementation** | New `/leaderboard` page. Cache results hourly. Add count to instrument table. |
| **Acceptance Criteria** | - Updates hourly; - Shows week-over-week change; - Click to view chart |

---

### 10. 🔍 Search History + Symbol Autocomplete

| Attribute | Value |
|-----------|-------|
| **Name** | Enhanced Search with History & Autocomplete |
| **Description** | Search bar suggests recent queries + top trending symbols. Show search history for current user. |
| **Effort** | S (localStorage + API endpoint) |
| **Impact** | Medium (reduces friction for frequent lookups; improves time-to-insight) |
| **Priority Score** | **7.9/10** |
| **Category** | UI/UX Improvements |
| **Implementation** | Enhance search component. Store last 10 queries in localStorage. |
| **Acceptance Criteria** | - Autocomplete within 100ms; - History clears on logout; - Works on mobile |

---

### 11. 📅 Dividend Calendar Alert

| Attribute | Value |
|-----------|-------|
| **Name** | Dividend Payment Notifications |
| **Description** | Alert users when dividend stocks in their watchlist have ex-div or pay dates. Includes yield %. |
| **Effort** | M (calendar enhancement + alert logic) |
| **Impact** | Medium (income traders rely on this; gaps in other platforms) |
| **Priority Score** | **7.8/10** |
| **Category** | Data Features |
| **Implementation** | Add dividend data from Alpha Vantage/Finnhub. Trigger alerts 3 days before ex-date. |
| **Acceptance Criteria** | - Alert includes dividend %, ex-date, and pay date; - Only alerts for watchlisted stocks; - Configurable |

---

### 12. 📱 Home Screen Widget (iOS/Android)

| Attribute | Value |
|-----------|-------|
| **Name** | Mobile Home Screen Widget |
| **Description** | iOS/Android home screen widget showing top 3 watchlist items with current price and % change. Quick tap to open app. |
| **Effort** | M (React Native or native widget code) |
| **Impact** | Medium (iOS users expect widgets; improves re-engagement) |
| **Priority Score** | **7.7/10** |
| **Category** | Mobile Improvements |
| **Implementation** | Part of future React Native app. Start with iOS WidgetKit sample. |
| **Acceptance Criteria** | - Updates every 5 min; - Tap opens app to that symbol; - Shows gain/loss in color (green/red) |

---

### 13. 🚨 Pre-Market Movers Alert

| Attribute | Value |
|-----------|-------|
| **Name** | Pre-Market Activity Alert |
| **Description** | Daily 6:30 AM alert (US ET) showing biggest movers in extended hours. Useful for day traders. |
| **Effort** | S (scheduled job + push notification) |
| **Impact** | Medium (day traders prioritize; limited in free tiers) |
| **Priority Score** | **7.6/10** |
| **Category** | Data Features |
| **Implementation** | Bull job runs at 6:30 AM ET. Query extended hours data from Finnhub. |
| **Acceptance Criteria** | - Includes top 10 gainers/losers; - Shows pre-market vs. last close %; - Multi-channel notify |

---

### 14. 🔄 Bulk Watchlist Actions

| Attribute | Value |
|-----------|-------|
| **Name** | Bulk Actions on Watchlist Items |
| **Description** | Select multiple items → delete all, set alerts for all, move to another watchlist, or add same alert to all. |
| **Effort** | M (checkbox state + batch API endpoints) |
| **Impact** | Medium (power users managing 50+ stocks need speed) |
| **Priority Score** | **7.5/10** |
| **Category** | UI/UX Improvements |
| **Implementation** | Add checkbox to watchlist table. New batch endpoints: `/api/watchlist/bulk-delete`, etc. |
| **Acceptance Criteria** | - Select/deselect all works; - Batch delete confirms; - Actions complete in <2s |

---

### 15. 📈 Volume Leaders Dashboard

| Attribute | Value |
|-----------|-------|
| **Name** | Volume Leaders (Most Traded Today) |
| **Description** | Real-time table of top 50 stocks by trading volume today. Shows $ volume, share count, and volatility. |
| **Effort** | M (API query + table layout) |
| **Impact** | Medium (swing traders watch volume leaders; common in FinViz) |
| **Priority Score** | **7.4/10** |
| **Category** | Data Features |
| **Implementation** | New `/dashboard/volume-leaders` widget. Use Finnhub top movers by volume. |
| **Acceptance Criteria** | - Updates every minute; - Shows 1d volume + moving avg; - Click to chart |

---

### 16. 🎯 Stock Split Alert

| Attribute | Value |
|-----------|-------|
| **Name** | Stock Split Notifications |
| **Description** | Notify users when stocks in watchlist undergo splits. Include ratio and effective date. |
| **Effort** | S (calendar enhancement + filter) |
| **Impact** | Low-Medium (primarily benefits long-term investors; edge case but appreciated) |
| **Priority Score** | **7.2/10** |
| **Category** | Data Features |
| **Implementation** | Add to calendar events. Use Alpha Vantage for split data. |
| **Acceptance Criteria** | - Alert includes old/new price per share; - Effective date highlighted; - Email + push |

---

### 17. 💬 Siri Shortcuts (iOS)

| Attribute | Value |
|-----------|-------|
| **Name** | iOS Siri Shortcuts |
| **Description** | Voice commands: "What's AAPL?" → reads price. "Add TSLA to watchlist" → adds. No app open required. |
| **Effort** | M (Shortcut automation + API) |
| **Impact** | Low-Medium (niche but highly engaged users) |
| **Priority Score** | **7.0/10** |
| **Category** | Mobile Improvements |
| **Implementation** | Public Shortcut shared on App Store. Calls API endpoints. |
| **Acceptance Criteria** | - 5+ shortcut actions; - Voice recognition works; - No auth required for price lookup |

---

### 18. 🔗 Shareable Portfolio Links

| Attribute | Value |
|-----------|-------|
| **Name** | Public Portfolio Share Links |
| **Description** | Generate read-only share link for watchlist (e.g., `tradvue.io/share/xyz123`). Show top holdings, allocation %, and performance. |
| **Effort** | M (link generation + public route + permission checks) |
| **Impact** | Low-Medium (enables influencers, advisory, community sharing) |
| **Priority Score** | **6.9/10** |
| **Category** | Social Features |
| **Implementation** | Add share button to watchlist. Generate UUID for public slug. |
| **Acceptance Criteria** | - Link works without login; - Shows updated prices; - Owner can disable anytime |

---

### 19. 📊 Asset Allocation Pie Chart

| Attribute | Value |
|-----------|-------|
| **Name** | Portfolio Allocation Visualization |
| **Description** | Pie/donut chart showing % allocation across sectors (Tech, Finance, Healthcare, etc.). Help users spot concentration risk. |
| **Effort** | S (Recharts pie + sector mapping) |
| **Impact** | Low (nice-to-have; specialized for portfolio holders, not pure traders) |
| **Priority Score** | **6.8/10** |
| **Category** | UI/UX Improvements |
| **Implementation** | Widget on dashboard. Use sector data from Finnhub. |
| **Acceptance Criteria** | - Accurate sector classification; - Hover shows details; - Add to watchlist from pie |

---

### 20. 🌍 Market Hours Indicator

| Attribute | Value |
|-----------|-------|
| **Name** | Global Market Open/Close Status Indicator |
| **Description** | Status banner showing which global markets are currently open: US, EU, Asia. Include countdown to next open. |
| **Effort** | S (time calculation + UI badge) |
| **Impact** | Low-Medium (helps traders planning; common in international platforms) |
| **Priority Score** | **6.7/10** |
| **Category** | UI/UX Improvements |
| **Implementation** | Header component. Calculate open/close times per market. |
| **Acceptance Criteria** | - Updates every minute; - Color-coded (open=green, closed=gray); - Countdown to next market |

---

## Implementation Roadmap

### Week 1 (March 9–15)
1. Dark Mode Toggle (#1)
2. Export Watchlist (#3)
3. Watchlist Quick-Add Shortcut (#7)
4. Search History (#10)
5. Market Hours Indicator (#20)

**Rationale:** Foundation UX improvements + quick data wins. Each is <4 hours.

### Week 2 (March 16–22)
6. Market Heatmap (#2)
7. Earnings Surprise Alert (#4)
8. Pre-Market Movers (#13)
9. Volume Leaders (#15)
10. Siri Shortcuts (#17) — *start design phase*

**Rationale:** Data features with high trader demand. Heatmap requires chart integration; pre-market job needs scheduling.

### Week 3 (March 23–29)
11. Daily Market Summary Email (#6)
12. Chart Snapshot Share (#5)
13. Dividend Calendar (#11)
14. Bulk Watchlist Actions (#14)
15. Stock Split Alert (#16)

**Rationale:** Advanced personalization + social features. Depends on mail system + job queue stability.

### Week 4+ (April)
16. Side-by-Side Comparison (#8)
17. Leaderboard (#9)
18. Portfolio Links (#18)
19. Allocation Chart (#19)
20. Home Screen Widget (#12) — *requires mobile app*

**Rationale:** UI enhancements + lower-impact social features. Comparison and leaderboard need state refactoring.

---

## Success Metrics

| Metric | Target | Window |
|--------|--------|--------|
| Dark Mode Adoption | >40% of beta users | 1 week post-launch |
| Heatmap Daily Views | >60% of DAU | 2 weeks |
| Chart Share Clicks | >100 shares/week | 2 weeks |
| Email Opt-in Rate | >35% of active users | 3 weeks |
| Bulk Action Adoption | >20% of power users | 3 weeks |

---

## Resource Requirements

### Backend
- **Time:** 15–20 engineer-days total (spread across team)
- **Skills:** Node.js, PostgreSQL, job scheduling (Bull), email templates (SendGrid)
- **Dependencies:** Existing API stability + data provider integrations

### Frontend
- **Time:** 10–15 engineer-days total
- **Skills:** React/Next.js, TailwindCSS, state management, chart libraries
- **Dependencies:** New design tokens (dark mode)

### QA & Release
- **Time:** 3–5 days (beta testing + staging validation)
- **Risk Level:** Low (all features are non-breaking, additive)

---

## Competitive Gaps Addressed

| Gap | Feature(s) Solving | Competitor |
|-----|-------------------|-----------|
| No dark mode | Dark Mode (#1) | TradingView, Benzinga |
| No chart sharing | Share Snapshots (#5) | TradingView (strong here) |
| Limited earnings data | Earnings Surprise (#4) | TradingView, Benzinga |
| No market digest | Daily Email (#6) | Yahoo Finance, Benzinga |
| Slow watchlist mgmt | Bulk Actions (#14) | FinViz |
| No social engagement | Leaderboard (#9), Share Links (#18) | StockTwits (community) |

---

## Risk & Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Dark mode breaks charts | Medium | Test all chart types (candlestick, volume, indicators) |
| Email deliverability issues | Low | Use SendGrid template; test with multiple providers |
| API rate limit exceeded (movers, earnings data) | Medium | Implement caching (1h TTL); fallback to cached data |
| Share links expose user preferences | Low | Permission checks; option to anonymize |
| Scheduler job misses time zones | Low | Store user TZ in DB; use `moment-timezone` for accuracy |

---

## Notes for Product

- **User Research:** Test heatmap + comparison features in beta. Early feedback will inform iteration.
- **Mobile App:** Features #12, #17 depend on React Native roadmap. Can ship responsive web versions first.
- **Data Quality:** Earnings surprise, dividend alerts only work if Alpha Vantage/Finnhub data is accurate. Monitor API quality.
- **Community:** Leaderboard & share links create engagement loops. Monitor for abuse (market manipulation signals).

---

**Owner:** Zip (Research Agent)  
**Status:** Ready for prioritization & sprint planning  
**Last Updated:** March 7, 2026
