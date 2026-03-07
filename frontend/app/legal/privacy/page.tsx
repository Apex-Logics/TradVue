import type { Metadata } from 'next'
import { LegalPage, Section, SubSection, UL, InfoBox, AcknowledgmentBox } from '../components'

export const metadata: Metadata = {
  title: 'Privacy Policy — ChartGenius',
  description: 'Learn how ChartGenius collects, uses, and protects your personal information.',
  alternates: {
    canonical: 'https://chartgenius.io/legal/privacy',
  },
  robots: 'noindex, follow',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="March 6, 2026">

      <Section id="intro" title="1. Introduction">
        <p>
          ChartGenius ("Company," "we," "us," "our") is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you use our platform.
        </p>
        <p>
          Please read this policy carefully. If you do not agree with our practices,
          please do not use ChartGenius.
        </p>
      </Section>

      <Section id="collection" title="2. Information We Collect">
        <SubSection title="2.1 Information You Provide Directly">
          <p><strong>Account Registration:</strong></p>
          <UL items={[
            'Name',
            'Email address',
            'Password (encrypted)',
            'Phone number (optional)',
            'Country/timezone',
            'User preferences',
          ]} />
          <p style={{ marginTop: '12px' }}><strong>Through Your Use of the Service:</strong></p>
          <UL items={[
            'Watchlist data (stocks, cryptoassets, or other securities you track)',
            'Charts and analysis you create or save',
            'Technical indicator settings and preferences',
            'Market alerts you set up',
            'Profile information you add voluntarily',
          ]} />
          <p style={{ marginTop: '12px' }}><strong>Communications:</strong></p>
          <UL items={[
            'Support tickets and messages',
            'Feedback and feature requests',
            'Communications with our support team',
          ]} />
        </SubSection>

        <SubSection title="2.2 Automatically Collected Information">
          <p><strong>Usage Data:</strong></p>
          <UL items={[
            'IP address',
            'Device type and operating system',
            'Browser type and version',
            'Pages visited and time spent',
            'Features used and frequency',
            'Search queries within the platform',
            'Referring website',
          ]} />
          <p style={{ marginTop: '12px' }}><strong>Cookies & Tracking:</strong></p>
          <UL items={[
            'Session cookies (for login persistence)',
            'Preference cookies (language, layout settings)',
            'Analytics cookies (Segment, Google Analytics)',
            'Advertising cookies (if you consent)',
          ]} />
        </SubSection>
      </Section>

      <Section id="use" title="3. How We Use Your Information">
        <SubSection title="Operational Purposes">
          <UL items={[
            'Providing, maintaining, and improving the Service',
            'Creating and managing your account',
            'Processing requests and transactions',
            'Sending account notifications and updates',
            'Troubleshooting and technical support',
          ]} />
        </SubSection>
        <SubSection title="Analytics & Improvement">
          <UL items={[
            'Understanding how users interact with ChartGenius',
            'Identifying trends and improving user experience',
            'Measuring platform performance',
            'Conducting A/B testing',
          ]} />
        </SubSection>
        <SubSection title="Communication">
          <UL items={[
            'Sending service announcements',
            'Responding to your inquiries',
            'Sending educational content (with your consent)',
            'Notifying you of changes to policies or Service',
          ]} />
        </SubSection>
        <SubSection title="Legal & Safety">
          <UL items={[
            'Complying with legal obligations',
            'Enforcing our Terms of Service',
            'Preventing fraud, abuse, or illegal activity',
            'Protecting the rights, property, and safety of ChartGenius, users, and the public',
          ]} />
        </SubSection>
        <SubSection title="Marketing (with consent)">
          <UL items={[
            'Sending promotional emails about new features',
            'Personalized offers based on usage (only if opted-in)',
            'Market research surveys',
          ]} />
        </SubSection>
        <InfoBox>
          <strong>We do NOT sell your personal data to third parties.</strong>
        </InfoBox>
      </Section>

      <Section id="sharing" title="4. Information Sharing & Disclosure">
        <SubSection title="4.1 Service Providers">
          <p>We share information with trusted vendors who assist us:</p>
          <UL items={[
            'Cloud hosting providers (AWS, Google Cloud)',
            'Analytics providers (Google Analytics, Segment)',
            'Payment processors (for premium features)',
            'Email service providers',
            'Customer support platforms',
          ]} />
          <p>These vendors are contractually obligated to use your data only for providing services to us.</p>
        </SubSection>
        <SubSection title="4.2 Legal Requirements">
          <p>We may disclose information when required by law:</p>
          <UL items={[
            'Court orders or subpoenas',
            'Regulatory investigations',
            'Law enforcement requests',
            'Compliance with financial regulations',
          ]} />
        </SubSection>
        <SubSection title="4.3 Business Transfers">
          <p>
            If ChartGenius is acquired, merged, or its assets sold, your information may be transferred
            as part of that transaction. We will notify you of any such change.
          </p>
        </SubSection>
        <SubSection title="4.4 Aggregated Data">
          <p>
            We may share anonymized, aggregated data (e.g., "70% of users track tech stocks")
            for industry analysis without identifying individuals.
          </p>
        </SubSection>
      </Section>

      <Section id="security" title="5. Data Security">
        <p>ChartGenius implements industry-standard security measures:</p>
        <UL items={[
          'SSL/TLS encryption for data in transit',
          'AES-256 encryption for sensitive data at rest',
          'Secure password hashing (bcrypt)',
          'Regular security audits and penetration testing',
          'Access controls and authentication',
          'Employee confidentiality agreements',
        ]} />
        <p>
          <strong>However, no system is completely secure.</strong> We cannot guarantee absolute security of your data.
        </p>
      </Section>

      <Section id="retention" title="6. Data Retention">
        <UL items={[
          'Account Data: Kept while your account is active; deleted upon account termination (unless required for legal obligations)',
          'Usage Logs: Typically retained for 12 months',
          'Cookies: Session cookies deleted after logout; preference cookies retained for 1–2 years',
          'Deleted Content: May be retained in backups for up to 90 days',
        ]} />
      </Section>

      <Section id="gdpr" title="7. GDPR Rights (EU & EEA Residents)">
        <p>If you are in the EU or EEA, you have the following rights under GDPR:</p>
        <UL items={[
          'Right of Access — Request a copy of all personal data we hold about you',
          'Right to Rectification — Correct inaccurate or incomplete information',
          'Right to Erasure ("Right to be Forgotten") — Request deletion of your data, except where we have legal obligations to retain it',
          'Right to Data Portability — Request your data in a structured, machine-readable format',
          'Right to Restrict Processing — Limit how we use your data',
          'Right to Object — Object to our processing of your data for marketing or analytics',
          'Right to Withdraw Consent — Withdraw consent for communications at any time',
        ]} />
        <InfoBox>
          To exercise these rights, contact{' '}
          <a href="mailto:privacy@chartgenius.io" style={{ color: '#4a9eff' }}>privacy@chartgenius.io</a>{' '}
          with "GDPR Request" in the subject line.
        </InfoBox>
      </Section>

      <Section id="ccpa" title="8. CCPA Rights (California Residents)">
        <p>If you are a California resident, you have the following rights under CCPA:</p>
        <UL items={[
          'Right to Know — Request what personal information is collected and how it is used',
          'Right to Delete — Request deletion of personal information (with exceptions for legal obligations)',
          'Right to Opt-Out — Opt out of "sale" or "sharing" of your information (we do not sell data, but we may share for analytics)',
          'Right to Non-Discrimination — We will not discriminate against you for exercising your privacy rights',
        ]} />
        <InfoBox>
          To submit a CCPA request, contact{' '}
          <a href="mailto:privacy@chartgenius.io" style={{ color: '#4a9eff' }}>privacy@chartgenius.io</a>{' '}
          with "CCPA Request" in the subject line. Include your name and email.
          We will respond within 45 days.
        </InfoBox>
      </Section>

      <Section id="cookies" title="9. Cookies & Tracking Technologies">
        <p>
          When you first visit ChartGenius, you will be presented with a cookie consent banner.
          You can accept all cookies, reject non-essential cookies, or customize your preferences.
          You can also control cookies through your browser settings, though some features may not work properly.
        </p>
        <p>
          For full details, see our{' '}
          <a href="/legal/cookies" style={{ color: '#4a9eff' }}>Cookie Policy</a>.
        </p>
      </Section>

      <Section id="children" title="10. Children's Privacy">
        <p>
          ChartGenius is not directed to children under 13. We do not knowingly collect information from children.
          If we learn that a child under 13 has provided information, we will delete it immediately.
        </p>
      </Section>

      <Section id="third-party" title="11. Third-Party Links">
        <p>
          ChartGenius may link to external websites. We are not responsible for their privacy practices.
          Please review their privacy policies before providing any information.
        </p>
      </Section>

      <Section id="changes" title="12. Changes to This Policy">
        <p>
          ChartGenius may update this Privacy Policy periodically. We will notify you of material changes
          via email or prominent notice on the platform. Continued use after changes indicates acceptance.
        </p>
      </Section>

      <Section id="international" title="13. International Data Transfers">
        <p>
          If you are outside the United States, your information may be transferred to, stored in,
          and processed in the US or other countries. By using ChartGenius, you consent to such transfers.
        </p>
        <p>
          For EU/EEA residents, we use Standard Contractual Clauses to ensure adequate protection.
        </p>
      </Section>

      <Section id="contact" title="14. Contact & Complaints">
        <UL items={[
          'Privacy Questions: privacy@chartgenius.io',
          'Data Protection Officer: dpo@chartgenius.io',
          'Mailing Address: ChartGenius Privacy Team, [Company Address]',
        ]} />
        <p>
          <strong>EU/EEA Residents:</strong> You have the right to lodge a complaint with your local
          data protection authority if you believe your rights have been violated.
        </p>
      </Section>

      <AcknowledgmentBox>
        By using ChartGenius, you acknowledge that you have read and understood this Privacy Policy.
      </AcknowledgmentBox>

    </LegalPage>
  )
}
