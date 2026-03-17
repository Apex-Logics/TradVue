import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Help & Support — FAQs, Guides & Troubleshooting',
  description:
    'Find answers to common questions about TradVue: journal setup, portfolio tracking, price alerts, calculators, CSV import, prop firm tracking, billing, and more.',
  keywords: [
    'TradVue help',
    'TradVue FAQ',
    'trading journal help',
    'prop firm tracker help',
    'TradVue support',
    'trading calculators help',
  ],
  openGraph: {
    title: 'Help & Support | TradVue',
    description:
      'FAQs, guides and troubleshooting for TradVue trading journal, portfolio tracker, calculators, and more.',
    url: 'https://www.tradvue.com/help',
    siteName: 'TradVue',
    type: 'website',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'TradVue Help & Support' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Help & Support | TradVue',
    description:
      'FAQs and guides for TradVue trading journal, calculators, and market tools.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://www.tradvue.com/help',
  },
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
