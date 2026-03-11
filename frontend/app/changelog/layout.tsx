import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Changelog — TradVue',
  description: 'Full history of TradVue features, fixes, and improvements. Updated with every release.',
}

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
