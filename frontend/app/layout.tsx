import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { ToastProvider } from './context/ToastContext'
import OnboardingOverlay from './components/OnboardingOverlay'
import CookieConsent from './components/CookieConsent'
import ToastContainer from './components/Toast'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.chartgenius.io'),
  title: 'ChartGenius — Real-Time Market Intelligence',
  description: 'Live market data, news feed, economic calendar and market movers for active traders',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'icon', url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'ChartGenius — Real-Time Market Intelligence',
    description: 'Live market data, news feed, economic calendar and market movers for active traders',
    url: 'https://www.chartgenius.io',
    siteName: 'ChartGenius',
    images: [
      {
        url: '/logo-tagline.png',
        width: 1024,
        height: 1024,
        alt: 'ChartGenius — AI Driven Alpha',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChartGenius — Real-Time Market Intelligence',
    description: 'Live market data, news feed, economic calendar and market movers for active traders',
    images: ['/logo-tagline.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ChartGenius',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-dark">
      <head>
        <meta name="theme-color" content="#6366f1" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      </head>
      <body>
        {/* Google Analytics 4 — only load in production and when a GA ID is configured */}
        {GA_ID && process.env.NODE_ENV === 'production' && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  page_path: window.location.pathname,
                  anonymize_ip: true,
                  cookie_flags: 'SameSite=None;Secure'
                });
              `}
            </Script>
          </>
        )}

        <ToastProvider>
          <SettingsProvider>
            <AuthProvider>
              <OnboardingProvider>
                {children}
                <OnboardingOverlay />
                <CookieConsent />
                {/* Global Footer Disclaimer */}
                <footer style={{ 
                  background: 'var(--bg-1)', 
                  borderTop: '1px solid var(--border)',
                  padding: '8px 16px',
                  fontSize: '10px',
                  color: 'var(--text-3)',
                  textAlign: 'center',
                }}>
                  <span style={{ display: 'inline-block', marginTop: '4px' }}>
                    ⚠️ Not financial advice. For informational purposes only.{' '}
                    <a href="/legal/disclaimer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                      Read disclaimer
                    </a>
                  </span>
                </footer>
              </OnboardingProvider>
            </AuthProvider>
          </SettingsProvider>
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  )
}
