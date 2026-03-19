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

function IconTV({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function IconLink({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
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

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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

// ── Copyable Code block ───────────────────────────────────────────────────────

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <pre style={{
        background: 'var(--bg-0, #0d0d14)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        borderRadius: 8,
        padding: '14px 16px',
        fontFamily: 'var(--mono, monospace)',
        fontSize: 12,
        color: 'var(--text-1, #e0e0e0)',
        margin: 0,
        overflowX: 'auto',
        lineHeight: 1.7,
      }}>
        {code}
      </pre>
      <button
        onClick={copy}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
          border: '1px solid ' + (copied ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.15)'),
          borderRadius: 6,
          padding: '4px 10px',
          color: copied ? 'var(--green, #10b981)' : 'var(--text-2, #9ca3af)',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
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
        background: 'rgba(74,158,255,0.15)',
        border: '1px solid rgba(74,158,255,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 800,
        color: 'var(--blue, #4a9eff)',
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

interface TradingViewConnectProps {
  onClose: () => void
}

export default function TradingViewConnect({ onClose }: TradingViewConnectProps) {
  const { token } = useAuth()
  const [webhookToken, setWebhookToken] = useState<WebhookToken | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
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
          body: JSON.stringify({ label: 'TradingView' }),
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

  const handleDisconnect = async () => {
    if (!token || !webhookToken) return
    setDisconnecting(true)
    try {
      await fetch(API_BASE + '/api/webhooks/tokens/' + webhookToken.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      })
      setWebhookToken(null)
      setShowDisconnectConfirm(false)
    } catch {
      // silent
    } finally {
      setDisconnecting(false)
    }
  }

  const messageTemplate = `{
  "ticker": "{{ticker}}",
  "action": "buy",
  "price": {{close}},
  "qty": 1,
  "strategy": "My Strategy"
}`

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
          background: 'rgba(74,158,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(74,158,255,0.15)',
              border: '1px solid rgba(74,158,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--blue, #4a9eff)',
            }}>
              <IconTV size={20} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-0, #f9fafb)', letterSpacing: '-0.01em' }}>
                Connect TradingView
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', marginTop: 2 }}>
                Auto-import trades directly from TradingView alerts
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

          {/* Section 1: Webhook URL */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3, #6b7280)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconLink size={12} />
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
                  This URL is unique to your account. Do not share it.
                </div>
              </>
            )}

            {!loading && !error && !webhookToken && (
              <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 13, color: 'var(--text-2, #9ca3af)' }}>
                No webhook URL active.{' '}
                <button onClick={loadToken} style={{ background: 'none', border: 'none', color: 'var(--blue, #4a9eff)', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                  Generate one
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Status */}
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
                {webhookToken ? 'Connected' : 'Not connected'}
              </div>
              {webhookToken && webhookToken.last_used_at && (
                <div style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', marginLeft: 'auto' }}>
                  Last received: {relativeTime(webhookToken.last_used_at)}
                </div>
              )}
              {webhookToken && !webhookToken.last_used_at && (
                <div style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', marginLeft: 'auto' }}>
                  No events yet — fire your first alert to test
                </div>
              )}
            </div>
          )}

          {/* Section 3: Setup Guide */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3, #6b7280)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              3-Step Setup Guide
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              <StepCard number={1} title="Open TradingView Alerts">
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2, #9ca3af)', lineHeight: 1.6 }}>
                  Open any chart on <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>TradingView.com</strong> and click the{' '}
                  <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>Alerts icon</strong> (clock icon) in the right panel,
                  or right-click the chart and select <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>"Add Alert"</strong>.
                </p>
              </StepCard>

              <StepCard number={2} title="Configure Your Alert">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2, #9ca3af)', lineHeight: 1.6 }}>
                    Set your alert condition (e.g., price crosses above/below a level). Under{' '}
                    <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>"Notifications"</strong>, check{' '}
                    <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>"Webhook URL"</strong> and paste your unique URL:
                  </p>

                  {webhookUrl ? (
                    <CopyBox value={webhookUrl} compact />
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-3, #6b7280)', fontFamily: 'var(--mono, monospace)' }}>
                      [Your webhook URL will appear once connected]
                    </div>
                  )}

                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-2, #9ca3af)', lineHeight: 1.6 }}>
                      In the <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>"Message"</strong> field, paste this template:
                    </p>
                    <CopyCode code={messageTemplate} />
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: 'var(--text-1, #e0e0e0)', lineHeight: 1.6 }}>
                    <strong style={{ color: '#f59e0b' }}>Note:</strong> Change{' '}
                    <code style={{ fontFamily: 'var(--mono, monospace)', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>"action"</code>{' '}
                    to <code style={{ fontFamily: 'var(--mono, monospace)', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>"sell"</code>{' '}
                    for sell alerts. Adjust{' '}
                    <code style={{ fontFamily: 'var(--mono, monospace)', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>qty</code>{' '}
                    to your position size.
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', lineHeight: 1.6 }}>
                    You can also use TradingView variables:{' '}
                    {['{{ticker}}', '{{close}}', '{{open}}', '{{high}}', '{{low}}', '{{volume}}', '{{time}}'].map((v) => (
                      <code key={v} style={{ fontFamily: 'var(--mono, monospace)', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, marginRight: 4, display: 'inline-block', marginBottom: 4 }}>
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              </StepCard>

              <StepCard number={3} title="Done — Trades Import Automatically">
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2, #9ca3af)', lineHeight: 1.6 }}>
                  When your alert triggers, TradingView sends the trade data to TradVue automatically. Check your{' '}
                  <strong style={{ color: 'var(--text-1, #e0e0e0)' }}>Trade Log</strong> — your trade will appear within seconds.
                </p>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green, #10b981)' }}>
                  <IconCheck size={13} />
                  No manual entry needed. Runs 24/7 automatically.
                </div>
              </StepCard>

            </div>
          </div>

          {/* Section 4: Disconnect */}
          {webhookToken && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
              {!showDisconnectConfirm ? (
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3, #6b7280)',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: 0,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  <IconTrash size={13} />
                  Disconnect TradingView
                </button>
              ) : (
                <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>
                    Are you sure?
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2, #9ca3af)', marginBottom: 12, lineHeight: 1.5 }}>
                    This will revoke your webhook URL and stop auto-importing trades from TradingView.
                    You can reconnect at any time.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      style={{
                        background: 'rgba(239,68,68,0.2)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        borderRadius: 8,
                        padding: '7px 16px',
                        color: '#ef4444',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: disconnecting ? 'not-allowed' : 'pointer',
                        opacity: disconnecting ? 0.6 : 1,
                      }}
                    >
                      {disconnecting ? 'Disconnecting...' : 'Yes, disconnect'}
                    </button>
                    <button
                      onClick={() => setShowDisconnectConfirm(false)}
                      style={{
                        background: 'var(--bg-1, #1a1a2e)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        padding: '7px 16px',
                        color: 'var(--text-0, #f9fafb)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security disclaimer */}
          <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 }}>
                TradVue only receives trade data. We cannot access your TradingView account, broker account, place trades, or modify your positions. Your broker credentials are never shared with TradVue. All data is transmitted over HTTPS. See our <a href="/legal/privacy" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Privacy Policy</a>.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Re-usable trigger button ──────────────────────────────────────────────────

export function TradingViewConnectButton({
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
        border: '1px solid rgba(74,158,255,0.45)',
        borderRadius: 'var(--btn-radius, 8px)',
        padding: compact ? '7px 14px' : '9px 18px',
        color: 'var(--blue, #4a9eff)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(74,158,255,0.1)'
        e.currentTarget.style.borderColor = 'rgba(74,158,255,0.7)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'rgba(74,158,255,0.45)'
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      Connect TradingView
    </button>
  )
}
