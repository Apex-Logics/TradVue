# PRIVACY POLICY — TradVue | Last Updated: March 16, 2026

---

## Section 1. Introduction

This Privacy Policy explains how Apex Logics LLC, a Florida limited liability company doing business as TradVue ("TradVue," "we," "us," or "our"), collects, uses, stores, shares, and protects information about you when you use the TradVue platform at tradvue.com and any associated applications (collectively, the "Service").

TradVue is committed to protecting your privacy and handling your personal information with transparency and care. By creating an account or using the Service, you agree to the collection and use of your information as described in this Privacy Policy.

This Privacy Policy is incorporated into and forms part of our Terms of Service.

> For data protection inquiries, contact us at: privacy@tradvue.com

---

## Section 2. Information We Collect

We collect the following categories of information:

### 2.1 Account Information

When you register for TradVue, we collect:

- Full name — to personalize your account.
- Email address — for account authentication, transactional communications, and support.
- Password — stored as a one-way cryptographic hash using bcrypt via Supabase Auth. We never store, access, or transmit your plaintext password.

### 2.2 Trading Data

The core content you create and store in TradVue, including:

- Trade records (instrument, date, price, quantity, direction, entry/exit times, profit/loss)
- Journal entries and trade notes
- Tags and custom trade labels
- Portfolio holdings and position snapshots
- Historical transaction data
- Playbook entries (strategy templates)
- Post-Trade Ritual responses

> **This data belongs to you.** See Section 9 (Your Rights and Choices) for export and deletion options.

### 2.3 Market Data Preferences

- Watchlists and instruments you track
- Price alert configurations
- Dashboard layout and settings preferences

### 2.4 Anonymous Visitors vs. Account Holders

TradVue distinguishes between anonymous visitors and registered account holders for data collection purposes:

- **Anonymous Visitors (no account):** When you access TradVue without creating an account, we may collect standard analytics data including page views, device type, browser type, and IP address for security and service improvement purposes. We do not store personal trade data, journal entries, or any personally identifiable information for anonymous visitors. Anonymous usage of publicly available features (dashboard, news, economic calendar, calculators, watchlist) does not result in storage of personal data on our servers.
- **Account Holders:** Once you create a free or paid account, we collect and store the full range of data described in this Section 2, including your account information, trading data, preferences, and usage data, as necessary to provide the Service.

### 2.5 Usage Data

When you use the Service, we automatically collect:

- IP address — for security, fraud prevention, and abuse detection.
- Device type and operating system — for compatibility and support.
- Browser type and version — for compatibility.
- Pages and features visited — to understand how the Service is used.
- Feature interaction data — which features you use, how often, and for how long.
- Referral URLs — how you arrived at the Service.
- Error logs — to diagnose and fix technical issues.

### 2.6 Payment Information

All payment processing is handled exclusively by **Stripe, Inc.** ("Stripe"), a PCI DSS Level 1-certified payment processor. TradVue:

- Does not collect, store, or process your credit card numbers, bank account numbers, or other payment card data.
- May retain records of subscription tier, billing dates, and transaction status for account management purposes.
- May receive from Stripe a tokenized payment method identifier (not the card number itself) for managing recurring subscriptions.

### 2.7 Broker Sync Data (Future Feature)

If and when TradVue offers automated broker synchronization, and you choose to connect a brokerage account:

- We will collect trade history, account balances, and position data from connected brokerages through our third-party aggregator.
- Connecting a brokerage account is entirely voluntary.
- Your brokerage credentials are never stored by TradVue.

### 2.8 Communications

If you contact TradVue support or send us an email, we retain the content of your communications to respond to you and improve our support.

---

## Section 3. How We Use Your Information

We use the information we collect for the following purposes:

### 3.1 Service Delivery

To provide, operate, and maintain the TradVue platform; to process your trades, journal entries, and analytics; to deliver the features described in our Terms of Service.

### 3.2 AI Coach Features

When you use AI Coach, relevant trade data and journal entries are transmitted to OpenAI's API for processing and analysis. See Section 5.10 (OpenAI and AI Coach) for important details.

### 3.3 Account Management

To create and manage your account, process subscriptions and billing (via Stripe), and send transactional communications such as billing receipts, password resets, and subscription notices.

### 3.4 Customer Support

To respond to your questions, troubleshoot issues, and provide technical support.

### 3.5 Service Improvement

To analyze aggregate usage patterns, understand how features are used, and improve the Service. We use Google Analytics (GA4) for this purpose.

### 3.6 Security and Fraud Prevention

To detect, investigate, and prevent fraudulent transactions, abuse, security breaches, and other potentially illegal activity.

### 3.7 Legal Compliance

To comply with applicable laws, regulations, court orders, and legal process; to enforce our Terms of Service and other agreements.

### 3.8 Communications

To send you service-related notices and, where you have opted in, product updates or newsletters. You may opt out of marketing communications at any time.

### 3.9 Aggregated Analytics

To generate aggregated, de-identified, and anonymized statistics about platform usage. This data does not identify individual users.

> **We do NOT sell your personal data to third parties. Ever.**

---

## Section 4. Legal Bases for Processing (GDPR)

If you are located in the European Economic Area (EEA) or United Kingdom, we process your personal data under the following legal bases under GDPR:

| Purpose | Legal Basis |
|---|---|
| Providing the Service | Performance of a contract (Art. 6(1)(b)) |
| Account management and billing | Performance of a contract (Art. 6(1)(b)) |
| Analytics and improvement | Legitimate interests (Art. 6(1)(f)) |
| Marketing (opt-in only) | Consent (Art. 6(1)(a)) |
| Security and fraud prevention | Legitimate interests (Art. 6(1)(f)) |
| Legal compliance | Legal obligation (Art. 6(1)(c)) |
| AI Coach processing | Consent (Art. 6(1)(a)) — you may opt out at any time |

---

## Section 5. Third-Party Service Providers

We share your information with the following categories of third-party service providers who process data on our behalf:

### 5.1 Render (Backend Hosting)

Our backend application and API servers are hosted on Render. Your data transits through and is processed on Render's infrastructure.

### 5.2 Vercel (Frontend Hosting)

Our web application frontend is hosted on Vercel. Vercel may log access data (IP address, request metadata) in the ordinary course of providing hosting services.

### 5.3 Supabase / Amazon Web Services (Database)

Your account data and trade records are stored in a PostgreSQL database hosted by Supabase, which runs on Amazon Web Services (AWS). Data is encrypted at rest and protected by Row Level Security (RLS) policies. Data is stored in the United States.

### 5.4 Cloudflare (CDN and Security)

All traffic to TradVue passes through Cloudflare's network, which provides content delivery, DDoS protection, bot management, and Web Application Firewall (WAF) services.

### 5.5 Stripe (Payment Processing)

Subscription payments are processed exclusively by Stripe. Stripe is PCI DSS Level 1 certified. TradVue never handles your raw payment card data.

### 5.6 Resend (Transactional Email)

Transactional emails (account verification, password reset, billing notices) are delivered through Resend's email delivery service.

### 5.7 Google Analytics (GA4)

We use Google Analytics 4 to analyze how users interact with the Service. Google Analytics does **not** receive or process your trade data, account details, or personal financial information. It receives only standard browsing analytics.

### 5.8 Alpaca Markets, Marketaux, Finnhub (Market Data)

These providers supply market data displayed on the TradVue platform. We do not share your personal trade data with these providers.

### 5.9 SnapTrade (Broker Aggregation — Future Feature)

If and when TradVue enables broker account synchronization, we intend to use SnapTrade as our broker aggregation provider. This feature is not yet active. We will update this Policy before enabling it.

### 5.10 OpenAI (AI Coach Feature)

> **IMPORTANT — AI COACH DATA PROCESSING:**
>
> When you use the AI Coach feature, your trade data (including trade records, journal entries, and notes that you submit for analysis) is transmitted to **OpenAI's API** for processing. OpenAI's API is used to generate analytical insights about your trading patterns.
>
> **Key disclosures:**
>
> - Your trade data may be sent to OpenAI's servers for processing.
> - According to OpenAI's API usage policies, data sent through the API is **not used to train OpenAI's models** and is not retained beyond the processing of each request (subject to OpenAI's current terms and policies).
> - OpenAI's Privacy Policy and API Usage Policies govern OpenAI's handling of data received through the API.
> - TradVue transmits only data relevant to the analysis you request.
> - **You can opt out of AI Coach features at any time** through your account settings.

---

## Section 6. Cookies and Tracking Technologies

We use cookies and similar tracking technologies. For details, please see our Cookie Policy.

---

## Section 7. Data Security

We implement commercially reasonable administrative, technical, and organizational security measures designed to protect your personal information, including:

- **Encryption in Transit:** All data transmitted between your browser and TradVue is encrypted using TLS.
- **Encryption at Rest:** Your data stored in Supabase/AWS is encrypted at rest.
- **Password Hashing:** Passwords are hashed using bcrypt via Supabase Auth. We never store plaintext passwords.
- **Row Level Security (RLS):** Supabase RLS policies ensure users can only access their own data.
- **Rate Limiting:** API rate limiting is enforced to prevent abuse and credential stuffing attacks.
- **Cloudflare WAF:** A Web Application Firewall is deployed at the network edge.
- **Security Audits:** We conduct periodic security reviews of our infrastructure and code.

> **No system is completely secure.** While we take reasonable precautions, we cannot guarantee absolute security.

---

## Section 8. Data Retention

| Data Category | Retention Period |
|---|---|
| Account and trading data (active account) | Retained while account is active |
| Account and trading data (after deletion) | Removed from active systems within approximately 90 days using commercially reasonable efforts |
| Encrypted backup copies | Purged in the ordinary course of backup rotation (retained for a reasonable period) |
| Usage and access logs | Up to 12 months |
| Payment records | As required by applicable tax and financial law |
| Cookies | Per Cookie Policy |
| Aggregated/anonymized analytics | Indefinitely (not linked to individuals) |

> **Important:** We do not guarantee permanent retention of your data. You are responsible for maintaining your own backups. See Section 9 for how to export your data.

We may retain data for longer periods where required by applicable law or for the establishment, exercise, or defense of legal claims.

**8.A Inactive Accounts.** An account is considered inactive if no login activity has occurred for twelve (12) consecutive months. TradVue reserves the right to delete User Data associated with inactive accounts after providing thirty (30) days written notice to the email address on file. If the account holder does not respond or log in within the notice period, data may be permanently deleted. TradVue is not responsible for any data loss resulting from account inactivity.

> **8.B Free Tier Data Disclaimer.**
>
> DATA STORED UNDER FREE-TIER ACCOUNTS IS PROVIDED ON A BEST-EFFORT BASIS. TRADVUE SHALL NOT BE LIABLE FOR ANY LOSS, CORRUPTION, OR UNAVAILABILITY OF DATA ASSOCIATED WITH FREE-TIER ACCOUNTS. Free-tier users are solely responsible for maintaining their own backup copies of any data they input into TradVue. For enhanced data protection and reliability, consider upgrading to a paid subscription plan.

---

## Section 9. Your Rights and Choices

### 9.1 Access and Portability

You have the right to access the personal information we hold about you. You may export your trade data at any time through the data export feature in your account settings. To request a copy of your personal account information, contact privacy@tradvue.com.

### 9.2 Correction

You may update your account information directly in your account settings. For other corrections, contact privacy@tradvue.com.

### 9.3 Deletion

You may delete your account at any time through your account settings or by contacting privacy@tradvue.com. See Section 8 for retention timelines after deletion.

### 9.4 Opt-Out of Marketing

You may opt out of marketing or promotional emails at any time by clicking the unsubscribe link in any marketing email or by contacting support@tradvue.com.

### 9.5 AI Coach Opt-Out

You may disable AI Coach features in your account settings. Disabling AI Coach will prevent your trade data from being sent to OpenAI.

### 9.6 Cookie Management

You may manage cookie preferences through your browser settings or our cookie consent tool. See our Cookie Policy for details.

---

## Section 10. Rights for EU/EEA Users (GDPR)

If you are located in the European Economic Area, United Kingdom, or Switzerland, you have the following rights:

- **Right of Access:** Request a copy of your personal data.
- **Right of Rectification:** Request correction of inaccurate or incomplete data.
- **Right to Erasure ("Right to be Forgotten"):** Request deletion of your personal data, subject to legal obligations.
- **Right to Data Portability:** Receive your data in a structured, machine-readable format.
- **Right to Restrict Processing:** Request that we limit the processing of your data.
- **Right to Object:** Object to processing based on legitimate interests.
- **Right to Withdraw Consent:** Withdraw consent at any time without affecting prior processing.
- **Right to Lodge a Complaint:** Lodge a complaint with your local supervisory authority.

> To exercise your GDPR rights, contact: privacy@tradvue.com. We will respond within thirty (30) days.

---

## Section 11. Rights for California Residents (CCPA/CPRA)

If you are a California resident, you have the following rights:

### 11.1 Right to Know

Request disclosure of: categories of personal information we collect; sources; business purpose; categories of third parties; and specific pieces of personal information we hold about you.

### 11.2 Right to Delete

Request deletion of personal information we have collected from you, subject to certain exceptions.

### 11.3 Right to Correct

Request correction of inaccurate personal information.

### 11.4 Right to Opt-Out of Sale or Sharing

TradVue does **not** sell your personal information. TradVue does **not** share your personal information for cross-context behavioral advertising.

### 11.5 Right to Non-Discrimination

We will not discriminate against you for exercising any CCPA rights.

> To exercise your CCPA rights, contact: privacy@tradvue.com. We will respond within forty-five (45) days.

---

## Section 12. Children's Privacy

**12.1** TradVue is not directed to individuals under the age of 18. We do not knowingly collect personal information from anyone under 18 years of age.

**12.2 COPPA Compliance.** We do not knowingly collect personal information from children under 13.

**12.4** If you believe a child has provided us with personal information, please contact privacy@tradvue.com and we will take immediate steps to delete that information.

---

## Section 13. International Data Transfers

**13.1** TradVue's primary data storage is located in the United States (via Supabase/AWS). By using the Service from outside the United States, you understand that your information will be transferred to and processed in the United States.

**13.2 EU/EEA Transfers.** For transfers of personal data from the EU/EEA to the United States, we rely on Standard Contractual Clauses (SCCs) approved by the European Commission. Copies are available upon request at privacy@tradvue.com.

**13.3 UK Transfers.** For transfers from the United Kingdom, we rely on the UK International Data Transfer Agreement (IDTA) or UK-approved standard contractual clauses as applicable.

---

## Section 14. Do Not Track

We respect Do Not Track (DNT) signals. When your browser sends a Do Not Track signal, we will:

- Disable non-essential analytics tracking (Google Analytics);
- Continue to operate essential cookies necessary for the Service to function.

---

## Section 15. Data Breach Notification

In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will:

- **GDPR:** Notify the relevant supervisory authority within seventy-two (72) hours where required, and notify affected individuals without undue delay.
- **U.S. State Laws:** Notify affected individuals and state attorneys general in accordance with applicable state data breach notification laws.

---

## Section 16. Changes to This Privacy Policy

**16.1** We may update this Privacy Policy from time to time. For material changes, we will:

- Post the updated Policy at tradvue.com/legal/privacy with a new "Last Updated" date;
- Send an email notification at least thirty (30) days before the effective date.

**16.3** Your continued use of the Service after the effective date constitutes your acceptance of the changes.

---

## Section 17. Contact Information

**Apex Logics LLC d/b/a TradVue**
1935 Commerce Lane, Suite 9
Jupiter, FL 33458

- Privacy inquiries: privacy@tradvue.com
- Legal inquiries: legal@tradvue.com
- Security reports: security@tradvue.com
- Website: https://tradvue.com

Response time: within 30 days for GDPR requests; within 45 days for CCPA requests.

Apex Logics LLC, FL Doc# L23000460971, DBA Reg# G26000036763, EIN 93-3771291.
Effective Date: March 16, 2026

---

> **ACKNOWLEDGMENT:** By using TradVue, you acknowledge that you have read and understood this Privacy Policy and consent to the data practices described herein.

---

© 2026 TradVue — Operated by Apex Logics LLC
