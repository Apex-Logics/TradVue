import type { Metadata } from 'next'
import { LegalPage, Section, SubSection, UL, InfoBox, WarningBox, CookieTable, ImpactTable, AcknowledgmentBox } from '../components'

export const metadata: Metadata = {
  title: 'Cookie Policy — TradVue',
  description: 'Learn about the cookies TradVue uses and how to manage your cookie preferences.',
  alternates: {
    canonical: 'https://tradvue.io/legal/cookies',
  },
  robots: 'noindex, follow',
}

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="March 6, 2026">

      <Section id="what" title="1. What Are Cookies?">
        <p>
          Cookies are small text files stored on your device (computer, phone, or tablet) when you visit a website.
          They allow websites to remember your preferences, keep you logged in, and track usage patterns.
        </p>
        <p>
          TradVue uses cookies to improve your experience and understand how the platform is used.
        </p>
      </Section>

      <Section id="types" title="2. Types of Cookies We Use">

        <SubSection title="2.1 Essential Cookies (Always Active)">
          <p>
            These cookies are necessary for the Service to function properly.
            They cannot be disabled without breaking core features.
          </p>
          <CookieTable rows={[
            { name: 'session_id',  purpose: 'Keeps you logged in',                          duration: 'Session (cleared on logout)', type: 'TradVue' },
            { name: 'csrf_token',  purpose: 'Prevents cross-site request forgery',           duration: 'Session',                     type: 'TradVue' },
            { name: 'auth_token',  purpose: 'Authentication and authorization',              duration: '30 days',                     type: 'TradVue' },
            { name: 'timezone',    purpose: 'Stores your timezone for data display',         duration: '1 year',                      type: 'TradVue' },
          ]} />
          <WarningBox>
            <strong>What happens if you disable essential cookies?</strong>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>You won't be able to log in</li>
              <li>Watchlists and preferences won't load</li>
              <li>Charts may not display correctly</li>
              <li>Form submissions will fail</li>
            </ul>
          </WarningBox>
        </SubSection>

        <SubSection title="2.2 Preference Cookies (Optional)">
          <p>These cookies store your preferences and settings.</p>
          <CookieTable rows={[
            { name: 'theme_preference', purpose: 'Dark/light mode setting',                 duration: '2 years', type: 'TradVue' },
            { name: 'language',         purpose: 'Your preferred language',                  duration: '2 years', type: 'TradVue' },
            { name: 'chart_layout',     purpose: 'Default chart view (candlestick, line…)',  duration: '2 years', type: 'TradVue' },
            { name: 'sidebar_collapsed',purpose: 'Whether sidebar is collapsed',             duration: '2 years', type: 'TradVue' },
          ]} />
          <p>
            <strong>You can opt out of these cookies.</strong> Disabling them means you'll need to set your preferences each visit.
          </p>
        </SubSection>

        <SubSection title="2.3 Analytics Cookies (Optional)">
          <p>
            These cookies help us understand how users interact with TradVue,
            identify issues, and improve the platform.
          </p>
          <CookieTable rows={[
            { name: '_ga',       purpose: 'Google Analytics (identifies users)',          duration: '2 years', type: 'Google'  },
            { name: '_gid',      purpose: 'Google Analytics (session tracking)',          duration: '24 hours',type: 'Google'  },
            { name: 'Segment',   purpose: 'Event tracking (feature usage, page views)',   duration: '1 year',  type: 'Segment' },
          ]} />
          <p>
            Data collected includes: pages visited and time spent, features used and how often,
            device type and browser, geographic region (approximate), and referral source.
          </p>
          <InfoBox>
            Data is anonymized and aggregated. You are identified by a random ID, not your name.
          </InfoBox>
        </SubSection>

        <SubSection title="2.4 Marketing/Advertising Cookies (Opt-In Only)">
          <p>
            These cookies are only active if you explicitly consent.
            They allow us to show you relevant promotions.
          </p>
          <CookieTable rows={[
            { name: 'marketing_consent', purpose: 'Tracks if you consented to marketing',    duration: '1 year', type: 'TradVue' },
            { name: 'Facebook Pixel',    purpose: 'Retargeting ads on Facebook/Instagram',   duration: 'Session',type: 'Meta'        },
            { name: 'LinkedIn Insight',  purpose: 'Retargeting on LinkedIn',                  duration: 'Session',type: 'LinkedIn'    },
          ]} />
          <p><strong>We do not use these unless you consent in the cookie banner.</strong></p>
        </SubSection>
      </Section>

      <Section id="manage" title="3. How to Manage Cookies">
        <SubSection title="3.1 Via TradVue Cookie Banner">
          <p>When you first visit TradVue, a cookie consent banner appears. You can:</p>
          <UL items={[
            'Accept All Cookies — Enable all non-essential cookies',
            'Reject Non-Essential — Only essential cookies are active',
            'Customize — Choose which types to enable',
          ]} />
          <p>You can change your preferences anytime in <strong>Settings → Privacy & Cookies</strong>.</p>
        </SubSection>

        <SubSection title="3.2 Via Your Browser">
          <p>All modern browsers allow you to control cookies:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { browser: 'Chrome', steps: 'Settings → Privacy and security → Cookies and other site data → Manage all cookies and site data → Search "tradvue.com"' },
              { browser: 'Firefox', steps: 'Settings → Privacy & Security → Cookies and Site Data → Manage Exceptions or Clear Data' },
              { browser: 'Safari', steps: 'Preferences → Privacy → Manage website data' },
              { browser: 'Edge', steps: 'Settings → Privacy → Clear browsing data → Choose "Cookies and other site data"' },
            ].map(b => (
              <div key={b.browser} style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '13.5px',
                lineHeight: 1.6,
              }}>
                <strong style={{ color: 'var(--text-0)' }}>{b.browser}:</strong>{' '}
                <span style={{ color: 'var(--text-2)' }}>{b.steps}</span>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title="3.3 Global Opt-Outs">
          <UL items={[
            'Google Analytics Opt-Out: https://tools.google.com/dlpage/gaoptout',
            'Network Advertising Initiative: http://optout.networkadvertising.org',
            'Digital Advertising Alliance: http://optout.aboutads.info',
          ]} />
        </SubSection>
      </Section>

      <Section id="impact" title="4. What Happens If You Disable Cookies?">
        <ImpactTable rows={[
          { type: 'Essential',  impact: 'Service will NOT work properly' },
          { type: 'Preference', impact: 'Settings reset each visit; charts show defaults' },
          { type: 'Analytics',  impact: "We can't improve the platform based on usage data" },
          { type: 'Marketing',  impact: "You won't see relevant promotions" },
        ]} />
        <InfoBox>
          We recommend keeping essential cookies enabled for a good experience.
        </InfoBox>
      </Section>

      <Section id="storage" title="5. Local Storage & Other Tracking">
        <SubSection title="Local Storage">
          <p>
            Stores chart preferences, watchlist filters, and recent searches.
            Persists even after cookies are cleared. Managed via browser DevTools.
          </p>
        </SubSection>
        <SubSection title="Session Storage">
          <p>Stores temporary data during your session. Cleared when you close the browser tab.</p>
        </SubSection>
        <SubSection title="Web Beacons">
          <p>
            Small invisible images that track if you opened an email.
            Used only in email communications (with your consent).
          </p>
        </SubSection>
      </Section>

      <Section id="dnt" title="6. Do-Not-Track Signals">
        <p>
          Some browsers allow you to set a "Do Not Track" (DNT) signal.
          TradVue respects DNT preferences:
        </p>
        <UL items={[
          'We do NOT enable tracking cookies if DNT is active',
          'We still use essential cookies (necessary for the Service)',
          'Third-party services (Google, Segment) may still track if their own policies allow',
        ]} />
      </Section>

      <Section id="changes" title="7. Cookie Changes">
        <p>TradVue may:</p>
        <UL items={[
          'Add new cookies to improve the Service',
          'Remove cookies that are no longer needed',
          'Update cookie names or purposes',
        ]} />
        <p>We will update this policy and notify users of significant changes.</p>
      </Section>

      <Section id="contact" title="8. Contact & More Information">
        <p>
          Questions about cookies? Email:{' '}
          <a href="mailto:privacy@tradvue.io" style={{ color: '#4a9eff' }}>privacy@tradvue.io</a>
        </p>
        <p>Learn more about cookies:</p>
        <UL items={[
          'AboutCookies.org',
          "Your browser's privacy documentation",
          'GDPR Cookie Guidance: https://gdpr.eu/',
        ]} />
      </Section>

      <AcknowledgmentBox>
        By using TradVue, you accept our use of cookies as described in this policy.
      </AcknowledgmentBox>

    </LegalPage>
  )
}
