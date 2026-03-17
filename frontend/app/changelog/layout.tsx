import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Changelog — TradVue Feature Updates & Release Notes',
  description: 'Full history of TradVue features, fixes, and improvements. See what's new in the latest release. Updated with every release.',
  alternates: { canonical: 'https://www.tradvue.com/changelog' },
  openGraph: {
    title: 'Changelog | TradVue',
    description: 'Feature updates, bug fixes, and improvements — updated with every TradVue release.',
    url: 'https://www.tradvue.com/changelog',
    type: 'website',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'TradVue Changelog' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Changelog | TradVue',
    description: 'Feature updates and release notes for TradVue.',
    images: ['/og-image.png'],
  },
}

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
