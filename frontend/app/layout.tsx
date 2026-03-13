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

// ─── Default Metadata ─────────────────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tradvue.com'),

  title: {
    default: 'TradVue — Free Trading Journal, Portfolio Tracker & Market Tools',
    template: '%s | TradVue',
  },
  description:
    'Track trades, analyze portfolios, calculate risk, and monitor markets — all free. 11 trading calculators, smart alerts, DRIP simulator, and more. No account required.',

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
      'Track trades, analyze portfolios, calculate risk, and monitor markets — all free. 11 trading calculators, smart alerts, DRIP simulator, and more. No account required.',
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
      'Track trades, analyze portfolios, calculate risk, and monitor markets — all free. 11 trading calculators, smart alerts, DRIP simulator, and more. No account required.',
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
  '@type': 'WebApplication',
  name: 'TradVue',
  url: 'https://www.tradvue.com',
  description: 'Free trading journal, portfolio tracker, and market analysis tools',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-dark">
      <head>
        <meta name="theme-color" content="#6366f1" />
        <link rel="canonical" href="https://www.tradvue.com" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Font-size preference — applied before hydration to prevent layout shift */}
        <script dangerouslySetInnerHTML={{ __html: `try{var _fs=localStorage.getItem('cg_font_size');if(_fs==='medium')document.documentElement.classList.add('font-medium');else if(_fs==='large')document.documentElement.classList.add('font-large');}catch(e){}` }} />
      </head>
      <body>
        {/* Google Analytics 4 — consent-gated, production only */}
        <GoogleAnalytics />

        <ToastProvider>
          <SettingsProvider>
            <AuthProvider>
              <OnboardingProvider>
                {children}
                <OnboardingOverlay />
                <CookieConsent />
                <AppFooter />
                <FeedbackWidget />
              </OnboardingProvider>
            </AuthProvider>
          </SettingsProvider>
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  )
}
