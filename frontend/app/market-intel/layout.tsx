import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Insider Trading Tracker — SEC Form 4 Filings, Earnings & IPOs | TradVue',
  description:
    'Track insider buying and selling in real-time. Free SEC Form 4 data for AAPL, MSFT, NVDA, TSLA, and more. Filter by buy, sell, award, gift. Earnings calendar and IPO tracker included.',
  alternates: {
    canonical: 'https://www.tradvue.com/market-intel',
  },
  openGraph: {
    title: 'Free Insider Trading Tracker — SEC Form 4 Filings, Earnings & IPOs | TradVue',
    description:
      'Track insider buying and selling in real-time. Free SEC Form 4 data for AAPL, MSFT, NVDA, TSLA, and more. Filter by buy, sell, award, gift. Earnings calendar and IPO tracker included.',
    url: 'https://www.tradvue.com/market-intel',
    siteName: 'TradVue',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'Free Insider Trading Tracker — TradVue' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Insider Trading Tracker — SEC Form 4 Filings, Earnings & IPOs | TradVue',
    description:
      'Track insider buying and selling in real-time. Free SEC Form 4 data for AAPL, MSFT, NVDA, TSLA, and more.',
    images: ['/og-image.png'],
  },
}

export default function MarketIntelLayout({ children }: { children: React.ReactNode }) {
  return children
}
