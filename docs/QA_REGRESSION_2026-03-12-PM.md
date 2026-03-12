# QA Regression Report — 2026-03-12 PM

**Agent:** Zip (QA)  
**Scope:** Full regression test — mobile + desktop  
**Triggered by:** Multiple commits pushed today without QA  
**Status:** ✅ PASS (1 minor fix applied)

---

## 1. Build Test

```
cd frontend && npx next build
```

**Result: ✅ PASS — Exit code 0, 0 errors**

- Compiled successfully in 863ms (Turbopack)
- All 18 routes generated (17 static, 1 dynamic)
- TypeScript check: clean
- No warnings

---

## 2. Backend Endpoints

| Endpoint | Status | Latency |
|----------|--------|---------|
| `GET /health` | ✅ 200 | 233ms |
| `GET /api/feed/news?limit=5` | ✅ 200 | 2.4s |
| `GET /api/market-data/quote/AAPL` | ✅ 200 | 242ms |
| `GET /api/calendar/today` | ✅ 200 | 296ms |
| `GET /api/alerts/market` | ✅ 200 | 247ms |
| `GET /api/alerts/calendar` | ✅ 200 | 1.3s |

**All 6 endpoints: ✅ PASS**

News and calendar endpoints slightly slower (external API calls), but well within acceptable range.

---

## 3. Frontend CSS Audit — Mobile Layout

### Mobile Portrait (`≤768px + orientation:portrait`)

**Layout:** ✅ CORRECT

The portrait 2-column layout CSS is intact:
- `layout-3col` overrides to `grid-template-columns: 1fr 1fr !important`
- Grid areas: `"watchlist calendar" / "news news"`
- `.col-watchlist`: `display: flex !important; position: static !important; max-height: 45vh`
- `.col-calendar`: `grid-area: calendar; max-height: 45vh; overflow-y: auto`
- `.col-news`: `grid-area: news; border-right: none` (spans full width)

All rules use `!important` correctly to override the inline `gridTemplateColumns` style on the React component.

**Watchlist search bar:** ✅ VISIBLE  
The `.symbol-search` hiding rule uses descendant selectors (`.cat-tabs .symbol-search`, `.header-nav .symbol-search`) so the watchlist's search bar (inside `.col-watchlist`) is unaffected.

**Hamburger menu:** ✅ WORKING  
The `.mobile-hamburger` button opens `mobileNavOpen`, rendering a full-screen nav drawer (position: fixed, z-index: 9999) with links to all sections. Works correctly on portrait.

### Mobile Landscape (`orientation:landscape + max-height:500px`)

**Layout:** ✅ CORRECT  
- 3-column layout: `1fr 2fr 1fr` — watchlist | news | calendar side by side
- All sticky/fixed positioning removed (reclaims vertical space)
- Hamburger shown for nav
- `apn-items` hidden on all mobile sizes (horizontal tab bar replaced by drawer)

### Desktop (`>768px`)

**Layout:** ✅ UNAFFECTED  
All mobile CSS uses `max-width: 768px`, `orientation` constraints, or `max-height: 500px` — desktop layouts untouched.

---

## 4. Git Commits Reviewed (Today)

```
55ba170c  fix: news articles sorted newest-first
f73002b4  feat: landing page refresh + SEO improvements  
7cb31c24  feat: real-time market alerts + breaking news detection
83da41bb  feat: add informational disclaimers to all 8 tools
182bf1e3  fix: update legal entity name 'Apex Logics LLC'
3c4ee07f  chore: trigger Vercel auto-deploy with DRIP tab
30e0ed3c  feat: Add DRIP tab to Portfolio page
29bb8c1a  feat: watchlist gear settings + drag-to-reorder
4263ae07  fix: force CSS rebuild (watchlist search cache issue)
33c6dd1c  chore: force Vercel rebuild
7b230795  fix: show search/add bar in watchlist on mobile portrait
fc66f189  fix: unstick calendar filter header on mobile
71bc8859  feat: add visible + button next to watchlist search bar
```

**CSS/layout-relevant commits reviewed:**

- **`7cb31c24`** — Added `MarketAlertBar` + `UpcomingEventsWidget` + CSS for market-alert-scroll. The new `.market-alert-scroll` mobile CSS correctly wraps pills vertically (100% width, full-tap targets). **Issue found:** The outer `MarketAlertBar` wrapper had no `max-height` constraint on mobile, meaning a busy market day with many price alerts could push the bar to 150px+ and bury the main grid. **Fixed (see §6).**
- **`f73002b4`** — Added `FeaturesShowcase` (below grid). Uses `repeat(auto-fit, minmax(280px, 1fr))` — collapses to 1 column on mobile. No overflow issues on ≥375px phones. ✅
- **`7b230795`** — The watchlist search bar fix from earlier today is intact and preserved. ✅
- **`fc66f189`** — `.ecal-header { position: relative !important }` on mobile is intact. ✅

---

## 5. Specific Mobile Issue Checklist

| Issue | Result | Notes |
|-------|--------|-------|
| 3-column layout breaking on mobile | ✅ NO BREAK | Portrait/landscape CSS overrides work correctly |
| Watchlist search bar visible on portrait | ✅ VISIBLE | Scoped CSS hide rule doesn't affect col-watchlist |
| Hamburger menu working | ✅ WORKING | Opens full-screen nav drawer |
| MarketAlertBar breaking layout | ⚠️ POTENTIAL | Fixed — see §6 |
| UpcomingEventsWidget breaking layout | ✅ OK | Fits in col-calendar's 45vh, scrollable |
| FeaturesShowcase breaking layout | ✅ OK | auto-fit collapses to 1 col on mobile |
| DRIP tab responsive | ✅ OK | Tab bar has `overflowX: auto`, content uses auto-fill grids |

---

## 6. Fix Applied

**Issue:** `MarketAlertBar` wrapper had no `max-height` on mobile. With many price alerts, pills stacked vertically 100% wide could make the bar 150px+ tall, significantly reducing viewport space for the main 3-column grid.

**Fix:**
1. Added `className="market-alert-bar"` to the wrapper div in `MarketAlertBar` component (`page.tsx`)
2. Added CSS rule in `globals.css`:

```css
@media (max-width: 768px) {
  .market-alert-bar {
    max-height: 96px;
    overflow-y: auto;
    align-items: flex-start !important;
  }
}
```

This caps the alert bar at 96px on mobile (enough for ~3 alert rows) and scrolls vertically if there are more. Desktop is unaffected (no `max-width` constraint on the fix).

**Post-fix build:** ✅ PASS — Exit code 0

---

## 7. Summary

| Category | Status |
|----------|--------|
| Build | ✅ 0 errors |
| Backend (all 6) | ✅ 200 OK |
| Mobile portrait layout | ✅ Correct |
| Mobile landscape layout | ✅ Correct |
| Desktop layout | ✅ Unaffected |
| Watchlist search | ✅ Visible |
| Hamburger nav | ✅ Working |
| New components (3) | ✅ Responsive |
| DRIP tab | ✅ Responsive |
| Fixes applied | 1 (MarketAlertBar max-height) |

**Overall: PASS with 1 minor fix. Mobile layout is functional. No breaking layout bugs found.**

---

*Report generated by Zip — QA Agent, ApexLogics*  
*Timestamp: 2026-03-12 PM EDT*
