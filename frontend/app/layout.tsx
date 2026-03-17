import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { ToastProvider } from './context/ToastContext'
import OnboardingOverlay from './components/OnboardingOverlay'
import CookieConsent from './components/CookieConsent'
import ToastContainer from './components/Toast'
import GoogleAnalytics from './components/GoogleAnalytics'
import AppFooter from './components/AppFooter'
import FeedbackWidget from './components/FeedbackWidget'
import AnnouncementBanner from './components/AnnouncementBanner'
import TrialBanner from './components/TrialBanner'
import SupportChat from './components/SupportChat'

// ─── Default Metadata ─────────────────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tradvue.com'),

  title: {
    default: 'TradVue — Free Trading Journal, Portfolio Tracker & Market Tools',
    template: '%s | TradVue',
  },
  description:
    'TradVue is the free trading journal, portfolio tracker, and market tools platform built for serious traders. 30+ calculators, AI coach, prop firm tracking. Free to start.',

  keywords: [
    'trading journal',
    'portfolio tracker',
    'stock calculator',
    'options calculator',
    'futures calculator',
    'DRIP simulator',
    'trading tools',
    'market alerts',
    'risk management',
    'position sizing',
    'free trading platform',
    'prop firm tracker',
  ],

  alternates: {
    canonical: 'https://www.tradvue.com',
  },

  manifest: '/manifest.json',

  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
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
    type: 'website',
    url: 'https://www.tradvue.com',
    siteName: 'TradVue',
    title: 'TradVue — Free Trading Journal, Portfolio Tracker & Market Tools',
    description:
      'TradVue is the free trading journal, portfolio tracker, and market tools platform built for serious traders. 30+ calculators, AI coach, prop firm tracking.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TradVue — Free Trading Journal, Portfolio Tracker & Market Tools',
      },
    ],
    locale: 'en_US',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'TradVue — Free Trading Journal, Portfolio Tracker & Market Tools',
    description:
      'TradVue is the free trading journal, portfolio tracker, and market tools platform built for serious traders. 30+ calculators, AI coach, prop firm tracking.',
    images: ['/og-image.png'],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TradVue',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },

  other: {
    'mobile-web-app-capable': 'yes',
  },
}

// ─── JSON-LD Structured Data ──────────────────────────────────────────────────

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.tradvue.com/#organization',
      name: 'TradVue',
      url: 'https://www.tradvue.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.tradvue.com/og-image.png',
        width: 1200,
        height: 630,
      },
      sameAs: [],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@tradvue.com',
      },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.tradvue.com/#website',
      url: 'https://www.tradvue.com',
      name: 'TradVue',
      publisher: { '@id': 'https://www.tradvue.com/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://www.tradvue.com/news?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://www.tradvue.com/#app',
      name: 'TradVue',
      url: 'https://www.tradvue.com',
      description:
        'Free trading journal, portfolio tracker, and market analysis tools for day traders and investors.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      offers: [
        {
          '@type': 'Offer',
          name: 'Free',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free tier with trading journal, calculators, and basic analytics.',
        },
        {
          '@type': 'Offer',
          name: 'TradVue Pro Monthly',
          price: '24',
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '24',
            priceCurrency: 'USD',
            unitCode: 'MON',
          },
        },
        {
          '@type': 'Offer',
          name: 'TradVue Pro Annual',
          price: '201.60',
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '201.60',
            priceCurrency: 'USD',
            unitCode: 'ANN',
          },
        },
      ],
      featureList: [
        'AI-powered trade analysis',
        'Unlimited trade journal',
        '30+ trading calculators',
        'Prop firm rule tracking',
        'Portfolio tracker',
        'Real-time market news',
        'Price alerts',
        'CSV import/export',
        'Post-trade ritual & streak tracking',
      ],
      publisher: { '@id': 'https://www.tradvue.com/#organization' },
    },
  ],
}

// ─── Global Disclaimer Bar ────────────────────────────────────────────────────

function GlobalDisclaimer() {
  return (
    <div style={{
      width: '100%',
      background: '#0d0d16',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      padding: '8px 16px',
      textAlign: 'center',
    }}>
      <p style={{
        margin: 0,
        fontSize: 11,
        color: 'rgba(180,180,200,0.6)',
        lineHeight: 1.5,
        maxWidth: 900,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        TradVue is a trading journal and analytics tool — not a financial advisor. Nothing on this platform constitutes financial advice, trading recommendations, or guarantees of any kind. Trading involves substantial risk of loss. See our{' '}
        <a href="/legal/disclaimer" style={{ color: 'var(--accent, #6366f1)', textDecoration: 'none' }}>Disclaimer</a>
        {' '}and{' '}
        <a href="/legal/terms" style={{ color: 'var(--accent, #6366f1)', textDecoration: 'none' }}>Terms of Service</a>.
      </p>
    </div>
  )
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-dark">
      <head>
        <meta name="theme-color" content="#0a0a1a" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://tradvue-api.onrender.com" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://s3.tradingview.com" />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Font-size preference — applied before hydration to prevent layout shift */}
        <script dangerouslySetInnerHTML={{ __html: `try{var _fs=localStorage.getItem('cg_font_size');if(_fs==='medium')document.documentElement.classList.add('font-medium');else if(_fs==='large')document.documentElement.classList.add('font-large');}catch(e){}` }} />
      </head>
      <body>
        {/* No-JavaScript fallback — shown only when JS is disabled */}
        <noscript>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0f0f12', color: '#e0e0e8',
            fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '24px',
          }}>
            <p style={{ fontSize: '18px', maxWidth: '480px', lineHeight: 1.6 }}>
              <strong>TradVue requires JavaScript to run.</strong><br />
              Please enable JavaScript in your browser settings and reload the page.
            </p>
          </div>
        </noscript>
        {/* Announcement Banner */}
        <AnnouncementBanner />
        {/* Google Analytics 4 — consent-gated, production only */}
        <GoogleAnalytics />

        <ToastProvider>
          <SettingsProvider>
            <AuthProvider>
              {/* Trial countdown banner — shown for free-tier users (must be inside AuthProvider) */}
              <TrialBanner />
              <OnboardingProvider>
                {children}
                <OnboardingOverlay />
                <CookieConsent />
                <GlobalDisclaimer />
                <AppFooter />
                <FeedbackWidget />
                <SupportChat />
              </OnboardingProvider>
            </AuthProvider>
          </SettingsProvider>
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  )
}
