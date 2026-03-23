import Link from 'next/link'
import '../components/seo-landing.css'

export default function MarketIntelPage() {
  return (
    <div className="seo-page">
      {/* ── Structured Data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebPage',
                name: 'Free Insider Trading Tracker — SEC Form 4 Filings, Earnings & IPOs | TradVue',
                description:
                  'Track insider buying and selling in real-time. Free SEC Form 4 data for AAPL, MSFT, NVDA, TSLA, and more. Filter by buy, sell, award, gift.',
                url: 'https://www.tradvue.com/market-intel',
              },
              {
                '@type': 'FAQPage',
                mainEntity: [
                  {
                    '@type': 'Question',
                    name: 'Is this data accurate?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. Data is sourced directly from SEC EDGAR via Finnhub. All Form 4 filings are official disclosures submitted by corporate insiders.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'How often is the insider trading data updated?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Data is cached for 30 minutes and refreshes automatically from SEC filings via Finnhub.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Do I need an account to use Market Intel?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'No. Market Intel is completely free for all users — no account required.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'What tickers are covered?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'We cover AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL, JPM, V, and SPY by default. You can also search any ticker.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'What do the transaction types mean?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Buy = open market purchase. Sell = disposition of shares. Award = stock grant from the company. Gift = gifted shares. F = shares withheld for tax.',
                    },
                  },
                ],
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tradvue.com' },
                  { '@type': 'ListItem', position: 2, name: 'Market Intel', item: 'https://www.tradvue.com/market-intel' },
                ],
              },
            ],
          }),
        }}
      />

      {/* ── Nav ── */}
      <nav className="seo-nav">
        <div className="seo-nav-inner">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-header.svg" alt="TradVue" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
          </Link>
          <Link href="/?view=market-intel" className="seo-nav-cta">Track Insider Trades</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="seo-hero">
        <div className="seo-hero-glow-1" />
        <div className="seo-hero-glow-2" />
        <div className="seo-hero-inner">
          <div className="seo-hero-badge">
            <span className="seo-hero-badge-dot" />
            SEC Form 4 filings — updated daily, 100% free
          </div>
          <h1 className="seo-hero-h1">
            Free Insider Trading Data<br />
            <span className="gradient-text">Updated Daily</span>
          </h1>
          <p className="seo-hero-sub">
            Track what corporate insiders are buying and selling. Real SEC Form 4 filings for the world&apos;s
            biggest companies. No account required.
          </p>
          <Link href="/?view=market-intel" className="seo-hero-cta">
            Track Insider Trades
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <div className="seo-hero-trust">
            {['No account required', 'Real SEC EDGAR data', 'Updated daily'].map(t => (
              <span key={t} className="seo-hero-trust-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="seo-section-alt" style={{ padding: '0' }}>
        <div className="seo-stats-bar" style={{ borderRadius: '0', border: 'none', borderBottom: '1px solid var(--border)' }}>
          {[
            { value: '1,300+', label: 'Insider Trades' },
            { value: '10', label: 'Major Tickers' },
            { value: 'Daily', label: 'Updated' },
            { value: '100%', label: 'Free' },
          ].map(s => (
            <div key={s.label} className="seo-stat">
              <div className="seo-stat-value">{s.value}</div>
              <div className="seo-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How It Works ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>How It Works</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-steps">
            {[
              {
                step: '01',
                title: 'Real SEC Form 4 Data via Finnhub',
                desc: 'We pull official insider transaction filings directly from SEC EDGAR via Finnhub. Every trade is a real disclosure submitted by a corporate officer, director, or 10% shareholder.',
              },
              {
                step: '02',
                title: 'Coverage Across 10 Major Tickers',
                desc: 'Track insider activity across AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL, JPM, V, and SPY — or search any ticker symbol.',
              },
              {
                step: '03',
                title: 'Filter by Transaction Type',
                desc: 'Use quick filters to view only the trades you care about: Buy, Sell, Award, or Gift. Spot purchasing patterns fast.',
              },
              {
                step: '04',
                title: 'Plus Earnings and IPO Calendars',
                desc: 'Market Intel also includes an upcoming earnings calendar with EPS estimates, an IPO tracker, and economic indicators from FRED.',
              },
            ].map(item => (
              <div key={item.step} className="seo-step">
                <div className="seo-step-num">{item.step}</div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Insider Data Matters ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner">
          <div className="seo-section-header">
            <h2>Why Insider Trading Data Matters</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>
              Corporate insiders have information the market doesn&apos;t. Their required disclosures are public — and revealing.
            </p>
          </div>
          <div className="seo-grid-3">
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                ),
                title: '2-Day Disclosure Window',
                desc: 'Corporate insiders must disclose trades within 2 business days of execution. That means you get timely, actionable data — not stale filings from months ago.',
                color: 'blue',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                ),
                title: 'Buying Is a Stronger Signal',
                desc: 'Insiders sell for many reasons: diversification, taxes, personal needs. But they only buy for one reason — they expect the stock to go up. Insider purchases carry the highest signal strength.',
                color: 'green',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                ),
                title: 'Patterns Across Multiple Insiders',
                desc: 'A single insider buying is interesting. Multiple insiders buying simultaneously is a powerful signal of internal confidence. Tracking patterns across filings reveals conviction.',
                color: 'purple',
              },
            ].map(f => (
              <div key={f.title} className="seo-card">
                <div className={`seo-card-icon seo-card-icon-${f.color}`}>{f.icon}</div>
                <div className="seo-card-title">{f.title}</div>
                <div className="seo-card-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's Included ── */}
      <section className="seo-section">
        <div className="seo-section-inner">
          <div className="seo-section-header">
            <h2>What&apos;s Included in Market Intel</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-grid-3">
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
                title: 'Insider Trades (SEC Form 4)',
                desc: 'See exactly who bought or sold, how many shares, the price per share, and the transaction date — all from official SEC EDGAR filings.',
                color: 'blue',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                ),
                title: 'Quick Filters',
                desc: 'Filter insider transactions by type — Buy, Sell, Award, or Gift — or search by any ticker symbol. Spot what matters in seconds.',
                color: 'purple',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                ),
                title: 'Earnings Calendar',
                desc: 'View upcoming earnings dates with EPS estimates and surprise history. Know when companies report before the move happens.',
                color: 'green',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                ),
                title: 'IPO Calendar',
                desc: 'Track upcoming IPOs — company name, expected price range, exchange, and date. Never miss a major market debut.',
                color: 'yellow',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                    <line x1="2" y1="20" x2="22" y2="20"/>
                  </svg>
                ),
                title: 'Economic Indicators',
                desc: 'Real FRED data — GDP growth, unemployment rate, inflation (CPI), and more. Understand the macro backdrop before you trade.',
                color: 'red',
              },
            ].map(f => (
              <div key={f.title} className="seo-card">
                <div className={`seo-card-icon seo-card-icon-${f.color}`}>{f.icon}</div>
                <div className="seo-card-title">{f.title}</div>
                <div className="seo-card-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tickers covered ── */}
      <section className="seo-section-alt">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Tickers Covered</h2>
            <div className="seo-divider" />
            <p style={{ marginTop: '20px' }}>
              Insider filings tracked for these 10 major companies and funds — plus search any ticker.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '28px',
          }}>
            {[
              'AAPL — Apple', 'MSFT — Microsoft', 'NVDA — NVIDIA', 'TSLA — Tesla',
              'AMZN — Amazon', 'META — Meta', 'GOOGL — Alphabet', 'JPM — JPMorgan',
              'V — Visa', 'SPY — S&P 500 ETF',
            ].map(ticker => (
              <div key={ticker} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-1)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {ticker}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="seo-section">
        <div className="seo-section-inner-narrow">
          <div className="seo-section-header">
            <h2>Frequently Asked Questions</h2>
            <div className="seo-divider" />
          </div>
          <div className="seo-faq-list">
            {[
              {
                q: 'Is this data accurate?',
                a: 'Yes. Data is sourced directly from SEC EDGAR via Finnhub. All Form 4 filings are official disclosures submitted by corporate insiders — the same data institutional investors use.',
              },
              {
                q: 'How often is the data updated?',
                a: 'Insider transaction data is cached for 30 minutes and refreshes automatically from SEC filings. New Form 4 disclosures are typically processed within 30 minutes of submission.',
              },
              {
                q: 'Do I need an account to use Market Intel?',
                a: 'No. Market Intel is completely free for all users. No account, no credit card, no sign-up required.',
              },
              {
                q: 'What tickers are covered?',
                a: 'We cover AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL, JPM, V, and SPY by default. You can also use the search bar to look up insider filings for any publicly traded company.',
              },
              {
                q: 'What do the transaction types mean?',
                a: 'Buy = open market purchase by the insider. Sell = disposition of shares (open market sale). Award = stock grant from the company (compensation). Gift = gifted shares (to charity or family). F = shares withheld to cover tax obligations on a vesting event.',
              },
            ].map(item => (
              <div key={item.q} className="seo-faq-item">
                <div className="seo-faq-q">
                  <span>{item.q}</span>
                  <span className="seo-faq-q-icon">+</span>
                </div>
                <div className="seo-faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section style={{
        padding: '16px 24px',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(180,180,200,0.55)', lineHeight: 1.6 }}>
            Insider transaction data is sourced from SEC EDGAR via Finnhub and other public/reference feeds and is provided for informational purposes only. Data can be delayed, amended, incomplete, or categorized differently by source. This is not financial advice. Past insider activity does not guarantee future stock performance. Always confirm filings and dates with official sources before acting.
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="seo-cta-section">
        <div className="seo-cta-inner">
          <h2 className="seo-cta-h2">Start Tracking Insider Activity</h2>
          <p className="seo-cta-sub">
            Free SEC Form 4 data, earnings calendar, IPO tracker, and economic indicators — all in one place. No account required.
          </p>
          <Link href="/?view=market-intel" className="seo-cta-btn">
            Open Market Intel
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
      </section>

      {/* ── Related ── */}
      <section className="seo-related-section">
        <div className="seo-section-inner-narrow">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '24px', color: 'var(--text-0)' }}>
            You Might Also Like
          </h2>
          <div className="seo-related-grid">
            {[
              { href: '/best-trading-journal', title: 'Trading Journal', desc: 'Log, analyze, and improve your trades' },
              { href: '/prop-firm-tracker', title: 'Prop Firm Tracker', desc: 'Track drawdown and daily loss limits in real-time' },
              { href: '/trading-calculators', title: '30+ Calculators', desc: 'Position sizing, risk/reward, Greeks, and more' },
              { href: '/futures-trading-journal', title: 'Futures Journal', desc: 'Track NQ, ES, CL with tick-based P&L' },
            ].map(item => (
              <Link key={item.href} href={item.href} className="seo-related-card">
                <div className="seo-related-card-title">{item.title}</div>
                <div className="seo-related-card-desc">{item.desc}</div>
              </Link>
            ))}
          </div>
          <div className="seo-guide-links">
            <h3>Related Guides</h3>
            <ul>
              {[
                { href: '/best-trading-journal', text: 'Best Trading Journal for Day Traders 2026' },
                { href: '/prop-firm-tracker', text: 'Prop Firm Tracker — Monitor Rules in Real-Time' },
                { href: '/trading-calculators', text: '30+ Free Trading Calculators' },
                { href: '/futures-trading-journal', text: 'Futures Trading Journal — Track NQ, ES, CL' },
                { href: '/options-trading-journal', text: 'Options Trading Journal — Track Greeks & Strategies' },
              ].map(link => (
                <li key={link.href}><Link href={link.href}>→ {link.text}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="seo-footer">
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px' }}>
          Insider transaction data sourced from SEC EDGAR via Finnhub. Provided for informational purposes only.
          This is not financial advice. Trading involves risk. Always verify data with official sources.
        </p>
        <p>© 2026 TradVue. Not financial advice. Trading involves risk.</p>
        <p><Link href="/legal/disclaimer">Disclaimer</Link>{' • '}<Link href="/legal/privacy">Privacy</Link></p>
      </footer>
    </div>
  )
}
