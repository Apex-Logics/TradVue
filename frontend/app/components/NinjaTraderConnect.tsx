'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface WebhookToken {
  id: string
  token: string
  label: string
  is_active: boolean
  created_at: string
  last_used_at?: string | null
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function IconX({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconCopy({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconNT({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18M3 21l18-18" />
      <rect x="2" y="2" width="20" height="20" rx="4" />
    </svg>
  )
}

function IconAlert({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

// ── Copyable URL box ──────────────────────────────────────────────────────────

function CopyBox({ value, compact }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      <div style={{
        flex: 1,
        background: 'var(--bg-0, #0d0d14)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        borderRadius: 8,
        padding: compact ? '7px 12px' : '10px 14px',
        fontFamily: 'var(--mono, monospace)',
        fontSize: compact ? 11 : 12,
        color: 'var(--text-1, #e0e0e0)',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}>
        {value}
      </div>
      <button
        onClick={copy}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(74,158,255,0.15)',
          border: '1px solid ' + (copied ? 'rgba(16,185,129,0.5)' : 'rgba(74,158,255,0.4)'),
          borderRadius: 8,
          padding: compact ? '6px 12px' : '8px 16px',
          color: copied ? 'var(--green, #10b981)' : 'var(--blue, #4a9eff)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
      >
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

// ── Step Card ─────────────────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 16,
      background: 'var(--bg-1, #1a1a2e)',
      border: '1px solid var(--border, rgba(255,255,255,0.08))',
      borderRadius: 12,
      padding: 18,
    }}>
      <div style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(139,92,246,0.15)',
        border: '1px solid rgba(139,92,246,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 800,
        color: '#a78bfa',
      }}>
        {number}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0, #f9fafb)', marginBottom: 8 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + ' min ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  return days + 'd ago'
}

// ── Main component ─────────────────────────────────────────────────────────────

interface NinjaTraderConnectProps {
  onClose: () => void
}

export default function NinjaTraderConnect({ onClose }: NinjaTraderConnectProps) {
  const { token } = useAuth()
  const [webhookToken, setWebhookToken] = useState<WebhookToken | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const webhookUrl = webhookToken
    ? API_BASE + '/api/webhook/tv/' + webhookToken.token
    : ''

  const loadToken = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_BASE + '/api/webhooks/tokens', {
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error('Failed to load tokens (' + res.status + ')')
      const data = await res.json()
      const list: WebhookToken[] = Array.isArray(data) ? data : (data.tokens ?? [])
      const active = list.find((t: WebhookToken) => t.is_active)

      if (active) {
        setWebhookToken(active)
      } else {
        const create = await fetch(API_BASE + '/api/webhooks/tokens', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ label: 'NinjaTrader' }),
        })
        if (!create.ok) throw new Error('Failed to create token (' + create.status + ')')
        const created = await create.json()
        const tok: WebhookToken = created.token ?? created
        setWebhookToken(tok)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadToken()
  }, [loadToken])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto',
      }}
    >
      <div style={{
        background: 'var(--bg-2, #111118)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        width: '100%',
        maxWidth: 680,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(139,92,246,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a78bfa',
            }}>
              <IconNT size={20} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-0, #f9fafb)', letterSpacing: '-0.01em' }}>
                Connect NinjaTrader
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', marginTop: 2 }}>
                Auto-sync futures trades from NinjaTrader 8 via the TradVue addon
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-2, #9ca3af)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Webhook URL */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3, #6b7280)', marginBottom: 12 }}>
              Your Webhook URL
            </div>

            {loading && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-2, #9ca3af)', fontSize: 13 }}>
                Generating your unique URL...
              </div>
            )}

            {error && !loading && (
              <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: '#ef4444' }}>
                <IconAlert size={14} />
                {error}
                <button onClick={loadToken} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '3px 10px', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && webhookToken && (
              <>
                <CopyBox value={webhookUrl} />
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3, #6b7280)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Paste this URL into the NinjaTrader addon&apos;s <strong>WebhookUrl</strong> parameter.
                </div>
              </>
            )}
          </div>

          {/* Status */}
          {!loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: webhookToken ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
              border: '1px solid ' + (webhookToken ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'),
              borderRadius: 10,
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: webhookToken ? 'var(--green, #10b981)' : 'var(--text-3, #6b7280)',
                flexShrink: 0,
                boxShadow: webhookToken ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
              }} />
              <div style={{ fontSize: 13, color: webhookToken ? 'var(--green, #10b981)' : 'var(--text-2, #9ca3af)', fontWeight: 600 }}>
                {webhookToken ? 'Webhook ready' : 'Not configured'}
              </div>
              {webhookToken && webhookToken.last_used_at && (
                <div style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', marginLeft: 'auto' }}>
                  Last trade: {relativeTime(webhookToken.last_used_at)}
                </div>
              )}
              {webhookToken && !webhookToken.last_used_at && (
                <div style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', marginLeft: 'auto' }}>
                  No trades yet — complete setup below to get started
                </div>
              )}
            </div>
          )}

          {/* Setup Guide */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3, #6b7280)', marginBottom: 14 }}>
              4-Step Setup Guide
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              <StepCard number={1} title="Download the TradVue Addon">
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2, #9ca3af)', lineHeight: 1.6 }}>
                  Download the <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>TradVueJournal.cs</strong> NinjaScript file.
                </p>
                <a
                  href="/downloads/TradVueJournal.cs"
                  download="TradVueJournal.cs"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 16px',
                    background: 'rgba(139,92,246,0.15)',
                    border: '1px solid rgba(139,92,246,0.35)',
                    borderRadius: 8,
                    color: '#a78bfa',
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <IconDownload size={14} />
                  Download TradVueJournal.cs
                </a>
              </StepCard>

              <StepCard number={2} title="Import the Indicator into NinjaTrader">
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2, #9ca3af)', lineHeight: 1.6 }}>
                  In NinjaTrader, go to <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>Tools → Import → NinjaScript Add-On</strong> and select the downloaded{' '}
                  <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>TradVueJournal.cs</code> file.
                  NinjaTrader will compile and install it automatically as an <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>Indicator</strong>.<br />
                  <span style={{ fontSize: 12, marginTop: 6, display: 'inline-block' }}>
                    (Using an Indicator — not a Strategy — lets it capture fills from <em>all</em> sources: manual orders, Chart Trader, ATM, SuperDOM, and other strategies.)
                  </span>
                </p>
              </StepCard>

              <StepCard number={3} title="Configure Your Webhook URL">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2, #9ca3af)', lineHeight: 1.6 }}>
                    Add <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>TradVueJournal</strong> to any chart
                    (right-click chart → Indicators → select TradVueJournal).
                    Set the <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>WebhookUrl</strong> parameter to:
                  </p>
                  {webhookUrl ? (
                    <CopyBox value={webhookUrl} compact />
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-3, #6b7280)', fontFamily: 'monospace' }}>
                      [Your webhook URL will appear once connected above]
                    </div>
                  )}
                </div>
              </StepCard>

              <StepCard number={4} title="Enable & Trade — Auto-Sync Starts">
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-2, #9ca3af)', lineHeight: 1.6 }}>
                  Enable the strategy. From now on, every real broker fill — entries and exits — is automatically sent to TradVue.
                  No manual logging. Check your <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>Trade Journal</strong> to see trades appear in seconds.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green, #10b981)' }}>
                  <IconCheck size={13} />
                  Only real broker fills are captured — paper trading is ignored.
                </div>
              </StepCard>

            </div>
          </div>

          {/* What the addon tracks */}
          <div style={{ padding: '16px 18px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>📊 What gets synced automatically</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {[
                { icon: '✅', label: 'Symbol (e.g. ES, NQ, CL)' },
                { icon: '✅', label: 'Fill price (real execution)' },
                { icon: '✅', label: 'Quantity & direction' },
                { icon: '✅', label: 'Entry & exit timestamps' },
                { icon: '✅', label: 'P&L calculated automatically' },
                { icon: '❌', label: 'Account balance or credentials' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2, #9ca3af)' }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security disclaimer */}
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 }}>
                The TradVue addon is read-only. It <strong>cannot</strong> place, modify, or cancel orders. It cannot access your account balance or broker credentials. 
                Only execution data (symbol, price, qty, direction) is transmitted over HTTPS. See our{' '}
                <a href="/legal/privacy" style={{ color: '#a78bfa', textDecoration: 'none' }}>Privacy Policy</a>.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Re-usable trigger button ──────────────────────────────────────────────────

export function NinjaTraderConnectButton({
  onOpen,
  compact,
}: {
  onOpen: () => void
  compact?: boolean
}) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: 'transparent',
        border: '1px solid rgba(139,92,246,0.45)',
        borderRadius: 'var(--btn-radius, 8px)',
        padding: compact ? '7px 14px' : '9px 18px',
        color: '#a78bfa',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(139,92,246,0.1)'
        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.7)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.45)'
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l18 18M3 21l18-18" /><rect x="2" y="2" width="20" height="20" rx="4" />
      </svg>
      Setup NinjaTrader
    </button>
  )
}
