import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.chartgenius.io'),
  // ── Title & Description ────────────────────────────────────────────────
  title: 'ChartGenius — Real-Time Market Intelligence for Active Traders',
  description:
    'AI-powered news feeds, sentiment analysis, and smart alerts. React faster to market moves. Free beta access — no credit card required.',

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
    url: 'https://chartgenius.io/landing',
    siteName: 'ChartGenius',
    title: 'ChartGenius — Real-Time Market Intelligence for Active Traders',
    description:
      'AI-powered news feeds, sentiment analysis, and smart alerts for traders who can\'t afford to miss a move.',
    images: [
      {
        url: 'https://www.chartgenius.io/logo-tagline.png',
        width: 1024,
        height: 1024,
        alt: 'ChartGenius — AI Driven Alpha',
      },
    ],
  },

  // ── Twitter Card ──────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    site: '@chartgenius',
    creator: '@chartgenius',
    title: 'ChartGenius — Real-Time Market Intelligence for Active Traders',
    description: 'AI-powered news, sentiment analysis, and smart alerts. Free beta access.',
    images: ['https://www.chartgenius.io/logo-tagline.png'],
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
    canonical: 'https://chartgenius.io/landing',
  },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
