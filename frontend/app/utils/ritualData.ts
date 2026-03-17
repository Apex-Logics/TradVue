// ─── Post-Trade Ritual Data Model ────────────────────────────────────────────

export interface RitualEntry {
  id: string
  date: string                    // YYYY-MM-DD
  trades: string[]                // linked trade IDs from journal
  totalPnl: number                // auto-calculated or manually entered
  note: string                    // free text (unlimited with trial)
  emotion?: {
    score: number                 // 1-5 scale (1=terrible, 5=great)
    tags: string[]                // e.g., ["disciplined", "frustrated"]
  }
  screenshots?: string[]          // base64 data URLs (paid feature, included in trial)
  playbookId?: string             // which playbook was used today
  followedRules?: boolean         // "Did I follow my trading rules?"
  rulesNote?: string              // what rules were broken/followed
  completedAt: string             // ISO datetime string
  completionTimeSeconds?: number
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastCompletedDate: string       // YYYY-MM-DD
  milestones: number[]            // achieved milestones [7, 14, 30, ...]
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

export const RITUAL_ENTRIES_KEY = 'cg_ritual_entries'
export const RITUAL_STREAK_KEY = 'cg_ritual_streak'

// ─── Storage Helpers ──────────────────────────────────────────────────────────

export function loadRitualEntries(): RitualEntry[] {
  try {
    const raw = localStorage.getItem(RITUAL_ENTRIES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRitualEntries(entries: RitualEntry[]): void {
  localStorage.setItem(RITUAL_ENTRIES_KEY, JSON.stringify(entries))
}

export function loadStreakData(): StreakData | null {
  try {
    const raw = localStorage.getItem(RITUAL_STREAK_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveStreakData(streak: StreakData): void {
  localStorage.setItem(RITUAL_STREAK_KEY, JSON.stringify(streak))
}

export function upsertRitualEntry(entry: RitualEntry): RitualEntry[] {
  const all = loadRitualEntries()
  const idx = all.findIndex(e => e.id === entry.id)
  if (idx >= 0) {
    all[idx] = entry
  } else {
    all.push(entry)
  }
  // Sort newest first
  all.sort((a, b) => b.date.localeCompare(a.date))
  saveRitualEntries(all)
  return all
}

export function getRitualEntryForDate(date: string): RitualEntry | undefined {
  const all = loadRitualEntries()
  return all.find(e => e.date === date)
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function todayDateString(): string {
  const now = new Date()
  return formatDateString(now)
}

export function formatDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isWeekday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00')
  const dow = date.getDay()
  return dow !== 0 && dow !== 6
}

export function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Streak Logic ─────────────────────────────────────────────────────────────

export const STREAK_MILESTONES = [7, 14, 30, 60, 90, 180, 365]

/**
 * Compute streak given all entries and today's date.
 * Weekends are skipped — they don't break or extend streak.
 * Missing any weekday breaks the streak.
 */
export function computeStreak(entries: RitualEntry[]): StreakData {
  const existing = loadStreakData()

  if (entries.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: existing?.longestStreak ?? 0,
      lastCompletedDate: '',
      milestones: existing?.milestones ?? [],
    }
  }

  // Build a Set of completed dates
  const completedDates = new Set(entries.map(e => e.date))

  // Walk backwards from yesterday (or today if completed today)
  // to count the current streak
  const today = todayDateString()
  const completedToday = completedDates.has(today)

  let streak = 0
  const cursor = new Date(today + 'T00:00:00')

  // Start from today or yesterday depending on whether today is done
  if (!completedToday) {
    // Walk from yesterday
    cursor.setDate(cursor.getDate() - 1)
  }

  while (true) {
    const ds = formatDateString(cursor)
    const dow = cursor.getDay()

    if (dow === 0 || dow === 6) {
      // Weekend — skip, don't break
      cursor.setDate(cursor.getDate() - 1)
      continue
    }

    if (completedDates.has(ds)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  const allDates = Array.from(completedDates).sort()
  const lastCompleted = allDates[allDates.length - 1] ?? ''

  // Compute longest streak across all history
  let longestStreak = existing?.longestStreak ?? 0
  longestStreak = Math.max(longestStreak, streak)

  // Check milestones
  const prevMilestones = existing?.milestones ?? []
  const newMilestones = STREAK_MILESTONES.filter(m => streak >= m && !prevMilestones.includes(m))
  const milestones = [...prevMilestones, ...newMilestones]

  return {
    currentStreak: streak,
    longestStreak,
    lastCompletedDate: lastCompleted,
    milestones,
  }
}

// ─── Emotion Helpers ──────────────────────────────────────────────────────────

export const EMOTION_EMOJIS = ['😫', '😕', '😐', '🙂', '😄']

export const EMOTION_LABELS = ['Terrible', 'Bad', 'Neutral', 'Good', 'Great']

export const EMOTION_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

export const EMOTION_TAGS = [
  'Disciplined', 'Confident', 'Frustrated', 'Anxious',
  'Euphoric', 'Revenge-mode', 'Patient', 'FOMO', 'Calm', 'Overwhelmed',
]

export function emotionEmoji(score: number): string {
  return EMOTION_EMOJIS[score - 1] ?? '😐'
}

export function emotionLabel(score: number): string {
  return EMOTION_LABELS[score - 1] ?? 'Neutral'
}

export function emotionColor(score: number): string {
  return EMOTION_COLORS[score - 1] ?? '#eab308'
}

// ─── Calendar Heatmap Helpers ─────────────────────────────────────────────────

export type DayStatus = 'completed' | 'missed' | 'none' | 'weekend' | 'future'

export interface CalendarDay {
  date: string
  status: DayStatus
  entry?: RitualEntry
}

/**
 * Generate last N weeks of calendar data for the heatmap
 */
export function generateCalendarData(entries: RitualEntry[], weeks = 13): CalendarDay[] {
  const completedDates = new Map(entries.map(e => [e.date, e]))
  const today = new Date()
  const todayStr = formatDateString(today)

  // Start from `weeks` weeks ago, on a Sunday
  const start = new Date(today)
  start.setDate(start.getDate() - (weeks * 7))
  // Align to Sunday
  start.setDate(start.getDate() - start.getDay())

  const days: CalendarDay[] = []
  const cursor = new Date(start)

  while (formatDateString(cursor) <= todayStr) {
    const ds = formatDateString(cursor)
    const dow = cursor.getDay()
    const isWeekendDay = dow === 0 || dow === 6
    const isFuture = ds > todayStr

    let status: DayStatus
    if (isFuture) {
      status = 'future'
    } else if (isWeekendDay) {
      status = 'weekend'
    } else if (completedDates.has(ds)) {
      status = 'completed'
    } else {
      status = 'missed'
    }

    days.push({
      date: ds,
      status,
      entry: completedDates.get(ds),
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

export function milestoneLabel(days: number): string {
  if (days === 365) return '1 Year'
  if (days >= 30) return `${days}d`
  return `${days}d`
}
