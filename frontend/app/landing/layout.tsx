import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tradvue.com'),
  // ── Title & Description ────────────────────────────────────────────────
  title: 'TradVue — Real-Time Market Intelligence for Active Traders',
  description:
    'AI-powered news feeds, sentiment analysis, and smart alerts. React faster to market moves. Free to start — no credit card required.',

  // ── Keywords ──────────────────────────────────────────────────────────
  keywords: [
    'real-time market data',
    'trading alerts',
    'AI sentiment analysis',
    'market news feed',
    'trader tools',
    'stock market dashboard',
    'crypto trading alerts',
    'trading platform',
  ],

  // ── Open Graph ────────────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    url: 'https://tradvue.com/landing',
    siteName: 'TradVue',
    title: 'TradVue — Real-Time Market Intelligence for Active Traders',
    description:
      'AI-powered news feeds, sentiment analysis, and smart alerts for traders who can\'t afford to miss a move.',
    images: [
      {
        url: 'https://www.tradvue.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TradVue — AI Driven Alpha',
      },
    ],
  },

  // ── Twitter Card ──────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    site: '@tradvue',
    creator: '@tradvue',
    title: 'TradVue — Real-Time Market Intelligence for Active Traders',
    description: 'AI-powered news, sentiment analysis, and smart alerts. Free to start.',
    images: ['https://www.tradvue.com/og-twitter.png'],
  },

  // ── Robots ────────────────────────────────────────────────────────────
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

  // ── Canonical ─────────────────────────────────────────────────────────
  alternates: {
    canonical: 'https://www.tradvue.com/landing',
  },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
