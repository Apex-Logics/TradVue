import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ChartGenius — AI-Powered Trading Intelligence',
  description: 'Real-time market data, news analysis, and portfolio tracking for smart traders',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  )
}
