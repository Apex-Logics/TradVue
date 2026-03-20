'use client'

/**
 * /integrations — NinjaTrader 8 Setup & Webhook Management
 *
 * Sections:
 *   Header — Title, subtitle, compatibility badge
 *   1. Step-by-Step Install Guide (numbered accordion, 5 steps)
 *   2. What Gets Captured (info box)
 *   3. Troubleshooting (collapsible)
 *   4. Security & Privacy
 *   5. Webhook URL (generate, copy, rotate, delete)
 *   6. Recent Events Log (auto-refresh)
 *   7. Token Management (multi-token list)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { API_BASE } from '../lib/api'
import PersistentNav from '../components/PersistentNav'

// ── Types ──────────────────────────────────────────────────────────────────────

interface WebhookToken {
  id: number
  token: string
  label: string
  source: string
  is_active: boolean
  last_used_at: string | null
  trade_count: number
  created_at: string
}

interface WebhookEvent {
  id: number
  token_id: number
  source_ip: string
  parsed_ticker: string | null
  parsed_action: string | null
  parsed_price: number | null
  parsed_quantity: number | null
  trade_id: number | null
  status: 'received' | 'matched' | 'ignored' | 'error' | 'test'
  error_message: string | null
  created_at: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const WEBHOOK_BASE = 'https://tradvue-api.onrender.com/api/webhook/nt'

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function maskToken(token: string): string {
  return token.slice(0, 6) + '...'
}

// ── Copy hook ──────────────────────────────────────────────────────────────────

function useCopyText() {
  const { showToast } = useToast()
  return useCallback(async (text: string, label = 'Copied!') => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    showToast(label, 'success', 2500)
  }, [showToast])
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

// ── Reusable components ────────────────────────────────────────────────────────

function SectionCard({ title, children, subtitle }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-1, #1a1a2e)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '24px 20px',
      marginBottom: 20,
    }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-3, #6b7280)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: 0,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 13, color: 'var(--text-2, #9ca3af)', margin: '6px 0 0', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    green:   { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   text: '#4ade80' },
    yellow:  { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)',   text: '#fbbf24' },
    red:     { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', text: '#f87171' },
    blue:    { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  text: '#a78bfa' },
    purple:  { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  text: '#a78bfa' },
    teal:    { bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.3)',  text: '#2dd4bf' },
    gray:    { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: '#9ca3af' },
  }
  const c = colorMap[color] || colorMap.gray
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 20,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function InlineButton({
  onClick, disabled, variant = 'default', children, small,
}: {
  onClick: () => void; disabled?: boolean; variant?: 'default' | 'danger' | 'primary' | 'ghost';
  children: React.ReactNode; small?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-1, #e5e7eb)' },
    primary: { background: 'rgba(139,92,246,0.2)',   border: '1px solid rgba(139,92,246,0.4)',   color: '#a78bfa' },
    danger:  { background: 'rgba(248,113,113,0.1)',  border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' },
    ghost:   { background: 'transparent',            border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-2, #9ca3af)' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '6px 12px' : '8px 14px',
      borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      transition: 'opacity 0.15s', ...styles[variant],
    }}>
      {children}
    </button>
  )
}

// ── Code inline ────────────────────────────────────────────────────────────────

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontFamily: 'monospace',
      background: 'rgba(255,255,255,0.08)',
      padding: '2px 6px',
      borderRadius: 4,
      fontSize: 11,
      color: '#a78bfa',
    }}>
      {children}
    </code>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Step-by-Step Install Guide
// ══════════════════════════════════════════════════════════════════════════════

function InstallGuide({ webhookUrl, tokens, loading, onGenerate, generating }: {
  webhookUrl: string | null;
  tokens: WebhookToken[];
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
}) {
  const [openStep, setOpenStep] = useState<number | null>(1)
  const copyText = useCopyText()

  const steps = [
    {
      n: 1,
      title: 'Download the TradVue Addon',
      content: (
        <div>
          <p style={bodyText}>
            Download <strong style={highlight}>TradVueAutoJournal.zip</strong> — the NinjaScript Add-On that connects NinjaTrader 8 to your TradVue account.
          </p>
          <a
            href="/downloads/TradVueAutoJournal.zip"
            download="TradVueAutoJournal.zip"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '12px 22px',
              background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(139,92,246,0.35)',
            }}
          >
            <IconDownload />
            Download TradVueAutoJournal.zip
          </a>
          <p style={{ ...bodyText, marginTop: 10, fontSize: 12, color: 'var(--text-3, #6b7280)' }}>
            NinjaScript Add-On archive — works with NinjaTrader 8.1+
          </p>
        </div>
      ),
    },
    {
      n: 2,
      title: 'Import into NinjaTrader',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={instructionRow}>
            <span style={stepDot}>1</span>
            <span style={bodyText}>In NinjaTrader: <strong style={highlight}>Tools → Import → NinjaScript Add-On</strong></span>
          </div>
          <div style={instructionRow}>
            <span style={stepDot}>2</span>
            <span style={bodyText}>Select the <Code>TradVueAutoJournal.zip</Code> file you downloaded</span>
          </div>
          <div style={instructionRow}>
            <span style={stepDot}>3</span>
            <span style={bodyText}>NinjaTrader will compile and install it automatically</span>
          </div>
          <div style={{
            marginTop: 4, padding: '10px 14px',
            background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
            borderRadius: 8, fontSize: 12, color: '#fbbf24', lineHeight: 1.6,
          }}>
            <strong>⚠️ If import fails:</strong> Copy <Code>TradVueAutoJournal.cs</Code> from inside the zip to{' '}
            <Code>Documents\NinjaTrader 8\bin\Custom\Indicators\</Code> and compile (F5) in the NinjaScript Editor
          </div>
        </div>
      ),
    },
    {
      n: 3,
      title: 'Generate Your Webhook URL',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={bodyText}>
            Your webhook URL is how NinjaTrader sends trade data to your TradVue account. Generate one below and copy it for the next step.
          </p>
          {loading ? (
            <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</div>
          ) : !webhookUrl ? (
            <div>
              <p style={{ ...bodyText, marginBottom: 12 }}>No webhook URL yet. Generate one to get started.</p>
              <button onClick={onGenerate} disabled={generating} style={{
                padding: '11px 22px',
                background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                border: 'none', borderRadius: 10, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
              }}>
                {generating ? 'Generating…' : '⚡ Generate Webhook URL'}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 8px' }}>Your webhook URL:</p>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '10px 12px',
              }}>
                <code style={{ flex: 1, fontSize: 11, color: '#a78bfa', fontFamily: 'monospace', wordBreak: 'break-all', minWidth: 0 }}>
                  {webhookUrl}
                </code>
                <button onClick={() => copyText(webhookUrl, 'Webhook URL copied!')} style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px',
                  background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                  border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  <IconCopy /> Copy
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 0' }}>
                Keep this URL private. If compromised, rotate it below.
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      n: 4,
      title: 'Configure the Indicator',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={bodyText}>Add TradVueAutoJournal to any chart:</p>
          <div style={instructionRow}>
            <span style={stepDot}>1</span>
            <span style={bodyText}>Right-click chart → <strong style={highlight}>Indicators</strong> → find <strong style={highlight}>TradVueAutoJournal</strong> → Add</span>
          </div>
          <p style={{ ...bodyText, marginTop: 4 }}>In the indicator settings, configure:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { param: 'Webhook URL', desc: 'Paste your webhook URL from Step 3' },
              { param: 'Account Name', desc: 'Enter your account name (e.g. 1779953) to track only that account. Leave blank to track all accounts.' },
              { param: 'Send Entries', desc: '✅ Enabled (recommended)' },
              { param: 'Send Exits', desc: '✅ Enabled (recommended)' },
              { param: 'Log to Output', desc: '✅ Enabled for troubleshooting — disable once confirmed working' },
            ].map(item => (
              <div key={item.param} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, fontWeight: 700, color: '#a78bfa', minWidth: 110 }}>{item.param}</span>
                <span style={{ color: 'var(--text-2, #9ca3af)' }}>— {item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      n: 5,
      title: 'Start Trading',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={instructionRow}>
            <span style={{ fontSize: 18 }}>1️⃣</span>
            <span style={bodyText}>Place a trade — you should see <Code>[TradVue] ENTRY...</Code> in the NinjaTrader Output window</span>
          </div>
          <div style={instructionRow}>
            <span style={{ fontSize: 18 }}>2️⃣</span>
            <span style={bodyText}>Your trade will appear in your TradVue Journal within 30 seconds</span>
          </div>
          <div style={{ ...instructionRow, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ fontSize: 18 }}>🎉</span>
            <span style={{ ...bodyText, color: '#4ade80', fontWeight: 600 }}>That&apos;s it — every trade auto-journals from now on</span>
          </div>
        </div>
      ),
    },
  ]

  return (
    <SectionCard title="5-Step Setup Guide">
      {steps.map(step => (
        <div key={step.n} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setOpenStep(openStep === step.n ? null : step.n)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 0', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
              background: openStep === step.n ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.12)',
              border: `1px solid ${openStep === step.n ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.3)'}`,
              color: '#a78bfa', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}>
              {step.n}
            </span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--text-0, #f9fafb)' }}>
              {step.title}
            </span>
            <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>
              <IconChevron open={openStep === step.n} />
            </span>
          </button>

          {openStep === step.n && (
            <div style={{ padding: '0 0 20px 44px' }}>
              {step.content}
            </div>
          )}
        </div>
      ))}
    </SectionCard>
  )
}

// ── Inline styles ──────────────────────────────────────────────────────────────

const bodyText: React.CSSProperties = {
  fontSize: 13, color: 'var(--text-2, #9ca3af)', margin: 0, lineHeight: 1.7,
}
const highlight: React.CSSProperties = {
  color: 'var(--text-0, #f9fafb)',
}
const instructionRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
}
const stepDot: React.CSSProperties = {
  flexShrink: 0,
  width: 20, height: 20,
  borderRadius: '50%',
  background: 'rgba(139,92,246,0.15)',
  border: '1px solid rgba(139,92,246,0.3)',
  color: '#a78bfa',
  fontSize: 11, fontWeight: 800,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginTop: 1,
}

// ══════════════════════════════════════════════════════════════════════════════
// What Gets Captured
// ══════════════════════════════════════════════════════════════════════════════

function WhatGetsCaptured() {
  return (
    <div style={{
      background: 'rgba(139,92,246,0.06)',
      border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 14,
      padding: '18px 20px',
      marginBottom: 20,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        📊 What Gets Captured
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[
          'Symbol (e.g. ES, NQ, MES, CL)',
          'Direction — Long or Short',
          'Entry price & exit price',
          'Quantity',
          'P&L (with futures multiplier)',
          'Timestamp',
        ].map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
            <span style={{ color: '#4ade80' }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div style={{
        padding: '10px 14px',
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 8, fontSize: 12, color: '#4ade80', fontWeight: 600,
      }}>
        🔒 We NEVER see your account number, balance, or broker credentials
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Troubleshooting (collapsible)
// ══════════════════════════════════════════════════════════════════════════════

function Troubleshooting() {
  const [open, setOpen] = useState(false)

  const items = [
    {
      problem: 'Output window shows nothing',
      fix: 'Make sure the indicator is added to a chart and is enabled (check Enabled in indicator settings)',
    },
    {
      problem: '403 Forbidden error',
      fix: 'Check that your webhook URL uses /nt/ not /tv/ — old tokens may have the wrong path',
    },
    {
      problem: 'P&L shows $0',
      fix: 'Make sure both Send Entries and Send Exits are enabled in the indicator settings',
    },
    {
      problem: 'Duplicate trades',
      fix: 'Set Account Name to your specific account number (e.g. 1779953) to avoid copy-trade duplicates',
    },
    {
      problem: 'Trades show but no exit',
      fix: 'Wait 30 seconds — the poller updates exits automatically once the exit fill is received',
    },
  ]

  return (
    <div style={{
      background: 'var(--bg-1, #1a1a2e)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            🛠 Troubleshooting
          </h2>
          {!open && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '4px 0 0' }}>Common issues and how to fix them</p>
          )}
        </div>
        <span style={{ color: 'var(--text-3)', flexShrink: 0, marginLeft: 12 }}>
          <IconChevron open={open} />
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => (
              <div key={item.problem} style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', marginBottom: 4 }}>
                  &ldquo;{item.problem}&rdquo;
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  → {item.fix}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Security & Privacy
// ══════════════════════════════════════════════════════════════════════════════

function SecuritySection() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: '18px 20px',
      marginBottom: 20,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#4ade80' }}><IconShield /></span> Security & Privacy
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { icon: '✅', text: 'Data sent: symbol, price, qty, direction, time only' },
          { icon: '❌', text: 'Data NOT sent: account numbers, balances, credentials, broker info' },
          { icon: '🔐', text: 'All data encrypted via HTTPS' },
          { icon: '🔑', text: 'Revoke access anytime by deleting your webhook token' },
        ].map(item => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
        TradVue is not affiliated with NinjaTrader LLC. This integration is provided as-is. The addon is read-only — it cannot place, modify, or cancel orders.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '10px 0 0', lineHeight: 1.6 }}>
        🔌 You can disconnect NinjaTrader anytime from your{' '}
        <a href="/account" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>Account Settings</a>
        {' '}page.
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Webhook URL Section
// ══════════════════════════════════════════════════════════════════════════════

function WebhookURLSection({ tokens, loading, onGenerate, onRotate, onDelete, generating }: {
  tokens: WebhookToken[]; loading: boolean; onGenerate: () => void;
  onRotate: (id: number) => void; onDelete: (id: number) => void; generating: boolean;
}) {
  const copyText = useCopyText()
  const [rotateConfirm, setRotateConfirm] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const primaryToken = tokens.find(t => t.is_active) || tokens[0]
  const webhookUrl = primaryToken ? `${WEBHOOK_BASE}/${primaryToken.token}` : null

  function getStatus(tk: WebhookToken) {
    if (!tk.is_active) return { icon: '🔴', label: 'Disabled' }
    if (!tk.last_used_at) return { icon: '🟡', label: 'Active — no trades yet' }
    return { icon: '🟢', label: `Active · Last event ${timeAgo(tk.last_used_at)}` }
  }

  if (loading) return (
    <SectionCard title="Your Webhook URL">
      <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</div>
    </SectionCard>
  )

  return (
    <SectionCard title="Your Webhook URL" subtitle="Paste this URL into the NinjaTrader indicator's Webhook URL parameter.">
      {!primaryToken ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16 }}>
            No webhook URL yet. Generate one to get started.
          </p>
          <button onClick={onGenerate} disabled={generating} style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
            border: 'none', borderRadius: 12, color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
          }}>
            {generating ? 'Generating…' : '⚡ Generate Webhook URL'}
          </button>
        </div>
      ) : (
        <>
          {(() => {
            const s = getStatus(primaryToken)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.label}</span>
              </div>
            )
          })()}

          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <code style={{ flex: 1, fontSize: 12, color: '#a78bfa', fontFamily: 'monospace', wordBreak: 'break-all', minWidth: 0 }}>
              {webhookUrl}
            </code>
            <button onClick={() => copyText(webhookUrl!, 'Webhook URL copied!')} style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 14px',
              background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
              border: 'none', borderRadius: 8, color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <IconCopy /> Copy URL
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {rotateConfirm === primaryToken.id ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '8px 14px',
                background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
                borderRadius: 8, fontSize: 13, color: '#fbbf24',
              }}>
                <span>⚠️ This will break the NinjaTrader connection. Sure?</span>
                <button onClick={() => { onRotate(primaryToken.id); setRotateConfirm(null) }} style={{
                  padding: '4px 12px', background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.4)',
                  borderRadius: 6, color: '#fbbf24', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>Yes, rotate</button>
                <button onClick={() => setRotateConfirm(null)} style={{
                  padding: '4px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, color: 'var(--text-2)', fontSize: 12, cursor: 'pointer',
                }}>Cancel</button>
              </div>
            ) : (
              <InlineButton onClick={() => setRotateConfirm(primaryToken.id)} variant="ghost">
                🔄 Rotate URL
              </InlineButton>
            )}

            {deleteConfirm === primaryToken.id ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '8px 14px',
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 8, fontSize: 13, color: '#f87171',
              }}>
                <span>Delete this token? You&apos;ll need to reconfigure NinjaTrader.</span>
                <button onClick={() => { onDelete(primaryToken.id); setDeleteConfirm(null) }} style={{
                  padding: '4px 12px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: 6, color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>Delete</button>
                <button onClick={() => setDeleteConfirm(null)} style={{
                  padding: '4px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, color: 'var(--text-2)', fontSize: 12, cursor: 'pointer',
                }}>Cancel</button>
              </div>
            ) : (
              <InlineButton onClick={() => setDeleteConfirm(primaryToken.id)} variant="danger">
                🗑 Delete
              </InlineButton>
            )}
          </div>
        </>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Recent Events Log
// ══════════════════════════════════════════════════════════════════════════════

function EventsSection({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/webhooks/events?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load events')
      const data = await res.json()
      setEvents(data.events || [])
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchEvents() }, [fetchEvents, refreshKey])

  useEffect(() => {
    intervalRef.current = setInterval(() => { if (!document.hidden) fetchEvents() }, 30000)
    const onVisibility = () => { if (!document.hidden) fetchEvents() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchEvents])

  function statusBadge(status: WebhookEvent['status']) {
    const map: Record<string, { icon: string; label: string; color: string }> = {
      matched:  { icon: '✅', label: 'Matched',   color: 'green' },
      received: { icon: '⏳', label: 'Received',  color: 'blue' },
      ignored:  { icon: '⚠️', label: 'Unmatched', color: 'yellow' },
      error:    { icon: '❌', label: 'Error',      color: 'red' },
      test:     { icon: '🔌', label: 'Test',       color: 'teal' },
    }
    const s = map[status] || map.ignored
    return <Badge label={`${s.icon} ${s.label}`} color={s.color} />
  }

  return (
    <SectionCard title="Recent Events" subtitle="Last 50 webhook events received from NinjaTrader. Refreshes every 30 seconds.">
      {loading ? (
        <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading events…</div>
      ) : error ? (
        <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-2)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <p style={{ margin: 0 }}>No events yet. Complete the setup above and place a trade — it&apos;ll appear here within seconds.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Time', 'Ticker', 'Action', 'Price', 'Status', 'Trade'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 50).map((ev, i) => (
                <tr key={ev.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '10px 10px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{timeAgo(ev.created_at)}</td>
                  <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--text-0)' }}>{ev.parsed_ticker || '—'}</td>
                  <td style={{ padding: '10px 10px' }}>
                    {ev.parsed_action ? (
                      <span style={{ fontWeight: 700, color: ev.parsed_action === 'buy' ? '#4ade80' : '#f87171', textTransform: 'capitalize' }}>
                        {ev.parsed_action === 'buy' ? '▲ Long' : '▼ Short'}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-1)', fontFamily: 'monospace', fontSize: 12 }}>
                    {ev.parsed_price != null ? `$${ev.parsed_price.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 10px' }}>{statusBadge(ev.status)}</td>
                  <td style={{ padding: '10px 10px' }}>
                    {ev.trade_id ? (
                      <a href={`/journal?trade=${ev.trade_id}`} style={{ color: '#a78bfa', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>View →</a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Token Management (multi-token)
// ══════════════════════════════════════════════════════════════════════════════

function TokenManagementSection({ tokens, onDelete, onGenerate, generating }: {
  tokens: WebhookToken[]; onDelete: (id: number) => void; onGenerate: () => void; generating: boolean;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  if (tokens.length <= 1) return null

  return (
    <SectionCard title="Token Management" subtitle={`You have ${tokens.length} webhook token${tokens.length !== 1 ? 's' : ''}. Max 5 per account.`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tokens.map(tk => (
          <div key={tk.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', marginBottom: 2 }}>{tk.label}</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-3)' }}>{maskToken(tk.token)}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
              {tk.last_used_at ? timeAgo(tk.last_used_at) : 'Never used'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
              {tk.trade_count} trade{tk.trade_count !== 1 ? 's' : ''}
            </div>
            <Badge label={tk.is_active ? '🟢 Active' : '🔴 Inactive'} color={tk.is_active ? 'green' : 'red'} />
            {deleteConfirm === tk.id ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { onDelete(tk.id); setDeleteConfirm(null) }} style={{
                  padding: '4px 10px', background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: 6, color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>Confirm</button>
                <button onClick={() => setDeleteConfirm(null)} style={{
                  padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, color: 'var(--text-2)', fontSize: 12, cursor: 'pointer',
                }}>Cancel</button>
              </div>
            ) : (
              <InlineButton onClick={() => setDeleteConfirm(tk.id)} variant="danger" small>Delete</InlineButton>
            )}
          </div>
        ))}
      </div>
      {tokens.length < 5 && (
        <button onClick={onGenerate} disabled={generating} style={{
          marginTop: 14, padding: '8px 16px',
          background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)',
          borderRadius: 10, color: '#a78bfa', fontSize: 13, fontWeight: 600,
          cursor: generating ? 'wait' : 'pointer',
        }}>
          {generating ? 'Generating…' : '+ Add Another Token'}
        </button>
      )}
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════

export default function IntegrationsPage() {
  const router = useRouter()
  const { user, token, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  const [tokens, setTokens] = useState<WebhookToken[]>([])
  const [tokensLoading, setTokensLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0)

  const fetchTokens = useCallback(async () => {
    if (!token) return
    setTokensLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/webhooks/tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load tokens')
      const data = await res.json()
      setTokens(data.tokens || [])
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load tokens', 'error')
    } finally {
      setTokensLoading(false)
    }
  }, [token, showToast])

  useEffect(() => {
    if (!authLoading && token) fetchTokens()
    else if (!authLoading) setTokensLoading(false)
  }, [authLoading, token, fetchTokens])

  async function handleGenerate() {
    if (!token) return
    setGenerating(true)
    try {
      const res = await fetch(`${API_BASE}/api/webhooks/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: 'NinjaTrader' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate token')
      showToast('Webhook URL generated!', 'success')
      await fetchTokens()
      setEventsRefreshKey(k => k + 1)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to generate token', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRotate(id: number) {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/webhooks/tokens/${id}/rotate`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to rotate token')
      showToast('Webhook URL rotated! Update your NinjaTrader indicator settings.', 'warning', 6000)
      await fetchTokens()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to rotate token', 'error')
    }
  }

  async function handleDelete(id: number) {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/webhooks/tokens/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete token')
      }
      showToast('Webhook token deleted', 'success')
      await fetchTokens()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete token', 'error')
    }
  }

  const primaryToken = tokens.find(t => t.is_active) || tokens[0]
  const webhookUrl = primaryToken ? `${WEBHOOK_BASE}/${primaryToken.token}` : null

  if (authLoading) {
    return (
      <div style={pageStyle}>
        <PersistentNav />
        <div style={{ color: 'var(--text-2)', padding: '80px 0', textAlign: 'center' }}>Loading…</div>
      </div>
    )
  }

  if (!user || !token) {
    return (
      <div style={pageStyle}>
        <PersistentNav />
        <div style={{ maxWidth: 440, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-0)', marginBottom: 12 }}>
            Sign in to access Integrations
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>
            You need to be signed in to manage your webhook integrations.
          </p>
          <button onClick={() => router.push('/')} style={primaryBtnStyle}>Go to sign in →</button>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <PersistentNav />
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '36px 20px 80px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 30 }}>📊</span>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--text-0)', letterSpacing: '-0.03em', margin: 0 }}>
              Connect NinjaTrader 8
            </h1>
          </div>
          <p style={{ fontSize: 16, color: 'var(--text-2)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Auto-journal every futures trade. No manual entry needed.
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 20, fontSize: 12, color: '#a78bfa',
          }}>
            ✓ Works with all NinjaTrader 8 connections — NinjaTrader, Tradovate, Rithmic, CQG
          </div>
        </div>

        {/* ── Connection status pill ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, marginBottom: 24,
        }}>
          <span style={{ fontSize: 20 }}>🖥</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>NinjaTrader 8</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>TradVue Addon — Real-time trade sync</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Badge
              label={tokens.some(t => t.is_active && t.last_used_at) ? '🟢 Connected & active' : tokens.some(t => t.is_active) ? '🟡 Token ready — awaiting first trade' : '⚪ Not configured'}
              color={tokens.some(t => t.is_active && t.last_used_at) ? 'green' : tokens.some(t => t.is_active) ? 'yellow' : 'gray'}
            />
          </div>
        </div>

        {/* ── Main content ── */}
        <InstallGuide
          webhookUrl={webhookUrl}
          tokens={tokens}
          loading={tokensLoading}
          onGenerate={handleGenerate}
          generating={generating}
        />

        <WhatGetsCaptured />
        <Troubleshooting />
        <SecuritySection />

        <WebhookURLSection
          tokens={tokens}
          loading={tokensLoading}
          onGenerate={handleGenerate}
          onRotate={handleRotate}
          onDelete={handleDelete}
          generating={generating}
        />

        <EventsSection token={token} refreshKey={eventsRefreshKey} />
        <TokenManagementSection tokens={tokens} onDelete={handleDelete} onGenerate={handleGenerate} generating={generating} />

      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: 'var(--bg-0, #111827)' }

const primaryBtnStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '13px 20px',
  background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
  border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
}
