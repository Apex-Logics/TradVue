import type { Metadata } from 'next'
import { LegalPage, Section, SubSection, UL, OL, WarningBox, AcknowledgmentBox } from '../components'

export const metadata: Metadata = {
  title: 'Terms of Service — ChartGenius',
  description: 'Read the ChartGenius Terms of Service. By using our platform you agree to these terms.',
  alternates: {
    canonical: 'https://chartgenius.io/legal/terms',
  },
  robots: 'noindex, follow',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="March 6, 2026">

      <Section id="agreement" title="1. Agreement to Terms">
        <p>
          By accessing and using the ChartGenius platform ("Service"), you agree to be bound by these Terms of Service.
          If you do not agree to abide by the above, please do not use this service.
        </p>
      </Section>

      <Section id="description" title="2. Service Description">
        <p>
          ChartGenius is a financial data visualization and analysis platform that provides charting tools, market data,
          and watchlist management features. The Service is provided on an "as-is" basis for informational purposes only.
        </p>
      </Section>

      <WarningBox>
        <strong>NOT FINANCIAL ADVICE</strong>
        <br /><br />
        <strong>ChartGenius does not provide financial, investment, or trading advice.</strong> The Service is a research
        and visualization tool only. Nothing on ChartGenius constitutes:
        <ul style={{ marginTop: '12px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>Investment recommendations</li>
          <li>Financial advice</li>
          <li>Trading signals</li>
          <li>Market predictions</li>
          <li>Personalized financial guidance</li>
        </ul>
        <p style={{ marginTop: '12px' }}>
          All market data, charts, and analysis are provided for educational and informational purposes.
          You are solely responsible for any investment decisions.
        </p>
      </WarningBox>

      <Section id="accounts" title="3. User Accounts">
        <SubSection title="3.1 Account Creation">
          <UL items={[
            'You must provide accurate, current, and complete information when registering',
            'You are responsible for maintaining the confidentiality of your account credentials',
            'You agree not to share your login information with others',
            'You are liable for all activity on your account',
          ]} />
        </SubSection>
        <SubSection title="3.2 Eligibility">
          <UL items={[
            'You must be at least 18 years old to use this Service',
            'You must comply with all applicable laws and regulations in your jurisdiction',
            'You may not use ChartGenius if prohibited by law in your location',
          ]} />
        </SubSection>
      </Section>

      <Section id="acceptable-use" title="4. Acceptable Use">
        <p>You agree <strong>NOT</strong> to:</p>
        <UL items={[
          'Use ChartGenius for illegal purposes or in violation of any laws',
          'Manipulate, scrape, or automatically access the Service without permission',
          'Reverse engineer, decompile, or attempt to access source code',
          'Upload malware, viruses, or harmful code',
          'Harass, abuse, or threaten other users',
          'Impersonate or misrepresent your identity',
          'Sell, transfer, or distribute access to the Service',
          'Engage in market manipulation or pump-and-dump schemes',
          'Use automated trading bots without explicit written permission',
          'Attempt to gain unauthorized access to restricted areas',
        ]} />
      </Section>

      <Section id="ip" title="5. Intellectual Property">
        <p>
          ChartGenius owns all intellectual property rights to the Service, including charts, logos, design elements,
          and proprietary analysis tools. You may not reproduce, distribute, or modify any content without permission.
        </p>
      </Section>

      <Section id="disclaimers" title="6. Disclaimers & Limitations">
        <SubSection title="6.1 Data Accuracy">
          <p>While we strive for accuracy, ChartGenius does not guarantee that:</p>
          <UL items={[
            'Market data is real-time or error-free',
            'Historical data is complete or accurate',
            'Technical indicators are always reliable',
            'Charts are free from technical errors',
          ]} />
        </SubSection>
        <SubSection title="6.2 Third-Party Data">
          <p>
            ChartGenius uses data from external sources including exchanges, brokers, and market data providers.
            We are not responsible for their errors, delays, or inaccuracies.
          </p>
        </SubSection>
        <SubSection title="6.3 Service Availability">
          <p>
            The Service is provided on an "as-is" basis without warranties of merchantability or fitness
            for a particular purpose. We do not guarantee:
          </p>
          <UL items={[
            'Uninterrupted access',
            'Error-free operation',
            'Data preservation in case of system failure',
            'Specific performance levels',
          ]} />
        </SubSection>
      </Section>

      <Section id="liability" title="7. Limitation of Liability">
        <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong></p>
        <p>ChartGenius and its owners, developers, and staff shall <strong>NOT</strong> be liable for:</p>
        <UL items={[
          'Any trading losses, whether direct or indirect',
          'Loss of profits, revenue, or anticipated savings',
          'Loss of data or corruption of files',
          'Any consequential, incidental, special, or punitive damages',
          'Damages arising from interruptions, delays, or unavailability of the Service',
        ]} />
        <p style={{ marginTop: '16px' }}>
          This limitation applies even if ChartGenius has been advised of the possibility of such damages.
        </p>
      </Section>

      <Section id="risk" title="8. Assumption of Risk">
        <p>
          <strong>Using ChartGenius for any financial decision is entirely at your own risk.</strong> You acknowledge that:
        </p>
        <UL items={[
          'Trading and investing involve substantial risk of loss',
          'Past performance does not guarantee future results',
          'Market conditions are unpredictable',
          'You may lose some or all of your investment',
        ]} />
      </Section>

      <Section id="modifications" title="9. Modification of Terms">
        <p>
          ChartGenius reserves the right to modify these Terms at any time. Continued use of the Service
          after changes constitute acceptance of the new terms.
        </p>
      </Section>

      <Section id="termination" title="10. Termination">
        <p>ChartGenius may terminate your account without notice if you:</p>
        <UL items={[
          'Violate these Terms',
          'Engage in illegal activity',
          'Abuse the Service or other users',
          'Violate applicable securities laws',
        ]} />
      </Section>

      <Section id="law" title="11. Governing Law">
        <p>
          These Terms are governed by applicable law. Any disputes shall be resolved through
          binding arbitration rather than litigation.
        </p>
      </Section>

      <Section id="contact" title="12. Contact">
        <p>
          For questions about these Terms, contact:{' '}
          <a href="mailto:legal@chartgenius.io" style={{ color: '#4a9eff' }}>legal@chartgenius.io</a>
        </p>
      </Section>

      <AcknowledgmentBox>
        By using ChartGenius, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
      </AcknowledgmentBox>

    </LegalPage>
  )
}
