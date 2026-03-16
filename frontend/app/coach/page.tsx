'use client'

import { useState, useEffect, useCallback } from 'react'
import PersistentNav from '../components/PersistentNav'
import { IconBrain, IconCheck, IconInfo, IconAlert, IconZap, IconTrendingUp, IconTrendingDown } from '../components/Icons'
import { generateWeeklySummary } from '../utils/coachEngine'
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
    label: '✅',
    accent: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.07)',
    border: 'rgba(74, 222, 128, 0.25)',
    gradient: 'linear-gradient(135deg, rgba(74,222,128,0.06) 0%, transparent 60%)',
  },
  neutral: {
    icon: <IconInfo size={16} />,
    label: 'ℹ️',
    accent: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.07)',
    border: 'rgba(96, 165, 250, 0.25)',
    gradient: 'linear-gradient(135deg, rgba(96,165,250,0.06) 0%, transparent 60%)',
  },
  warning: {
    icon: <IconAlert size={16} />,
    label: '⚠️',
    accent: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.07)',
    border: 'rgba(251, 146, 60, 0.25)',
    gradient: 'linear-gradient(135deg, rgba(251,146,60,0.06) 0%, transparent 60%)',
  },
  critical: {
    icon: <IconZap size={16} />,
    label: '🚨',
    accent: '#f87171',
    bg: 'rgba(248, 113, 113, 0.07)',
    border: 'rgba(248, 113, 113, 0.25)',
    gradient: 'linear-gradient(135deg, rgba(248,113,113,0.06) 0%, transparent 60%)',
  },
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: CoachInsight }) {
  const s = SEVERITY[insight.severity]
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
        <span style={{ fontSize: 18 }}>{s.label}</span>
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
          💡 Recommendation
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-0)', lineHeight: 1.6 }}>
          {insight.recommendation}
        </p>
      </div>

      {/* Footer */}
      {insight.dataPoints !== undefined && (
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Based on {insight.dataPoints} trade{insight.dataPoints !== 1 ? 's' : ''}
        </div>
      )}
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

function WeeklySummaryCard({ summary }: { summary: WeeklySummary }) {
  const pnlColor = summary.totalPnl >= 0 ? '#4ade80' : '#f87171'
  const pfColor = summary.profitFactor >= 1.5 ? '#4ade80' : summary.profitFactor >= 1 ? '#fb923c' : '#f87171'

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

      {summary.insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Insights ({summary.insights.length})
          </div>
          {summary.insights.map(ins => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}
    </div>
  )
}

function PastSummaryAccordion({ summary }: { summary: WeeklySummary }) {
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
          <WeeklySummaryCard summary={summary} />
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const [currentSummary, setCurrentSummary] = useState<WeeklySummary | null>(null)
  const [pastSummaries, setPastSummaries] = useState<WeeklySummary[]>([])
  const [generating, setGenerating] = useState(false)
  const [hasTradeData, setHasTradeData] = useState(true)

  // Load existing summaries on mount
  useEffect(() => {
    const summaries = loadCoachSummaries()
    if (summaries.length > 0) {
      setCurrentSummary(summaries[0])
      setPastSummaries(summaries.slice(1))
    }

    // Check if user has trade data
    try {
      const raw = localStorage.getItem('cg_journal_trades')
      const trades = raw ? JSON.parse(raw) : []
      setHasTradeData(trades.length > 0)
    } catch {
      setHasTradeData(false)
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

        // Update trade data check
        try {
          const raw = localStorage.getItem('cg_journal_trades')
          const trades = raw ? JSON.parse(raw) : []
          setHasTradeData(trades.length > 0)
        } catch { /* ignore */ }
      } catch (e) {
        console.error('Coach generation error:', e)
      } finally {
        setGenerating(false)
      }
    }, 50)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      <PersistentNav />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px 80px' }}>

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
              Pattern detection & behavioral analysis — 100% private, runs in your browser
            </p>
          </div>
        </div>

        {/* ── Beta badge ── */}
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
          marginBottom: 28,
          letterSpacing: 0.5,
        }}>
          ⚡ BETA — All insights unlocked
        </div>

        {/* ── Empty State ── */}
        {!hasTradeData && (
          <div style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '48px 32px',
            textAlign: 'center',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📓</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>No Trade Data Yet</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-1)', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              Log some trades in your Journal first, then come back for AI-powered insights.
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
              }}
            >
              Go to Journal →
            </a>
          </div>
        )}

        {/* ── Generate Button ── */}
        {hasTradeData && (
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
              {generating ? 'Analyzing your trades…' : 'Generate This Week\'s Summary'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
              Analyzes your journal data locally — nothing is sent anywhere
            </p>
          </div>
        )}

        {/* ── Current Summary ── */}
        {currentSummary && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Latest Analysis
            </div>
            <WeeklySummaryCard summary={currentSummary} />
          </div>
        )}

        {/* ── Past Summaries ── */}
        {pastSummaries.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Past Summaries
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pastSummaries.map(s => (
                <PastSummaryAccordion key={s.id} summary={s} />
              ))}
            </div>
          </div>
        )}

        {/* ── Disclaimer ── */}
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
          <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>⚠️ Disclaimer: </span>
          AI Trade Coach provides analytical insights based on your trading data for educational purposes only.
          This is not financial advice. Past patterns do not guarantee future results.
          Always make trading decisions based on your own research and risk tolerance.
        </div>
      </div>
    </div>
  )
}
