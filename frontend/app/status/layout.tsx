import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'System Status — TradVue Service Health',
  description: 'Real-time health status of TradVue services: market data feeds, API server, and web app. Check for known outages and incidents.',
  alternates: { canonical: 'https://www.tradvue.com/status' },
  openGraph: {
    title: 'System Status | TradVue',
    description: 'Real-time TradVue service health: market data, API, and web app status.',
    url: 'https://www.tradvue.com/status',
    type: 'website',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'TradVue System Status' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'System Status | TradVue',
    description: 'Real-time TradVue service health and incident status.',
    images: ['/og-image.png'],
  },
}

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
