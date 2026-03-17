# ATTORNEY COVER LETTER — TradVue Legal Document Package

---

**Date:** March 16, 2026

**From:** Erick M. Ramdeholl, President
Apex Logics LLC d/b/a TradVue
1935 Commerce Lane, Suite 9
Jupiter, FL 33458

**To:** Counsel of Record
[Attorney Name]
[Firm Name]
[Address]

**Re:** Updated Legal Document Package for Review — TradVue Platform (tradvue.com)

---

Dear Counsel,

Please find enclosed an updated legal document package for TradVue, a software-as-a-service (SaaS) trading journal and analytics platform operated by Apex Logics LLC (FL Doc# L23000460971, DBA Reg# G26000036763, EIN 93-3771291). This package reflects significant revisions made on March 16, 2026, and is submitted for your review and comment prior to publication on the platform.

---

## Documents Included in This Package

The following five (5) legal documents are enclosed:

1. **Terms of Service** (`TERMS_OF_SERVICE.md`) — Primary user agreement governing access and use of the TradVue platform.
2. **Privacy Policy** (`PRIVACY_POLICY.md`) — Governs collection, use, storage, and disclosure of user personal information; includes GDPR and CCPA compliance sections.
3. **Disclaimer** (`DISCLAIMER.md`) — Investment risk, no-advice, regulatory status, and limitation of liability disclosures.
4. **Cookie Policy** (`COOKIE_POLICY.md`) — Discloses all cookies and tracking technologies in use; includes opt-out mechanisms.
5. **Acceptable Use Policy** (`ACCEPTABLE_USE_POLICY.md`) — Governs permitted and prohibited uses of the platform, including market manipulation, AI Coach misuse, and technical abuse prohibitions.

---

## Summary of Material Changes — March 16, 2026

The following material changes were made to the legal documents in this revision cycle. These changes are highlighted for your particular attention:

### 1. Three-Tier Access Model Defined (Terms of Service §2.1)

The platform's access model has been formally defined into three tiers:

- **No Account / Anonymous Access:** Dashboard market data, news feed, economic calendar, 30+ calculators, and watchlist. No personal data stored.
- **Free Account (with 3-week full trial):** All features during trial; after trial expiration, limited to 30-day rolling view window, limited CSV import/export, 3 price alerts, and community support. Data preserved.
- **Pro Subscription:** $24.00/month (monthly) or $16.80/month billed annually at $201.60/year.

*Attorney's attention is requested on the enforceability of the trial-to-free-tier downgrade mechanism and whether the free tier data restriction (locked but not deleted) requires additional disclosure.*

### 2. Section 4.1 Updated — Anonymous Access Explicitly Defined

Terms of Service §4.1 has been updated to explicitly enumerate which features are available without an account (dashboard, news feed, economic calendar, trading calculators, watchlist) and which require account creation (trading journal, portfolio tracker, playbooks, AI Coach, prop firm tracker, trade rules). This is intended to align the Terms with the actual product behavior and to clarify the scope of the "anonymous use" tier.

### 3. Section 13.5 Added — Inactive Accounts (12-Month Policy)

A new section has been added to address inactive accounts: accounts with no login activity for twelve (12) consecutive months are subject to data deletion after thirty (30) days written notice to the email on file. This policy has also been cross-referenced in Privacy Policy §8.A.

*Attorney's attention is requested: please review whether the 12-month inactivity threshold and 30-day notice period are reasonable and enforceable, and whether additional GDPR-specific notice requirements apply to EU users.*

### 4. Section 13.6 Added — Free Tier Data Best-Effort Disclaimer

A new ALL CAPS warning block has been added to Terms of Service §13.6 and cross-referenced in Privacy Policy §8.B, disclaiming TradVue's liability for data loss, corruption, or unavailability under free-tier accounts. Data stored under free-tier accounts is characterized as "best-effort basis" storage.

*Attorney's attention is requested: please confirm that this disclaimer is adequately prominent and whether a clickwrap acknowledgment at the point of free account creation would strengthen enforceability.*

### 5. Section 2.3 Updated — Uptime/Downtime Disclaimer

Terms of Service §2.3 has been updated to explicitly state that TradVue "is not liable for any downtime, service interruptions, or data unavailability, whether scheduled or unscheduled." This supersedes the prior language which was ambiguous regarding liability for maintenance windows.

### 6. Section 21 Added — Force Majeure Clause

A Force Majeure clause has been added as a new Section 21 to the Terms of Service. The clause covers natural disasters, pandemics, government actions, war, terrorism, cyberattacks, utility/infrastructure failures, and internet/telecommunications outages. TradVue commits to using "commercially reasonable efforts" to resume performance following cessation of a force majeure event.

*Attorney's attention is requested: please confirm the scope of force majeure events is appropriate and that the clause is sufficient to protect against liability arising from AWS/Supabase, Cloudflare, Vercel, or Render outages.*

### 7. Retention Timelines Softened to "Commercially Reasonable Efforts"

Throughout the Terms of Service (§13.1, §13.2) and Privacy Policy (§8), absolute deletion commitments have been softened to "commercially reasonable efforts" language to account for the practical realities of backup rotation and distributed infrastructure. The 90-day deletion timeline for active production systems is retained as a target, not a guarantee.

*Attorney's attention is requested: please review whether the "commercially reasonable efforts" standard is consistent with GDPR Article 5(1)(e) storage limitation obligations and CCPA deletion right requirements.*

### 8. Privacy Policy §8.A and §8.B Added

Two new subsections have been added to Privacy Policy Section 8 (Data Retention):

- **§8.A Inactive Accounts:** Cross-references the Terms of Service §13.5 inactive account policy, specifying 12-month inactivity threshold and 30-day notice before deletion.
- **§8.B Free Tier Data Disclaimer:** Cross-references the Terms of Service §13.6 disclaimer, confirming that free-tier data is stored on a best-effort basis in the Privacy Policy as well.

### 9. Pricing Confirmed

All pricing references have been confirmed and are consistent across all documents:

- Monthly Plan: **$24.00/month**
- Annual Plan: **$16.80/month** billed annually at **$201.60/year** (approximately 30% savings)

---

## Priority Items for Attorney Review

The following items are flagged as highest priority for legal review:

1. **AI Coach and Investment Adviser Classification Risk** — The AI Coach feature analyzes historical trade patterns and provides textual feedback (e.g., pattern analysis, behavioral insights). Please review whether any AI Coach output type could be characterized as "investment advice" under the Investment Advisers Act of 1940 or applicable state law, and advise on whether additional safeguards, modal acknowledgments, or feature restrictions are warranted.

2. **Arbitration Clause Enforceability (Terms §17)** — The Terms specify AAA Consumer Arbitration Rules for individual users and AAA Commercial Arbitration Rules for business accounts. Please advise on enforceability under Florida law and any federal consumer protection statutes, and confirm that the class action waiver in §17.4 is enforceable.

3. **GDPR Compliance — OpenAI Data Transfers** — The Privacy Policy (§5.10) discloses that user trade data is transmitted to OpenAI's API for AI Coach processing. Please advise on whether a Data Processing Agreement (DPA) with OpenAI is required under GDPR Article 28, and whether the current Standard Contractual Clauses (SCCs) framework adequately covers this transfer.

4. **Free Tier Data Retention and Inactive Account Policy** — Please advise on the interaction between the 12-month inactive account deletion policy (§13.5), the 30-day notice requirement, and GDPR/CCPA deletion right obligations.

5. **Auto-Renewal Compliance** — Please review Terms §5.3 and advise on compliance with state-specific auto-renewal laws, including California's Automatic Renewal Law (Cal. Bus. & Prof. Code § 17600 et seq.) and any applicable Florida statutes.

6. **DMCA Agent Registration** — Please confirm whether TradVue's designated DMCA agent (legal@tradvue.com) should be formally registered with the U.S. Copyright Office under 17 U.S.C. § 512(c)(2) and advise on the registration process if so.

---

## Internal Review Completed

Prior to transmittal to counsel, this document package was reviewed internally by:

- **Axle** (CEO Agent, Apex Logics LLC) — Reviewed for business accuracy, pricing consistency, and policy alignment.
- **Nova** (QA and Review Agent, Apex Logics LLC) — Conducted cross-reference audit of all five documents for internal consistency, legal terminology, and cross-document coherence. Nova's full audit report is enclosed as a separate document (`AUDIT_REPORT.md`).

---

## Requested Actions

We respectfully request that counsel:

1. Review all five (5) enclosed legal documents for enforceability under Florida law and applicable federal law.
2. Identify any provisions that may be unenforceable, ambiguous, or in need of strengthening.
3. Advise specifically on the priority items enumerated above.
4. Confirm whether any additional disclosures, registrations (e.g., DMCA agent), or user consent mechanisms are required.
5. Provide a redlined version of any suggested revisions.

Please do not hesitate to contact me directly at the information below with any questions.

---

Respectfully submitted,

**Erick M. Ramdeholl**
President, Apex Logics LLC d/b/a TradVue
1935 Commerce Lane, Suite 9
Jupiter, FL 33458
Email: legal@tradvue.com
Website: https://tradvue.com

Apex Logics LLC, FL Doc# L23000460971, DBA Reg# G26000036763, EIN 93-3771291.

---

*This letter and the enclosed documents are submitted for legal review and are subject to attorney-client privilege. Do not distribute without authorization.*

---

© 2026 TradVue — Operated by Apex Logics LLC
