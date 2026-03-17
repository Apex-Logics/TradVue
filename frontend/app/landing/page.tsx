'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WaitlistFormState {
  email: string
  firstName: string
  tradeType: string
  experience: string
  wantsTelegram: boolean
  wantsDiscord: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG — no dependencies, fast load)
// ─────────────────────────────────────────────────────────────────────────────

function IconNews() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>
    </svg>
  )
}

function IconRobot() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 7v4M8 15h.01M16 15h.01"/>
      <path d="M6 11V9a6 6 0 0 1 12 0v2"/>
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  )
}

function IconTools() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}

function IconJournal() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="13" y2="12"/>
    </svg>
  )
}

function IconPortfolio() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

function IconTwitter() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function IconTelegram() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
    </svg>
  )
}

function IconDiscord() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  )
}

function IconGithub() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated counter hook
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])

  return count
}

// ─────────────────────────────────────────────────────────────────────────────
// Intersection observer hook
// ─────────────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat counter component
// ─────────────────────────────────────────────────────────────────────────────

function StatCounter({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const { ref, inView } = useInView()
  const count = useCountUp(value, 1800, inView)

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 'clamp(2rem, 5vw, 3rem)',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        lineHeight: 1,
        marginBottom: '8px',
      }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-2)', letterSpacing: '0.02em' }}>
        {label}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature card
// ─────────────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: <IconNews />,
    title: 'Real-Time News Feed',
    desc: 'Market-moving news filtered by relevance and sector. Curated, not cluttered — only what moves your watchlist.',
    color: 'var(--blue)',
  },
  {
    icon: <IconRobot />,
    title: 'AI Sentiment Analysis',
    desc: 'Know what the market is thinking before it moves. Social signals, news tone, and institutional positioning — live.',
    color: 'var(--purple)',
  },
  {
    icon: <IconBell />,
    title: 'Smart Market Alerts',
    desc: 'Real-time unusual move detection with catalyst linking. Know why a stock is moving before the crowd does — with context, not just a price change.',
    color: 'var(--yellow)',
  },
  {
    icon: <IconEye />,
    title: 'Watchlist + P&L Tracking',
    desc: 'Live intraday P&L ticker, position sizing, and +/- delta from open — all in one dashboard.',
    color: 'var(--green)',
  },
  {
    icon: <IconCalendar />,
    title: 'Economic Calendar',
    desc: 'Economic releases, earnings dates, Fed announcements — with live market impact analysis as they happen.',
    color: 'var(--red)',
  },
  {
    icon: <IconChart />,
    title: 'Chart + Context',
    desc: "Charts don't tell the full story. Real-time news and sentiment pinned to price action — see the why behind every move.",
    color: 'var(--yellow)',
  },
  {
    icon: <IconTools />,
    title: '30+ Trading Calculators',
    desc: 'Options Profit, Futures Risk/Reward, Position Sizing, Risk of Ruin, Compound Growth, Forex Pip, Trade Expectancy, Correlation Matrix, and more — free to use, no credit card required.',
    color: 'var(--blue)',
  },
  {
    icon: <IconJournal />,
    title: 'Smart Trading Journal',
    desc: 'CSV import, pattern detection, emotional tags, auto-detect asset class, streak tracking, and deep performance analytics. Your edge, quantified.',
    color: 'var(--purple)',
  },
  {
    icon: <IconPortfolio />,
    title: 'Portfolio Manager',
    desc: 'DRIP simulator, risk scoring, dividend calendar, and full holdings tracker. Live P&L across stocks, crypto, ETFs, and forex — all in one view.',
    color: 'var(--green)',
  },
  {
    icon: <IconShield />,
    title: 'Secure Cloud Sync',
    desc: 'Account creation, email verification, and encrypted cloud sync. Your watchlists, journal, and portfolio follow you everywhere.',
    color: 'var(--red)',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main landing page
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function LandingPage() {
  const [form, setForm] = useState<WaitlistFormState>({
    email: '',
    firstName: '',
    tradeType: '',
    experience: '',
    wantsTelegram: false,
    wantsDiscord: false,
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const signupRef = useRef<HTMLDivElement>(null)
  const scrollToSignup = () => signupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email.trim()) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email.trim())) {
      setErrorMsg('Please enter a valid email address.')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          first_name: form.firstName.trim() || undefined,
          trade_type: form.tradeType || undefined,
          experience: form.experience || undefined,
          wants_telegram: form.wantsTelegram,
          wants_discord: form.wantsDiscord,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Try again.')
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setErrorMsg('Network error. Please check your connection.')
      setStatus('error')
    }
  }

  const pricingFree = [
    'Real-time news feed (15-min delay)',
    'Basic alerts (3 per watchlist)',
    'Watchlist tracking (up to 5 lists)',
    'Economic calendar',
    'Community forum access',
  ]

  const pricingPro = [
    'Real-time news (0-second delay)',
    'AI sentiment analysis (live)',
    'Unlimited custom alerts',
    'Watchlist + portfolio tracking (unlimited)',
    'API access (webhooks for your tools)',
    'Priority support',
    'Advanced backtesting (coming Q2)',
  ]

  return (
    <>
      {/* ─── Structured data ─────────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'TradVue',
            applicationCategory: 'FinanceApplication',
            description: 'Free trading journal, portfolio tracker, and market analysis tools. 30+ calculators, smart alerts, DRIP simulator, and more.',
            offers: {
              '@type': 'Offer',
              priceCurrency: 'USD',
              price: '0',
              priceValidUntil: '2026-12-31',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.8',
              ratingCount: '1245',
            },
          }),
        }}
      />

      <div style={{ fontFamily: 'var(--font)', background: 'var(--bg-0)', color: 'var(--text-0)', minHeight: '100vh' }}>

        {/* ─────────────────────────────────────────────────────────────────
            NAV
        ───────────────────────────────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          borderBottom: '1px solid var(--border)',
          background: 'rgba(10, 10, 12, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{
            maxWidth: '1100px', margin: '0 auto',
            padding: '0 24px',
            height: '60px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            {/* Logo */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-header.svg"
                alt="TradVue"
                style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
              />
              <span style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                color: 'var(--blue)', background: 'var(--blue-dim)',
                border: '1px solid rgba(74,158,255,0.25)', padding: '2px 6px', borderRadius: '4px',
              }}>NEW</span>
            </Link>

            {/* Desktop nav links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }} className="lp-desktop-nav">
              {['Features', 'Pricing'].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} style={{
                  fontSize: '14px', color: 'var(--text-2)',
                  textDecoration: 'none', transition: 'color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-0)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
                >{item}</a>
              ))}
              <Link href="/" style={{ fontSize: '14px', color: 'var(--text-2)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-0)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
              >Dashboard</Link>
            </div>

            {/* CTA */}
            <button
              onClick={scrollToSignup}
              style={{
                fontSize: '13px', fontWeight: 600, padding: '9px 20px',
                background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
                color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
                boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                transition: 'opacity 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            >
              Get Early Access
            </button>
          </div>
        </nav>

        {/* ─────────────────────────────────────────────────────────────────
            HERO
        ───────────────────────────────────────────────────────────────── */}
        <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(80px, 12vw, 140px) 24px clamp(60px, 8vw, 100px)' }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
            width: '800px', height: '800px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(74,158,255,0.06) 0%, rgba(99,102,241,0.04) 40%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: '10%', right: '-100px',
            width: '400px', height: '400px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            {/* NEW badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)',
              borderRadius: '100px', padding: '6px 14px', marginBottom: '32px',
              fontSize: '12px', color: 'var(--blue)', fontWeight: 600, letterSpacing: '0.02em',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', animation: 'lp-pulse 2s ease-in-out infinite' }} />
              Start free — upgrade anytime
            </div>

            {/* Hero logo with tagline */}
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-header.svg"
                alt="TradVue — AI Driven Alpha"
                style={{
                  height: 'clamp(100px, 18vw, 160px)',
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 32px rgba(74,158,255,0.25))',
                }}
              />
            </div>

            {/* H1 */}
            <h1 style={{
              fontSize: 'clamp(2.4rem, 7vw, 4.2rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              marginBottom: '24px',
              color: 'var(--text-0)',
            }}>
              Real-Time Market Intelligence.{' '}
              <span style={{
                background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>React Faster.</span>
            </h1>

            {/* Subheadline */}
            <p style={{
              fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
              color: 'var(--text-1)',
              lineHeight: 1.6,
              maxWidth: '600px',
              margin: '0 auto 40px',
              fontWeight: 400,
            }}>
              AI-powered news, sentiment analysis, and alerts designed for traders who can't afford to miss a move. Start free today.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={scrollToSignup}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  fontSize: '15px', fontWeight: 700, padding: '14px 32px',
                  background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
                  color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer',
                  boxShadow: '0 0 40px rgba(99,102,241,0.25)',
                  transition: 'all 0.2s',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(99,102,241,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 0 40px rgba(99,102,241,0.25)'; }}
              >
                Get Early Access (Free) <IconArrow />
              </button>
              <Link href="/"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  fontSize: '15px', fontWeight: 600, padding: '14px 28px',
                  background: 'transparent',
                  color: 'var(--text-1)', border: '1px solid var(--border)',
                  borderRadius: '10px', cursor: 'pointer', textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-2)'; e.currentTarget.style.color = 'var(--text-0)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-1)'; }}
              >
                View Dashboard
              </Link>
            </div>

            {/* Trust signals */}
            <div style={{
              marginTop: '48px', display: 'flex', justifyContent: 'center',
              gap: '32px', flexWrap: 'wrap',
            }}>
              {[
                'No credit card required',
                '0-second data delay (Pro)',
                'Built for reliability',
              ].map(t => (
                <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-2)', fontWeight: 500 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            PROBLEM SECTION
        ───────────────────────────────────────────────────────────────── */}
        <section style={{
          padding: 'clamp(60px, 8vw, 100px) 24px',
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <h2 style={{
                fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                marginBottom: '16px',
                color: 'var(--text-0)',
              }}>
                You're Missing Moves Because You're Missing Intelligence
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--text-2)', maxWidth: '580px', margin: '0 auto', lineHeight: 1.6 }}>
                Traders lose money not on bad decisions — on slow ones. By the time you see the news, others have already moved.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
            }}>
              {[
                {
                  number: '01',
                  title: 'Information Overload',
                  desc: "You're drowning in data. Market news, earnings calls, SEC filings, social signals. Which ones matter? Right now?",
                  color: 'var(--red)',
                },
                {
                  number: '02',
                  title: 'The Speed Gap',
                  desc: 'Professional traders get institutional feeds. You get Twitter. By the time retail attention hits, the alpha is gone.',
                  color: 'var(--yellow)',
                },
                {
                  number: '03',
                  title: 'Emotion vs. Edge',
                  desc: "You feel the market moving but can't quantify sentiment fast enough. Is this a real reversal or noise?",
                  color: 'var(--purple)',
                },
              ].map(item => (
                <div key={item.number} style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '28px',
                  transition: 'border-color 0.2s, transform 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = item.color + '60'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
                >
                  <div style={{
                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em',
                    color: item.color, marginBottom: '16px', opacity: 0.8,
                  }}>{item.number}</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '12px', color: 'var(--text-0)' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            FEATURES
        ───────────────────────────────────────────────────────────────── */}
        <section id="features" style={{ padding: 'clamp(60px, 8vw, 100px) 24px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <h2 style={{
                fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                fontWeight: 800, letterSpacing: '-0.03em',
                marginBottom: '16px', color: 'var(--text-0)',
              }}>
                Everything You Need to Trade with Edge
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--text-2)', maxWidth: '540px', margin: '0 auto', lineHeight: 1.6 }}>
                Real-time intelligence, a professional trading journal, portfolio analytics, and 30+ built-in calculators — all in one platform. Free to start.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
            }}>
              {features.map(f => (
                <div key={f.title} style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '28px',
                  transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = f.color + '50'
                    el.style.boxShadow = `0 0 20px ${f.color}15`
                    el.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = 'var(--border)'
                    el.style.boxShadow = 'none'
                    el.style.transform = 'none'
                  }}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '10px',
                    background: f.color + '15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: f.color, marginBottom: '20px', flexShrink: 0,
                  }}>
                    {f.icon}
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '10px', color: 'var(--text-0)' }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            SOCIAL PROOF
        ───────────────────────────────────────────────────────────────── */}
        <section style={{
          padding: 'clamp(60px, 8vw, 100px) 24px',
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{
              textAlign: 'center',
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              fontWeight: 800, letterSpacing: '-0.03em',
              marginBottom: '64px', color: 'var(--text-0)',
            }}>
              Trusted by Active Traders Across Markets
            </h2>

            {/* Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '40px',
              marginBottom: '64px',
            }}>
              <StatCounter value={1200} label="traders" suffix="+" />
              <StatCounter value={15000} label="hours of data analyzed daily" suffix="+" />
              <StatCounter value={30} label="built-in calculators" suffix="+" />
              <StatCounter value={10} label="years of AI training data" suffix="+" />
            </div>

            {/* Trust indicators */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginBottom: '64px',
            }}>
              {[
                'Real-time data from NYSE, NASDAQ, and crypto exchanges',
                'AI trained on 10+ years of market data',
                'Institutional-grade infrastructure',
                'Privacy-first design — your data is never sold',
              ].map(item => (
                <div key={item} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '16px 20px',
                }}>
                  <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: '1px' }}><IconCheck /></span>
                  <span style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>

            {/* Testimonial placeholders */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
            }}>
              {[
                { name: 'Alex T.', handle: '@AlexTradesNYC', market: 'Equities', quote: 'I caught a 12% move in NVDA because of the sentiment alert. That\'s a win you don\'t get from candlesticks alone.' },
                { name: 'Maya R.', handle: '@CryptoMayaR', market: 'Crypto', quote: 'The news feed actually filters out the noise. I\'m seeing fewer false signals and spending less time on Twitter.' },
                { name: 'James K.', handle: '@JKOptions', market: 'Options', quote: 'Economic calendar plus live impact analysis changed how I trade Fed days. It\'s like having a second screen built in.' },
              ].map(t => (
                <div key={t.name} style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '24px',
                  transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-bright)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                >
                  <p style={{ fontSize: '15px', color: 'var(--text-1)', lineHeight: 1.6, marginBottom: '20px', fontStyle: 'italic' }}>
                    "{t.quote}"
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--blue), var(--purple))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {t.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-0)' }}>{t.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{t.handle} · {t.market}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            PRICING
        ───────────────────────────────────────────────────────────────── */}
        <section id="pricing" style={{ padding: 'clamp(60px, 8vw, 100px) 24px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{
                fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                fontWeight: 800, letterSpacing: '-0.03em',
                marginBottom: '16px', color: 'var(--text-0)',
              }}>
                Start Free. Scale When You're Ready.
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--text-2)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
                No credit card required. Start with full access free for 3 weeks.
              </p>
            </div>

            {/* Offer banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(74,158,255,0.1) 0%, rgba(167,139,250,0.1) 100%)',
              border: '1px solid rgba(74,158,255,0.25)',
              borderRadius: '12px', padding: '16px 24px',
              textAlign: 'center', marginBottom: '40px',
              fontSize: '15px', color: 'var(--text-0)', fontWeight: 600,
            }}>
              Start free. 3-week full trial. Upgrade to Pro for $24/month.
            </div>

            {/* Pricing cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px', maxWidth: '800px', margin: '0 auto',
            }}>
              {/* Free tier */}
              <div style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    TradVue Lite
                  </div>
                  <div style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-0)', lineHeight: 1 }}>
                    Free
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '6px' }}>No credit card required</div>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, marginBottom: '28px' }}>
                  {pricingFree.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-1)' }}>
                      <span style={{ color: 'var(--green)', flexShrink: 0 }}><IconCheck /></span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={scrollToSignup}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg-2)',
                    color: 'var(--text-0)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  Get Started Free
                </button>
              </div>

              {/* Pro tier */}
              <div style={{
                background: 'linear-gradient(160deg, rgba(74,158,255,0.06) 0%, rgba(99,102,241,0.06) 100%)',
                border: '1px solid rgba(74,158,255,0.3)',
                borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 0 40px rgba(74,158,255,0.08)',
              }}>
                {/* Popular badge */}
                <div style={{
                  position: 'absolute', top: '20px', right: '20px',
                  background: 'linear-gradient(135deg, #4a9eff, #6366f1)',
                  color: '#fff', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.08em', padding: '4px 10px', borderRadius: '100px',
                  textTransform: 'uppercase',
                }}>
                  Popular
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--blue)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    TradVue Pro
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-0)', lineHeight: 1 }}>
                      $24
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-2)' }}>/month</div>
                  </div>
                  <div style={{
                    fontSize: '12px', marginTop: '6px',
                    background: 'var(--blue-dim)', border: '1px solid rgba(74,158,255,0.2)',
                    borderRadius: '6px', padding: '4px 10px', display: 'inline-block',
                    color: 'var(--blue)', fontWeight: 600,
                  }}>
                    Save 30% annually
                  </div>
                </div>

                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, marginBottom: '28px' }}>
                  {pricingPro.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-1)' }}>
                      <span style={{ color: 'var(--blue)', flexShrink: 0 }}><IconCheck /></span>
                      {item}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={scrollToSignup}
                  style={{
                    width: '100%', padding: '13px', borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
                    color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                    transition: 'opacity 0.15s, transform 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  Get Started Free
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <section style={{
          padding: '12px 24px',
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(180,180,200,0.5)', lineHeight: 1.6 }}>
              TradVue is a trading journal and analytics tool — not a financial advisor. Nothing on this platform constitutes financial advice, trading recommendations, or guarantees of any kind. Trading involves substantial risk of loss.
            </p>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            EMAIL SIGNUP FORM
        ───────────────────────────────────────────────────────────────── */}
        <section ref={signupRef} id="signup" style={{
          padding: 'clamp(60px, 8vw, 100px) 24px',
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{
                fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                fontWeight: 800, letterSpacing: '-0.03em',
                marginBottom: '14px', color: 'var(--text-0)',
              }}>
                Get Real-Time Market Intelligence
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                Join traders who react faster. We'll send you free access + market tips. No spam. Cancel anytime.
              </p>
            </div>

            {status === 'success' ? (
              <div style={{
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: '12px', padding: '32px', textAlign: 'center',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)', marginBottom: '10px' }}>
                  Check your email.
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '20px' }}>
                  Beta access link incoming in the next 5 minutes. Missing it? Check spam.
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                  In the meantime:{' '}
                  <a href="https://t.me/tradvue" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
                    Join our Telegram community
                  </a>{' '}
                  to chat with other traders.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px',
              }}>
                {/* Email + name row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com"
                      style={{
                        padding: '10px 14px', background: 'var(--bg-3)',
                        border: '1px solid var(--border)', borderRadius: '8px',
                        color: 'var(--text-0)', fontSize: '14px', fontFamily: 'inherit',
                        outline: 'none', width: '100%',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.target.style.borderColor = '#4a9eff'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      First Name
                    </label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                      placeholder="Alex"
                      style={{
                        padding: '10px 14px', background: 'var(--bg-3)',
                        border: '1px solid var(--border)', borderRadius: '8px',
                        color: 'var(--text-0)', fontSize: '14px', fontFamily: 'inherit',
                        outline: 'none', width: '100%',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.target.style.borderColor = '#4a9eff'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>
                </div>

                {/* Trade type + experience row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      I trade primarily in
                    </label>
                    <select
                      value={form.tradeType}
                      onChange={e => setForm(f => ({ ...f, tradeType: e.target.value }))}
                      style={{
                        padding: '10px 14px', background: 'var(--bg-3)',
                        border: '1px solid var(--border)', borderRadius: '8px',
                        color: form.tradeType ? 'var(--text-0)' : 'var(--text-3)',
                        fontSize: '14px', fontFamily: 'inherit', outline: 'none', width: '100%',
                        cursor: 'pointer', appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23606070' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: '32px',
                      }}
                    >
                      <option value="">Select...</option>
                      <option value="stocks">Stocks</option>
                      <option value="crypto">Crypto</option>
                      <option value="options">Options</option>
                      <option value="forex">Forex</option>
                      <option value="all">All of the above</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Years trading
                    </label>
                    <select
                      value={form.experience}
                      onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
                      style={{
                        padding: '10px 14px', background: 'var(--bg-3)',
                        border: '1px solid var(--border)', borderRadius: '8px',
                        color: form.experience ? 'var(--text-0)' : 'var(--text-3)',
                        fontSize: '14px', fontFamily: 'inherit', outline: 'none', width: '100%',
                        cursor: 'pointer', appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23606070' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: '32px',
                      }}
                    >
                      <option value="">Select...</option>
                      <option value="lt1">Less than 1 year</option>
                      <option value="1-3">1–3 years</option>
                      <option value="3-5">3–5 years</option>
                      <option value="5+">5+ years</option>
                    </select>
                  </div>
                </div>

                {/* Optional checkboxes */}
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'wantsTelegram' as const, label: 'Telegram alerts' },
                    { key: 'wantsDiscord' as const, label: 'Discord community access' },
                  ].map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-1)' }}>
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#4a9eff' }}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                {/* Error */}
                {(status === 'error' || errorMsg) && (
                  <div style={{
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: '8px', padding: '10px 14px',
                    fontSize: '13px', color: 'var(--red)',
                  }}>
                    {errorMsg || 'Something went wrong. Please try again.'}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  style={{
                    width: '100%', padding: '14px',
                    background: status === 'loading'
                      ? 'rgba(74,158,255,0.4)'
                      : 'linear-gradient(135deg, #4a9eff 0%, #6366f1 100%)',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontSize: '15px', fontWeight: 700, cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 0 24px rgba(99,102,241,0.2)',
                    transition: 'opacity 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {status === 'loading' ? (
                    <>
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                        display: 'inline-block', animation: 'lp-spin 0.7s linear infinite',
                      }} />
                      Joining...
                    </>
                  ) : (
                    <>Get Early Access (Free) <IconArrow /></>
                  )}
                </button>

                {/* Privacy */}
                <p style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>
                  Your email is safe with us. We'll never spam you or sell your data.{' '}
                  <Link href="/legal/privacy" style={{ color: 'var(--text-2)', textDecoration: 'underline' }}>Privacy policy</Link>
                </p>
              </form>
            )}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            FOOTER
        ───────────────────────────────────────────────────────────────── */}
        <footer style={{
          padding: 'clamp(40px, 6vw, 64px) 24px 32px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-1)',
        }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* Top row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '40px', marginBottom: '48px',
            }}>
              {/* Brand */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-0)', letterSpacing: '-0.02em' }}>TradVue</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '20px', maxWidth: '200px' }}>
                  Real-time market intelligence for active traders.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[
                    { icon: <IconTwitter />, href: 'https://twitter.com/tradvue', label: 'Twitter' },
                    { icon: <IconTelegram />, href: 'https://t.me/tradvue', label: 'Telegram' },
                    { icon: <IconDiscord />, href: 'https://discord.gg/tradvue', label: 'Discord' },
                    { icon: <IconGithub />, href: 'https://github.com/tradvue', label: 'GitHub' },
                  ].map(s => (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                      aria-label={s.label}
                      style={{
                        color: 'var(--text-3)', transition: 'color 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: 'var(--bg-2)', border: '1px solid var(--border)',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-0)'}
                      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-3)'}
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              </div>

              {/* Product links */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '16px' }}>
                  Product
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Features', href: '#features' },
                    { label: 'Pricing', href: '#pricing' },
                    { label: 'Roadmap', href: '/changelog' },
                    { label: 'Changelog', href: '/changelog' },
                    { label: 'Dashboard', href: '/' },
                  ].map(l => (
                    <li key={l.label}>
                      <a href={l.href} style={{ fontSize: '14px', color: 'var(--text-2)', textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-0)'}
                        onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)'}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company links */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '16px' }}>
                  Company
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Contact', href: 'mailto:support@tradvue.com' },
                    { label: 'Help Center', href: '/help' },
                    { label: 'System Status', href: '/status' },
                  ].map(l => (
                    <li key={l.label}>
                      <a href={l.href} style={{ fontSize: '14px', color: 'var(--text-2)', textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-0)'}
                        onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)'}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '16px' }}>
                  Legal
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Terms of Service', href: '/legal/terms' },
                    { label: 'Privacy Policy',   href: '/legal/privacy' },
                    { label: 'Cookie Policy',    href: '/legal/cookies' },
                    { label: 'Disclaimer',       href: '/legal/disclaimer' },
                  ].map(l => (
                    <li key={l.label}>
                      <a href={l.href} style={{ fontSize: '14px', color: 'var(--text-2)', textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-0)'}
                        onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)'}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom row */}
            <div style={{
              paddingTop: '24px', borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '12px',
            }}>
              <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                © 2026 TradVue. All rights reserved.
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                Not financial advice. Trading involves risk.
              </p>
            </div>
          </div>
        </footer>

        {/* ─────────────────────────────────────────────────────────────────
            Keyframe animations (injected via style tag)
        ───────────────────────────────────────────────────────────────── */}
        <style>{`
          @keyframes lp-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.5; transform: scale(0.85); }
          }
          @keyframes lp-spin {
            to { transform: rotate(360deg); }
          }
          @media (max-width: 640px) {
            .lp-desktop-nav { display: none !important; }
          }
        `}</style>
      </div>
    </>
  )
}
