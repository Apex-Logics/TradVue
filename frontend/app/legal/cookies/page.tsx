import type { Metadata } from 'next'
import { LegalPage, Section, SubSection, UL, InfoBox, WarningBox, CookieTable, AcknowledgmentBox } from '../components'

export const metadata: Metadata = {
  title: 'Cookie Policy — TradVue',
  description: 'Learn about the cookies TradVue uses and how to manage your cookie preferences.',
  alternates: {
    canonical: 'https://www.tradvue.com/legal/cookies',
  },
  robots: 'noindex, follow',
}

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="March 16, 2026">

      <Section id="intro" title="1. Introduction">
        <p>
          This Cookie Policy explains how Apex Logics LLC, doing business as TradVue ("TradVue," "we," "us,"
          or "our"), uses cookies and similar tracking technologies on our website at tradvue.com and associated
          applications (collectively, the "Service").
        </p>
        <p>
          This Cookie Policy should be read alongside our{' '}
          <a href="/legal/privacy" style={{ color: '#4a9eff' }}>Privacy Policy</a> and{' '}
          <a href="/legal/terms" style={{ color: '#4a9eff' }}>Terms of Service</a>.
        </p>
        <p>
          By using TradVue, you consent to the use of cookies as described in this Policy. You can manage
          cookie preferences as described in Section 6.
        </p>
      </Section>

      <Section id="what" title="2. What Are Cookies?">
        <p>
          <strong>Cookies</strong> are small text files placed on your device (computer, tablet, smartphone)
          when you visit a website. They allow the website to recognize your device on subsequent visits and
          enable various functionality.
        </p>
        <p><strong>Similar technologies</strong> include:</p>
        <UL items={[
          'Local Storage / Session Storage: Browser-based key-value storage used to persist data within a session or across sessions.',
          'Pixels/Beacons: Small image files embedded in web pages used to track page visits and user interactions.',
          'Fingerprinting: Techniques that use device characteristics to identify users without cookies.',
        ]} />
        <p>TradVue primarily uses cookies and browser local/session storage.</p>
      </Section>

      <Section id="types" title="3. Types of Cookies We Use">

        <SubSection title="3.1 Essential / Strictly Necessary Cookies">
          <p>
            These cookies are required for the Service to function. They cannot be disabled without breaking
            core functionality.
          </p>
          <CookieTable rows={[
            { name: 'sb-access-token',  purpose: 'Authentication session token. Keeps you logged in to TradVue.', duration: 'Session / up to 1 hour', type: 'Supabase' },
            { name: 'sb-refresh-token', purpose: 'Used to refresh your authentication session without re-login.', duration: 'Up to 7 days',             type: 'Supabase' },
            { name: '__stripe_mid',     purpose: 'Fraud prevention and payment processing integrity. Set when interacting with payment pages.', duration: '1 year', type: 'Stripe' },
            { name: '__stripe_sid',     purpose: 'Stripe session identifier for payment processing.', duration: '30 minutes', type: 'Stripe' },
          ]} />
          <WarningBox>
            <strong>These cookies cannot be disabled via cookie preferences.</strong> They are necessary for
            account security and to process payments.
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Disabling these cookies means you won't be able to log in</li>
              <li>Preferences and watchlists won't load</li>
              <li>Payment processing will not function</li>
            </ul>
          </WarningBox>
        </SubSection>

        <SubSection title="3.2 Security / Network Cookies (Cloudflare)">
          <p>
            These cookies are set by Cloudflare, our CDN and security provider, at the network layer. They
            are used for security, bot management, and network performance.
          </p>
          <CookieTable rows={[
            { name: 'cf_clearance', purpose: 'Stores proof that you passed a Cloudflare security challenge (e.g., CAPTCHA). Prevents repeated challenges.', duration: '1 year', type: 'Cloudflare' },
            { name: '__cf_bm',     purpose: 'Bot management cookie. Distinguishes legitimate users from automated bot traffic.', duration: '30 minutes', type: 'Cloudflare' },
            { name: '_cfuvid',     purpose: 'Used for rate limiting on Cloudflare\'s side to prevent abuse.', duration: 'Session', type: 'Cloudflare' },
          ]} />
          <InfoBox>
            Cloudflare cookies operate at the network/infrastructure level. They are set for all visitors to
            protect the platform, regardless of cookie consent settings. They do not track personal behavior
            for marketing purposes.
          </InfoBox>
        </SubSection>

        <SubSection title="3.3 Analytics Cookies (Non-Essential)">
          <p>
            These cookies collect information about how users interact with the Service to help us understand
            usage patterns and improve TradVue. These cookies are set only with your consent (or unless you
            have opted out via Do Not Track or cookie preferences).
          </p>
          <CookieTable rows={[
            { name: '_ga',       purpose: 'Distinguishes unique users. Used to calculate visit statistics.',             duration: '2 years',  type: 'Google Analytics' },
            { name: '_ga_[ID]',  purpose: 'Used to maintain session state for Google Analytics 4.',                      duration: '2 years',  type: 'Google Analytics' },
            { name: '_gid',      purpose: 'Distinguishes users for a 24-hour period.',                                   duration: '24 hours', type: 'Google Analytics' },
            { name: '_gat',      purpose: 'Throttles request rate to Google Analytics.',                                  duration: '1 minute', type: 'Google Analytics' },
          ]} />
          <p>
            Google Analytics does <strong>not</strong> receive or process your trade data, account details,
            or personal financial information. It receives only standard browsing analytics (pages visited,
            session duration, device/browser type).
          </p>
          <InfoBox>
            You can opt out of Google Analytics at any time using the{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" style={{ color: '#4a9eff' }} target="_blank" rel="noopener noreferrer">
              Google Analytics Opt-Out Browser Add-On
            </a>.
          </InfoBox>
        </SubSection>

        <SubSection title="3.4 Functional / Preference Cookies">
          <p>These cookies enable personalized features and remember your preferences.</p>
          <CookieTable rows={[
            { name: 'tradvue_theme', purpose: 'Remembers your UI theme preference (light/dark mode).', duration: '1 year', type: 'TradVue' },
            { name: 'tradvue_prefs', purpose: 'Stores dashboard layout and display preferences.',      duration: '1 year', type: 'TradVue' },
          ]} />
        </SubSection>
      </Section>

      <Section id="not-used" title="4. Cookies We Do NOT Use">
        <p>
          To be explicit, TradVue currently does <strong>NOT</strong> use the following tracking technologies:
        </p>
        <UL items={[
          'Segment — not implemented',
          'Facebook Pixel / Meta Pixel — not installed',
          'LinkedIn Insight Tag — not installed',
          'Google Ads / Remarketing tags — not installed',
          'Twitter/X Pixel — not installed',
          'TikTok Pixel — not installed',
          'Any third-party behavioral advertising or retargeting cookies',
        ]} />
        <InfoBox>
          We do not sell your personal information or use your data for cross-site advertising.
        </InfoBox>
      </Section>

      <Section id="dnt" title="5. Do Not Track (DNT)">
        <p>
          TradVue respects Do Not Track (DNT) signals sent by your browser.
          When your browser sends a DNT=1 signal:
        </p>
        <UL items={[
          'Non-essential analytics cookies (Google Analytics) will not be set.',
          'Essential cookies (authentication, security) will continue to function as necessary to provide the Service.',
          'Cloudflare security cookies operate at the infrastructure level and may still be set regardless of DNT signals.',
        ]} />
        <p>To enable DNT in your browser, refer to your browser's privacy settings.</p>
      </Section>

      <Section id="manage" title="6. Managing Your Cookie Preferences">

        <SubSection title="6.1 Browser Settings">
          <p>
            Most browsers allow you to refuse or delete cookies. Refer to your browser's help documentation:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { browser: 'Chrome',  url: 'https://support.google.com/chrome/answer/95647' },
              { browser: 'Firefox', url: 'https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences' },
              { browser: 'Safari',  url: 'https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac' },
              { browser: 'Edge',    url: 'https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09' },
            ].map(b => (
              <div key={b.browser} style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '13.5px',
                lineHeight: 1.6,
                minWidth: 0,
                maxWidth: '100%',
                overflowWrap: 'anywhere',
                boxSizing: 'border-box',
              }}>
                <strong style={{ color: 'var(--text-0)' }}>{b.browser}:</strong>{' '}
                <a href={b.url} style={{ color: '#4a9eff', overflowWrap: 'anywhere' }} target="_blank" rel="noopener noreferrer">{b.url}</a>
              </div>
            ))}
          </div>
          <WarningBox>
            <strong>Note:</strong> Disabling essential cookies will prevent you from logging in and using TradVue.
          </WarningBox>
        </SubSection>

        <SubSection title="6.2 Google Analytics Opt-Out">
          <p>
            Install the{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" style={{ color: '#4a9eff' }} target="_blank" rel="noopener noreferrer">
              Google Analytics Opt-Out Browser Add-On
            </a>{' '}
            to prevent Google Analytics data collection across all websites.
          </p>
        </SubSection>

        <SubSection title="6.3 Do Not Track">
          <p>Enable Do Not Track in your browser settings.</p>
        </SubSection>
      </Section>

      <Section id="third-party-privacy" title="7. Cookies and Third-Party Privacy Policies">
        <p>For cookies set by third parties, their privacy and cookie policies apply:</p>
        <UL items={[
          'Stripe: https://stripe.com/privacy',
          'Cloudflare: https://www.cloudflare.com/privacypolicy/',
          'Google Analytics: https://policies.google.com/privacy',
        ]} />
      </Section>

      <Section id="changes" title="8. Changes to This Cookie Policy">
        <p>
          We may update this Cookie Policy from time to time to reflect changes in our technology stack or
          applicable law. Material changes will be communicated in accordance with our{' '}
          <a href="/legal/privacy" style={{ color: '#4a9eff' }}>Privacy Policy</a>{' '}
          (30-day notice). The "Last Updated" date above indicates when this Policy was last revised.
        </p>
      </Section>

      <Section id="contact" title="9. Contact">
        <p>For questions about our use of cookies:</p>
        <InfoBox>
          <strong>Apex Logics LLC d/b/a TradVue</strong><br />
          1935 Commerce Lane, Suite 9<br />
          Jupiter, FL 33458<br /><br />
          Privacy:{' '}
          <a href="mailto:privacy@tradvue.com" style={{ color: '#4a9eff' }}>privacy@tradvue.com</a><br />
          Website: <a href="https://tradvue.com" style={{ color: '#4a9eff' }}>https://tradvue.com</a>
        </InfoBox>
        <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
          TradVue is a product of Apex Logics LLC.<br />
          Apex Logics LLC, FL Doc# L23000460971.<br />
          Effective Date: March 16, 2026
        </p>
      </Section>

      <AcknowledgmentBox>
        By using TradVue, you accept our use of cookies as described in this policy.
      </AcknowledgmentBox>

    </LegalPage>
  )
}
