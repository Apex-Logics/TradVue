import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'System Status — TradVue',
  description: 'Real-time health status of TradVue services including market data feeds, API, and web app. Check for known outages and incidents.',
}

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
