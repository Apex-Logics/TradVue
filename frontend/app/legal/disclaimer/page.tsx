import type { Metadata } from 'next'
import { LegalPage, Section, SubSection, UL, OL, WarningBox, InfoBox, AcknowledgmentBox } from '../components'

export const metadata: Metadata = {
  title: 'Disclaimer — ChartGenius',
  description: 'Important legal disclaimer: ChartGenius is not a financial advisor and does not provide investment advice. Read before using the platform.',
  alternates: {
    canonical: 'https://chartgenius.io/legal/disclaimer',
  },
  robots: 'noindex, follow',
}

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" lastUpdated="March 6, 2026">

      <WarningBox>
        <strong>⚠️ IMPORTANT LEGAL NOTICE</strong>
        <br /><br />
        Read this disclaimer carefully before using ChartGenius.
        Your use of the platform constitutes acceptance of all terms outlined below.
      </WarningBox>

      <Section id="not-advice" title="1. NOT FINANCIAL ADVICE">
        <p>
          <strong>ChartGenius is NOT a financial advisor and does NOT provide investment, trading, or financial advice.</strong>
        </p>
        <p>
          ChartGenius is a <strong>financial information and portfolio tracking tool</strong>. It is NOT a registered investment advisor,
          broker-dealer, or tax preparer.
        </p>
        <p>Nothing on ChartGenius — including charts, analysis, indicators, alerts, or any other content — should be construed as:</p>
        <UL items={[
          'A recommendation to buy, sell, or hold any security',
          'An offer to provide financial or investment advice',
          'A solicitation to invest in any particular asset or strategy',
          'Personalized financial guidance based on your situation',
          'Professional investment management services',
          'Tax, legal, or accounting advice',
        ]} />
        <p>
          <strong>All data, calculations, and analysis provided are for informational purposes only</strong> and should not be considered
          financial, investment, tax, or legal advice. ChartGenius is a <strong>research and visualization tool only</strong>. All decisions
          to buy, sell, or trade securities must be made independently by you, preferably with guidance from a qualified financial advisor.
        </p>
        <InfoBox>
          <strong>If you need financial, tax, or legal advice, consult with a licensed financial advisor, tax professional, attorney, broker, or investment professional.</strong>
        </InfoBox>
      </Section>

      <Section id="warranties" title="2. NO WARRANTIES">
        <p>ChartGenius is provided "AS-IS" without any warranties, express or implied. We make no guarantees regarding:</p>

        <SubSection title="2.1 Data Accuracy">
          <UL items={[
            'Market data may contain errors, omissions, or delays',
            'Historical data may be incomplete or inaccurate',
            'Real-time prices may lag actual market conditions',
            'Corporate actions (splits, dividends) may not be reflected immediately',
            'Indicators and calculations may not be perfect',
          ]} />
        </SubSection>

        <SubSection title="2.2 Service Availability">
          <UL items={[
            'The platform may be temporarily unavailable for maintenance',
            'We do not guarantee 24/7 uptime or error-free operation',
            'Service interruptions may occur without notice',
            'Market data feeds may be delayed or disconnected',
            'Features may malfunction due to technical issues',
          ]} />
        </SubSection>

        <SubSection title="2.3 Indicator Reliability">
          <UL items={[
            'Technical indicators are mathematical tools, not guarantees',
            'Past signals do not predict future performance',
            'Indicators may fail or produce misleading results under certain conditions',
            'No indicator is 100% accurate',
          ]} />
        </SubSection>

        <SubSection title="2.4 Watchlist Accuracy">
          <UL items={[
            'Watchlists may not include all available securities',
            'Securities may be added, delisted, or renamed without notice',
            'Real-time alerts may be delayed or missed',
            'Price data may be inaccurate',
          ]} />
        </SubSection>
      </Section>

      <Section id="tax-tools" title="3. TAX ESTIMATION TOOLS">
        <p>
          Tax estimation and tax planning tools on ChartGenius provide <strong>approximate calculations based on user-provided data</strong>.
        </p>
        <p><strong>IMPORTANT:</strong></p>
        <UL items={[
          'Tax estimations are NOT a substitute for professional tax preparation',
          'ChartGenius is NOT a tax preparation service',
          'Tax calculations may contain errors, omissions, or inaccuracies',
          'Tax laws vary by jurisdiction, filing status, income level, and individual circumstances',
          'Past tax treatment does not guarantee future tax results',
          'You must verify all tax calculations with your tax professional before filing',
          'ChartGenius makes NO guarantees about the accuracy of tax calculations',
          'Always consult a qualified tax professional (CPA, tax attorney, or tax preparer) before making tax decisions',
        ]} />
        <WarningBox>
          <strong>ALWAYS consult a qualified tax professional before making any tax decisions or filing your return.</strong>
        </WarningBox>
      </Section>

      <Section id="portfolio-calcs" title="4. PORTFOLIO CALCULATIONS & PERFORMANCE DISCLAIMERS">
        <SubSection title="4.1 Portfolio Performance Estimates">
          <p>
            <strong>Portfolio performance calculations, dividend projections, and gain/loss estimates are approximations and may contain errors.</strong>
          </p>
          <UL items={[
            'Calculations may not reflect actual trading commissions, fees, or slippage',
            'Dividend projections are based on historical dividend data and API estimates; actual dividends may differ',
            'Portfolio valuations may not reflect real-time market conditions',
            'Tax lots, cost basis, and realized/unrealized gains are approximations',
            'Adjustments for corporate actions (splits, mergers) may be delayed or incomplete',
          ]} />
        </SubSection>

        <SubSection title="4.2 Verification Required">
          <p>
            <strong>Always verify all portfolio figures with your broker statements and professional advisors.</strong>
          </p>
          <UL items={[
            'Compare cost basis, share counts, and valuations with your broker',
            'Use broker-supplied documents for tax reporting and accounting records',
            'Do NOT rely solely on ChartGenius calculations for financial reporting or tax filing',
          ]} />
        </SubSection>

        <SubSection title="4.3 Past Performance & Future Results">
          <p>
            <strong>Past performance does not guarantee future results.</strong>
          </p>
          <UL items={[
            'Historical returns are not predictive of future performance',
            'Market conditions change; past winners may underperform',
            'Volatility and risk may increase or decrease unexpectedly',
          ]} />
        </SubSection>
      </Section>

      <Section id="ai-analysis" title="5. AI-GENERATED ANALYSIS">
        <p>
          <strong>AI-generated analysis, summaries, and recommendations are informational only and do NOT constitute personalized investment recommendations.</strong>
        </p>
        <UL items={[
          'AI models may produce inaccurate, outdated, or biased analysis',
          'AI analysis should not be your sole basis for investment decisions',
          'Always conduct your own independent research and due diligence',
          'Consult with professional advisors before acting on AI recommendations',
          'AI analysis may not account for your individual financial situation, goals, or risk tolerance',
        ]} />
      </Section>

      <Section id="responsibility" title="6. CHARTGENIUS RESPONSIBILITY LIMITATIONS">
        <p>
          <strong>ChartGenius is not responsible for any financial decisions made based on information provided by this platform.</strong>
        </p>
        <UL items={[
          'You accept full responsibility for all investment and trading decisions',
          'You accept full responsibility for understanding the risks of trading and investing',
          'ChartGenius is not liable for losses arising from reliance on platform data or analysis',
          'ChartGenius is not liable for missed trading opportunities or market timing errors',
          'You are solely responsible for verifying information before using it',
        ]} />
      </Section>

      <Section id="third-party" title="7. THIRD-PARTY DATA SOURCES">
        <p>ChartGenius uses market data from external sources, including:</p>
        <UL items={[
          'Stock exchanges and market data providers',
          'Cryptocurrency exchanges',
          'Financial data aggregators',
          'News and economic calendars',
          'Broker APIs',
        ]} />
        <p><strong>We are not responsible for:</strong></p>
        <UL items={[
          'Delays in data delivery',
          'Inaccuracies in third-party data',
          'Disruptions in external services',
          'Changes in data availability',
          'Errors introduced by third-party sources',
        ]} />
        <p>
          We do not control, audit, or guarantee the accuracy of third-party data.
          Always verify critical information through official sources.
        </p>
      </Section>

      <Section id="data-limits" title="8. MARKET DATA & DELAY LIMITATIONS">
        <SubSection title="4.1 Real-Time vs. Delayed Data">
          <UL items={[
            'ChartGenius may display delayed data (15–20 minutes behind live market)',
            'During market hours, delays are common',
            'Do NOT use delayed data for time-sensitive trading decisions',
            "For live trading, use your broker's official platform",
          ]} />
        </SubSection>
        <SubSection title="4.2 Price Gaps & Liquidity">
          <UL items={[
            'Charts may show gaps during market closures',
            'Bid-ask spreads are not displayed',
            'Actual execution prices may differ from displayed prices',
            'Low-liquidity securities may have unreliable pricing',
          ]} />
        </SubSection>
        <SubSection title="4.3 Historical Data">
          <UL items={[
            'Historical data may be incomplete for newer securities',
            'Data may be reconstructed or adjusted after market events',
            'Splits and dividends may not be reflected accurately',
            'Free data sources may have limitations',
          ]} />
        </SubSection>
      </Section>

      <Section id="risk" title="9. RISK DISCLAIMER">
        <SubSection title="5.1 Market Risk">
          <UL items={[
            'Financial markets are inherently unpredictable',
            'Past performance does not guarantee future results',
            'Market conditions can change rapidly and dramatically',
            'Unexpected events (geopolitical, economic) can cause sharp price movements',
          ]} />
        </SubSection>
        <SubSection title="5.2 Investment Risk">
          <UL items={[
            'You may lose some or all of your investment',
            'Leverage amplifies both gains and losses',
            'Derivatives (options, futures) carry extreme risk',
            'Volatile assets (crypto) can decline rapidly',
            'Penny stocks and micro-caps are highly speculative',
          ]} />
        </SubSection>
        <SubSection title="5.3 Trading Risk">
          <UL items={[
            'Day trading and short-term trading involve substantial risk',
            'Emotional decision-making often leads to losses',
            'Overconfidence is a common cause of trading failure',
            'Most retail traders lose money',
          ]} />
        </SubSection>
        <WarningBox>
          <strong>If you cannot afford to lose money, DO NOT trade.</strong>
        </WarningBox>
      </Section>

      <Section id="no-personalization" title="10. NO PERSONALIZATION">
        <p>ChartGenius does <strong>NOT</strong>:</p>
        <UL items={[
          'Know your financial situation, goals, or risk tolerance',
          'Consider your income, assets, or liabilities',
          'Assess your investment experience or knowledge',
          'Provide recommendations tailored to your needs',
          'Manage your portfolio or execute trades for you',
        ]} />
        <p>
          Any content on the platform applies equally to all users. Your personal circumstances
          may make any strategy inappropriate for you.
        </p>
      </Section>

      <Section id="prohibited" title="11. PROHIBITED USES">
        <SubSection title="7.1 Securities Law Violations">
          <UL items={[
            'Use the platform to engage in insider trading',
            'Share material non-public information',
            'Manipulate markets or engage in pump-and-dump schemes',
            'Violate SEC, FINRA, or other regulatory rules',
            'Trade without proper licensing if required by law',
          ]} />
        </SubSection>
        <SubSection title="7.2 Unethical Trading">
          <UL items={[
            'Front-run other traders',
            'Engage in spoofing or layering',
            'Use high-frequency or algorithmic trading without proper compliance',
            'Trade based on misrepresented information',
          ]} />
        </SubSection>
        <SubSection title="7.3 Platform Abuse">
          <UL items={[
            'Use bots or automated scrapers without permission',
            'Reverse-engineer the platform',
            'Attempt unauthorized access',
            'Disrupt service for other users',
          ]} />
        </SubSection>
      </Section>

      <Section id="liability" title="12. LIMITATION OF LIABILITY">
        <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong></p>
        <p>ChartGenius shall NOT be liable for ANY losses, damages, or costs, including:</p>
        <UL items={[
          'Trading losses (even if caused by incorrect data)',
          'Lost profits, revenue, or anticipated savings',
          'Loss of data or information',
          'Lost opportunity costs',
          'Emotional distress or frustration',
          'Consequential, incidental, special, or punitive damages',
          'Damages from service interruptions',
          'Damages from third-party services',
        ]} />
        <p>
          <strong>This applies even if ChartGenius was advised of the possibility of such damages.</strong>
        </p>
        <InfoBox>
          <strong>Your sole remedy is discontinuing use of the Service.</strong>
        </InfoBox>
      </Section>

      <Section id="jurisdiction" title="13. JURISDICTIONAL LIMITATIONS">
        <p>ChartGenius may not be available or legal in all jurisdictions. You are responsible for:</p>
        <UL items={[
          'Determining if ChartGenius is legal in your country/state',
          'Complying with all local investment and trading regulations',
          'Understanding tax implications of your trades',
          'Obtaining necessary licenses or permissions',
          'Filing required regulatory documents',
        ]} />
        <p>ChartGenius cannot be held responsible for your violations of local law.</p>
      </Section>

      <Section id="assumption" title="14. ASSUMPTION OF RISK">
        <p><strong>By using ChartGenius, you acknowledge and accept that:</strong></p>
        <UL items={[
          'Trading and investing involve substantial risk of loss',
          'You may lose money using information or tools from ChartGenius',
          'You are making your own trading decisions',
          'You understand the risks involved',
          'You have read and accepted this disclaimer',
          'You will not hold ChartGenius liable for trading losses',
        ]} />
      </Section>

      <Section id="reliance" title="15. RELIANCE ON CONTENT">
        <p>
          <strong>ChartGenius does not guarantee the accuracy or completeness of any content.</strong>{' '}
          Before making any investment decision:
        </p>
        <OL items={[
          'Verify data through official sources (exchanges, company filings, etc.)',
          'Consult with qualified financial professionals',
          'Conduct your own independent research',
          'Do NOT rely solely on information from ChartGenius',
          'Understand that errors or delays may occur',
        ]} />
      </Section>

      <Section id="changes" title="16. CHANGES TO DISCLAIMER">
        <p>
          ChartGenius may update this disclaimer at any time. Your continued use of the platform
          after changes constitutes acceptance of the revised disclaimer.
        </p>
      </Section>

      <Section id="contact" title="17. CONTACT">
        <p>
          Questions about this disclaimer?{' '}
          <a href="mailto:legal@chartgenius.io" style={{ color: '#4a9eff' }}>legal@chartgenius.io</a>
        </p>
        <p>
          Reporting data errors?{' '}
          <a href="mailto:support@chartgenius.io" style={{ color: '#4a9eff' }}>support@chartgenius.io</a>{' '}
          — include "Data Error" in the subject line.
        </p>
      </Section>

      <Section id="agreement" title="18. FULL AGREEMENT">
        <p>
          This disclaimer, combined with our{' '}
          <a href="/legal/terms" style={{ color: '#4a9eff' }}>Terms of Service</a>{' '}
          and{' '}
          <a href="/legal/privacy" style={{ color: '#4a9eff' }}>Privacy Policy</a>,
          constitutes the complete agreement between you and ChartGenius regarding the use of the platform.
        </p>
      </Section>

      <AcknowledgmentBox>
        By using ChartGenius, you certify that you have read this entire disclaimer, understand the risks of
        trading and investing, acknowledge that ChartGenius provides no financial advice, and accept all limitations
        and disclaimers outlined above. <strong>Use at Your Own Risk ⚠️</strong>
      </AcknowledgmentBox>

    </LegalPage>
  )
}
