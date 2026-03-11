# TradVue Task Queue — 2026-03-11
_Master list of everything discussed. Bolt builds, Zip verifies, Axle orchestrates._

## 🔨 BATCH 1: QA Fixes + Core Automation (Bolt — IN PROGRESS)
- [x] Fix `/login` 404 (portfolio links)
- [x] Fix 5 dead landing page links (/about, /contact, /team, /roadmap, /blog)
- [x] Fix `/learn` dead link on help page
- [x] Fix calendar showing yesterday's events
- [x] Replace ~35 remaining emojis with SVG icons
- [x] Add meta tags for /status and /changelog
- [x] Disclose mock data on heatmap/sectors
- [x] One-click trade logging from watchlist
- [x] Smart defaults per asset class (journal)
- [x] Auto-fill entry price from market data (journal)
- [x] Calendar auto-highlights for watchlist stocks
- [x] Weekly performance auto-summary (journal)

## 🔨 BATCH 2: New Tools — Tools Page (Bolt — IN PROGRESS)
- [ ] Options Profit Calculator (P&L chart, break-even, Greeks)
- [ ] Compound Growth Calculator (area chart, year-by-year table)
- [ ] Risk of Ruin Calculator (Monte Carlo simulation, Kelly Criterion)
- [ ] Forex Pip Calculator (20+ pairs, pip values, leverage/margin)
- [ ] Universal Position Sizer (all asset classes, risk % scenarios)
- [ ] Trade Expectancy Calculator (system profitability check)
- [ ] Correlation Matrix (2-8 tickers, color-coded grid)
- [ ] Market Session World Clock (all global sessions, overlap periods)
- [ ] Economic Calendar Heatmap (weekly grid, impact color-coded)
- [ ] Dividend Income Planner (standalone reference calc)
- [ ] Organize tools into categories: Trading Calculators, Risk & Analytics, Planning, Market Overview

## 🔨 BATCH 3: Page Integrations (Bolt — IN PROGRESS)

### Portfolio Page
- [ ] DRIP Simulator (toggle per holding, projected growth with reinvestment)
- [ ] Portfolio Risk Score (auto-calculated 1-100, concentration/sector/beta)
- [ ] Dividend Calendar (ex-div dates, monthly income projections)

### Journal Page
- [ ] Pattern Detection ("you lose 70% on Mondays", "morning trades best")
- [ ] Win/Loss Streak Tracker (current streak, best/worst historical)
- [ ] Emotional Tags (Confident/FOMO/Revenge/Disciplined → performance correlation)

### Dashboard Page
- [ ] Smart Alerts Bar (earnings warnings, win rate drops, high-impact events)
- [ ] Daily P&L Ticker in header ("Today: +$450, 3W/1L")

## 🧪 BATCH 4: Verification (Zip — QUEUED, runs after Bolt)
- [ ] Independent math verification of ALL calculators
- [ ] Hand-calculated test cases per tool (see TOOL_VERIFICATION_SPEC.md)
- [ ] Edge case testing (zeros, negatives, large numbers)
- [ ] Every formula must match within 0.01% tolerance
- [ ] Full report with pass/fail per tool

## 📋 BATCH 5: Remaining Items (after verification)
- [ ] Auth frontend UI (login/signup modal, sync indicator)
- [ ] Run Supabase migration 010 (user_data tables)
- [ ] Set Supabase env vars on Render (SUPABASE_URL, ANON_KEY, JWT_SECRET)
- [ ] Shut down Railway (~March 13)
- [ ] Remove Railway URL from CORS + CSP
- [ ] Google Analytics property → real GA_MEASUREMENT_ID
- [ ] chartgenius.io redirect (week of 3/16)
- [ ] chartgenius.io removal from Vercel (week of 3/23)
- [ ] Broker auto-import (biggest competitive gap — future sprint)
- [ ] AI support chatbot on /help page
- [ ] Find first 10 users (Reddit, Twitter, Discord)

## 🚀 FUTURE SPRINT: Advanced Automation
- [ ] Broker API integration (Robinhood, IBKR, Webull, TD Ameritrade)
- [ ] Auto-populate trade data from symbol + timestamp (historical prices)
- [ ] AI trade tagging ("Looks like a breakout trade during market open")
- [ ] Post-trade replay ("You exited at $155. Stock went to $172 in 5 days")
- [ ] Auto-generated weekly email reports
- [ ] Push notifications for price alerts
- [ ] Portfolio rebalancing suggestions

## Rules
- Axle orchestrates, never implements
- Bolt builds features, Zip verifies math
- No tool goes live without independent verification
- No duplicates — merge if functionality overlaps
- Every calculator must have tooltips, instructions, mobile support
- Features go WHERE THEY BELONG (portfolio/journal/dashboard), not all on tools page
