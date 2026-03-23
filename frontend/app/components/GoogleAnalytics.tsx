'use client'

/**
 * GoogleAnalytics.tsx
 *
 * Loads GA4 only in production and only when the user has granted analytics
 * consent (localStorage key: cg_analytics_consent).
 *
 * Page-view events are fired on every client-side route change via
 * next/navigation's `usePathname`.
 *
 * Env var: NEXT_PUBLIC_GA_MEASUREMENT_ID (e.g. G-XXXXXXXXXX)
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

const CONSENT_KEY = 'cg_analytics_consent'

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true'
  } catch {
    return false
  }
}

/** Send a page_view hit on SPA route changes */
function GoogleAnalyticsPageTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!GA_ID || !hasConsent()) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (typeof w.gtag !== 'function') return
    w.gtag('config', GA_ID, {
      page_path: pathname,
    })
  }, [pathname])

  return null
}

export default function GoogleAnalytics() {
  // Only render in production and when a measurement ID is configured
  if (!GA_ID || process.env.NODE_ENV !== 'production') {
    return null
  }

  const gaInitScript = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

var hasConsent = false;
try { hasConsent = localStorage.getItem('${CONSENT_KEY}') === 'true'; } catch(e) {}

if (hasConsent) {
  gtag('config', '${GA_ID}', {
    page_path: window.location.pathname,
    anonymize_ip: true,
    cookie_flags: 'SameSite=None;Secure'
  });
} else {
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied'
  });
}

window.addEventListener('storage', function(e) {
  if (e.key !== '${CONSENT_KEY}') return;
  if (e.newValue === 'true') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('config', '${GA_ID}', {
      page_path: window.location.pathname,
      anonymize_ip: true,
      cookie_flags: 'SameSite=None;Secure'
    });
  } else {
    gtag('consent', 'update', { analytics_storage: 'denied' });
  }
});`

  return (
    <>
      {/* Use plain script tags here. Next/script inline children were causing a prod-only appendChild token crash. */}
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
      <script id="ga4-init" dangerouslySetInnerHTML={{ __html: gaInitScript }} />

      {/* SPA route change tracker */}
      <GoogleAnalyticsPageTracker />
    </>
  )
}
