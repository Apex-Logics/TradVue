// ─── AI Trade Coach Data Model ────────────────────────────────────────────────
// All data stays client-side — zero network calls, localStorage only.

export interface CoachInsight {
  id: string
  type: 'pattern' | 'streak' | 'time_analysis' | 'ticker_analysis' | 'emotion' | 'risk' | 'playbook' | 'general'
  severity: 'positive' | 'neutral' | 'warning' | 'critical'
  title: string           // e.g., "Revenge Trading Detected"
  description: string     // detailed explanation
  metric?: string         // e.g., "Win rate drops 40% after 2 PM"
  recommendation: string  // actionable advice
  dataPoints?: number     // how many trades this is based on
  createdAt: string
}

export interface WeeklySummary {
  id: string
  weekStart: string       // YYYY-MM-DD (Monday)
  weekEnd: string         // YYYY-MM-DD (Friday)
  totalTrades: number
  winRate: number
  totalPnl: number
  avgWinner: number
  avgLoser: number
  profitFactor: number
  bestDay: { date: string; pnl: number }
  worstDay: { date: string; pnl: number }
  insights: CoachInsight[]
  generatedAt: string
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export const COACH_SUMMARIES_KEY = 'cg_coach_summaries'

export function loadCoachSummaries(): WeeklySummary[] {
  try {
    const raw = localStorage.getItem(COACH_SUMMARIES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCoachSummaries(summaries: WeeklySummary[]): void {
  localStorage.setItem(COACH_SUMMARIES_KEY, JSON.stringify(summaries))
}

export function upsertCoachSummary(summary: WeeklySummary): void {
  const summaries = loadCoachSummaries()
  const idx = summaries.findIndex(s => s.weekStart === summary.weekStart)
  if (idx >= 0) {
    summaries[idx] = summary
  } else {
    summaries.unshift(summary)
  }
  // Keep only last 52 weeks
  saveCoachSummaries(summaries.slice(0, 52))
}
