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

function IconCopy({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconDownload({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
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

// ── Copyable URL box ──────────────────────────────────────────────────────────

function CopyBox({ value, compact }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }).finally(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      <div style={{
        flex: 1,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: compact ? '7px 12px' : '10px 14px',
        fontFamily: 'monospace',
        fontSize: compact ? 11 : 12,
        color: '#a78bfa',
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
          background: copied ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
          border: '1px solid ' + (copied ? 'rgba(16,185,129,0.5)' : 'transparent'),
          borderRadius: 8,
          padding: compact ? '6px 12px' : '8px 16px',
          color: copied ? '#10b981' : '#fff',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
      >
        {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

// ── Accordion step card ───────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  open,
  onToggle,
  children,
}: {
  number: number
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
          background: open ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.12)',
          border: `1px solid ${open ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.3)'}`,
          color: '#a78bfa', fontSize: 12, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {number}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-0, #f9fafb)', lineHeight: 1.3 }}>
          {title}
        </span>
        <span style={{ color: 'var(--text-3, #6b7280)', flexShrink: 0 }}>
          <IconChevron open={open} />
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px 52px' }}>
          {children}
        </div>
      )}
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
  const [openStep, setOpenStep] = useState<number | null>(1)
  const [troubleOpen, setTroubleOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const WEBHOOK_BASE = 'https://tradvue-api.onrender.com/api/webhook/nt'
  const webhookUrl = webhookToken ? `${WEBHOOK_BASE}/${webhookToken.token}` : ''

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
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'NinjaTrader' }),
        })
        if (!create.ok) throw new Error('Failed to create token (' + create.status + ')')
        const created = await create.json()
        setWebhookToken(created.token ?? created)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadToken() }, [loadToken])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const bodyText: React.CSSProperties = {
    fontSize: 12, color: 'var(--text-2, #9ca3af)', margin: 0, lineHeight: 1.7,
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
    >
      <div style={{
        background: 'var(--bg-2, #111118)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        width: '100%', maxWidth: 640,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden', flexShrink: 0,
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(139,92,246,0.06)',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-0, #f9fafb)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              Connect NinjaTrader 8
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3, #6b7280)' }}>
              Auto-journal every futures trade. No manual entry needed.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-2, #9ca3af)', cursor: 'pointer', padding: 8, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* ── Compatibility badge ── */}
        <div style={{ padding: '12px 24px 0', display: 'flex' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px',
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 20, fontSize: 11, color: '#a78bfa',
          }}>
            ✓ Works with NinjaTrader, Tradovate, Rithmic, CQG
          </span>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Webhook URL (prominent) */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3, #6b7280)', marginBottom: 10 }}>
              Your Webhook URL
            </div>

            {loading && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                Generating your unique URL…
              </div>
            )}
            {error && !loading && (
              <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: '#ef4444' }}>
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
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  Paste this URL into the indicator&apos;s <strong style={{ color: '#a78bfa' }}>Webhook URL</strong> parameter (Step 4 below).
                </div>
              </>
            )}

            {/* Status pill */}
            {!loading && webhookToken && (
              <div style={{
                marginTop: 10,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 12px',
                background: webhookToken.last_used_at ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                border: '1px solid ' + (webhookToken.last_used_at ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'),
                borderRadius: 8,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: webhookToken.last_used_at ? '#10b981' : '#6b7280',
                  boxShadow: webhookToken.last_used_at ? '0 0 6px rgba(16,185,129,0.5)' : 'none',
                }} />
                <div style={{ fontSize: 12, color: webhookToken.last_used_at ? '#10b981' : 'var(--text-2)', fontWeight: 600 }}>
                  {webhookToken.last_used_at
                    ? `Connected · Last trade ${relativeTime(webhookToken.last_used_at)}`
                    : 'Token ready — no trades yet'
                  }
                </div>
              </div>
            )}
          </div>

          {/* ── 5-Step Guide ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>
              Setup Guide
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              <StepCard number={1} title="Download the TradVue Addon" open={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? null : 1)}>
                <p style={bodyText}>
                  Download <strong style={{ color: 'var(--text-1)' }}>TradVueAutoJournal.zip</strong> — the NinjaScript Add-On that connects NinjaTrader 8 to your TradVue account.
                </p>
                <div style={{ marginTop: 10 }}>
                  <a
                    href="/downloads/TradVueAutoJournal.zip"
                    download="TradVueAutoJournal.zip"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '9px 18px',
                      background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                      border: 'none', borderRadius: 8, color: '#fff',
                      fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    }}
                  >
                    <IconDownload size={14} />
                    Download TradVueAutoJournal.zip
                  </a>
                  <p style={{ ...bodyText, marginTop: 8, fontSize: 11 }}>
                    NinjaScript Add-On archive — works with NinjaTrader 8.1+
                  </p>
                </div>
              </StepCard>

              <StepCard number={2} title="Import into NinjaTrader" open={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? null : 2)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={bodyText}>In NinjaTrader: <strong style={{ color: 'var(--text-1)' }}>Tools → Import → NinjaScript Add-On</strong></p>
                  <p style={bodyText}>Select the <Code>TradVueAutoJournal.zip</Code> file you downloaded</p>
                  <p style={bodyText}>NinjaTrader will compile and install it automatically</p>
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
                    borderRadius: 8, fontSize: 11, color: '#fbbf24', lineHeight: 1.6,
                  }}>
                    <strong>⚠️ If import fails:</strong> Copy <Code>TradVueAutoJournal.cs</Code> to <Code>Documents\NinjaTrader 8\bin\Custom\Indicators\</Code> and compile (F5) in the NinjaScript Editor
                  </div>
                </div>
              </StepCard>

              <StepCard number={3} title="Generate Your Webhook URL" open={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? null : 3)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={bodyText}>Your webhook URL is shown above — copy it for use in Step 4.</p>
                  {webhookUrl && <CopyBox value={webhookUrl} compact />}
                  <p style={{ ...bodyText, fontSize: 11 }}>
                    This URL is how NinjaTrader sends trade data to your TradVue account. Keep it private.
                  </p>
                </div>
              </StepCard>

              <StepCard number={4} title="Configure the Indicator" open={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? null : 4)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={bodyText}>Add TradVueAutoJournal to any chart:</p>
                  <p style={bodyText}>Right-click chart → <strong style={{ color: 'var(--text-1)' }}>Indicators</strong> → find <strong style={{ color: 'var(--text-1)' }}>TradVueAutoJournal</strong> → Add</p>
                  <p style={{ ...bodyText, marginTop: 4 }}>In the indicator settings:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    {[
                      { param: 'Webhook URL', desc: 'Paste your webhook URL from Step 3' },
                      { param: 'Account Name', desc: 'Your account number (e.g. Sim101), or blank for all accounts' },
                      { param: 'Send Entries', desc: '✅ Enabled' },
                      { param: 'Send Exits', desc: '✅ Enabled' },
                      { param: 'Log to Output', desc: '✅ Enabled for troubleshooting' },
                    ].map(item => (
                      <div key={item.param} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
                        <span style={{ flexShrink: 0, fontWeight: 700, color: '#a78bfa', minWidth: 90 }}>{item.param}</span>
                        <span style={{ color: 'var(--text-2)' }}>— {item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </StepCard>

              <StepCard number={5} title="Start Trading" open={openStep === 5} onToggle={() => setOpenStep(openStep === 5 ? null : 5)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={bodyText}>Place a trade — you should see <Code>[TradVue] ENTRY...</Code> in the NinjaTrader Output window</p>
                  <p style={bodyText}>Your trade will appear in your TradVue Journal within 30 seconds</p>
                  <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
                    🎉 That&apos;s it — every trade auto-journals from now on
                  </div>
                </div>
              </StepCard>

            </div>
          </div>

          {/* What gets captured */}
          <div style={{ padding: '14px 16px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>📊 What gets captured</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
              {[
                { icon: '✅', text: 'Symbol, direction (Long/Short)' },
                { icon: '✅', text: 'Entry & exit price' },
                { icon: '✅', text: 'Quantity, P&L, timestamp' },
                { icon: '❌', text: 'Account number, balance, credentials' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Troubleshooting collapsible */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setTroubleOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🛠 Troubleshooting</span>
              <span style={{ color: 'var(--text-3)' }}><IconChevron open={troubleOpen} /></span>
            </button>
            {troubleOpen && (
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { p: 'Output window shows nothing', f: 'Make sure the indicator is added to a chart and is enabled' },
                  { p: '403 Forbidden error', f: 'Check webhook URL uses /nt/ not /tv/' },
                  { p: 'P&L shows $0', f: 'Enable both Send Entries and Send Exits' },
                  { p: 'Duplicate trades', f: 'Set Account Name to your specific account number' },
                  { p: 'No exit recorded', f: 'Wait 30 seconds — the poller updates exits automatically' },
                ].map(item => (
                  <div key={item.p} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-0)', marginBottom: 2 }}>&ldquo;{item.p}&rdquo;</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>→ {item.f}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security disclaimer */}
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 }}>
              🔒 The TradVue addon is read-only. It cannot place, modify, or cancel orders. It cannot access your account balance or broker credentials.
              All data encrypted via HTTPS. TradVue is not affiliated with NinjaTrader LLC. This integration is provided as-is.{' '}
              <a href="/legal/privacy" style={{ color: '#a78bfa', textDecoration: 'none' }}>Privacy Policy</a>
            </p>
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
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: 'transparent', border: '1px solid rgba(139,92,246,0.45)',
        borderRadius: 8, padding: compact ? '7px 14px' : '9px 18px',
        color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s', whiteSpace: 'nowrap',
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
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      Setup NinjaTrader
    </button>
  )
}
