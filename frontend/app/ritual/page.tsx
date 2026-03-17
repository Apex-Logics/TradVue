'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserTier } from '../utils/tierAccess'
import AuthGate from '../components/AuthGate'
import PersistentNav from '../components/PersistentNav'
import PushNotificationPanel from '../components/PushNotificationPanel'
import {
  loadRitualEntries,
  upsertRitualEntry,
  getRitualEntryForDate,
  computeStreak,
  saveStreakData,
  todayDateString,
  formatDisplayDate,
  generateCalendarData,
  EMOTION_EMOJIS,
  EMOTION_COLORS,
  EMOTION_TAGS,
  STREAK_MILESTONES,
  emotionEmoji,
  emotionColor,
  milestoneLabel,
  type RitualEntry,
  type StreakData,
  type CalendarDay,
} from '../utils/ritualData'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodayTrade {
  id: string
  symbol: string
  pnl: number
  direction: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `ritual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function getTodayTradesFromJournal(): TodayTrade[] {
  try {
    const raw = localStorage.getItem('cg_journal_trades')
    if (!raw) return []
    const trades: Array<{
      id: string
      date: string
      symbol: string
      pnl: number
      direction: string
    }> = JSON.parse(raw)
    const today = todayDateString()
    return trades
      .filter(t => t.date === today)
      .map(t => ({ id: t.id, symbol: t.symbol, pnl: t.pnl, direction: t.direction }))
  } catch {
    return []
  }
}

function formatPnl(pnl: number): string {
  const abs = Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return pnl >= 0 ? `+$${abs}` : `-$${abs}`
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background: i === current ? '#4a9eff' : i < current ? '#4a9eff66' : 'var(--border, #333)',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

// ─── Step Card Wrapper ────────────────────────────────────────────────────────

function StepCard({
  children,
  visible,
}: {
  children: React.ReactNode
  visible: boolean
}) {
  return (
    <div
      style={{
        maxWidth: 600,
        margin: '0 auto',
        background: 'var(--card-bg, #1a1a1a)',
        border: '1px solid var(--border, #2a2a2a)',
        borderRadius: 12,
        padding: '36px 40px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
      }}
    >
      {children}
    </div>
  )
}

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────

function CalendarHeatmap({ entries }: { entries: RitualEntry[] }) {
  const days = generateCalendarData(entries, 13)

  // Group into weeks
  const weeks: CalendarDay[][] = []
  let week: CalendarDay[] = []
  days.forEach((day, i) => {
    week.push(day)
    if (week.length === 7 || i === days.length - 1) {
      weeks.push(week)
      week = []
    }
  })

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        {/* Day labels column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 18 }}>
          {dayLabels.map((l, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                fontSize: 9,
                color: 'var(--text-3, #666)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Month label (show on first day of month) */}
            <div style={{ height: 14, fontSize: 9, color: 'var(--text-3, #666)', textAlign: 'center' }}>
              {wk[0]?.date.endsWith('-01') || (wi === 0)
                ? new Date(wk[0]?.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })
                : ''}
            </div>
            {wk.map((day, di) => {
              const bg =
                day.status === 'completed' ? '#22c55e' :
                day.status === 'missed' ? '#f97316' :
                day.status === 'weekend' ? 'transparent' :
                day.status === 'future' ? 'transparent' :
                'var(--border, #2a2a2a)'

              const border =
                day.status === 'weekend' ? '1px dashed var(--border, #2a2a2a)' :
                day.status === 'future' ? '1px dashed var(--border, #2a2a2a)' :
                'none'

              const title =
                day.status === 'completed' ? `${day.date} ✅ Completed (P&L: ${day.entry ? formatPnl(day.entry.totalPnl) : '—'})` :
                day.status === 'missed' ? `${day.date} ❌ Missed` :
                day.status === 'weekend' ? `${day.date} (Weekend)` :
                day.date

              return (
                <div
                  key={di}
                  title={title}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: bg,
                    border,
                    cursor: day.status === 'completed' ? 'pointer' : 'default',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
        {[
          { color: '#22c55e', label: 'Completed' },
          { color: '#f97316', label: 'Missed' },
          { color: 'var(--border, #2a2a2a)', label: 'No entry' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: 'var(--text-3, #666)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Confetti (CSS-based, no deps) ───────────────────────────────────────────

function Confetti({ active }: { active: boolean }) {
  if (!active) return null
  const pieces = Array.from({ length: 30 })
  const colors = ['#4a9eff', '#22c55e', '#a855f7', '#f97316', '#eab308']
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1000,
      }}
    >
      {pieces.map((_, i) => {
        const left = `${Math.random() * 100}%`
        const color = colors[i % colors.length]
        const delay = `${Math.random() * 0.8}s`
        const duration = `${0.8 + Math.random() * 1.2}s`
        const size = 6 + Math.random() * 8
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              top: '-20px',
              width: size,
              height: size,
              borderRadius: Math.random() > 0.5 ? '50%' : 2,
              background: color,
              animation: `confettiFall ${duration} ${delay} ease-in forwards`,
            }}
          />
        )
      })}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── History Entry Item ───────────────────────────────────────────────────────

function HistoryItem({ entry }: { entry: RitualEntry }) {
  const [expanded, setExpanded] = useState(false)
  const pnlColor = entry.totalPnl > 0 ? '#22c55e' : entry.totalPnl < 0 ? '#ef4444' : 'var(--text-2, #999)'

  return (
    <div
      style={{
        background: 'var(--card-bg, #1a1a1a)',
        border: '1px solid var(--border, #2a2a2a)',
        borderRadius: 12,
        padding: '14px 18px',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-3, #666)', minWidth: 80 }}>
          {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <span style={{ fontWeight: 600, color: pnlColor, minWidth: 80, fontSize: 13 }}>
          {formatPnl(entry.totalPnl)}
        </span>
        {entry.emotion && (
          <span style={{ fontSize: 18 }}>
            {EMOTION_EMOJIS[entry.emotion.score - 1]}
          </span>
        )}
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2, #999)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.note || <em>No note</em>}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3, #666)' }}>
          {entry.trades.length} trade{entry.trades.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3, #666)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border, #2a2a2a)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entry.note && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3, #666)', marginBottom: 4 }}>Note</div>
              <div style={{ fontSize: 13, color: 'var(--text-1, #e0e0e0)', lineHeight: 1.5 }}>{entry.note}</div>
            </div>
          )}
          {entry.emotion && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3, #666)', marginBottom: 6 }}>Emotion</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20 }}>{EMOTION_EMOJIS[entry.emotion.score - 1]}</span>
                {entry.emotion.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'var(--border, #2a2a2a)',
                      fontSize: 11,
                      color: 'var(--text-2, #999)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {entry.followedRules !== undefined && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3, #666)', marginBottom: 4 }}>Followed Rules</div>
              <div style={{ fontSize: 13, color: entry.followedRules ? '#22c55e' : '#ef4444' }}>
                {entry.followedRules ? '✓ Yes' : '✗ No'}
                {entry.rulesNote && (
                  <span style={{ color: 'var(--text-2, #999)', marginLeft: 8 }}>{entry.rulesNote}</span>
                )}
              </div>
            </div>
          )}
          {entry.completionTimeSeconds !== undefined && (
            <div style={{ fontSize: 11, color: 'var(--text-3, #666)' }}>
              Completed in {entry.completionTimeSeconds}s
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Completed View ────────────────────────────────────────────────────────────

function CompletedView({
  entry,
  streak,
  entries,
  onEdit,
}: {
  entry: RitualEntry
  streak: StreakData
  entries: RitualEntry[]
  onEdit: () => void
}) {
  const pnlColor = entry.totalPnl > 0 ? '#22c55e' : entry.totalPnl < 0 ? '#ef4444' : 'var(--text-2, #999)'
  const newMilestones = STREAK_MILESTONES.filter(m => streak.milestones.includes(m))
  const latestMilestone = newMilestones.filter(m => m <= streak.currentStreak).sort((a, b) => b - a)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Streak display */}
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          width: '100%',
          background: 'linear-gradient(135deg, #1a2a1a 0%, #1a1a2a 100%)',
          border: '1px solid #4a9eff33',
          borderRadius: 12,
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div style={{ fontSize: 48 }}>🔥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#4a9eff', lineHeight: 1 }}>
            {streak.currentStreak}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2, #999)', marginTop: 4 }}>
            day streak · Best: {streak.longestStreak}
          </div>
          {latestMilestone && (
            <div
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: '#4a9eff22',
                borderRadius: 20,
                fontSize: 12,
                color: '#4a9eff',
              }}
            >
              🏆 {milestoneLabel(latestMilestone)} milestone achieved!
            </div>
          )}
        </div>
        <button
          onClick={onEdit}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--border, #333)',
            background: 'transparent',
            color: 'var(--text-2, #999)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Edit
        </button>
      </div>

      {/* Today's entry summary */}
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          width: '100%',
          background: 'var(--card-bg, #1a1a1a)',
          border: '1px solid var(--border, #2a2a2a)',
          borderRadius: 12,
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--text-3, #666)' }}>Today's Ritual</div>
          <div style={{ fontSize: 13, color: '#22c55e' }}>✅ Complete</div>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3, #666)', marginBottom: 4 }}>P&L</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: pnlColor }}>{formatPnl(entry.totalPnl)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3, #666)', marginBottom: 4 }}>Trades</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1, #e0e0e0)' }}>{entry.trades.length}</div>
          </div>
          {entry.emotion && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3, #666)', marginBottom: 4 }}>Mood</div>
              <div style={{ fontSize: 28 }}>{EMOTION_EMOJIS[entry.emotion.score - 1]}</div>
            </div>
          )}
        </div>

        {entry.note && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3, #666)', marginBottom: 6 }}>Note</div>
            <div style={{ fontSize: 14, color: 'var(--text-1, #e0e0e0)', lineHeight: 1.6 }}>{entry.note}</div>
          </div>
        )}

        {entry.followedRules !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: entry.followedRules ? '#22c55e' : '#ef4444' }}>
              {entry.followedRules ? '✓ Followed trading rules' : '✗ Did not follow all rules'}
            </span>
            {entry.rulesNote && (
              <span style={{ fontSize: 12, color: 'var(--text-3, #666)' }}>— {entry.rulesNote}</span>
            )}
          </div>
        )}

        {entry.emotion?.tags && entry.emotion.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {entry.emotion.tags.map(tag => (
              <span
                key={tag}
                style={{
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: 'var(--border, #2a2a2a)',
                  fontSize: 12,
                  color: 'var(--text-2, #999)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          width: '100%',
          background: 'var(--card-bg, #1a1a1a)',
          border: '1px solid var(--border, #2a2a2a)',
          borderRadius: 12,
          padding: '24px 28px',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text-3, #666)', marginBottom: 16 }}>Activity</div>
        <CalendarHeatmap entries={entries} />
      </div>

      {/* History */}
      <HistorySection entries={entries} currentDate={entry.date} />
    </div>
  )
}

// ─── History Section ──────────────────────────────────────────────────────────

function HistorySection({ entries, currentDate }: { entries: RitualEntry[]; currentDate: string }) {
  const past = entries.filter(e => e.date !== currentDate)
  if (past.length === 0) return null

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <div style={{ fontSize: 14, color: 'var(--text-2, #999)', marginBottom: 12, fontWeight: 500 }}>
        Past Rituals
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {past.map(e => (
          <HistoryItem key={e.id} entry={e} />
        ))}
      </div>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

function WizardFlow({
  onComplete,
  editEntry,
}: {
  onComplete: (entry: RitualEntry) => void
  editEntry?: RitualEntry
}) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const startTime = useRef<number>(Date.now())

  // Step 1 state
  const [todayTrades, setTodayTrades] = useState<TodayTrade[]>([])
  const [manualPnl, setManualPnl] = useState<string>(editEntry ? String(editEntry.totalPnl) : '')
  const [noTrades, setNoTrades] = useState(editEntry ? editEntry.trades.length === 0 : false)

  // Step 2 state
  const [note, setNote] = useState(editEntry?.note ?? '')
  const [followedRules, setFollowedRules] = useState<boolean | undefined>(editEntry?.followedRules)
  const [rulesNote, setRulesNote] = useState(editEntry?.rulesNote ?? '')
  const [showRulesNote, setShowRulesNote] = useState(editEntry?.rulesNote ? true : false)

  // Step 3 state
  const [emotionScore, setEmotionScore] = useState(editEntry?.emotion?.score ?? 3)
  const [selectedTags, setSelectedTags] = useState<string[]>(editEntry?.emotion?.tags ?? [])

  // Step 4 state
  const [screenshots, setScreenshots] = useState<string[]>(editEntry?.screenshots ?? [])
  const fileRef = useRef<HTMLInputElement>(null)

  // Load today's trades on mount
  useEffect(() => {
    const trades = getTodayTradesFromJournal()
    setTodayTrades(trades)
    if (editEntry && editEntry.trades.length > 0 && trades.length === 0) {
      // Edit mode with no live trades, treat as manual
    }
  }, [editEntry])

  const transition = (nextStep: number) => {
    setVisible(false)
    setTimeout(() => {
      setStep(nextStep)
      setVisible(true)
    }, 250)
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) transition(step + 1)
  }

  const handleSkip = () => {
    if (step < TOTAL_STEPS - 1) transition(step + 1)
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        setScreenshots(prev => [...prev, result])
      }
      reader.readAsDataURL(file)
    })
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleComplete = () => {
    const autoTrades = noTrades ? [] : todayTrades.map(t => t.id)
    const autoPnl = noTrades
      ? 0
      : todayTrades.length > 0
        ? todayTrades.reduce((sum, t) => sum + t.pnl, 0)
        : parseFloat(manualPnl) || 0

    const elapsedSeconds = Math.round((Date.now() - startTime.current) / 1000)

    const entry: RitualEntry = {
      id: editEntry?.id ?? generateId(),
      date: todayDateString(),
      trades: autoTrades,
      totalPnl: autoPnl,
      note,
      emotion: { score: emotionScore, tags: selectedTags },
      screenshots: screenshots.length > 0 ? screenshots : undefined,
      followedRules,
      rulesNote: followedRules !== undefined ? rulesNote : undefined,
      completedAt: new Date().toISOString(),
      completionTimeSeconds: editEntry ? editEntry.completionTimeSeconds : elapsedSeconds,
    }

    transition(TOTAL_STEPS - 1)
    // Slight delay so user sees step 5 animation before we fire the callback
    setTimeout(() => onComplete(entry), 800)
  }

  const calculatedPnl = noTrades
    ? 0
    : todayTrades.length > 0
      ? todayTrades.reduce((sum, t) => sum + t.pnl, 0)
      : parseFloat(manualPnl) || 0

  const pnlColor = calculatedPnl > 0 ? '#22c55e' : calculatedPnl < 0 ? '#ef4444' : 'var(--text-2, #999)'

  return (
    <div>
      <ProgressDots total={TOTAL_STEPS} current={step} />

      {/* Step 1 — Trades */}
      {step === 0 && (
        <StepCard visible={visible}>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6, color: 'var(--text-1, #e0e0e0)' }}>
            What did you trade today?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-3, #666)', marginBottom: 24 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>

          {todayTrades.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {todayTrades.map(trade => (
                <div
                  key={trade.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--bg, #111)',
                    border: '1px solid var(--border, #2a2a2a)',
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-1, #e0e0e0)', marginRight: 8 }}>{trade.symbol}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3, #666)' }}>{trade.direction}</span>
                  </div>
                  <span style={{ fontWeight: 600, color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    {formatPnl(trade.pnl)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  padding: '10px 16px',
                  background: '#4a9eff11',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 4,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-2, #999)' }}>Total P&L</span>
                <span style={{ fontWeight: 700, color: pnlColor }}>{formatPnl(calculatedPnl)}</span>
              </div>
            </div>
          ) : (
            !noTrades && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-2, #999)', marginBottom: 8 }}>
                  No trades logged yet — enter P&L manually:
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 250.00 or -85.00"
                  value={manualPnl}
                  onChange={e => setManualPnl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'var(--bg, #111)',
                    border: '1px solid var(--border, #2a2a2a)',
                    borderRadius: 8,
                    color: 'var(--text-1, #e0e0e0)',
                    fontSize: 16,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-2, #999)' }}>
              <input
                type="checkbox"
                checked={noTrades}
                onChange={e => setNoTrades(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              No trades today
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleNext} style={btnPrimary}>
              Next →
            </button>
            <button onClick={handleSkip} style={btnGhost}>
              Skip
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 2 — How did it go */}
      {step === 1 && (
        <StepCard visible={visible}>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6, color: 'var(--text-1, #e0e0e0)' }}>
            How did it go?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-3, #666)', marginBottom: 24 }}>
            A quick note about today's session.
          </p>

          <textarea
            placeholder="What happened today? Key lessons, market observations, what you'd do differently…"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'var(--bg, #111)',
              border: '1px solid var(--border, #2a2a2a)',
              borderRadius: 8,
              color: 'var(--text-1, #e0e0e0)',
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              marginBottom: 20,
            }}
          />

          {/* Rules toggle */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2, #999)', marginBottom: 10 }}>
              Did you follow your trading rules?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { val: true, label: '✓ Yes', color: '#22c55e' },
                { val: false, label: '✗ No', color: '#ef4444' },
              ].map(({ val, label, color }) => (
                <button
                  key={label}
                  onClick={() => {
                    setFollowedRules(followedRules === val ? undefined : val)
                    if (followedRules !== val) setShowRulesNote(true)
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: `1px solid ${followedRules === val ? color : 'var(--border, #333)'}`,
                    background: followedRules === val ? `${color}22` : 'transparent',
                    color: followedRules === val ? color : 'var(--text-2, #999)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: followedRules === val ? 600 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {followedRules !== undefined && showRulesNote && (
              <input
                type="text"
                placeholder={followedRules ? 'Great! What worked well?' : 'Which rules did you break?'}
                value={rulesNote}
                onChange={e => setRulesNote(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 10,
                  padding: '10px 14px',
                  background: 'var(--bg, #111)',
                  border: '1px solid var(--border, #2a2a2a)',
                  borderRadius: 8,
                  color: 'var(--text-1, #e0e0e0)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleNext} style={btnPrimary}>
              Next →
            </button>
            <button onClick={handleSkip} style={btnGhost}>
              Skip
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 3 — Emotion */}
      {step === 2 && (
        <StepCard visible={visible}>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6, color: 'var(--text-1, #e0e0e0)' }}>
            How are you feeling?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-3, #666)', marginBottom: 28 }}>
            Track your emotional state after the session.
          </p>

          {/* Emoji row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            {EMOTION_EMOJIS.map((emoji, i) => (
              <button
                key={i}
                onClick={() => setEmotionScore(i + 1)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: emotionScore === i + 1 ? 40 : 28,
                  opacity: emotionScore === i + 1 ? 1 : 0.4,
                  transform: emotionScore === i + 1 ? 'translateY(-4px)' : 'none',
                  transition: 'all 0.2s',
                  padding: '4px 8px',
                  borderRadius: 8,
                }}
                title={['Terrible', 'Bad', 'Neutral', 'Good', 'Great'][i]}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Slider */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              type="range"
              min={1}
              max={5}
              value={emotionScore}
              onChange={e => setEmotionScore(Number(e.target.value))}
              style={{
                width: '100%',
                height: 6,
                appearance: 'none',
                background: `linear-gradient(to right, ${EMOTION_COLORS[0]}, ${EMOTION_COLORS[2]}, ${EMOTION_COLORS[4]})`,
                borderRadius: 4,
                cursor: 'pointer',
                outline: 'none',
                accentColor: EMOTION_COLORS[emotionScore - 1],
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
            <span style={{ fontSize: 10, color: '#ef4444' }}>Terrible</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: EMOTION_COLORS[emotionScore - 1] }}>
              {['Terrible', 'Bad', 'Neutral', 'Good', 'Great'][emotionScore - 1]}
            </span>
            <span style={{ fontSize: 10, color: '#22c55e' }}>Great</span>
          </div>

          {/* Emotion tags */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3, #666)', marginBottom: 10 }}>
              Tag your state (optional):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EMOTION_TAGS.map(tag => {
                const active = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      border: `1px solid ${active ? '#4a9eff' : 'var(--border, #333)'}`,
                      background: active ? '#4a9eff22' : 'transparent',
                      color: active ? '#4a9eff' : 'var(--text-2, #999)',
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'all 0.15s',
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleNext} style={btnPrimary}>
              Next →
            </button>
            <button onClick={handleSkip} style={btnGhost}>
              Skip
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 4 — Screenshots */}
      {step === 3 && (
        <StepCard visible={visible}>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6, color: 'var(--text-1, #e0e0e0)' }}>
            Add a screenshot?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-3, #666)', marginBottom: 28 }}>
            Attach chart screenshots to remember your setups.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {screenshots.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {screenshots.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Trade screenshot ${i + 1}`}
                    loading="lazy"
                    style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border, #333)' }}
                  />
                  <button
                    onClick={() => setScreenshots(prev => prev.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#ef4444',
                      border: 'none',
                      color: '#fff',
                      fontSize: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '16px 20px',
              background: 'var(--bg, #111)',
              border: '1px dashed var(--border, #333)',
              borderRadius: 10,
              color: 'var(--text-2, #999)',
              cursor: 'pointer',
              fontSize: 14,
              width: '100%',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            📎 Upload screenshot
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleComplete} style={btnPrimary}>
              Finish →
            </button>
            <button onClick={handleComplete} style={btnGhost}>
              Skip
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 5 — Done! */}
      {step === 4 && (
        <StepCard visible={visible}>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#4a9eff', marginBottom: 8 }}>
              Done!
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-2, #999)', marginBottom: 24 }}>
              Ritual complete. Great job taking care of your trading mindset.
            </p>

            {/* Quick summary */}
            <div
              style={{
                background: 'var(--bg, #111)',
                border: '1px solid #4a9eff33',
                borderRadius: 10,
                padding: '16px 20px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-3, #666)', marginBottom: 4 }}>Summary</div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3, #666)' }}>P&L</div>
                  <div style={{ fontWeight: 700, color: pnlColor, fontSize: 18 }}>{formatPnl(calculatedPnl)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3, #666)' }}>Feeling</div>
                  <div style={{ fontSize: 24 }}>{EMOTION_EMOJIS[emotionScore - 1]}</div>
                </div>
                {note && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3, #666)' }}>Note</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2, #999)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </StepCard>
      )}
    </div>
  )
}

// ─── Button styles ────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: 8,
  border: 'none',
  background: '#4a9eff',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
}

const btnGhost: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 8,
  border: '1px solid var(--border, #333)',
  background: 'transparent',
  color: 'var(--text-3, #666)',
  cursor: 'pointer',
  fontSize: 14,
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RitualPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<RitualEntry[]>([])
  const [streak, setStreak] = useState<StreakData>({ currentStreak: 0, longestStreak: 0, lastCompletedDate: '', milestones: [] })
  const [todayEntry, setTodayEntry] = useState<RitualEntry | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const today = todayDateString()

  // Load data
  useEffect(() => {
    const allEntries = loadRitualEntries()
    setEntries(allEntries)
    const todayE = allEntries.find(e => e.date === today)
    setTodayEntry(todayE)
    const s = computeStreak(allEntries)
    setStreak(s)
    saveStreakData(s)
    setLoaded(true)
  }, [today])

  const handleComplete = useCallback((entry: RitualEntry) => {
    const updated = upsertRitualEntry(entry)
    setEntries(updated)
    setTodayEntry(entry)
    setEditing(false)

    const newStreak = computeStreak(updated)
    setStreak(newStreak)
    saveStreakData(newStreak)

    // Fire confetti
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 3000)
  }, [])

  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #0a0a0a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PersistentNav />
        <div style={{ color: 'var(--text-3, #666)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  // Auth gating
  const tier = getUserTier(user)
  if (tier === 'demo') {
    return (
      <AuthGate
        featureName="Post-Trade Ritual"
        featureDesc="Build your daily trading habits. Review trades, track emotional state, and build consistency. Free account required."
      >
        <div style={{ minHeight: '100vh', background: 'var(--bg, #0a0a0a)' }}>
          <PersistentNav />
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Post-Trade Ritual</h1>
          </div>
        </div>
      </AuthGate>
    )
  }

  const showWizard = !todayEntry || editing

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0a0a0a)' }}>
      <PersistentNav />
      <Confetti active={showConfetti} />

      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '40px 20px 80px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 40,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: 'var(--text-1, #e0e0e0)',
                marginBottom: 6,
                letterSpacing: '-0.5px',
              }}
            >
              Post-Trade Ritual
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-3, #666)' }}>
              {formatDisplayDate(today)}
            </p>
          </div>

          {/* Streak badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: streak.currentStreak > 0 ? '#1a1a0a' : 'var(--card-bg, #1a1a1a)',
              border: `1px solid ${streak.currentStreak > 0 ? '#f97316' : 'var(--border, #2a2a2a)'}`,
              borderRadius: 12,
            }}
          >
            <span style={{ color: streak.currentStreak > 0 ? '#f97316' : 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
            </span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: streak.currentStreak > 0 ? '#f97316' : 'var(--text-3, #666)', lineHeight: 1 }}>
                {streak.currentStreak}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3, #666)' }}>day streak</div>
            </div>
          </div>
        </div>

        {/* Milestone badges row */}
        {streak.milestones.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            {streak.milestones.map(m => (
              <div
                key={m}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  background: '#4a9eff22',
                  border: '1px solid #4a9eff44',
                  fontSize: 12,
                  color: '#4a9eff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                🏆 {milestoneLabel(m)}
              </div>
            ))}
          </div>
        )}

        {/* Main content */}
        {showWizard ? (
          <WizardFlow
            key={editing ? 'edit' : 'new'}
            onComplete={handleComplete}
            editEntry={editing ? todayEntry : undefined}
          />
        ) : (
          todayEntry && (
            <CompletedView
              entry={todayEntry}
              streak={streak}
              entries={entries}
              onEdit={() => setEditing(true)}
            />
          )
        )}

        {/* History when in wizard mode */}
        {showWizard && entries.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <HistorySection entries={entries} currentDate={today} />
          </div>
        )}

        {/* ── Push Notification Panel ──────────────────────────────────────── */}
        <PushNotificationPanel />

        {/* ── Disclaimer ──────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 0', marginTop: 24, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
            ⚠️ Performance analytics are based on user-entered data and may not reflect actual trading results. Past performance does not guarantee future results. This is not financial advice.
          </p>
        </div>
      </div>
    </div>
  )
}
