# Brokerage Integration Research for TradVue

**Document Date:** March 2026  
**Status:** Research & Planning (Pre-MVP)  
**Purpose:** Evaluate brokerage integration options for future TradVue features

---

## Executive Summary

This document evaluates six major brokerages for potential API integration with TradVue, a charting and trading analytics platform. The analysis covers API capabilities, authentication methods, regulatory requirements, and recommendations for MVP implementation.

**Key Finding:** Alpaca and Tradier are best positioned for MVP integration due to superior API documentation, OAuth2 support, and transparent rate limits. TD Ameritrade/Schwab integration is possible but requires partnership with Schwab. E*TRADE and Interactive Brokers offer comprehensive features but with steeper compliance complexity.

---

## 1. API AVAILABILITY & AUTHENTICATION

### 1.1 Alpaca
**Status:** ✅ Public API (Fully Available)  
**URL:** https://docs.alpaca.markets/docs/  
**Authentication:** OAuth2 + API Key  
**Account Types:** Brokerage & Broker API (white-label)

**Key Features:**
- OAuth2 integration for user accounts
- Broker API for building trading platforms
- REST & WebSocket support
- Market data included (stocks & crypto)
- Paper trading environment for testing

**Rate Limits:** 
- Standard: 200 requests/minute (data), 15 orders/minute (trading)
- Adjustable via tier upgrade

**Cost:** 
- Free tier available for individuals
- Commission-free trading (stocks/options/crypto)
- Premium tiers for higher volume traders

---

### 1.2 Interactive Brokers (IBKR)
**Status:** ⚠️ API Available (Limited Public Access)  
**Documentation:** https://www.interactivebrokers.com/api/  
**Authentication:** API Key + Session Token  
**Account Types:** Professional/Retail Trading

**Key Features:**
- Comprehensive trading API (Trader Workstation)
- Read/write access to positions, orders, executions
- Real-time market data available
- Futures, options, forex, crypto support
- Desktop gateway application required

**Rate Limits:** 
- Variable by subscription level
- Real-time data requires subscription ($10-20/month per market)

**Cost:** 
- Account minimum: $500-2000 depending on account type
- Maintenance fees: $10/month (waived with $25K+ AUM)
- Data subscription fees required for real-time quotes
- Tiered commission structure (lower for active traders)

**Integration Complexity:** High (requires Trader Workstation gateway)

---

### 1.3 TD Ameritrade / Charles Schwab
**Status:** ⚠️ API Transitioning to Schwab Unified Platform  
**URL:** https://developer.schwab.com/  
**Authentication:** OAuth2 (in transition)  
**Account Types:** Individual & Professional Trading

**History & Status:**
- TD Ameritrade API being migrated to Schwab infrastructure
- Schwab acquired TD Ameritrade in 2020, consolidation in progress
- Existing integrations work but new sign-ups directed to Schwab API

**Schwab Unified API Features:**
- Account access & position management
- Order placement & order history
- Quote data & streaming
- OAuth2 flow (user consent)
- REST API with WebSocket support

**Rate Limits:** 
- 120 requests/minute for most endpoints
- Streaming connections: 10 concurrent per account

**Cost:** 
- No account minimum (changed in 2020s)
- Commission-free equities trading
- Market data: Free basic data, premium real-time available
- API access: Free for individual developers

**Documentation Quality:** Good but migration period creates some confusion

---

### 1.4 Tradier
**Status:** ✅ Public API (Fully Available)  
**URL:** https://tradier.com/api  
**Authentication:** OAuth2 + Bearer Token  
**Account Types:** Sandbox & Live Trading

**Key Features:**
- Simple, clean REST API
- OAuth2 standard implementation
- Sandbox environment for testing
- Market data included (real-time delayed)
- Order management (equities, options, futures)
- Account statements & position history

**Rate Limits:** 
- Sandbox: 20 requests/second
- Production: 10 requests/second per API key
- Burst allowance: Up to 20 requests/second

**Cost:** 
- Sandbox account: Free
- Live trading: Commission-based ($5-10 per trade)
- No account minimum
- API access: Free (included in trading account)

**Documentation Quality:** Excellent - Clear, well-organized, actively maintained

---

### 1.5 E*TRADE
**Status:** ⚠️ API Available (Developer Registration Required)  
**URL:** https://developer.etrade.com/  
**Authentication:** OAuth (Proprietary Implementation)  
**Account Types:** Individual & Professional Trading

**Key Features:**
- Account access & portfolio management
- Order placement & management
- Real-time quotes & streaming (delayed)
- Account statements & tax data
- Options trading support

**Rate Limits:** 
- Request throttling: 120 requests/minute per session
- Batch operations: Limited per request type

**Cost:** 
- Account access: Free (must have E*TRADE account)
- Commission-free equities & options (for eligible accounts)
- Market data: Included (real-time with subscription)
- Developer registration: Free but requires approval

**Integration Complexity:** Medium - Proprietary OAuth flow, requires developer approval

**Note:** E*TRADE is owned by Morgan Stanley; APIs managed separately from consumer trading platform

---

### 1.6 Robinhood
**Status:** ❌ No Public API Available  
**URL:** None (Unofficial community APIs exist)  
**Account Types:** Individual Trading (App Only)

**Current Status:**
- Robinhood has NOT released official public API
- Unofficial reverse-engineered APIs exist but:
  - Violate Terms of Service
  - Unsupported and subject to breaking changes
  - Risk account termination
  - No SLA or documentation

**Why No API?**
- Robinhood's business model relies on payment-for-order-flow (PFOF)
- Public API would complicate monetization strategy
- Competition with retail trading apps

**Recommendation:** **Do not pursue Robinhood integration** unless official API becomes available

---

## 2. FEATURE CAPABILITIES BY BROKER

### Feature Matrix

| Feature | Alpaca | IBKR | Schwab | Tradier | E*TRADE | Robinhood |
|---------|--------|------|--------|---------|---------|-----------|
| **Read Positions** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Place Orders** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Cancel Orders** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Real-time Quotes** | ✅ | ✅* | ✅ | ⚠️ | ✅* | ❌ |
| **Order History** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Account Data** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **OAuth2** | ✅ | ❌ | ✅ | ✅ | ⚠️ | ❌ |
| **Crypto Trading** | ✅ | ⚠️ | ❌ | ⚠️ | ❌ | ❌ |
| **Options Trading** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Futures Trading** | ⚠️ | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| **Sandbox/Paper** | ✅ | ❌ | ⚠️ | ✅ | ❌ | ❌ |

\* = Requires subscription

---

## 3. ENABLING FEATURES FOR TRADVUE

### 3.1 Position Import to Watchlist
**Difficulty:** Easy-Medium  
**Prerequisites:** Read-only account access, OAuth2 or API key

**Implementation Path:**
1. Authenticate user via OAuth2 flow
2. Fetch `/accounts/{id}/positions` endpoint
3. Parse holdings into watchlist format
4. Store symbol, shares, entry price, current value
5. Sync on-demand or scheduled (e.g., daily)

**Brokers Best Suited:** Alpaca, Schwab, Tradier (best documentation)

**Timeline:** 1-2 weeks per broker

---

### 3.2 P&L Dashboard Integration
**Difficulty:** Easy  
**Prerequisites:** Position history, real-time quotes

**Implementation Path:**
1. Calculate unrealized P&L from positions + current quotes
2. Fetch order history for trades with entry prices
3. Calculate realized P&L from closed positions
4. Display portfolio metrics: total return %, daily change, etc.
5. Aggregate across broker accounts if multi-broker

**Brokers Best Suited:** All major brokers support this

**Data Sources:**
- Positions endpoint → Current holdings
- Orders endpoint → Trade history
- Quotes API → Real-time/delayed pricing

**Timeline:** 2-3 weeks integration + testing

---

### 3.3 One-Click Trade from TradVue
**Difficulty:** Medium-Hard  
**Prerequisites:** Trading API access, OAuth2 with trading scopes

**Security Considerations:** ⚠️ HIGH RISK
- Requires write access to user accounts
- Must implement order preview/confirmation UI
- Consider 2FA for sensitive operations
- Need clear risk disclaimers

**Implementation Path:**
1. Authenticate with `trading` scope in OAuth2
2. Build order builder UI in TradVue
3. Pass symbol, qty, order type to `/v1/orders` endpoint
4. Return order confirmation with ID
5. Support stop-loss / take-profit orders
6. Track order status via WebSocket (if available)

**Brokers Supporting This:**
- ✅ Alpaca (best SDK support)
- ✅ Schwab (good documentation)
- ✅ Tradier (well-documented)
- ⚠️ E*TRADE (proprietary API)

**Timeline:** 3-4 weeks (includes testing, security review)

**Note:** This feature requires careful compliance review (see Section 4)

---

### 3.4 Alert Sync with Broker Orders
**Difficulty:** Medium  
**Prerequisites:** Webhook support or polling infrastructure

**Implementation Path:**
1. User sets price alert in TradVue (e.g., "notify if SPY > $450")
2. Alert triggers TradVue order placement
3. TradVue places order via broker API
4. Broker confirms order status
5. Sync status back to TradVue alerts dashboard

**Alternative: Broker-Native Alerts**
- Some brokers support alert APIs (Schwab, Tradier)
- Could create alerts directly on broker account
- Reduces infrastructure load on TradVue

**Brokers with Alert APIs:**
- Tradier: ✅ Native alert endpoint
- Schwab: ⚠️ Limited alert API
- Alpaca: ✅ Conditional order support

**Timeline:** 2-3 weeks

---

### 3.5 Portfolio Analytics
**Difficulty:** Medium-Hard  
**Prerequisites:** Full account data, historical data, multi-account support

**Possible Analytics:**
- Sector allocation (pie chart)
- Risk analysis (beta, correlation)
- Performance attribution (which trades drove returns)
- Tax-loss harvesting opportunities
- Dividend income tracking

**Data Requirements:**
- Current positions (symbol, shares, cost basis)
- Historical pricing for analysis
- Options positions (Greeks, margin impact)
- Cash flows (deposits, withdrawals)
- Dividends received

**Brokers with Best Analytics Support:**
- Interactive Brokers (most detailed data)
- Schwab (improving platform, good data)
- Alpaca (good API, needs custom analytics layer)

**Timeline:** 4-6 weeks (most complex feature)

---

## 4. REGULATORY & COMPLIANCE CONSIDERATIONS

### 4.1 Do We Need Broker-Dealer Registration?

**Short Answer:** Possibly, depends on scope of features.

**Analysis:**

**If TradVue ONLY provides read-only features:**
- ✅ NO broker-dealer registration needed
- Only act as information provider / analytics tool
- Users maintain full control of accounts at brokers

**If TradVue enables order placement (One-Click Trade):**
- ⚠️ GRAY AREA - Depends on implementation
- **Scenario 1:** User logs in, TradVue transmits pre-approved order
  - Likely: Not BD registration (user's broker executes)
  - TradVue = order routing tool
- **Scenario 2:** TradVue accumulates orders, executes in batches
  - Likely: **YES, BD registration required**
  - TradVue = acting as intermediary
- **Scenario 3:** TradVue acts on user's behalf without direct instruction
  - **DEFINITELY YES, BD registration + RIA registration required**
  - High legal risk

**Recommendation for MVP:**
- Keep order placement as "transmit-only" (user confirms each trade)
- Do NOT batch orders or execute on behalf of users
- Add explicit disclosure: "TradVue does not execute trades; orders are routed to [BROKER]"

---

### 4.2 SEC/FINRA Requirements for Trade Integration

**Key Regulations:**

| Regulation | Applies To | Requirement |
|-----------|-----------|------------|
| SEC Rule 10b5-1 | Algorithmic trading | Disclosure if TradVue runs auto-trading algorithms |
| SEC Rule 10b5-2 | Trading under plans | TradVue cannot control trading plan execution without written agreement |
| FINRA Rule 5210 | Anti-money laundering | Know-Your-Customer (KYC) compliance for trading activity |
| FINRA Rule 2010 | Standards of conduct | Suitability of recommendations if TradVue provides trading signals |
| SEC Rule 203A | Investment advice | If TradVue gives trading recommendations, may need RIA registration |

**For MVP (Read-Only + Manual Order Transmission):**
- ✅ No SEC registration needed
- ✅ No FINRA registration needed
- ⚠️ Still need AML/KYC monitoring if handling user data

**For Full Feature Set (Auto-Trading):**
- ❌ Likely requires SEC broker-dealer registration ($250K+ in capital)
- ❌ Likely requires FINRA membership ($50K+ in setup + annual fees)
- ❌ Requires RIA registration for advisory features ($150K+ legal + compliance)

---

### 4.3 Disclosure Requirements

**Required Disclosures (FINRA/SEC guidance):**

1. **Service Limitations**
   - "TradVue is a charting tool, not a broker or financial adviser"
   - "Orders are routed directly to [BROKER], which executes your trades"

2. **Conflict of Interest**
   - If TradVue monetizes order flow or receives rebates
   - Any revenue sharing with brokers

3. **Data Privacy**
   - How user data is stored and protected
   - Who has access to trading data
   - Retention policies for account/order information

4. **Trading Risks**
   - Market risk, execution risk, connectivity risk
   - Past performance ≠ future results
   - Leverage/margin risks if supported

5. **System Risk**
   - Latency disclosures (orders may not execute at displayed price)
   - Downtime risk (what happens if TradVue goes offline)
   - Third-party dependency (reliance on broker APIs)

---

### 4.4 Data Handling Rules

**Personal Financial Information (PFI) Protection:**

| Data Type | Handling Rules |
|-----------|---------------|
| Account credentials/API keys | Encrypt at rest, never log, rotate regularly |
| Positions & holdings | Treat as PFI, encrypt in database, access logs |
| Trade history | PFI, retain only as long as needed |
| Performance data | Can be anonymized for analytics |
| User behavior/alerts | Track for service improvement, anonymize if possible |

**Best Practices:**
- Use vault/secrets manager for API keys (never commit to code)
- Implement audit logging for all account data access
- SOC 2 Type II compliance recommended
- Data residency: Keep data in same region as broker (e.g., US brokers = US data centers)
- Liability insurance: Errors & Omissions (E&O) coverage recommended

---

## 5. RECOMMENDED MVP APPROACH

### 5.1 MVP Scope: Features & Brokers

**Phase 1: Read-Only (Months 1-3)**
- [x] Position import to watchlist
- [x] P&L dashboard
- [x] Historical order viewing
- [x] Portfolio visualization

**Target Broker(s):** Alpaca or Tradier
- Reasons: Best APIs, excellent documentation, easiest OAuth2 integration, fastest implementation

**Timeline:** 6-10 weeks for single broker, +2-3 weeks per additional broker

**Team Size:** 1-2 engineers + 1 legal/compliance review

---

### 5.2 Phase 2: One-Click Trading (Months 4-6) - CONDITIONAL

**Decision Gate:** Only proceed if:
- ✅ Legal review confirms no BD registration needed for order routing
- ✅ Customer demand validated (50+ users request this feature)
- ✅ Engineering capacity available

**Feature:** User-initiated order transmission
- User clicks "Buy SPY 100 shares at market"
- TradVue opens order preview modal
- User confirms with password or 2FA
- TradVue transmits order to broker API
- Broker executes; TradVue displays confirmation

**Target Broker(s):** Same as Phase 1 (Alpaca or Tradier)

**Timeline:** 4-6 weeks

**Compliance Requirements:**
- Legal opinion letter from securities counsel
- Liability insurance (E&O policy, $1M-5M recommended)
- Updated ToS with trading disclaimers
- Monitoring system for suspicious trading patterns

---

### 5.3 Why NOT Start with Others

| Broker | Why Not for MVP | Alternative Use |
|--------|-----------------|-----------------|
| **Interactive Brokers** | High integration complexity, requires local gateway, data subscription costs | Phase 3+ (advanced traders, pros) |
| **Schwab** | Migrating APIs, documentation unclear during transition | Phase 2+ (wait for consolidation) |
| **E*TRADE** | Proprietary OAuth, requires developer approval, longer onboarding | Phase 2+ (legacy user support) |
| **Robinhood** | No official API, high risk of ToS violation | Never (unless API released) |

---

## 6. PARTNERSHIP & COMMERCIALIZATION

### 6.1 Alpaca: Path to Partnership

**Current Status:** Public API, self-service

**Partnership Opportunities:**
- **White-Label Broker API:** Could become broker for TradVue users
  - Alpaca handles regulatory compliance
  - TradVue handles UX/charting
  - Revenue split: 30-50% to Alpaca
  - Timeline: 6-12 months negotiation

- **Revenue Share:** Per-trade fees from Alpaca
  - Typical: $0.50-$2 per trade
  - Incentive: Execute on Alpaca platform

**Contacts:** partnerships@alpaca.markets

---

### 6.2 Tradier: Path to Partnership

**Current Status:** Public API, commission-based

**Partnership Opportunities:**
- **Affiliate Program:** Refer customers to Tradier
  - Commission: 20-30% of customer fees
  - Passive revenue, no integration changes needed

- **API Tier Upgrade:** Get priority support, higher rate limits
  - Cost: $100-500/month depending on volume
  - Benefit: Better support for custom integration

**Contacts:** sales@tradier.com or support@tradier.com

---

### 6.3 Schwab: Enterprise Integration

**Requirements for Schwab Integration:**
- Established business (typically 100+ customers)
- Signed Schwab API agreement
- Compliance audit by Schwab
- Revenue-sharing agreement

**Timeline:** 3-6 months from application to live API

**Contact:** Schwab Developer Relations (via developer.schwab.com)

---

## 7. TIMELINE & RESOURCE ESTIMATES

### 7.1 Single-Broker MVP (Alpaca or Tradier)

| Phase | Task | Weeks | FTE |
|-------|------|-------|-----|
| **Planning** | Determine scope, legal review | 2 | 0.5 |
| **Development** | API integration, OAuth2, data models | 4-5 | 1 |
| **Testing** | Unit tests, integration tests, UAT | 2 | 1 |
| **Compliance** | Final legal review, ToS updates | 1-2 | 0.5 |
| **Launch** | Documentation, customer comms | 1 | 0.5 |
| **Total** | | **10-12 weeks** | **1 FTE** |

---

### 7.2 Multi-Broker Support (2-3 brokers)

| Phase | Task | Weeks | Notes |
|-------|------|-------|-------|
| **First Broker** | Full MVP | 10-12 | Alpaca recommended |
| **Second Broker** | Adapt existing integration | 4-6 | Tradier or Schwab |
| **Third Broker** | Additional adapter | 3-5 | E*TRADE if needed |
| **Total** | | **17-23 weeks** | 1-1.5 FTE |

---

### 7.3 Full Feature Set (Positions, P&L, One-Click Trading)

| Component | Weeks | FTE | Notes |
|-----------|-------|-----|-------|
| Phase 1: Positions & P&L | 6-8 | 1 | With single broker |
| Phase 2: Order Routing | 4-6 | 1 | Requires legal review |
| Phase 3: Advanced Analytics | 6-8 | 1-2 | Multi-asset, tax tracking |
| Phase 4: Compliance/Security | 2-4 | 0.5 | Audit, insurance, monitoring |
| **Total** | **18-26 weeks** | **1.5-2 FTE** | 6 months, 2 engineers |

---

## 8. FINAL RECOMMENDATIONS

### 8.1 MVP Strategy: Start with Alpaca

**Why Alpaca:**
1. ✅ Best API documentation (exceeds industry standard)
2. ✅ Transparent, simple OAuth2 flow
3. ✅ No partnership negotiation needed (public API)
4. ✅ Sandbox environment for testing
5. ✅ Fast integration possible (2-3 weeks)
6. ✅ Low compliance risk (order routing only)
7. ✅ Active community, good support

**Scope:** Position import + P&L dashboard (read-only)

**Timeline:** 10 weeks to launch

**Team:** 1 backend engineer + 1 QA + legal review (0.5 FTE)

---

### 8.2 Roadmap for Year 1

**Q1 2026:** Alpaca integration (positions, P&L, order history)
- Launch with early beta users
- Validate feature demand
- Gather feedback on UX

**Q2 2026:** Add one-click order routing (if legal clear)
- Implement order transmission (NO auto-trading)
- User testing in beta group
- Security audit

**Q3 2026:** Expand to Tradier (second broker)
- Reuse Alpaca integration pattern
- Support users with Tradier accounts
- Evaluate Schwab migration

**Q4 2026:** Advanced features (selective)
- Alert integration (Tradier platform alerts)
- Portfolio analytics starter pack
- Multi-broker aggregation

---

### 8.3 Long-Term Vision (Year 2+)

**Conditional on traction (1000+ active users):**

- **Schwab Integration:** After API consolidation complete (est. 2026-2027)
- **E*TRADE Support:** Legacy user segment, lower priority
- **Advanced Analytics:** Tax loss harvesting, rebalancing tools
- **White-Label:** Partnership with Alpaca or Tradier to become branded broker
- **Mobile Trading:** One-click orders from mobile charts

**DO NOT pursue:**
- ❌ Robinhood integration (no API)
- ❌ Automated trading (broker-dealer registration required)
- ❌ Algorithmic trading strategies (heavy regulatory burden)
- ❌ Options analytics (requires advanced compliance)

---

## 9. COMPLIANCE CHECKLIST

### For Phase 1 Launch (Read-Only Features)

- [ ] Legal review: Confirm no BD/RIA registration needed for TradVue
- [ ] Draft Terms of Service updates
  - [ ] Clear statement: "Not a broker, not a financial adviser"
  - [ ] Disclaimer on data timeliness (may be delayed)
  - [ ] Third-party broker handling execution
- [ ] Privacy policy review for CCPA/GDPR compliance
- [ ] API key/token security audit
  - [ ] Vault implementation for secrets
  - [ ] Audit logging for account access
  - [ ] Encryption of stored credentials
- [ ] Liability insurance: Errors & Omissions (E&O) policy
  - [ ] Covers cyber liability
  - [ ] Covers professional errors
  - [ ] Minimum $1M recommended

### For Phase 2 (Order Routing)

- [ ] Regulatory opinion letter from securities counsel
  - [ ] Order routing vs. order execution distinction clear
  - [ ] No broker-dealer registration triggered by feature
- [ ] Enhanced data security audit
  - [ ] Penetration testing
  - [ ] SOC 2 Type II assessment
- [ ] Compliance monitoring system
  - [ ] Pattern detection for wash sales, insider trading signals
  - [ ] Suspicious activity reporting capability
- [ ] Updated insurance: $5M+ E&O coverage recommended
- [ ] Customer suitability verification
  - [ ] Age verification (18+)
  - [ ] Accredited investor status (if limited to pros)

---

## 10. RISK ASSESSMENT

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| API breaking changes | Medium | High | Broker API versioning, monitoring, automated tests |
| Rate limit issues | Low | Medium | Queue management, exponential backoff |
| Data sync lag | Medium | Medium | Real-time WebSocket subscriptions where available |
| Account permission errors | Low | High | Comprehensive testing of OAuth scopes |

### Regulatory Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| SEC inquiry on trading features | Medium | Critical | Early legal opinion, conservative scope |
| Data breach/privacy lawsuit | Low | Critical | SOC 2 compliance, encryption, audit logging |
| Broker API changes | Medium | Medium | Multi-broker strategy reduces dependency |
| Customer disputes | Low | High | Clear documentation, liability insurance |

### Market Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Low customer adoption | Medium | High | Beta testing with target users before launch |
| Competitors (Robin, E*TRADE, Webull) | High | Medium | Focus on superior charting, analysis features |
| Broker consolidation | Low | Medium | Multi-broker approach, relationship building |

---

## 11. CONCLUSION

**Best Path Forward:**
1. ✅ **Start with Alpaca** for MVP (read-only)
2. ✅ **Add Tradier** as second broker for redundancy
3. ⚠️ **Evaluate Schwab** after 2026 API consolidation
4. ❌ **Skip Robinhood** (no API), **Skip E*TRADE** (until second wave)

**Key Success Factors:**
- Clean, simple OAuth2 implementation
- Strong legal foundation (board opinion letter)
- Conservative feature scope for launch
- Early partnership discussions with Alpaca/Tradier
- Customer feedback loop from beta users

**Estimated Cost to MVP:**
- Development: $80-120K (10 weeks, 1 FTE)
- Legal/Compliance: $20-40K (opinions, ToS, audit)
- Infrastructure/Ops: $5-10K (servers, monitoring, first year)
- Insurance: $3-8K (E&O policy, first year)
- **Total: $108-178K**

**Expected Timeline:** 10-12 weeks to Alpaca MVP launch

---

## Appendix: Resource Links

### API Documentation
- Alpaca: https://docs.alpaca.markets/
- Tradier: https://tradier.com/api
- Schwab Developer: https://developer.schwab.com/
- E*TRADE: https://developer.etrade.com/

### Regulatory References
- SEC Rule 10b5-1: https://www.sec.gov/rules/final/33-8611.htm
- FINRA Rule 5210 (AML): https://www.finra.org/rules-guidance/rulebooks/finra-rules/5210
- FINRA Rule 2010: https://www.finra.org/rules-guidance/rulebooks/finra-rules/2010

### Industry Standards
- OAuth 2.0: https://tools.ietf.org/html/rfc6749
- OpenAPI 3.0: https://spec.openapis.org/oas/v3.0.3
- SOC 2: https://www.aicpa.org/interestareas/informationmanagement/socialmediaadvisories/pages/soc-2.aspx

---

**Document Prepared By:** Zip (Research Agent)  
**Last Updated:** March 6, 2026  
**Next Review:** Q2 2026 (post-partner outreach)
