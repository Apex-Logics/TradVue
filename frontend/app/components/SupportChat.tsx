'use client'

import { useState } from 'react'

// ─── Data ─────────────────────────────────────────────────────────────────────

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  id: string
  label: string
  items: FAQItem[]
}

const FAQ_DATA: FAQCategory[] = [
  {
    id: 'journal',
    label: 'Journal & Trade Log',
    items: [
      {
        question: 'How do I log a trade?',
        answer: "Go to Journal → Trade Log → click '+ Log Trade'. Fill in symbol, entry/exit price, and position size. P&L calculates automatically.",
      },
      {
        question: 'How do I delete a trade?',
        answer: 'In the Trade Log, click on the trade you want to remove, then click the delete/trash icon.',
      },
      {
        question: 'How do I import trades from my broker?',
        answer: "Click 'Import CSV' at the top of the Journal page. We support Robinhood, Fidelity, Schwab, Webull, Tastytrade, E*TRADE, IBKR, and TradeStation formats.",
      },
      {
        question: 'How do I log a futures trade?',
        answer: 'Type a futures symbol (NQ, ES, CL, etc.) in the symbol field — it auto-detects the contract and fills in tick values. Just enter contracts, entry price, and exit price.',
      },
      {
        question: 'How do I log an options trade?',
        answer: "Select 'Options' as the asset type, then fill in strike price, expiration, premium, and strategy type.",
      },
    ],
  },
  {
    id: 'propfirm',
    label: 'Prop Firm Tracker',
    items: [
      {
        question: 'How do I add a prop firm account?',
        answer: "Go to Prop Firm → click '+ Add Account' → select your firm → choose account size → rules auto-populate. You can also choose 'Custom' and enter rules manually.",
      },
      {
        question: 'How do I edit the rules?',
        answer: "Click on your account card → click 'Edit Rules' → modify any field → save.",
      },
      {
        question: 'How do I link journal trades?',
        answer: "When logging a trade in the Journal, select your prop firm account from the 'Prop Firm' dropdown. The trade's P&L will automatically count toward that account.",
      },
      {
        question: "Why don't the numbers match my firm's dashboard?",
        answer: "TradVue tracks drawdown from closed trades only. Your firm tracks intraday drawdown on open positions in real-time. Always use your firm's dashboard as the official source.",
      },
    ],
  },
  {
    id: 'playbooks',
    label: 'Playbooks & Strategies',
    items: [
      {
        question: 'How do I create a custom playbook?',
        answer: "Go to Playbooks → click '+ Create Playbook' → fill in name, description, entry/exit rules, and ideal conditions.",
      },
      {
        question: 'How do I tag a trade with a playbook?',
        answer: "When logging a trade in the Journal, select a playbook from the 'Playbook' dropdown.",
      },
    ],
  },
  {
    id: 'ritual',
    label: 'Post-Trade Ritual',
    items: [
      {
        question: 'How does the streak work?',
        answer: "Your streak counts consecutive market days (Mon-Fri) where you complete the ritual. Weekends and holidays don't break your streak. Missing a weekday resets it to zero.",
      },
      {
        question: 'How do I edit a completed ritual?',
        answer: "On the Ritual page, if today's entry is complete, click the 'Edit' button to modify it.",
      },
    ],
  },
  {
    id: 'aicoach',
    label: 'AI Coach',
    items: [
      {
        question: "Why don't I see any insights?",
        answer: 'The AI Coach requires a minimum number of trades to generate insights. Log 5 trades for basic stats, 10 for pattern detection, 20 for full analysis, 50 for high-confidence insights.',
      },
      {
        question: 'Is my data sent anywhere?',
        answer: 'No. All analysis runs 100% in your browser. Your trade data never leaves your device.',
      },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    items: [
      {
        question: 'How do I add a holding?',
        answer: "Go to Portfolio → Holdings tab → click 'Add Position' → enter symbol, shares, and cost basis.",
      },
      {
        question: 'What is the DRIP tab?',
        answer: 'DRIP simulates dividend reinvestment projections for stocks in your portfolio. It auto-populates from your holdings.',
      },
    ],
  },
  {
    id: 'calculators',
    label: 'Calculators & Tools',
    items: [
      {
        question: 'Where are the calculators?',
        answer: 'Go to Tools in the navigation. We have 30+ calculators including Position Size, Risk/Reward, Options Greeks, Fibonacci, Compound Growth, and more.',
      },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar & News',
    items: [
      {
        question: 'How do I filter events?',
        answer: 'On the Calendar page, use the type filters (Earnings, Economic, etc.) and impact filters (High/Medium/Low) at the top.',
      },
      {
        question: 'Where does the news come from?',
        answer: 'Our news feed aggregates from major financial publishers including Bloomberg, CNBC, Seeking Alpha, and others. Refreshed every few minutes.',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account & Billing',
    items: [
      {
        question: 'How do I sign up?',
        answer: "Click 'Sign In' in the top navigation → 'Sign Up' → enter your email → verify → done in seconds.",
      },
      {
        question: 'What does Pro include?',
        answer: 'Pro is $24/month (or $16.80/month billed annually — 30% off). Includes unlimited data access, cloud sync, ad-free experience, and all premium features. 3-week free trial, no credit card required.',
      },
      {
        question: 'How do I cancel?',
        answer: "Go to your Account page → click 'Manage Subscription' → cancel through the billing portal.",
      },
      {
        question: 'Is my data safe?',
        answer: 'Your data is saved locally in your browser by default. Sign in to enable cloud sync. We never sell your data.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    items: [
      {
        question: 'Data not loading',
        answer: 'Try: 1) Hard refresh (Ctrl+Shift+R or Cmd+Shift+R), 2) Clear browser cache, 3) Disable ad blockers, 4) Try a different browser (Chrome, Firefox, Safari, Edge).',
      },
      {
        question: 'Charts not showing',
        answer: 'Make sure JavaScript is enabled and ad blockers are disabled. TradingView charts require both.',
      },
      {
        question: 'Lost my data',
        answer: 'If you were using local storage (not signed in), data is stored in your browser. Clearing browser data removes it. Sign in to enable cloud backup.',
      },
    ],
  },
  {
    id: 'contact',
    label: 'Contact Support',
    items: [],
  },
]

// ─── View types ───────────────────────────────────────────────────────────────

type View =
  | { level: 'categories' }
  | { level: 'questions'; categoryId: string }
  | { level: 'answer'; categoryId: string; questionIndex: number }

// ─── Back Button ──────────────────────────────────────────────────────────────

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: '#4a9eff',
        cursor: 'pointer',
        fontSize: 12.5,
        padding: '6px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
        flexShrink: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </button>
  )
}

// ─── Clickable Row ────────────────────────────────────────────────────────────

function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: 'var(--bg-2, #1a1a24)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: 10,
        padding: '11px 14px',
        color: 'var(--text-0, #e0e0e8)',
        fontSize: 13.5,
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        transition: 'background 0.12s, border-color 0.12s',
        flexShrink: 0,
        lineHeight: 1.4,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(74,158,255,0.08)'
        e.currentTarget.style.borderColor = 'rgba(74,158,255,0.25)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-2, #1a1a24)'
        e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,0.08))'
      }}
    >
      <span>{label}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

// ─── Contact Panel ────────────────────────────────────────────────────────────

function ContactPanel({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <BackButton label="Back to categories" onClick={onBack} />
      <div
        style={{
          background: 'var(--bg-2, #1a1a24)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: 10,
          padding: '14px 16px',
          fontSize: 13.5,
          color: 'var(--text-0, #e0e0e8)',
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: '0 0 10px 0' }}>
          Email us at{' '}
          <a href="mailto:support@tradvue.com" style={{ color: '#4a9eff', textDecoration: 'none' }}>
            support@tradvue.com
          </a>{' '}
          — we respond within 24 hours (Mon-Fri).
        </p>
        <p style={{ margin: 0, color: 'var(--text-1, rgba(255,255,255,0.6))' }}>
          Use the Feedback button (bottom right) to report bugs or request features.
        </p>
      </div>
    </div>
  )
}

// ─── Main SupportChat Component ───────────────────────────────────────────────

export default function SupportChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<View>({ level: 'categories' })

  const handleOpen = () => {
    setIsOpen(true)
    setView({ level: 'categories' })
  }

  const handleClose = () => setIsOpen(false)

  const currentCategory =
    view.level !== 'categories'
      ? FAQ_DATA.find(c => c.id === view.categoryId)
      : null

  const currentAnswer =
    view.level === 'answer' && currentCategory
      ? currentCategory.items[view.questionIndex]
      : null

  return (
    <>
      {/* ── Animation keyframes ── */}
      <style>{`
        @keyframes supportChatSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ── FAQ Panel ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="TradVue Support FAQ"
          style={{
            position: 'fixed',
            bottom: 152,
            right: 20,
            width: 'min(380px, calc(100vw - 24px))',
            height: 500,
            background: 'var(--bg-0, #0f0f12)',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(74,158,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 9000,
            animation: 'supportChatSlideUp 0.2s ease-out',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #1a2744 0%, #0f1a33 100%)',
              borderBottom: '1px solid rgba(74,158,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4a9eff 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e8', lineHeight: 1.2 }}>
                TradVue Support
              </div>
              <div style={{ fontSize: 11, color: '#4a9eff', marginTop: 2 }}>
                Help Center
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close support"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#a0a0b0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ── Content Area ── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 14px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            }}
          >
            {/* ── Level 1: Categories ── */}
            {view.level === 'categories' && (
              <>
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--text-2, rgba(255,255,255,0.45))',
                    margin: '0 0 4px 2px',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  How can we help?
                </p>
                {FAQ_DATA.map(category => (
                  <Row
                    key={category.id}
                    label={category.label}
                    onClick={() => setView({ level: 'questions', categoryId: category.id })}
                  />
                ))}
              </>
            )}

            {/* ── Level 2: Questions (Contact handled separately) ── */}
            {view.level === 'questions' && currentCategory && currentCategory.id === 'contact' && (
              <ContactPanel onBack={() => setView({ level: 'categories' })} />
            )}

            {view.level === 'questions' && currentCategory && currentCategory.id !== 'contact' && (
              <>
                <BackButton
                  label="Back to categories"
                  onClick={() => setView({ level: 'categories' })}
                />
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-0, #e0e0e8)',
                    margin: '0 0 4px 2px',
                    flexShrink: 0,
                  }}
                >
                  {currentCategory.label}
                </p>
                {currentCategory.items.map((item, i) => (
                  <Row
                    key={i}
                    label={item.question}
                    onClick={() =>
                      setView({ level: 'answer', categoryId: currentCategory.id, questionIndex: i })
                    }
                  />
                ))}
              </>
            )}

            {/* ── Level 3: Answer ── */}
            {view.level === 'answer' && currentCategory && currentAnswer && (
              <>
                <BackButton
                  label={`Back to ${currentCategory.label}`}
                  onClick={() => setView({ level: 'questions', categoryId: currentCategory.id })}
                />
                <div
                  style={{
                    background: 'var(--bg-2, #1a1a24)',
                    border: '1px solid var(--border, rgba(255,255,255,0.08))',
                    borderRadius: 10,
                    padding: '14px 16px',
                    flexShrink: 0,
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-1, rgba(255,255,255,0.6))',
                      margin: '0 0 8px 0',
                    }}
                  >
                    {currentAnswer.question}
                  </p>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: 'var(--text-0, #e0e0e8)',
                      lineHeight: 1.65,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {currentAnswer.answer}
                  </p>
                </div>
              </>
            )}

            {/* Spacer at bottom */}
            <div style={{ height: 6, flexShrink: 0 }} />
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--border, rgba(255,255,255,0.06))',
              background: 'var(--bg-1, #13131a)',
              flexShrink: 0,
            }}
          >
            <p style={{ fontSize: 11, color: 'var(--text-3, rgba(255,255,255,0.3))', textAlign: 'center', margin: 0 }}>
              Can&apos;t find what you need? Email{' '}
              <a href="mailto:support@tradvue.com" style={{ color: '#4a9eff', textDecoration: 'none' }}>
                support@tradvue.com
              </a>
            </p>
          </div>
        </div>
      )}

      {/* ── Floating Chat Bubble ── */}
      <button
        onClick={isOpen ? handleClose : handleOpen}
        aria-label={isOpen ? 'Close support' : 'Open support'}
        style={{
          position: 'fixed',
          bottom: 84,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: isOpen ? 'rgba(74,158,255,0.9)' : '#4a9eff',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 24px rgba(74,158,255,0.4), 0 2px 8px rgba(0,0,0,0.4)',
          zIndex: 9001,
          transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.06)'
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(74,158,255,0.5), 0 2px 8px rgba(0,0,0,0.4)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(74,158,255,0.4), 0 2px 8px rgba(0,0,0,0.4)'
        }}
      >
        {/* Icon toggles between chat and X */}
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  )
}
