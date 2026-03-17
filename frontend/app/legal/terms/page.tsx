import type { Metadata } from 'next'
import { LegalPage, Section, SubSection, UL, WarningBox, InfoBox, AcknowledgmentBox } from '../components'

export const metadata: Metadata = {
  title: 'Terms of Service — TradVue',
  description: 'Read the TradVue Terms of Service. By using our platform you agree to these terms.',
  alternates: {
    canonical: 'https://www.tradvue.com/legal/terms',
  },
  robots: 'noindex, follow',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="March 16, 2026">

      <WarningBox>
        <strong>PLEASE READ THESE TERMS OF SERVICE CAREFULLY. BY CREATING AN ACCOUNT OR USING THE TRADVUE PLATFORM, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE, DO NOT USE THE SERVICE.</strong>
      </WarningBox>

      <Section id="agreement" title="1. Agreement to Terms">
        <p>
          <strong>1.1 Acceptance.</strong> These Terms of Service ("Terms") constitute a legally binding agreement between you
          ("User," "you," or "your") and Apex Logics LLC, a Florida limited liability company doing business as TradVue
          ("TradVue," "we," "us," or "our"). By creating an account, clicking "I Agree," accessing, or using the TradVue
          platform at tradvue.com or any associated application (collectively, the "Service"), you acknowledge that you have
          read, understood, and agree to be bound by these Terms and our{' '}
          <a href="/legal/privacy" style={{ color: '#4a9eff' }}>Privacy Policy</a>,{' '}
          <a href="/legal/disclaimer" style={{ color: '#4a9eff' }}>Disclaimer</a>,{' '}
          <a href="/legal/cookies" style={{ color: '#4a9eff' }}>Cookie Policy</a>, and{' '}
          <a href="/legal/aup" style={{ color: '#4a9eff' }}>Acceptable Use Policy</a>{' '}
          (collectively, the "Agreement").
        </p>
        <p>
          <strong>1.2 Clickwrap Agreement.</strong> The act of creating an account constitutes your electronic signature and
          acceptance of these Terms. This clickwrap agreement is enforceable to the same extent as a handwritten signature
          under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and applicable state law.
        </p>
        <p>
          <strong>1.3 Updates.</strong> We may update these Terms from time to time. See Section 19 (Modification of Terms) for details.
        </p>
      </Section>

      <Section id="description" title="2. Service Description">
        <p>
          <strong>2.1 What TradVue Provides.</strong> TradVue is a software-as-a-service ("SaaS") trading journal and analytics
          platform that helps traders organize, analyze, and review their trading activity. The Service currently includes:
        </p>
        <UL items={[
          'Trade Journaling: Tools to log, tag, annotate, and organize trade records.',
          'Performance Analytics: Statistical analysis and visualization of trading performance, including win rate, profit/loss metrics, drawdown analysis, and other quantitative measures.',
          'Portfolio Tracking: Visualization of portfolio holdings and transaction history using market data from third-party providers.',
          'AI Coach: An AI-powered feature that analyzes your trade history and provides analytical insights. AI Coach is a journaling and analytical tool only. It does not provide investment advice, financial recommendations, or personalized trading guidance. See Section 8 for the full AI Coach disclaimer.',
          'Watchlists and Alerts: Tools to monitor securities of interest and receive notifications based on user-defined parameters.',
          'CSV Import and Broker Sync: Import of trade data via CSV files and, where supported, automated synchronization with brokerage accounts through third-party data aggregators.',
          'Playbooks: User-created strategy templates for documenting and following personal trading rules.',
          'Post-Trade Ritual: A guided trade review workflow to help users reflect on completed trades.',
          'Correlation Matrix: Visualization of correlations between instruments in a user\'s portfolio.',
          'Market Data Visualization: Charting and data displays powered by third-party market data providers.',
        ]} />
        <p>
          <strong>2.2 What TradVue Does NOT Provide.</strong> TradVue is expressly <strong>not</strong> a broker-dealer,
          investment adviser, financial planner, or portfolio manager. TradVue does NOT:
        </p>
        <UL items={[
          'Execute, route, or facilitate trades or orders in any securities or financial instruments;',
          'Provide investment advice, recommendations, or guidance to buy, sell, or hold any security;',
          'Act as a registered investment adviser under the Investment Advisers Act of 1940 or as a broker-dealer under the Securities Exchange Act of 1934;',
          'Manage, control, or exercise discretion over any user\'s portfolio or funds;',
          'Guarantee any trading outcomes, performance, or returns;',
          'Provide tax, legal, or accounting advice.',
        ]} />
        <p>
          <strong>2.3 Service Availability.</strong> We strive for high availability but do not guarantee uninterrupted or
          error-free service. Maintenance windows, third-party outages, and unforeseen events may affect availability.
        </p>
      </Section>

      <Section id="eligibility" title="3. Eligibility">
        <p>
          <strong>3.1 Age Requirement.</strong> You must be at least 18 years of age to use TradVue. By using the Service,
          you represent and warrant that you are 18 years of age or older. If you are under 18, you are not permitted to use
          the Service.
        </p>
        <p>
          <strong>3.2 Legal Capacity.</strong> You represent and warrant that you have the legal capacity to enter into this
          Agreement and that your use of the Service does not violate any applicable law or regulation in your jurisdiction.
        </p>
        <p>
          <strong>3.3 Prohibited Jurisdictions.</strong> You may not use the Service if you are located in, or a resident or
          national of, any country subject to a U.S. government embargo or designated as a "terrorist supporting" country, or
          if you are on any U.S. government list of prohibited or restricted parties. See also Section 24 (Export Compliance).
        </p>
        <p>
          <strong>3.4 Business Accounts.</strong> If you are using the Service on behalf of a business or organization, you
          represent and warrant that you have authority to bind that entity to these Terms, and all references to "you" shall
          include that entity.
        </p>
        <p>
          <strong>3.5 International Use.</strong> TradVue is operated from the United States and is designed primarily for
          US-based users. Users outside the United States access the Service at their own risk and are solely responsible for
          compliance with all applicable local laws and regulations in their jurisdiction. TradVue makes no representation
          that the Service is appropriate, available, or legally permitted for use in any particular jurisdiction outside the
          United States. If accessing the Service is illegal or restricted in your country or jurisdiction, you are prohibited
          from doing so.
        </p>
      </Section>

      <Section id="accounts" title="4. Account Registration and Responsibility">
        <p>
          <strong>4.1 Account Creation.</strong> To access most features of the Service, you must create an account by
          providing accurate, current, and complete information. You agree to keep your account information updated.
        </p>
        <p>
          <strong>4.2 Account Security.</strong> You are solely responsible for:
        </p>
        <UL items={[
          'Maintaining the confidentiality of your account credentials (username and password);',
          'All activity that occurs under your account, whether authorized or unauthorized;',
          'Immediately notifying TradVue at security@tradvue.com if you suspect unauthorized access to your account.',
        ]} />
        <p>
          <strong>4.3 No Sharing.</strong> You may not share your account credentials with any third party or allow others
          to access your account. Each account is for a single individual user only, unless explicitly authorized in a
          separate written agreement with TradVue.
        </p>
        <p>
          <strong>4.4 Accurate Information.</strong> You agree not to impersonate any person or entity or falsely state or
          misrepresent your affiliation with any person or entity. Providing false registration information is grounds for
          immediate termination.
        </p>
        <p>
          <strong>4.5 One Account Per User.</strong> You may not create multiple accounts to circumvent account limitations,
          suspensions, or the free trial period.
        </p>
      </Section>

      <Section id="subscription" title="5. Subscription Terms, Billing, and Refund Policy">
        <SubSection title="5.1 Free Trial">
          <p>
            New users receive a three (3) week full-featured trial period beginning on the date of account creation. No
            credit card is required during the free trial. After the trial period expires:
          </p>
          <UL items={[
            'Your account will be downgraded to a limited free tier;',
            'You will retain a thirty (30) day rolling view window of your most recent trade data;',
            'Trade data older than thirty (30) days will be saved but locked (not accessible) unless you upgrade to a paid plan;',
            'Your data will not be deleted upon downgrade — it remains accessible upon upgrading.',
          ]} />
        </SubSection>
        <SubSection title="5.2 Paid Subscription Plans">
          <p>TradVue offers the following paid plans (pricing subject to change per Section 19):</p>
          <UL items={[
            'Monthly Plan: $24.00 USD per month, billed monthly.',
            'Annual Plan: $16.80 USD per month, billed annually at $201.60 USD per year (representing approximately 30% savings versus the monthly rate).',
          ]} />
        </SubSection>
        <SubSection title="5.3 Auto-Renewal">
          <p>
            ALL PAID SUBSCRIPTIONS AUTOMATICALLY RENEW AT THE END OF EACH BILLING PERIOD (MONTHLY OR ANNUAL) UNLESS
            CANCELLED PRIOR TO THE RENEWAL DATE. By subscribing, you authorize TradVue to charge your payment method on
            file for each renewal period without further action by you.
          </p>
          <p>
            <strong>5.3A Renewal Reminders.</strong> TradVue will send you a reminder email at least seven (7) days before
            any annual subscription renewal and at least three (3) days before any monthly subscription renewal, to the
            email address associated with your account. Failure to receive such reminder does not relieve you of your
            payment obligation, but you may contact support@tradvue.com for a refund of any renewal charge made without
            adequate notice.
          </p>
        </SubSection>
        <SubSection title="5.4 Cancellation">
          <UL items={[
            'You may cancel your subscription at any time through your account settings or by contacting support@tradvue.com.',
            'Cancellation will take effect at the end of your current billing period. You will retain access to paid features until the end of the period for which you have already paid.',
            'Cancellation does not automatically delete your account or data. See Section 20 (Termination) and Section 13 (Data Retention).',
          ]} />
        </SubSection>
        <SubSection title="5.5 Refund Policy">
          <UL items={[
            'Monthly Plans: Monthly subscription fees are non-refundable. No refunds or credits are issued for partial months or unused time.',
            'Annual Plans: For annual subscriptions, you may request a pro-rata refund for the unused portion of your annual term if you cancel within thirty (30) days of the start of your annual billing period. Refund requests after thirty (30) days of the annual billing cycle start date will not be honored.',
            'Exceptions: TradVue reserves the right to issue refunds or credits at its sole discretion in extraordinary circumstances. This discretion does not create an obligation to do so.',
            'Chargebacks: If you initiate a chargeback with your payment processor without first contacting TradVue, we reserve the right to suspend your account pending resolution.',
          ]} />
        </SubSection>
        <SubSection title="5.6 Payment Processing">
          <p>
            All payments are processed by Stripe, Inc. ("Stripe"), a PCI DSS-compliant payment processor. TradVue does
            not store your payment card information. By submitting payment information, you agree to Stripe's terms of
            service. You authorize TradVue to instruct Stripe to charge your payment method in accordance with your
            selected subscription plan.
          </p>
        </SubSection>
        <SubSection title="5.7 Failed Payments">
          <p>
            If a payment fails, we will attempt to notify you via email. Your account may be downgraded to the free tier
            after reasonable notice. TradVue is not responsible for bank fees, overdraft charges, or other charges
            incurred due to billing.
          </p>
        </SubSection>
        <SubSection title="5.8 Taxes">
          <p>
            Subscription prices do not include applicable taxes. You are responsible for all applicable taxes, including
            sales tax, VAT, or GST, where required by law. TradVue may collect and remit taxes where required.
          </p>
        </SubSection>
        <SubSection title="5.9 Price Changes">
          <p>
            TradVue reserves the right to modify subscription pricing upon thirty (30) days' prior written notice. Your
            continued use of a paid subscription after the effective date of a price change constitutes acceptance of
            the new pricing.
          </p>
        </SubSection>
      </Section>

      <Section id="not-advice" title="6. Not Investment Advice">
        <WarningBox>
          <strong>TRADVUE IS NOT A REGISTERED INVESTMENT ADVISER UNDER THE INVESTMENT ADVISERS ACT OF 1940, AS
          AMENDED, OR UNDER ANY APPLICABLE STATE SECURITIES LAW. TRADVUE IS NOT A BROKER-DEALER REGISTERED WITH THE
          SECURITIES AND EXCHANGE COMMISSION ("SEC") UNDER THE SECURITIES EXCHANGE ACT OF 1934, AS AMENDED, NOR IS
          IT A MEMBER OF THE FINANCIAL INDUSTRY REGULATORY AUTHORITY ("FINRA"). TRADVUE IS NOT A FINANCIAL PLANNER,
          COMMODITY TRADING ADVISER, OR ANY OTHER TYPE OF REGULATED FINANCIAL PROFESSIONAL.</strong>
        </WarningBox>
        <p>
          <strong>6.2 No Recommendations.</strong> Nothing on the TradVue platform — including but not limited to trade
          analytics, performance metrics, AI Coach outputs, market data, charts, watchlists, alerts, or any other feature
          — constitutes, or should be construed as, a recommendation to buy, sell, hold, or otherwise transact in any
          security, commodity, cryptocurrency, or other financial instrument.
        </p>
        <p>
          <strong>6.3 Informational and Educational Purpose Only.</strong> All content and features of TradVue are
          provided for informational, journaling, analytical, and educational purposes only. Past performance data
          displayed in TradVue relates solely to the user's own historical trade records and does not constitute a
          reliable indicator of future results.
        </p>
        <p>
          <strong>6.4 Consult a Professional.</strong> Users should consult a qualified, licensed financial adviser,
          broker-dealer, or investment professional before making any investment decisions. TradVue is not a substitute
          for professional financial advice.
        </p>
        <p>
          <strong>6.5 User Responsibility.</strong> All investment and trading decisions made by users are solely the
          user's responsibility. TradVue shall have no liability for any trading or investment outcomes, gains, or losses
          arising from or related to the user's use of the Service.
        </p>
      </Section>

      <Section id="market-data" title="7. Market Data Disclaimer">
        <p>
          <strong>7.1 Third-Party Data.</strong> Market data displayed on the TradVue platform is obtained from
          third-party providers including Alpaca Markets, Marketaux, and Finnhub (collectively, "Market Data
          Providers"). TradVue does not independently verify the accuracy, completeness, or timeliness of this data.
        </p>
        <p>
          <strong>7.2 Data Limitations.</strong> Market data may be:
        </p>
        <UL items={[
          'Delayed by 15 minutes or more, depending on the data provider and asset class;',
          'Incomplete, inaccurate, or subject to errors or omissions;',
          'Unavailable due to technical issues at the Market Data Provider.',
        ]} />
        <p>
          <strong>7.3 Not for Real-Time Trading Decisions.</strong> Market data displayed on TradVue is NOT suitable as
          the sole basis for real-time trading decisions. Always verify data through your broker, exchange, or official
          market data source before executing any trade.
        </p>
        <p>
          <strong>7.4 No Warranties on Data.</strong> TRADVUE MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE
          ACCURACY, COMPLETENESS, TIMELINESS, OR FITNESS FOR ANY PARTICULAR PURPOSE OF ANY MARKET DATA DISPLAYED ON
          THE PLATFORM.
        </p>
      </Section>

      <Section id="ai-coach" title="8. AI Coach Disclaimer">
        <WarningBox>
          <strong>THE AI COACH FEATURE PROVIDES AUTOMATED ANALYTICAL INSIGHTS BASED ON YOUR TRADE HISTORY AND JOURNAL
          ENTRIES. AI COACH IS A JOURNALING AND ANALYTICAL TOOL ONLY. IT DOES NOT PROVIDE INVESTMENT ADVICE,
          PERSONALIZED FINANCIAL RECOMMENDATIONS, OR ANY GUIDANCE TO BUY, SELL, OR HOLD ANY SECURITY.</strong>
        </WarningBox>
        <p>
          <strong>8.2 AI Limitations.</strong> AI Coach outputs:
        </p>
        <UL items={[
          'Are generated by artificial intelligence models (via OpenAI\'s API) and may be inaccurate, incomplete, misleading, or incorrect;',
          'Do not consider your individual financial situation, risk tolerance, investment objectives, tax circumstances, or any other personal factor;',
          'Are not personalized investment advice or a personalized recommendation;',
          'May reflect biases, errors, or limitations inherent in AI language models;',
          'Should not be relied upon as the sole basis for any trading or investment decision without independent verification and professional advice.',
        ]} />
        <p>
          <strong>8.3 Data Processing.</strong> When you use AI Coach, your trade data and journal entries may be
          transmitted to OpenAI's API for processing. Please review our{' '}
          <a href="/legal/privacy" style={{ color: '#4a9eff' }}>Privacy Policy</a> for details on how this data is handled.
        </p>
        <p>
          <strong>8.4 User Assumption of Risk.</strong> You expressly acknowledge and accept all risks associated with
          relying on AI Coach outputs. TradVue, its officers, directors, employees, and agents shall have no liability
          for any losses, damages, or adverse outcomes resulting from your reliance on AI Coach analysis.
        </p>
        <p>
          <strong>8.5 Opt-Out.</strong> You may disable AI Coach features through your account settings at any time.
        </p>
      </Section>

      <Section id="broker-sync" title="9. Broker Sync Disclaimer">
        <p>
          <strong>9.1 Third-Party Broker Data.</strong> TradVue currently supports manual CSV import of trade data,
          and may in the future offer automated broker synchronization through third-party data aggregators. When broker
          sync features are used:
        </p>
        <UL items={[
          'Data imported from connected brokerage accounts may be delayed, incomplete, inaccurate, or subject to errors;',
          'TradVue is not responsible for errors, omissions, or discrepancies in data provided by third-party brokers or aggregators;',
          'TradVue does not verify the accuracy of trade data received from third-party sources;',
          'You should independently verify all trade data against your official broker statements.',
        ]} />
        <p>
          <strong>9.2 No Responsibility for Sync Failures.</strong> TradVue is not liable for any losses, damages, or
          adverse consequences resulting from broker API errors, sync failures, data delays, or inaccurate data imported
          from third-party sources.
        </p>
        <p>
          <strong>9.3 Broker Relationship.</strong> Your relationship with your brokerage is solely between you and your
          broker. TradVue does not act as an agent of, or have any affiliation with, your brokerage.
        </p>
      </Section>

      <Section id="acceptable-use" title="10. Acceptable Use Policy">
        <p>
          <strong>10.1 Permitted Use.</strong> You may use the Service only for lawful purposes and in accordance with
          these Terms and our{' '}
          <a href="/legal/aup" style={{ color: '#4a9eff' }}>Acceptable Use Policy</a>.
        </p>
        <p>
          <strong>10.2 Prohibited Activities.</strong> You agree not to:
        </p>
        <UL items={[
          'Use the Service in any way that violates any applicable federal, state, local, or international law or regulation, including but not limited to securities laws, anti-fraud laws, and anti-money laundering laws;',
          'Use the Service to engage in, facilitate, or enable market manipulation, securities fraud, insider trading, front-running, or any other conduct prohibited under the Securities Exchange Act of 1934, the Securities Act of 1933, or related regulations;',
          'Scrape, crawl, or use automated tools to extract data from the Service without TradVue\'s prior written consent;',
          'Reverse engineer, decompile, disassemble, or attempt to derive the source code of any part of the Service;',
          'Circumvent, disable, or otherwise interfere with security-related features of the Service;',
          'Share, sell, or transfer your account credentials to any third party;',
          'Use automated scripts, bots, or other automated means to access the Service without TradVue\'s prior written consent;',
          'Introduce malware, viruses, trojan horses, or other harmful code;',
          'Conduct denial-of-service attacks or attempt to overwhelm the Service\'s infrastructure;',
          'Use AI Coach outputs to generate, distribute, or sell trading signals or purported investment advice to third parties;',
          'Create multiple accounts to circumvent trial limits or suspensions;',
          'Use the Service in any manner that could disable, damage, or impair TradVue\'s systems.',
        ]} />
        <p>
          <strong>10.3 Consequences.</strong> Violation of this Section may result in immediate suspension or termination
          of your account, legal action, and/or reporting to appropriate regulatory authorities. See Section 20 (Termination).
        </p>
      </Section>

      <Section id="dmca" title="10A. Copyright / DMCA Policy">
        <p>
          <strong>10A.1 Respect for Intellectual Property.</strong> TradVue respects the intellectual property rights of
          others and expects users to do the same. It is TradVue's policy to respond to valid notices of alleged copyright
          infringement in accordance with the Digital Millennium Copyright Act, 17 U.S.C. § 512 ("DMCA").
        </p>
        <p>
          <strong>10A.2 Designated DMCA Agent.</strong> TradVue's designated agent for receipt of DMCA takedown notices is:
        </p>
        <InfoBox>
          <strong>DMCA Agent — Apex Logics LLC d/b/a TradVue</strong><br />
          Email: legal@tradvue.com<br />
          Address: Apex Logics LLC, 1935 Commerce Lane, Suite 9, Jupiter, FL 33458
        </InfoBox>
        <p>
          <strong>10A.3 Takedown Notice Requirements.</strong> To submit a valid DMCA takedown notice, please provide
          the following information in writing:
        </p>
        <UL items={[
          'Identification of the copyrighted work (or a representative list if multiple works are at issue) that you claim has been infringed;',
          'Identification of the material on the Service that you claim is infringing, with sufficient detail to permit us to locate it (e.g., URL or description);',
          'Your contact information, including your name, mailing address, telephone number, and email address;',
          'A statement that you have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law;',
          'A statement that the information in the notice is accurate and, under penalty of perjury, that you are authorized to act on behalf of the copyright owner;',
          'Your physical or electronic signature (or that of the person authorized to act on behalf of the copyright owner).',
        ]} />
        <p>Incomplete or inaccurate notices may not be processed. Submit notices to: legal@tradvue.com.</p>
        <p>
          <strong>10A.4 Counter-Notice Procedure.</strong> If you believe your content was removed or disabled as a result
          of a mistake or misidentification, you may submit a counter-notice to legal@tradvue.com containing:
          (a) identification of the removed or disabled material and its prior location;
          (b) a statement under penalty of perjury that you have a good faith belief that the material was removed or
          disabled as a result of mistake or misidentification;
          (c) your name, address, and telephone number;
          (d) a statement consenting to jurisdiction of the federal district court for your judicial district; and
          (e) your physical or electronic signature. Upon receipt of a valid counter-notice, TradVue will follow the
          procedures set forth in 17 U.S.C. § 512(g).
        </p>
        <p>
          <strong>10A.5 Repeat Infringer Policy.</strong> In accordance with the DMCA and applicable law, TradVue
          maintains a policy of terminating, in appropriate circumstances and at TradVue's sole discretion, the accounts
          of users who are repeat copyright infringers.
        </p>
      </Section>

      <Section id="ip" title="11. Intellectual Property">
        <p>
          <strong>11.1 TradVue's Intellectual Property.</strong> The Service, including its software, user interface,
          design, text, graphics, logos, icons, and all other content created by TradVue (collectively, "TradVue IP"),
          is owned by or licensed to Apex Logics LLC and is protected by U.S. and international copyright, trademark,
          patent, and other intellectual property laws. © 2026 TradVue. All rights reserved.
        </p>
        <p>
          <strong>11.2 License to Use.</strong> Subject to your compliance with these Terms, TradVue grants you a
          limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal,
          non-commercial purposes.
        </p>
        <p>
          <strong>11.3 Restrictions.</strong> You may not:
        </p>
        <UL items={[
          'Copy, reproduce, distribute, or create derivative works of TradVue IP without express written permission;',
          'Use TradVue\'s trademarks, logos, or branding without express written permission;',
          'Remove or alter any proprietary notices or labels on the Service.',
        ]} />
        <p>
          <strong>11.4 User Trade Data.</strong> You own your trade data — the trade records, journal entries, notes,
          and other content you input into TradVue ("User Data"). By using the Service, you grant TradVue a limited,
          non-exclusive, worldwide, royalty-free license to process, store, transmit, and display your User Data solely
          as necessary to provide the Service to you. This license does not grant TradVue the right to sell your User
          Data to third parties.
        </p>
        <p>
          <strong>11.5 Feedback.</strong> If you provide TradVue with feedback, suggestions, or ideas regarding the
          Service ("Feedback"), you grant TradVue a perpetual, irrevocable, royalty-free, worldwide license to use,
          incorporate, and exploit such Feedback for any purpose, without compensation to you.
        </p>
      </Section>

      <Section id="user-data" title="12. User Data Ownership and Rights">
        <p>
          <strong>12.1 Ownership.</strong> You retain full ownership of all trade data, journal entries, notes, and
          other content that you create or import into TradVue. TradVue claims no ownership over your User Data.
        </p>
        <p>
          <strong>12.2 Data Processing License.</strong> The limited license granted in Section 11.4 permits TradVue to:
        </p>
        <UL items={[
          'Store your User Data on our infrastructure;',
          'Process your User Data to deliver features of the Service (including transmitting relevant data to third-party APIs such as OpenAI for AI Coach features);',
          'Generate aggregated, anonymized analytics about platform usage (which do not identify individual users);',
          'Back up your User Data to prevent loss.',
        ]} />
        <p>
          <strong>12.3 Data Export.</strong> You may export your trade data from TradVue at any time through the data
          export feature in your account settings. TradVue will provide your data in a commonly used, machine-readable format.
        </p>
        <p>
          <strong>12.4 Deletion Rights.</strong> You may request deletion of your User Data by deleting your account or
          by submitting a request to{' '}
          <a href="mailto:privacy@tradvue.com" style={{ color: '#4a9eff' }}>privacy@tradvue.com</a>.
          See Section 13 for data retention timelines.
        </p>
        <p>
          <strong>12.5 No Sale of User Data.</strong> TradVue does not sell your personal information or trade data to
          third parties for advertising or other commercial purposes.
        </p>
      </Section>

      <Section id="retention" title="13. Data Retention">
        <p>
          <strong>13.1 Active Accounts.</strong> TradVue retains your User Data for as long as your account is active
          and for as long as necessary to provide the Service. We use commercially reasonable efforts to maintain data
          integrity and availability, but we do not guarantee permanent storage of your data.
        </p>
        <p>
          <strong>13.2 Account Deletion.</strong> Upon deletion of your account:
        </p>
        <UL items={[
          'Your User Data will be removed from active production systems within ninety (90) days of account deletion;',
          'Residual copies of your User Data may persist in encrypted backup systems for up to an additional ninety (90) days before being purged in the ordinary course of backup rotation;',
          'Aggregated, anonymized data derived from your usage may be retained for analytical purposes while the service operates.',
        ]} />
        <p>
          <strong>13.3 No Guarantee of Permanent Storage.</strong> WE DO NOT GUARANTEE THAT YOUR DATA WILL BE STORED
          PERMANENTLY OR INDEFINITELY. You are solely responsible for maintaining your own backup copies of any data
          you input into TradVue.
        </p>
        <p>
          <strong>13.4 Legal Holds.</strong> Notwithstanding the above, TradVue may retain data for longer periods
          where required by applicable law, legal process, or to preserve evidence in connection with actual or
          reasonably anticipated litigation or regulatory investigations.
        </p>
      </Section>

      <Section id="liability" title="14. Disclaimers and Limitation of Liability">
        <WarningBox>
          <strong>14.1 AS-IS Service.</strong>
          <br /><br />
          THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER
          EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, TRADVUE DISCLAIMS ALL WARRANTIES,
          EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO: (A) WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT; (B) WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR
          COMPLETENESS OF ANY INFORMATION OR CONTENT ON THE SERVICE; AND (C) WARRANTIES THAT THE SERVICE WILL BE
          UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
        </WarningBox>
        <WarningBox>
          <strong>14.2 No Liability for Trading Outcomes.</strong>
          <br /><br />
          TRADVUE SHALL NOT BE LIABLE FOR ANY TRADING LOSSES, INVESTMENT LOSSES, FINANCIAL LOSSES, OR ADVERSE
          TRADING OUTCOMES ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE OR YOUR RELIANCE ON ANY INFORMATION,
          ANALYTICS, OR AI COACH OUTPUTS PROVIDED THROUGH THE SERVICE.
        </WarningBox>
        <WarningBox>
          <strong>14.3 Limitation of Liability.</strong>
          <br /><br />
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL TRADVUE, ITS OFFICERS, DIRECTORS,
          MEMBERS, EMPLOYEES, AGENTS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO: LOSS OF PROFITS,
          LOSS OF DATA, LOSS OF GOODWILL, BUSINESS INTERRUPTION, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN
          CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE.
          <br /><br />
          IN NO EVENT SHALL TRADVUE'S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO
          THESE TERMS OR THE SERVICE EXCEED THE TOTAL AMOUNT OF SUBSCRIPTION FEES ACTUALLY PAID BY YOU TO TRADVUE
          IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR ONE HUNDRED
          DOLLARS ($100.00), WHICHEVER IS GREATER.
        </WarningBox>
        <p>
          <strong>14.4 Essential Basis.</strong> You acknowledge that the limitations of liability in this Section 14
          are an essential element of the bargain between TradVue and you. TradVue would not provide the Service
          without these limitations.
        </p>
        <p>
          <strong>14.5 Exceptions.</strong> Nothing in these Terms shall limit TradVue's liability for:
          (a) death or personal injury caused by TradVue's gross negligence;
          (b) fraud or fraudulent misrepresentation; or
          (c) any liability that cannot be limited under applicable law.
        </p>
        <p>
          <strong>14.6 Applicability.</strong> Some jurisdictions do not allow the exclusion of certain warranties or
          the limitation of liability for consequential or incidental damages, so some of the above limitations may
          not apply to you. In such jurisdictions, TradVue's liability shall be limited to the maximum extent
          permitted by applicable law.
        </p>
      </Section>

      <Section id="risk" title="15. Assumption of Risk">
        <WarningBox>
          <strong>YOU EXPRESSLY ACKNOWLEDGE AND AGREE THAT:</strong>
          <br /><br />
          (A) TRADING IN SECURITIES, COMMODITIES, CRYPTOCURRENCIES, AND OTHER FINANCIAL INSTRUMENTS INVOLVES
          SUBSTANTIAL RISK OF LOSS, INCLUDING THE POSSIBLE LOSS OF YOUR ENTIRE INVESTMENT;
          <br /><br />
          (B) PAST TRADING PERFORMANCE, AS REFLECTED IN TRADVUE'S ANALYTICS, IS NOT NECESSARILY INDICATIVE OF
          FUTURE RESULTS;
          <br /><br />
          (C) YOU ARE SOLELY RESPONSIBLE FOR ALL TRADING AND INVESTMENT DECISIONS YOU MAKE, REGARDLESS OF ANY
          ANALYTICS, INSIGHTS, OR AI COACH OUTPUTS YOU MAY HAVE REVIEWED ON TRADVUE;
          <br /><br />
          (D) YOU HAVE SUFFICIENT KNOWLEDGE, EXPERIENCE, AND FINANCIAL RESOURCES TO BEAR THE RISKS ASSOCIATED
          WITH YOUR TRADING ACTIVITIES;
          <br /><br />
          (E) TRADVUE IS A JOURNALING AND ANALYTICS TOOL, NOT A TRADING SYSTEM, AND ANY RELIANCE ON TRADVUE DATA
          FOR TRADING DECISIONS IS ENTIRELY AT YOUR OWN RISK.
        </WarningBox>
      </Section>

      <Section id="indemnification" title="16. Indemnification">
        <p>
          <strong>16.1 User Indemnification.</strong> You agree to defend, indemnify, and hold harmless Apex Logics
          LLC, TradVue, and their respective officers, directors, members, employees, contractors, agents, licensors,
          and service providers (collectively, "TradVue Parties") from and against any and all claims, liabilities,
          damages, judgments, awards, losses, costs, expenses, and fees (including reasonable attorneys' fees) arising
          out of or relating to:
        </p>
        <UL items={[
          'Your violation of these Terms or any other policy referenced herein;',
          'Your use of the Service, including your trading decisions and investment activities;',
          'Your User Data, including any claim that your User Data infringes the rights of any third party;',
          'Your violation of any applicable law or regulation, including securities laws;',
          'Your misuse of AI Coach or any other feature of the Service;',
          'Any claim by a third party arising from your trading decisions or investment outcomes.',
        ]} />
        <p>
          <strong>16.2 Cooperation.</strong> TradVue reserves the right, at its own expense, to assume the exclusive
          defense and control of any matter subject to indemnification by you, in which case you agree to cooperate
          with TradVue's defense of such claim.
        </p>
      </Section>

      <Section id="arbitration" title="17. Dispute Resolution; Binding Arbitration; Class Action Waiver">
        <p>
          <strong>17.1 Informal Resolution.</strong> Before filing any formal legal proceeding, the parties agree to
          attempt to resolve any dispute, claim, or controversy informally. The party wishing to pursue a dispute must
          provide the other party with written notice describing the nature and basis of the claim and the relief
          sought. The parties shall have thirty (30) days from the date of notice (the "Informal Resolution Period")
          to attempt to resolve the dispute through good-faith negotiations. Contact:{' '}
          <a href="mailto:legal@tradvue.com" style={{ color: '#4a9eff' }}>legal@tradvue.com</a>;
          Apex Logics LLC, 1935 Commerce Lane, Suite 9, Jupiter, FL 33458.
        </p>
        <WarningBox>
          <strong>17.2 Binding Arbitration.</strong>
          <br /><br />
          IF THE DISPUTE IS NOT RESOLVED DURING THE INFORMAL RESOLUTION PERIOD, ANY DISPUTE, CLAIM, OR CONTROVERSY
          ARISING OUT OF OR RELATING TO THESE TERMS, THE SERVICE, OR YOUR USE THEREOF — INCLUDING BUT NOT LIMITED TO
          DISPUTES REGARDING THE FORMATION, VALIDITY, ENFORCEABILITY, OR INTERPRETATION OF THESE TERMS — SHALL BE
          RESOLVED EXCLUSIVELY BY FINAL AND BINDING ARBITRATION, RATHER THAN IN COURT.
          <br /><br />
          Arbitration shall be conducted by the American Arbitration Association ("AAA") under its Consumer
          Arbitration Rules for individual consumer users, or under its Commercial Arbitration Rules for business
          or enterprise accounts, in each case as modified by these Terms. For claims under $10,000, TradVue will
          pay all AAA filing fees and arbitrator costs. The arbitration shall be conducted in Palm Beach County,
          Florida, or virtually if mutually agreed. The arbitrator shall apply Florida law. The arbitrator's award
          shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.
        </WarningBox>
        <p>
          <strong>17.3 Small Claims Exception.</strong> Notwithstanding Section 17.2, either party may bring an
          individual claim in small claims court in Palm Beach County, Florida, if the claim qualifies and remains
          in small claims court.
        </p>
        <WarningBox>
          <strong>17.4 Class Action Waiver.</strong>
          <br /><br />
          YOU AND TRADVUE AGREE THAT EACH PARTY MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL
          CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, CONSOLIDATED, OR
          REPRESENTATIVE ACTION OR PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON'S CLAIMS
          AND MAY NOT PRESIDE OVER ANY FORM OF CLASS, COLLECTIVE, OR REPRESENTATIVE PROCEEDING.
        </WarningBox>
        <p>
          <strong>17.5 Severability of Arbitration.</strong> If the class action waiver in Section 17.4 is found to
          be unenforceable, then the entirety of Section 17.2 (binding arbitration) shall be null and void as to that
          claim, and the claim shall proceed in court under Section 17.7.
        </p>
        <p>
          <strong>17.6 Jury Trial Waiver.</strong> TO THE EXTENT A DISPUTE IS NOT SUBJECT TO ARBITRATION, EACH PARTY
          HEREBY IRREVOCABLY WAIVES ANY RIGHT TO A TRIAL BY JURY IN ANY ACTION OR PROCEEDING ARISING OUT OF OR
          RELATING TO THESE TERMS OR THE SERVICE.
        </p>
        <p>
          <strong>17.7 Venue for Non-Arbitrable Claims.</strong> For any claims not subject to arbitration, you and
          TradVue consent to the exclusive personal jurisdiction and venue of the state and federal courts located in
          Palm Beach County, Florida.
        </p>
      </Section>

      <Section id="law" title="18. Governing Law">
        <p>
          These Terms, and any dispute arising hereunder, shall be governed by and construed in accordance with the
          laws of the <strong>State of Florida</strong>, without regard to its conflict of law principles or
          choice-of-law rules, except to the extent governed by the Federal Arbitration Act (9 U.S.C. § 1 et seq.)
          with respect to arbitration matters.
        </p>
      </Section>

      <Section id="modifications" title="19. Modification of Terms">
        <p>
          <strong>19.1 Right to Modify.</strong> TradVue reserves the right to modify these Terms at any time.
          We will provide notice of material changes by:
        </p>
        <UL items={[
          'Posting the updated Terms on our website at tradvue.com/legal/terms with a new "Last Updated" date;',
          'Sending an email notification to the address associated with your account at least thirty (30) days prior to the effective date of material changes.',
        ]} />
        <p>
          <strong>19.2 Acceptance.</strong> Your continued use of the Service after the effective date of any
          modification constitutes your acceptance of the updated Terms. If you do not agree to the modified Terms,
          you must stop using the Service and may cancel your subscription in accordance with Section 5.4.
        </p>
        <p>
          <strong>19.3 Non-Material Changes.</strong> We may make non-material changes (such as corrections,
          clarifications, or additions that do not adversely affect your rights) at any time without prior notice,
          though we will update the "Last Updated" date.
        </p>
      </Section>

      <Section id="termination" title="20. Termination">
        <p>
          <strong>20.1 Termination by You.</strong> You may terminate your account at any time by:
        </p>
        <UL items={[
          'Using the account deletion feature in your account settings; or',
          'Contacting TradVue at support@tradvue.com.',
        ]} />
        <p>Termination is subject to the refund policy in Section 5.5.</p>
        <p>
          <strong>20.2 Termination by TradVue.</strong> TradVue may suspend or terminate your account, with or
          without notice, if:
        </p>
        <UL items={[
          'You violate these Terms or any policy incorporated herein;',
          'We are required to do so by applicable law;',
          'We discontinue the Service (with reasonable advance notice where practicable);',
          'Your subscription payment fails and is not remedied within a reasonable time;',
          'We reasonably determine that your use of the Service poses a security or legal risk.',
        ]} />
        <p>
          <strong>20.3 Effect of Termination.</strong> Upon termination:
        </p>
        <UL items={[
          'Your right to access and use the Service immediately ceases;',
          'Any outstanding fees become due and payable;',
          'Data retention is governed by Section 13 (Data Retention);',
          'Sections 6, 8, 11, 12, 13, 14, 15, 16, 17, 18, and all other provisions that by their nature should survive, shall survive termination.',
        ]} />
      </Section>

      <Section id="force-majeure" title="21. Force Majeure">
        <p>
          TradVue shall not be liable for any failure or delay in the performance of its obligations under these Terms
          to the extent such failure or delay is caused by circumstances beyond TradVue's reasonable control,
          including but not limited to: acts of God, natural disasters, earthquakes, floods, fires, epidemics,
          pandemics, governmental actions, wars, acts of terrorism, civil unrest, strikes, labor disputes, Internet
          or telecommunications failures, cyberattacks, power outages, or failures of third-party service providers
          (including hosting providers, payment processors, and market data providers). TradVue will use commercially
          reasonable efforts to resume performance as soon as reasonably practicable.
        </p>
      </Section>

      <Section id="assignment" title="22. Assignment">
        <p>
          <strong>22.1 TradVue's Right to Assign.</strong> TradVue may assign, transfer, or delegate any or all of
          its rights and obligations under these Terms without your consent, including in connection with a merger,
          acquisition, corporate reorganization, sale of assets, or operation of law. We will provide notice of
          any such assignment.
        </p>
        <p>
          <strong>22.2 No User Assignment.</strong> You may not assign, transfer, or delegate any of your rights or
          obligations under these Terms without TradVue's prior written consent. Any purported assignment without
          such consent is void.
        </p>
      </Section>

      <Section id="miscellaneous" title="23. Miscellaneous">
        <p>
          <strong>23.1 Entire Agreement.</strong> These Terms, together with the{' '}
          <a href="/legal/privacy" style={{ color: '#4a9eff' }}>Privacy Policy</a>,{' '}
          <a href="/legal/disclaimer" style={{ color: '#4a9eff' }}>Disclaimer</a>,{' '}
          <a href="/legal/cookies" style={{ color: '#4a9eff' }}>Cookie Policy</a>, and{' '}
          <a href="/legal/aup" style={{ color: '#4a9eff' }}>Acceptable Use Policy</a>,
          constitute the entire agreement between you and TradVue with respect to the Service and supersede all
          prior agreements, understandings, representations, and warranties.
        </p>
        <p>
          <strong>23.2 Severability.</strong> If any provision of these Terms is held to be invalid, illegal, or
          unenforceable by a court of competent jurisdiction or arbitrator, such provision shall be modified to the
          minimum extent necessary to make it enforceable, or severed if modification is not possible. The remaining
          provisions shall continue in full force and effect.
        </p>
        <p>
          <strong>23.3 No Waiver.</strong> TradVue's failure to enforce any right or provision of these Terms shall
          not constitute a waiver of that right or provision. A waiver of any breach shall not constitute a waiver
          of any subsequent breach.
        </p>
        <p>
          <strong>23.4 Third-Party Beneficiaries.</strong> These Terms do not create any third-party beneficiary
          rights. No third party shall have any right to enforce any provision of these Terms.
        </p>
        <p>
          <strong>23.5 Relationship of Parties.</strong> Nothing in these Terms shall create or be deemed to create
          a partnership, joint venture, employment, franchise, or agency relationship between TradVue and you.
        </p>
        <p>
          <strong>23.6 Headings.</strong> Section headings are for convenience only and shall not affect the
          interpretation of these Terms.
        </p>
        <p>
          <strong>23.7 Electronic Notices.</strong> TradVue may provide notices to you via email to the address
          associated with your account. Such notices shall be deemed delivered when sent. You may provide notices
          to TradVue at{' '}
          <a href="mailto:legal@tradvue.com" style={{ color: '#4a9eff' }}>legal@tradvue.com</a>{' '}
          or by mail to the address in Section 23.9.
        </p>
        <p>
          <strong>23.8 Language.</strong> These Terms are written in English. To the extent any translated version
          conflicts with the English version, the English version shall control.
        </p>
      </Section>

      <Section id="export" title="24. Export Compliance">
        <p>
          You represent and warrant that: (a) you are not located in a country subject to a U.S. Government embargo
          or designated by the U.S. Government as a "terrorist supporting" country; (b) you are not listed on any
          U.S. Government list of prohibited or restricted parties, including the Treasury Department's Specially
          Designated Nationals list or the Commerce Department's denied persons list; and (c) you will not access
          or use the Service in violation of any U.S. export, re-export, sanctions, or import laws or regulations,
          including those administered by the Office of Foreign Assets Control ("OFAC").
        </p>
      </Section>

      <Section id="contact" title="25. Contact Information">
        <p>For questions regarding these Terms, please contact:</p>
        <InfoBox>
          <strong>Apex Logics LLC d/b/a TradVue</strong><br />
          1935 Commerce Lane, Suite 9<br />
          Jupiter, FL 33458<br /><br />
          General/Legal:{' '}
          <a href="mailto:legal@tradvue.com" style={{ color: '#4a9eff' }}>legal@tradvue.com</a><br />
          Support:{' '}
          <a href="mailto:support@tradvue.com" style={{ color: '#4a9eff' }}>support@tradvue.com</a><br />
          Privacy:{' '}
          <a href="mailto:privacy@tradvue.com" style={{ color: '#4a9eff' }}>privacy@tradvue.com</a><br />
          Security:{' '}
          <a href="mailto:security@tradvue.com" style={{ color: '#4a9eff' }}>security@tradvue.com</a><br />
          Website: <a href="https://tradvue.com" style={{ color: '#4a9eff' }}>https://tradvue.com</a>
        </InfoBox>
        <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
          TradVue is a product of Apex Logics LLC.<br />
          Apex Logics LLC, FL Doc# L23000460971, DBA Reg# G26000036763, EIN 93-3771291.<br />
          Effective Date: March 16, 2026
        </p>
      </Section>

      <AcknowledgmentBox>
        By using TradVue, you acknowledge that you have read, understood, and agree to be bound by these Terms of
        Service, together with the Privacy Policy, Disclaimer, Cookie Policy, and Acceptable Use Policy.
        You further acknowledge that TradVue is not a financial advisor and that all use of the platform is at
        your own risk.
      </AcknowledgmentBox>

    </LegalPage>
  )
}
