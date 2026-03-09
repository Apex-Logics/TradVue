import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Help Center & FAQ | TradVue',
  description:
    'Find answers to common questions about TradVue — account setup, pricing, data sources, alerts, troubleshooting, and more.',
  keywords: [
    'TradVue help',
    'TradVue FAQ',
    'stock market app help',
    'trading platform support',
    'watchlist help',
    'price alerts',
    'TradVue support',
  ],
  openGraph: {
    title: 'Help Center & FAQ | TradVue',
    description:
      'Find answers to common questions about TradVue — account setup, pricing, data sources, alerts, troubleshooting, and more.',
    url: 'https://tradvue.io/help',
    siteName: 'TradVue',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Help Center & FAQ | TradVue',
    description:
      'Answers to common questions about TradVue — accounts, billing, data, and troubleshooting.',
  },
  alternates: {
    canonical: 'https://tradvue.io/help',
  },
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
