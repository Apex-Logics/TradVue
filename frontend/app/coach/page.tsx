'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { getUserTier } from '../utils/tierAccess'
import AuthGate from '../components/AuthGate'
import PersistentNav from '../components/PersistentNav'
import { IconBrain, IconCheck, IconInfo, IconAlert, IconZap, IconTrendingUp, IconTrendingDown } from '../components/Icons'
import { generateWeeklySummary, getThresholdInfo, type ThresholdInfo } from '../utils/coachEngine'
import { loadCoachSummaries, type WeeklySummary, type CoachInsight } from '../utils/coachData'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPnl(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function formatDate(d: string): string {
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeek(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`
}

// ─── Severity Config ──────────────────────────────────────────────────────────

const SEVERITY = {
  positive: {
    icon: <IconCheck size={16} />,
    accent: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.07)',
    border: 'rgba(74, 222, 128, 0.25)',
    gradient: 'linear-gradient(135deg, rgba(74,222,128,0.06) 0%, transparent 60%)',
  },
  neutral: {
    icon: <IconInfo size={16} />,
    accent: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.07)',
    border: 'rgba(96, 165, 250, 0.25)',
    gradient: 'linear-gradient(135deg, rgba(96,165,250,0.06) 0%, transparent 60%)',
  },
  warning: {
    icon: <IconAlert size={16} />,
    accent: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.07)',
    border: 'rgba(251, 146, 60, 0.25)',
    gradient: 'linear-gradient(135deg, rgba(251,146,60,0.06) 0%, transparent 60%)',
  },
  critical: {
    icon: <IconZap size={16} />,
    accent: '#f87171',
    bg: 'rgba(248, 113, 113, 0.07)',
    border: 'rgba(248, 113, 113, 0.25)',
    gradient: 'linear-gradient(135deg, rgba(248,113,113,0.06) 0%, transparent 60%)',
  },
}

// ─── Disclaimer Box ───────────────────────────────────────────────────────────

function DisclaimerBox() {
  return (
    <div style={{
      background: 'rgba(74, 158, 255, 0.06)',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 28,
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 0, flexShrink: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center' }}><IconBrain size={20} /></span>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text-0)' }}>AI Trade Coach</strong> analyzes patterns in YOUR trading data
        using statistical methods only. It does not provide financial advice, trading recommendations, or predictions.
        All insights are backward-looking observations based on trades you've logged.{' '}
        <strong style={{ color: 'var(--text-0)' }}>Always make your own trading decisions.</strong>
      </p>
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ThresholdProgressBar({ info }: { info: ThresholdInfo }) {
  const pct = Math.min(info.progressPct * 100, 100)
  const isComplete = info.level === 'confident'

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 18px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
          {info.progressLabel}
        </span>
        {isComplete && (
          <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4H17l-1 7a5 5 0 0 1-10 0L5 4H2m5 0H5a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h1M17 4h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-1"/><polyline points="8 21 12 21 16 21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            HIGH CONFIDENCE
          </span>
        )}
      </div>
      <div style={{ background: 'var(--bg-3)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: isComplete
            ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
            : 'linear-gradient(90deg, #4a9eff, #8b5cf6)',
          borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>
      {!isComplete && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
          {info.nextMilestone - info.tradeCount} more trade{info.nextMilestone - info.tradeCount !== 1 ? 's' : ''} to unlock{' '}
          <strong style={{ color: 'var(--text-2)' }}>{info.nextLabel}</strong>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic' }}>
        {info.message}
      </div>
    </div>
  )
}

// ─── Locked Feature Preview ───────────────────────────────────────────────────

const LOCKED_PREVIEWS = [
  { label: 'Revenge Trading Detection', threshold: 20 },
  { label: 'Time-of-Day Analysis', threshold: 20 },
  { label: 'Streak Patterns', threshold: 10 },
  { label: 'Overtrading Detection', threshold: 10 },
  { label: 'Ticker Concentration Analysis', threshold: 10 },
  { label: 'Playbook Performance', threshold: 20 },
  { label: 'Emotion-Performance Correlation', threshold: 20 },
  { label: 'Risk/Reward Analysis', threshold: 20 },
]

function LockedPreviewCards({ tradeCount }: { tradeCount: number }) {
  const locked = LOCKED_PREVIEWS.filter(p => p.threshold > tradeCount)
  if (locked.length === 0) return null

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Upcoming Insights — Log More Trades to Unlock
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {locked.map(p => (
          <div
            key={p.label}
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '14px 16px',
              opacity: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{p.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                Unlocks at {p.threshold} trades
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function InsightCard({ insight, showConfidence }: { insight: CoachInsight; showConfidence: boolean }) {
  const s = SEVERITY[insight.severity]
  const hasSmallSample = insight.dataPoints !== undefined && insight.dataPoints < 10

  return (
    <div style={{
      background: s.gradient,
      backgroundColor: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: s.accent, display: 'flex', alignItems: 'center' }}>{s.icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>{insight.title}</span>
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6 }}>
        {insight.description}
      </p>

      {/* Metric highlight */}
      {insight.metric && (
        <div style={{
          background: 'var(--bg-3)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          color: s.accent,
          fontFamily: 'monospace',
        }}>
          {insight.metric}
        </div>
      )}

      {/* Recommendation */}
      <div style={{
        background: 'var(--bg-1)',
        border: `1px solid ${s.border}`,
        borderRadius: 8,
        padding: '10px 14px',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: s.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          📊 Statistical Observation
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-0)', lineHeight: 1.6 }}>
          {insight.recommendation}
        </p>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {insight.dataPoints !== undefined && (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Based on {insight.dataPoints} trade{insight.dataPoints !== 1 ? 's' : ''}
            {showConfidence && (
              <span style={{ marginLeft: 8, color: '#4ade80', fontWeight: 600 }}>✓ High confidence</span>
            )}
          </div>
        )}
        {hasSmallSample && (
          <div style={{ fontSize: 11, color: '#fb923c' }}>
            ⚠️ Small sample size — accuracy improves with more data
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? 'var(--text-0)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{sub}</div>}
    </div>
  )
}

function WeeklySummaryCard({ summary, thresholdLevel }: {
  summary: WeeklySummary
  thresholdLevel: 'none' | 'basic' | 'patterns' | 'full' | 'confident'
}) {
  const pnlColor = summary.totalPnl >= 0 ? '#4ade80' : '#f87171'
  const pfColor = summary.profitFactor >= 1.5 ? '#4ade80' : summary.profitFactor >= 1 ? '#fb923c' : '#f87171'
  const showInsights = thresholdLevel !== 'none' && thresholdLevel !== 'basic'
  const showConfidence = thresholdLevel === 'confident'

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>
            Week of {formatWeek(summary.weekStart, summary.weekEnd)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            Generated {new Date(summary.generatedAt).toLocaleString()}
          </div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: pnlColor }}>
          {formatPnl(summary.totalPnl)}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10,
      }}>
        <StatCard label="Trades" value={String(summary.totalTrades)} />
        <StatCard label="Win Rate" value={formatPct(summary.winRate)}
          accent={summary.winRate >= 0.5 ? '#4ade80' : summary.winRate >= 0.4 ? '#fb923c' : '#f87171'} />
        <StatCard label="Profit Factor" value={summary.profitFactor === 999 ? '∞' : summary.profitFactor.toFixed(2)} accent={pfColor} />
        <StatCard label="Avg Winner" value={`$${summary.avgWinner.toFixed(0)}`} accent="#4ade80" />
        <StatCard label="Avg Loser" value={`-$${summary.avgLoser.toFixed(0)}`} accent="#f87171" />
        <StatCard
          label="Best Day"
          value={formatPnl(summary.bestDay.pnl)}
          sub={formatDate(summary.bestDay.date)}
          accent="#4ade80"
        />
        <StatCard
          label="Worst Day"
          value={formatPnl(summary.worstDay.pnl)}
          sub={formatDate(summary.worstDay.date)}
          accent="#f87171"
        />
      </div>

      {showInsights && summary.insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Pattern Insights ({summary.insights.length})
          </div>
          {summary.insights.map(ins => (
            <InsightCard key={ins.id} insight={ins} showConfidence={showConfidence} />
          ))}
        </div>
      )}

      {!showInsights && summary.totalTrades >= 5 && (
        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 13,
          color: 'var(--text-2)',
        }}>
          🔒 Pattern detection unlocks at 10+ total logged trades. Keep journaling!
        </div>
      )}
    </div>
  )
}

function PastSummaryAccordion({ summary, thresholdLevel }: {
  summary: WeeklySummary
  thresholdLevel: 'none' | 'basic' | 'patterns' | 'full' | 'confident'
}) {
  const [open, setOpen] = useState(false)
  const pnlColor = summary.totalPnl >= 0 ? '#4ade80' : '#f87171'

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--text-0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {formatWeek(summary.weekStart, summary.weekEnd)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {summary.totalTrades} trades · {formatPct(summary.winRate)} WR
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {summary.insights.length} insights
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: pnlColor }}>
            {formatPnl(summary.totalPnl)}
          </span>
          <span style={{ color: 'var(--text-3)', fontSize: 16 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          <WeeklySummaryCard summary={summary} thresholdLevel={thresholdLevel} />
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const { user } = useAuth()
  const { settings, openSettings } = useSettings()
  const [currentSummary, setCurrentSummary] = useState<WeeklySummary | null>(null)
  const [pastSummaries, setPastSummaries] = useState<WeeklySummary[]>([])
  const [generating, setGenerating] = useState(false)
  const [tradeCount, setTradeCount] = useState(0)
  const [thresholdInfo, setThresholdInfo] = useState<ThresholdInfo>(() => getThresholdInfo(0))

  // Load existing summaries on mount
  useEffect(() => {
    const summaries = loadCoachSummaries()
    if (summaries.length > 0) {
      setCurrentSummary(summaries[0])
      setPastSummaries(summaries.slice(1))
    }

    // Load trade count for threshold calculations
    try {
      const raw = localStorage.getItem('cg_journal_trades')
      const trades = raw ? JSON.parse(raw) : []
      const count = Array.isArray(trades) ? trades.length : 0
      setTradeCount(count)
      setThresholdInfo(getThresholdInfo(count))
    } catch {
      setTradeCount(0)
      setThresholdInfo(getThresholdInfo(0))
    }
  }, [])

  const handleGenerate = useCallback(() => {
    setGenerating(true)
    // Use setTimeout to allow spinner to render
    setTimeout(() => {
      try {
        const summary = generateWeeklySummary(new Date(), true)
        setCurrentSummary(summary)
        const all = loadCoachSummaries()
        setPastSummaries(all.slice(1))

        // Update trade count
        try {
          const raw = localStorage.getItem('cg_journal_trades')
          const trades = raw ? JSON.parse(raw) : []
          const count = Array.isArray(trades) ? trades.length : 0
          setTradeCount(count)
          setThresholdInfo(getThresholdInfo(count))
        } catch { /* ignore */ }
      } catch (e) {
        console.error('Coach generation error:', e)
      } finally {
        setGenerating(false)
      }
    }, 50)
  }, [])

  const hasEnoughData = tradeCount >= 5

  // Auth gating
  const tier = getUserTier(user)
  if (tier === 'demo') {
    return (
      <AuthGate
        featureName="AI Trade Coach"
        featureDesc="Get weekly AI-powered insights on your trading patterns. Identify strengths and areas for improvement. Free account required."
      >
        <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
          <PersistentNav />
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>AI Trade Coach</h1>
          </div>
        </div>
      </AuthGate>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      <PersistentNav />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px 80px' }}>
        {/* AI Coach disabled banner */}
        {!settings.aiCoachEnabled && (
          <div style={{
            background: 'rgba(251,146,60,0.08)',
            border: '1px solid rgba(251,146,60,0.25)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>🔕</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)', marginBottom: 4 }}>
                AI Coach is currently disabled
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                You can enable it in Settings to get trade insights. When enabled, your trade patterns are analyzed to provide insights. Your data is processed securely — see our{' '}
                <a href="/legal/privacy" style={{ color: 'var(--accent, #6366f1)' }}>Privacy Policy</a> for details.
              </div>
              <button
                onClick={openSettings}
                style={{
                  marginTop: 10,
                  padding: '7px 14px',
                  background: 'rgba(251,146,60,0.15)',
                  border: '1px solid rgba(251,146,60,0.35)',
                  borderRadius: 8,
                  color: '#fb923c',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Open Settings →
              </button>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(74,158,255,0.2), rgba(168,85,247,0.2))',
            border: '1px solid rgba(74,158,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <IconBrain size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
              AI Trade Coach
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
              Pattern detection &amp; behavioral analysis — 100% private, runs in your browser
            </p>
          </div>
        </div>

        {/* ── New badge ── */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(74,158,255,0.12)',
          border: '1px solid rgba(74,158,255,0.3)',
          borderRadius: 20,
          padding: '3px 10px',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--accent)',
          marginBottom: 20,
          letterSpacing: 0.5,
        }}>
          ⚡ NEW
        </div>

        {/* ── Prominent Disclaimer ── */}
        <DisclaimerBox />

        {/* ── Progress Bar (always visible) ── */}
        <ThresholdProgressBar info={thresholdInfo} />

        {/* ── Under Threshold State ── */}
        {!hasEnoughData && (
          <>
            <div style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '40px 32px',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📓</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Keep Building Your Trade History</h2>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-1)', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                {tradeCount === 0
                  ? 'Log at least 5 trades to unlock your first insights. The more you trade and journal, the smarter your analysis gets.'
                  : `You have ${tradeCount} trade${tradeCount !== 1 ? 's' : ''} logged. Log ${5 - tradeCount} more to unlock your first insights.`}
              </p>
              <a
                href="/journal"
                style={{
                  display: 'inline-block',
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                  marginTop: 16,
                }}
              >
                Go to Journal →
              </a>
            </div>

            {/* Locked preview cards */}
            <LockedPreviewCards tradeCount={tradeCount} />
          </>
        )}

        {/* ── Generate Button (5+ trades) ── */}
        {hasEnoughData && (
          <div style={{ marginBottom: 28 }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                background: generating
                  ? 'var(--bg-3)'
                  : 'linear-gradient(135deg, #4a9eff, #8b5cf6)',
                border: 'none',
                borderRadius: 10,
                padding: '12px 24px',
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
                cursor: generating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: generating ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <IconBrain size={18} />
              {generating ? 'Analyzing your trades…' : 'Generate This Week\'s Analysis'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
              Analyzes your journal data locally — nothing is sent anywhere
            </p>
          </div>
        )}

        {/* ── Locked previews for partial unlocks ── */}
        {hasEnoughData && thresholdInfo.level !== 'confident' && (
          <LockedPreviewCards tradeCount={tradeCount} />
        )}

        {/* ── Current Summary ── */}
        {currentSummary && hasEnoughData && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Latest Analysis
            </div>
            <WeeklySummaryCard summary={currentSummary} thresholdLevel={thresholdInfo.level} />
          </div>
        )}

        {/* ── Past Summaries ── */}
        {pastSummaries.length > 0 && hasEnoughData && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Past Analyses
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pastSummaries.map(s => (
                <PastSummaryAccordion key={s.id} summary={s} thresholdLevel={thresholdInfo.level} />
              ))}
            </div>
          </div>
        )}

        {/* ── Footer Disclaimer ── */}
        <div style={{
          marginTop: 40,
          padding: '16px 20px',
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          fontSize: 12,
          color: 'var(--text-3)',
          lineHeight: 1.7,
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>⚠️ Statistical Analysis Only: </span>
          AI Trade Coach provides backward-looking observations based on your trading data for educational purposes only.
          This is not financial advice. Past patterns do not guarantee future results.
          All insights are statistical observations of logged data. Always make your own trading decisions based on your own research and risk tolerance.
        </div>
      </div>
    </div>
  )
}
