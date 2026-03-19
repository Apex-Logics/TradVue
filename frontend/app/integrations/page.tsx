'use client'

/**
 * /integrations — TradVue Integration Settings
 *
 * Sections:
 *   1. NinjaTrader Setup (download addon, configure, enable)
 *   2. Webhook URL (generate, copy, rotate, delete)
 *   3. Recent Events Log (auto-refresh every 30s)
 *   4. Token Management (multiple tokens list)
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

const WEBHOOK_BASE = 'https://tradvue-api.onrender.com/api/webhook/tv'

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

// ══════════════════════════════════════════════════════════════════════════════
// Section 1: NinjaTrader Setup Guide
// ══════════════════════════════════════════════════════════════════════════════

const NT_SETUP_STEPS = [
  {
    n: 1,
    title: 'Download the TradVue Addon',
    body: 'Download TradVueJournal.zip — the NinjaScript addon that connects NinjaTrader to your TradVue account.',
    hasDownload: true,
  },
  {
    n: 2,
    title: 'Import into NinjaTrader 8',
    body: 'In NinjaTrader 8, go to Tools → Import → NinjaScript Add-On. Select the TradVueJournal.zip file. NinjaTrader will compile and install it automatically.',
  },
  {
    n: 3,
    title: 'Add the strategy to your workspace',
    body: 'Open your chart or Strategies tab, right-click → Add Strategy → select TradVueJournal. You can add it to any instrument you trade.',
  },
  {
    n: 4,
    title: 'Set your Webhook URL',
    body: 'In the strategy parameters, set WebhookUrl to your unique TradVue webhook URL (see "Your Webhook URL" section below). Copy and paste it exactly.',
    hasWebhookRef: true,
  },
  {
    n: 5,
    title: 'Enable the strategy — done!',
    body: 'Activate the strategy. From this point on, every real broker fill — entries and exits — is sent to TradVue automatically. Check your Trade Journal to see trades appear within seconds.',
  },
]

function NinjaTraderSetupSection({ webhookUrl }: { webhookUrl: string | null }) {
  const [openStep, setOpenStep] = useState<number | null>(null)
  const copyText = useCopyText()

  return (
    <SectionCard
      title="NinjaTrader 8 Setup"
      subtitle="Connect NinjaTrader to auto-journal every real futures trade. No manual entry needed."
    >
      {/* What gets synced */}
      <div style={{
        marginBottom: 20,
        padding: '14px 16px',
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 8,
      }}>
        {[
          { icon: '✅', text: 'Real broker fills only (no paper)' },
          { icon: '✅', text: 'Symbol, price, quantity, direction' },
          { icon: '✅', text: 'Entry & exit timestamps' },
          { icon: '✅', text: 'P&L calculated automatically' },
          { icon: '❌', text: 'Cannot place or modify orders' },
          { icon: '❌', text: 'No account balance or credentials' },
        ].map(item => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
            <span>{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {NT_SETUP_STEPS.map(step => (
        <div key={step.n} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setOpenStep(openStep === step.n ? null : step.n)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
              color: '#a78bfa', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{step.n}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-0, #f9fafb)' }}>{step.title}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{openStep === step.n ? '▲' : '▼'}</span>
          </button>

          {openStep === step.n && (
            <div style={{ padding: '0 0 16px 42px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.6 }}>{step.body}</p>

              {step.hasDownload && (
                <a
                  href="/downloads/TradVueJournal.zip"
                  download="TradVueJournal.zip"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '9px 18px',
                    background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                    border: 'none', borderRadius: 10, color: '#fff',
                    fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  ⬇ Download TradVueJournal.zip
                </a>
              )}

              {step.hasWebhookRef && webhookUrl && (
                <div style={{ marginTop: 10 }}>
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
                      flexShrink: 0, padding: '5px 12px',
                      background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
                      borderRadius: 6, color: '#a78bfa', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>Copy</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Tip box */}
      <div style={{
        marginTop: 20, padding: '12px 16px',
        background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10,
        fontSize: 12, color: '#4ade80',
      }}>
        💡 <strong>Tip:</strong> The addon only captures <strong>real broker executions</strong>. Paper trading and simulated orders are ignored, so your journal always reflects actual performance.
      </div>
    </SectionCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 2: Webhook URL
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
    if (!tk.last_used_at) return { icon: '🟡', label: 'Never used' }
    return { icon: '🟢', label: `Active · Last event ${timeAgo(tk.last_used_at)}` }
  }

  if (loading) return (
    <SectionCard title="Your Webhook URL">
      <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</div>
    </SectionCard>
  )

  return (
    <SectionCard title="Your Webhook URL" subtitle="Paste this URL into the NinjaTrader addon's WebhookUrl parameter.">
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
              flexShrink: 0, padding: '7px 14px',
              background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
              border: 'none', borderRadius: 8, color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              📋 Copy URL
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
                <span>⚠️ This will break the NinjaTrader addon connection. Sure?</span>
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
// Section 3: Recent Events Log
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

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents, refreshKey])

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
          <p style={{ margin: 0 }}>No events yet. Complete the NinjaTrader setup above and execute a trade to see it appear here.</p>
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
                        {ev.parsed_action === 'buy' ? '▲ Buy' : '▼ Sell'}
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
// Section 4: Token Management (multi-token)
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
      showToast('Webhook URL rotated! Update your NinjaTrader addon settings.', 'warning', 6000)
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
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>🔗</span>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-0)', letterSpacing: '-0.02em', margin: 0 }}>
              Integrations
            </h1>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
            Connect NinjaTrader 8 to auto-journal your futures trades via the TradVue addon.
          </p>
        </div>

        {/* NinjaTrader connection card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, marginBottom: 20,
        }}>
          <span style={{ fontSize: 20 }}>📊</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>NinjaTrader 8</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>TradVue Addon — Real-time trade sync</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Badge
              label={tokens.some(t => t.is_active) ? '🟡 Token active — awaiting first trade' : '⚪ Not set up'}
              color={tokens.some(t => t.is_active) ? 'amber' : 'gray'}
            />
          </div>
        </div>

        <NinjaTraderSetupSection webhookUrl={webhookUrl} />
        <WebhookURLSection tokens={tokens} loading={tokensLoading} onGenerate={handleGenerate} onRotate={handleRotate} onDelete={handleDelete} generating={generating} />
        <EventsSection token={token} refreshKey={eventsRefreshKey} />
        <TokenManagementSection tokens={tokens} onDelete={handleDelete} onGenerate={handleGenerate} generating={generating} />

        {/* Footer */}
        <div style={{ marginTop: 32, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
            The TradVue addon is read-only — it cannot place, modify, or cancel orders. It cannot access your broker account balance or credentials.
            Your webhook URL is private — do not share it. If compromised, use &ldquo;Rotate URL&rdquo; to generate a new one.
            This is not financial advice.
          </p>
        </div>

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
