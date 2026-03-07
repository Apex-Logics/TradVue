# ChartGenius Metrics Dashboard Specification

**Version:** 1.0  
**Date:** March 2026  
**Scope:** Beta Launch & Early Growth  
**Audience:** Internal team, investors, decision-makers

---

## Executive Summary

This spec defines the metrics ChartGenius will track to measure product-market fit, operational health, and growth during beta. Focused on **actionable insights** and **minimal operational overhead** — we're shipping a beta, not building a Fortune 500 analytics org.

**Core Philosophy:**
- Track what matters for decisions (not vanity metrics)
- Minimize instrumentation overhead
- Use free/low-cost tools where possible
- Focus on retention and engagement first, then revenue

---

## 1. Product Metrics (User Growth & Engagement)

### Primary Metrics (Track Daily)

| Metric | Definition | Target (Beta) | Tracking Method |
|--------|-----------|---------------|-----------------|
| **DAU (Daily Active Users)** | Unique users with ≥1 login in 24h | 100-500 | GA4 or custom event |
| **WAU (Weekly Active)** | Unique users in rolling 7 days | 300-1500 | GA4 or custom event |
| **MAU (Monthly Active)** | Unique users in rolling 30 days | 1000-5000 | GA4 or custom event |
| **Session Duration (avg)** | Mean session length in minutes | >5 min | GA4 default |
| **Sessions/User/Week** | How often users return | >2.5 | GA4 default |
| **Bounce Rate** | % users leaving without action | <40% | GA4 default |

### Feature Usage (Track Weekly)

| Feature | Metric | Tracking Method |
|---------|--------|-----------------|
| **Watchlists** | Watchlists created, avg size, % users with >5 | Custom event: `watchlist_created`, `watchlist_viewed` |
| **Alerts** | Alerts created per user (avg), triggered events | Custom event: `alert_created`, `alert_triggered` |
| **Chart Search** | Searches performed, top 10 symbols, avg results clicked | Custom event: `search_performed`, `search_result_clicked` |
| **News Feed** | Articles viewed, % scrolling to end, click-through rate | Custom event: `article_viewed`, `article_clicked` |
| **Technical Analysis** | TA tools used (% users), avg indicators per chart | Custom event: `indicator_added`, `chart_shared` |

### Retention (Track Weekly)

| Cohort | Definition | Threshold |
|--------|-----------|-----------|
| **D7 Retention** | % of Day 1 users active on Day 7 | >30% (healthy) |
| **D30 Retention** | % of Day 1 users active 30 days later | >15% (acceptable) |
| **Churn Rate (monthly)** | % users inactive >30 days | <25% beta acceptable |

---

## 2. Business Metrics (Growth & Monetization)

### User Acquisition (Track Daily)

| Metric | Definition | Target (Beta) | Method |
|--------|-----------|---|--------|
| **Signups/Day** | New user accounts created | 10-50/day ramp | GA4 + auth system |
| **Signups/Week** | Rolling weekly signups | 70-350 | Aggregated |
| **Signup Conversion** | % of visitors → accounts | >2% | GA4 funnel |
| **Referral Rate** | % new users from referrals | >10% (if enabled) | Custom event |

### Free → Pro Conversion (Track Daily)

| Metric | Definition | Target | Method |
|--------|-----------|--------|--------|
| **Free Users** | Active free tier accounts | — | Auth system |
| **Pro Conversions/Week** | Free users upgrading to Pro | 2-10/week initially | Stripe webhook |
| **Conversion Rate** | % active free → Pro | >0.5% | Stripe + cohort analysis |
| **ARPU** | Average revenue per user | $0.50-2.00 (beta) | Stripe/custom |
| **Time to Conversion** | Days from signup to upgrade | <14 days target | Cohort tracking |

### Revenue & LTV (Track Weekly)

| Metric | Definition | Target | Method |
|--------|-----------|--------|--------|
| **MRR (Monthly Recurring Revenue)** | Repeating monthly revenue | $500-2000 (beta) | Stripe reports |
| **ARR (Annual Run Rate)** | MRR × 12 | $6K-24K (beta) | Calculated |
| **ARPU (Annual)** | Annual revenue per user | $6-24 (beta) | Calculated |
| **Gross Margin** | Revenue minus COGS | >70% | Finance tracking |
| **LTV (Lifetime Value)** | Avg revenue per user lifetime | >$50 (beta estimate) | Cohort analysis |
| **CAC (Customer Acq. Cost)** | Marketing spend / conversions | <$10 (beta, organic) | Marketing tracking |
| **LTV/CAC Ratio** | Revenue efficiency | >3:1 target | Calculated |

### Churn Analysis (Track Monthly)

| Metric | Definition | Threshold |
|--------|-----------|-----------|
| **Monthly Churn Rate (Pro)** | % Pro users not renewing | <5% (healthy) |
| **Churn Reason** | Why users cancel (survey) | Qualitative |
| **Reactivation Rate** | % lapsed users returning | >10% (good) |

---

## 3. Technical Metrics (Reliability & Performance)

### Performance (Track Continuously)

| Metric | SLA Target | Tool |
|--------|-----------|------|
| **API Response Time (p95)** | <500ms | DataDog / New Relic free tier |
| **API Response Time (p99)** | <1s | |
| **Charting Render Time (avg)** | <2s | RUM (Real User Monitoring) |
| **Search Response Time (p95)** | <500ms | RUM |

### Reliability (Track Continuously)

| Metric | Target | Method |
|--------|--------|--------|
| **Uptime** | >99.5% (beta: >99%) | Pingdom / Uptime Robot free |
| **Error Rate (5xx)** | <0.1% | Application logs → DataDog |
| **API Error Rate (4xx)** | <1% | Application logs |
| **Database Query Time (p95)** | <100ms | DB monitoring (cloud provider) |
| **Frontend Error Rate** | <0.01% | Sentry free tier |

### Infrastructure (Track Daily)

| Metric | Alert Threshold | Method |
|--------|-----------------|--------|
| **Database CPU** | >70% | Cloud provider dashboard |
| **Database Storage** | >70% capacity | Cloud provider alerts |
| **Cache Hit Rate** | >80% | Redis/memcached stats |
| **Queue Backlog (async jobs)** | >1000 | Custom monitoring |

---

## 4. Engagement Metrics (Activation & Value Delivery)

### Activation (Track Daily)

| Metric | Definition | Target | Method |
|--------|-----------|--------|--------|
| **Time to First Value** | Minutes to first chart viewed | <5 min | Custom event |
| **First Feature Interaction** | % using key feature in session 1 | >50% | Event funnel |
| **Signup → First Chart (24h)** | % viewing chart within 24h | >70% | Cohort analysis |

### Feature Adoption (Track Weekly)

| Feature | Metric | Target |
|---------|--------|--------|
| **Watchlists** | % users creating ≥1 | >30% |
| **Alerts** | % users creating ≥1 | >20% |
| **News Feed** | % users viewing ≥1 article | >40% |
| **Technical Indicators** | % users applying any | >15% |
| **Portfolio Tracking** | % users tracking positions | >10% |

### Content/News Engagement (Track Daily)

| Metric | Definition | Target | Method |
|--------|-----------|--------|--------|
| **Articles Viewed/User/Week** | Avg news items per user | >3/week | Event tracking |
| **Article Click-Through Rate** | % articles read that get clicked | >5% | GA4 + custom |
| **Avg Time on News** | Time spent in news feed | >2 min/session | GA4 |

### Search & Discovery (Track Weekly)

| Metric | Definition | Target | Method |
|--------|-----------|--------|--------|
| **Searches/User/Week** | Avg charts searched | >2 | Custom event |
| **Search Success Rate** | % searches w/ results clicked | >30% | Event funnel |
| **Top 20 Symbols** | Most-searched tickers | Qualitative insights | Analytics |

---

## 5. Dashboard Layout & Views

### 5.1 Main Dashboard (Executive View)
**Refresh:** Real-time (5-min update)  
**Target Audience:** Executive team, investors

**Top Row (KPIs - Big Numbers)**
```
┌─────────────┬──────────────┬────────────────┬──────────────┐
│ DAU: 245    │ Sessions: 412 │ Conversion: 1.2% │ MRR: $1,234 │
│ ↑ 8% WoW    │ ↑ 15% WoW    │ Target: 0.5%   │ ↑ 45% MoM   │
└─────────────┴──────────────┴────────────────┴──────────────┘
```

**Middle Row (Trends - 7/30 Day)**
```
┌──────────────────────┬──────────────────────┐
│ DAU Trend (30d line) │ Revenue Trend (30d)  │
│ Chart: Shows growth  │ MRR/ARR trajectory  │
└──────────────────────┴──────────────────────┘
```

**Bottom Row (Health Checks)**
```
┌──────────────────────┬──────────────────────┐
│ System Health        │ Conversion Funnel    │
│ Uptime: 99.8%       │ Signup→Free→Pro      │
│ API p95: 234ms      │ 5,000→245→3 (1.2%)  │
└──────────────────────┴──────────────────────┘
```

---

### 5.2 Growth Dashboard (Product Manager View)
**Refresh:** Daily (overnight batch)  
**Audience:** Product, growth, marketing

**Section 1: Acquisition**
- Daily signups (line chart, 30d)
- Signup sources (bar: organic, referral, ads if any)
- Visitor → Signup funnel

**Section 2: Activation & Retention**
- D1, D7, D30 retention cohorts (heatmap)
- Time to first value histogram
- Feature adoption % (bar chart)
- Top features by usage (% of active users)

**Section 3: Revenue Cohorts**
- Signup cohorts with conversion rate (table)
- ARPU by cohort (line chart)
- Churn by cohort (line chart)

**Section 4: Engagement**
- Session duration distribution
- Feature usage breakdown (pie chart)
- News click-through rate (trending)

---

### 5.3 Technical Dashboard (Engineering/DevOps View)
**Refresh:** Real-time (1-min update)  
**Audience:** Engineering, DevOps, SRE

**Section 1: API Performance**
- Response time percentiles (p50, p95, p99)
- Error rates by endpoint
- Throughput (requests/sec)

**Section 2: Reliability**
- Uptime gauge (24h, 7d, 30d)
- Error budget remaining (if applicable)
- Critical alerts (firing/resolved)

**Section 3: Infrastructure**
- Database CPU, memory, connections
- Query performance (p95, slow query log)
- Cache hit rate
- Queue depth

**Section 4: Frontend Health**
- Client-side error rate
- Slow transaction rate (>3s load)
- Top errors (top 5)

---

### 5.4 Drill-Down Views (Accessible from main)

1. **Cohort Analysis Detail**
   - Filter by signup date, region (if tracked), referral source
   - Retention curves by cohort
   - Revenue curves by cohort

2. **Feature Funnel**
   - Select feature → see adoption funnel
   - Signup → First interaction → Repeat use

3. **Segment Breakdown**
   - Free vs. Pro user metrics side-by-side
   - High-engagement vs. low-engagement user profiles

4. **Error Explorer**
   - Filter errors by type, endpoint, date range
   - Stack trace & session replay (Sentry)

5. **Performance Timeline**
   - Zoom into any performance metric
   - Correlate with deployments (release markers)

---

## 6. Tracking & Implementation

### 6.1 Event Taxonomy (Custom Tracking)

**Authentication Events**
```
- user_signup: {source: 'organic'|'referral'|'ad', plan: 'free'}
- user_login: {}
- user_logout: {}
- subscription_upgraded: {from: 'free', to: 'pro', price: 9.99}
- subscription_cancelled: {reason: 'survey_response'}
```

**Feature Usage Events**
```
- watchlist_created: {count: 1}
- watchlist_viewed: {watchlist_id, size}
- alert_created: {alert_type: 'price'|'news'|'volume'}
- alert_triggered: {alert_id}
- chart_viewed: {symbol, indicators_applied}
- indicator_added: {indicator_type}
- search_performed: {query, results_count}
- search_result_clicked: {symbol, position}
- article_viewed: {article_id, category}
- article_clicked: {article_id, source}
```

**Engagement Events**
```
- session_start: {device: 'web'|'mobile'}
- session_end: {duration_sec}
- feature_adopted: {feature_name}
```

### 6.2 Recommended Tools Stack

#### **Free/Cheap Analytics Options**

| Tool | Use Case | Cost | Notes |
|------|----------|------|-------|
| **Google Analytics 4 (GA4)** | Web analytics, funnels, cohorts | Free up to 10M events/month | Start here. Covers acquisition, activation, sessions. |
| **Segment** | Event pipeline (optional) | Free up to 100K MTU | Use if coordinating multiple destinations. |
| **Metabase** | Internal dashboards | Free (self-hosted) | Great for SQL-based dashboards from your DB. |
| **Grafana** | System metrics dashboards | Free (self-hosted) | Best for technical metrics (Prometheus, cloud metrics). |
| **Sentry** | Error tracking & monitoring | Free up to 5K errors/month | Essential for frontend/API error monitoring. |
| **Uptime Robot** | Uptime monitoring | Free up to 50 monitors | Monitor API/web health. |
| **Mixpanel** | Product analytics (alternative) | Paid tier >$999/mo | Skip for now; GA4 sufficient. |

#### **Cloud Provider Tools (Built-in)**

| Provider | Metrics Available |
|----------|------------------|
| **AWS CloudWatch** | Database, API Gateway, Lambda metrics; free tier includes basic dashboards |
| **Google Cloud Monitoring** | Similar to CloudWatch; included with Cloud SQL, App Engine |
| **Azure Monitor** | Equivalent if using Azure |

#### **Custom Tracking (Application Level)**

If using a backend framework:
- **Server-side:** Log key events (signup, conversion, errors) to a simple table
  - Schema: `timestamp, event_name, user_id, properties (JSON)`
  - Query in Metabase for custom dashboards
- **Client-side:** Use GA4 SDK or a simple fetch to your events API
  - Minimal overhead; batch events in ~30s intervals

---

### 6.3 Initial Instrumentation (MVP)

**Phase 1 (Week 1 of Beta)** — *Minimal, essential tracking*
- ✅ GA4 pageviews & goals (signup, first chart view, upgrade)
- ✅ Stripe webhooks → custom event log (signup, upgrade, churn)
- ✅ API response time logging (simple middleware)
- ✅ Error logging (Sentry for frontend, app logs for backend)
- ✅ Uptime monitoring (Uptime Robot)

**Phase 2 (Week 2-4)** — *Add depth*
- ✅ Feature usage events (watchlist, alerts, search) via GA4
- ✅ Metabase dashboards from custom event log
- ✅ Database performance monitoring (CloudSQL/RDS native)
- ✅ Retention cohorts (manual SQL query, weekly batch)

**Phase 3 (Post-Beta)** — *Optimization*
- ✅ Refine event schema based on learnings
- ✅ Implement real-time alerts for anomalies
- ✅ User segmentation & advanced cohorts

---

### 6.4 GA4 Configuration Checklist

- [ ] GA4 property created
- [ ] Enhanced ecommerce (or events-based model) enabled
- [ ] Goal: `user_signup` (sign-up page completion)
- [ ] Goal: `first_chart_viewed` (chart page view, first time)
- [ ] Goal: `subscription_upgrade` (Stripe conversion event)
- [ ] Conversion events linked to Stripe (via GTM or direct)
- [ ] Funnel: Signup → Login → Chart View → Upgrade (4-step)
- [ ] User-ID reporting enabled (if collecting logged-in user behavior)
- [ ] 4-week data retention (default; extend if budget allows)

---

### 6.5 Stripe Integration for Revenue Metrics

**Automate revenue tracking:**
```
Stripe Webhook → Your Events Table → Metabase
Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
```

**Data Model:**
```sql
revenue_events (
  event_id, 
  timestamp, 
  user_id, 
  event_type (signup|upgrade|churn|refund), 
  amount_usd, 
  plan (free|pro)
)
```

---

## 7. Key Metrics to Prioritize (Beta Focus)

### **If you can only track 5 metrics (absolute minimum):**

1. **DAU** — Proves users are coming back
2. **D7 Retention** — Proves product has retention
3. **Free → Pro Conversion Rate** — Proves monetization path
4. **API Uptime** — Proves reliability (no point tracking users if service is down)
5. **Error Rate** — Proves quality

### **Quick Wins (Easy to add, high impact):**
- Session duration (GA4 default)
- Feature adoption % (top 3 features)
- First chart view % (activation bottleneck)
- News article CTR (engagement proxy)

---

## 8. Reporting Cadence

### **Daily (Team Standup)**
- DAU, WAU, signups
- Conversion rate (if updates available)
- Any uptime/error incidents

### **Weekly (Product Meeting)**
- Cohort retention curves
- Feature usage breakdown
- Revenue progress (MRR)
- Top bugs/errors

### **Monthly (Leadership Sync)**
- MRR, ARR, LTV/CAC
- Retention curves (D1, D7, D30)
- Key learnings from segments
- Roadmap impact (what's working, what isn't)

---

## 9. Example Dashboard Mockup (Text)

```
╔══════════════════════════════════════════════════════════════╗
║         CHARTGENIUS METRICS DASHBOARD (MAIN)                 ║
║                   March 7, 2026                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  DAU: 245          Sessions: 412        Conv: 1.2%  MRR: $1.2K
║  ↑ 8% WoW          ↑ 15% WoW            ↓ 0.3 pts  ↑ 45% MoM
║                                                              ║
╠════════════════════════════╦════════════════════════════════╣
║  DAU Trend (30d)           ║  Revenue Trajectory (30d)      ║
║  📈 Growth phase           ║  📊 Accelerating                ║
║  Avg: 180, Peak: 245       ║  MRR: $850 → $1,234            ║
╠════════════════════════════╬════════════════════════════════╣
║  System Health             ║  Activation Funnel             ║
║  ✅ Uptime: 99.8%          ║  Signup→Free→Pro: 1.2%        ║
║  ✅ API p95: 234ms         ║  Free Users: 245              ║
║  ✅ Errors: 0.02%          ║  Pro Users: 3 (from 5 upgrades)
╠════════════════════════════╬════════════════════════════════╣
║  Feature Adoption          ║  Top Features (This Week)      ║
║  Watchlists: 28%           ║  1. Chart View: 89%           ║
║  Alerts: 15%               ║  2. News Feed: 42%            ║
║  Technical Indicators: 8%  ║  3. Watchlists: 28%           ║
║  Portfolio: 4%             ║  4. Alerts: 15%               ║
╚════════════════════════════╩════════════════════════════════╝
```

---

## 10. Decision Framework: Metrics → Action

**Example decision loops:**

| If This Metric... | It Means... | Then Do This |
|------------------|-----------|-------------|
| DAU flat, but signups ↑ | Activation problem | Improve onboarding (faster first chart) |
| D7 retention <20% | Users not returning | Investigate feature gaps; survey lapsed users |
| Conversion stuck <1% | Monetization problem | Test pricing, upgrade friction, feature lock |
| Uptime <99% | Technical credibility issue | Incident review; improve reliability |
| Feature adoption <10% | Feature unused | Remove, pivot, or integrate differently |
| API p95 >1s | Performance issue | Database optimization, caching, load test |
| Churn spike | Retention issue | Survey churned users; check for bugs |

---

## 11. Notes for Beta

- **Privacy:** Track minimal PII. Use user IDs for cohort analysis, not emails in dashboards.
- **Sampling:** If events exceed free tier, sample user cohorts (e.g., track 50% of users fully).
- **Retrospectives:** Weekly: What surprised you? What changed? What's the next hypothesis?
- **Iteration:** Update this spec monthly as you learn what matters.

---

## Appendix A: SQL Queries for Metabase

### D7 Retention Query
```sql
WITH cohorts AS (
  SELECT 
    DATE(signup_date) as cohort_date,
    user_id
  FROM users
)
SELECT 
  cohorts.cohort_date,
  COUNT(DISTINCT cohorts.user_id) as cohort_size,
  COUNT(DISTINCT CASE WHEN logins.login_date BETWEEN cohorts.signup_date AND DATE_ADD(cohorts.signup_date, INTERVAL 7 DAY) THEN cohorts.user_id END) as d7_active,
  ROUND(100 * COUNT(DISTINCT CASE WHEN logins.login_date BETWEEN cohorts.signup_date AND DATE_ADD(cohorts.signup_date, INTERVAL 7 DAY) THEN cohorts.user_id END) / COUNT(DISTINCT cohorts.user_id), 1) as d7_retention_pct
FROM cohorts
LEFT JOIN logins ON cohorts.user_id = logins.user_id
GROUP BY cohorts.cohort_date
ORDER BY cohorts.cohort_date DESC;
```

### Free → Pro Conversion by Cohort
```sql
SELECT 
  DATE(users.signup_date) as signup_cohort,
  COUNT(DISTINCT users.user_id) as signups,
  COUNT(DISTINCT CASE WHEN subscriptions.plan = 'pro' THEN users.user_id END) as pro_conversions,
  ROUND(100 * COUNT(DISTINCT CASE WHEN subscriptions.plan = 'pro' THEN users.user_id END) / COUNT(DISTINCT users.user_id), 2) as conversion_pct,
  AVG(DATEDIFF(day, users.signup_date, subscriptions.upgrade_date)) as avg_days_to_upgrade
FROM users
LEFT JOIN subscriptions ON users.user_id = subscriptions.user_id
GROUP BY DATE(users.signup_date)
ORDER BY signup_cohort DESC;
```

---

## Appendix B: Recommended Reading

- *Lean Analytics* by Alistair Croll & Benjamin Yoskovitz — Pick 1-2 chapters on metrics strategy
- *Reforge: Analytics for Startups* — Online course (free tier available)
- GA4 Setup Guide: https://support.google.com/analytics/answer/9304153
- Metabase Docs: https://www.metabase.com/docs/latest/

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Mar 7, 2026 | Initial spec for beta launch |

---

**Owner:** Product team  
**Review Date:** April 15, 2026 (post-beta retrospective)
