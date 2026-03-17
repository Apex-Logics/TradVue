import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Trading Calculators & Tools — Position Size, Risk, Options',
  description:
    'Access 30+ free trading calculators: position sizing, risk/reward, options Greeks, futures tick value, Sharpe ratio, Kelly criterion, and more. No sign-up needed.',
  openGraph: {
    title: 'Free Trading Calculators & Tools — Position Size, Risk, Options | TradVue',
    description:
      'Access 30+ free trading calculators: position sizing, risk/reward, options Greeks, futures tick value, and more. No sign-up needed.',
    url: 'https://www.tradvue.com/tools',
    type: 'website',
    images: [{ url: 'https://www.tradvue.com/og-image.png', width: 1200, height: 630, alt: 'TradVue Trading Calculators' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Trading Calculators & Tools | TradVue',
    description:
      '30+ free trading calculators: position sizing, risk management, options pricing, futures specs, and more.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://www.tradvue.com/tools',
  },
}

// ─── JSON-LD for Tools page ───────────────────────────────────────────────────

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'TradVue Trading Calculators',
      url: 'https://www.tradvue.com/tools',
      applicationCategory: 'FinanceApplication',
      description:
        '30+ free professional trading calculators for position sizing, risk management, options Greeks, futures specs, and more.',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: '30+ trading calculators — no account required.',
      },
      featureList: [
        'Position Size Calculator',
        'Risk/Reward Calculator',
        'Options Greeks (Black-Scholes)',
        'Futures Tick Value Calculator',
        'Sharpe Ratio Calculator',
        'Kelly Criterion',
        'Trade Expectancy Calculator',
        'Compound Growth Calculator',
        'Correlation Matrix',
        'Risk of Ruin Calculator',
        'Forex Pip Calculator',
        'Dividend Planner',
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tradvue.com' },
        { '@type': 'ListItem', position: 2, name: 'Trading Tools', item: 'https://www.tradvue.com/tools' },
      ],
    },
  ],
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
