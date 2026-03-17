// ─── AI Trade Coach Pattern Detection Engine ─────────────────────────────────
// Runs 100% client-side. No API calls. No data leaves the device.

import { CoachInsight, WeeklySummary, upsertCoachSummary } from './coachData'

// ─── Types mirrored from journal (avoid circular dep) ─────────────────────────

export interface TradeLike {
  id: string
  date: string          // YYYY-MM-DD
  time: string          // HH:MM or HH:MM:SS
  symbol: string
  direction: string
  entryPrice: number
  exitPrice: number
  positionSize: number
  pnl: number
  rMultiple?: number
  holdMinutes?: number
  playbookId?: string
  emotionTag?: string
  tags_strategies?: string[]
  tags_mistakes?: string[]
}

export interface RitualLike {
  id: string
  date: string
  totalPnl: number
  emotion?: { score: number; tags: string[] }
  completedAt: string
}

// ─── Threshold System ─────────────────────────────────────────────────────────

export type ThresholdLevel = 'none' | 'basic' | 'patterns' | 'full' | 'confident'

export interface ThresholdInfo {
  level: ThresholdLevel
  tradeCount: number
  message: string
  nextMilestone: number
  nextLabel: string
  progressLabel: string
  progressPct: number
}

export function getThresholdInfo(tradeCount: number): ThresholdInfo {
  if (tradeCount < 5) {
    return {
      level: 'none',
      tradeCount,
      message: 'Log at least 5 trades to unlock your first insights. The more you trade and journal, the smarter your analysis gets.',
      nextMilestone: 5,
      nextLabel: 'Basic Stats',
      progressLabel: `${tradeCount} / 5 trades for Basic Stats`,
      progressPct: tradeCount / 5,
    }
  } else if (tradeCount < 10) {
    return {
      level: 'basic',
      tradeCount,
      message: 'Basic stats unlocked! Log 10+ trades to unlock pattern detection.',
      nextMilestone: 10,
      nextLabel: 'Pattern Detection',
      progressLabel: `${tradeCount} / 10 for Pattern Detection`,
      progressPct: tradeCount / 10,
    }
  } else if (tradeCount < 20) {
    return {
      level: 'patterns',
      tradeCount,
      message: 'Pattern detection active! Log 20+ trades for advanced behavioral insights.',
      nextMilestone: 20,
      nextLabel: 'Full Analysis',
      progressLabel: `${tradeCount} / 20 for Full Analysis`,
      progressPct: tradeCount / 20,
    }
  } else if (tradeCount < 50) {
    return {
      level: 'full',
      tradeCount,
      message: 'Full analysis active. Keep journaling — insights improve with more data.',
      nextMilestone: 50,
      nextLabel: 'High-Confidence',
      progressLabel: `${tradeCount} / 50 for High-Confidence`,
      progressPct: tradeCount / 50,
    }
  } else {
    return {
      level: 'confident',
      tradeCount,
      message: 'High-confidence analysis based on 50+ trades.',
      nextMilestone: 50,
      nextLabel: 'High-Confidence',
      progressLabel: `${tradeCount} trades — High-Confidence Mode`,
      progressPct: 1,
    }
  }
}

/** Insight types visible at each threshold level */
export const THRESHOLD_INSIGHT_TYPES: Record<ThresholdLevel, string[]> = {
  none: [],
  basic: [],
  patterns: ['streak', 'pattern', 'ticker_analysis'],
  full: ['streak', 'pattern', 'ticker_analysis', 'time_analysis', 'risk', 'playbook', 'emotion'],
  confident: ['streak', 'pattern', 'ticker_analysis', 'time_analysis', 'risk', 'playbook', 'emotion'],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Parse "HH:MM" or "HH:MM:SS" into minutes since midnight */
function timeToMinutes(t: string): number {
  const parts = t.split(':').map(Number)
  return parts[0] * 60 + (parts[1] ?? 0)
}

/** Get YYYY-MM-DD Monday of the week containing `date` */
export function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Get YYYY-MM-DD Friday of the week containing `date` */
export function getFridayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? 5 : 5 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function winRate(trades: TradeLike[]): number {
  if (!trades.length) return 0
  return trades.filter(t => t.pnl > 0).length / trades.length
}

function avgPnl(trades: TradeLike[]): number {
  if (!trades.length) return 0
  return trades.reduce((s, t) => s + t.pnl, 0) / trades.length
}

// ─── Pattern Detectors ────────────────────────────────────────────────────────

/** a) Revenge Trading: trade within 15min after a loss, same-or-larger size */
function detectRevengeTrading(trades: TradeLike[]): CoachInsight[] {
  if (trades.length < 5) return []

  // Sort by date+time
  const sorted = [...trades].sort((a, b) => {
    const da = a.date + ' ' + a.time
    const db = b.date + ' ' + b.time
    return da.localeCompare(db)
  })

  const revengeTrades: TradeLike[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (prev.pnl >= 0) continue // previous wasn't a loss
    if (prev.date !== curr.date) continue // different day

    const prevMin = timeToMinutes(prev.time)
    const currMin = timeToMinutes(curr.time)
    const gap = currMin - prevMin

    if (gap >= 0 && gap <= 15 && curr.positionSize >= prev.positionSize) {
      revengeTrades.push(curr)
    }
  }

  if (revengeTrades.length < 2) return []

  const overallWr = winRate(trades)
  const revengeWr = winRate(revengeTrades)
  const drop = overallWr - revengeWr

  if (drop < 0.1) return [] // not significantly worse

  const pctDrop = Math.round(drop * 100)
  return [{
    id: uid(),
    type: 'pattern',
    severity: drop > 0.25 ? 'critical' : 'warning',
    title: 'Revenge Trading Pattern Detected',
    description: `Your data shows ${revengeTrades.length} trades taken within 15 minutes of a loss with equal or larger position size. These entries perform significantly worse than your historical average.`,
    metric: `Win rate drops ${pctDrop}% on these entries (${Math.round(revengeWr * 100)}% vs ${Math.round(overallWr * 100)}% overall)`,
    recommendation: `📊 Data observation: Performance tends to decline when re-entering within 15 minutes of a loss. Based on your logged trades, a ${pctDrop}% win rate drop is observed on these entries. Historical data indicates a pause after losing trades correlates with improved subsequent performance.`,
    dataPoints: revengeTrades.length,
    createdAt: new Date().toISOString(),
  }]
}

/** b) Overtrading: days with 5+ trades where P&L/trade decreases with count */
function detectOvertrading(trades: TradeLike[]): CoachInsight[] {
  // Group by date
  const byDay: Record<string, TradeLike[]> = {}
  for (const t of trades) {
    if (!byDay[t.date]) byDay[t.date] = []
    byDay[t.date].push(t)
  }

  let overtradeDays = 0
  let early3Pnl = 0
  let later4Pnl = 0
  let sampleSize = 0

  for (const daytrades of Object.values(byDay)) {
    if (daytrades.length < 5) continue
    const sorted = daytrades.sort((a, b) => a.time.localeCompare(b.time))
    const first3 = sorted.slice(0, 3)
    const rest = sorted.slice(3)

    const avgFirst3 = avgPnl(first3)
    const avgRest = avgPnl(rest)

    if (avgRest < avgFirst3) {
      overtradeDays++
      early3Pnl += avgFirst3
      later4Pnl += avgRest
      sampleSize += daytrades.length
    }
  }

  if (overtradeDays < 2) return []

  const avgFirst = (early3Pnl / overtradeDays).toFixed(0)
  const avgLater = (later4Pnl / overtradeDays).toFixed(0)

  return [{
    id: uid(),
    type: 'pattern',
    severity: 'warning',
    title: 'Overtrading Pattern',
    description: `On ${overtradeDays} trading days with 5+ trades, your data shows declining performance on trades 4 and beyond compared to your first 3 trades of the day.`,
    metric: `Avg P&L per trade: First 3 = $${avgFirst}, Trades 4+ = $${avgLater}`,
    recommendation: `📊 Data observation: Based on your logged trades, performance on trades 4+ averages $${avgLater} vs $${avgFirst} on your first 3. Historical data indicates diminishing returns as daily trade count increases. Your statistical edge appears strongest in the first 3 trades of a session.`,
    dataPoints: sampleSize,
    createdAt: new Date().toISOString(),
  }]
}

/** c) Time-of-Day Performance */
function detectTimeOfDay(trades: TradeLike[]): CoachInsight[] {
  if (trades.length < 10) return []

  const buckets: Record<string, TradeLike[]> = {
    'Pre-market (4–9:30)': [],
    'Open (9:30–10:30)': [],
    'Midday (10:30–2:00)': [],
    'Power Hour (2:00–4:00)': [],
    'After Hours (4:00+)': [],
  }

  for (const t of trades) {
    const m = timeToMinutes(t.time)
    if (m < 570) buckets['Pre-market (4–9:30)'].push(t)         // <9:30
    else if (m < 630) buckets['Open (9:30–10:30)'].push(t)       // 9:30-10:30
    else if (m < 840) buckets['Midday (10:30–2:00)'].push(t)     // 10:30-14:00
    else if (m < 960) buckets['Power Hour (2:00–4:00)'].push(t)  // 14:00-16:00
    else buckets['After Hours (4:00+)'].push(t)
  }

  const overallWr = winRate(trades)
  const insights: CoachInsight[] = []

  for (const [period, pts] of Object.entries(buckets)) {
    if (pts.length < 3) continue
    const wr = winRate(pts)
    const drop = overallWr - wr

    if (drop >= 0.15) {
      const avgPeriodPnl = avgPnl(pts)
      const dropPct = Math.round(drop * 100)
      insights.push({
        id: uid(),
        type: 'time_analysis',
        severity: drop >= 0.25 ? 'critical' : 'warning',
        title: `Weak ${period} Performance`,
        description: `Your win rate during ${period} is significantly below your historical average. Your data shows a ${dropPct}% lower win rate during this window.`,
        metric: `Win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% average · Avg P&L: $${avgPeriodPnl.toFixed(0)}`,
        recommendation: `📊 Data observation: Based on your logged trades, the ${period} window shows a ${dropPct}% lower win rate vs. your overall average. Historical data indicates this window's statistical performance differs from your peak hours. Reviewing these entries for common patterns may reveal contributing factors.`,
        dataPoints: pts.length,
        createdAt: new Date().toISOString(),
      })
    }
  }

  return insights
}

/** d) Ticker Concentration: flag tickers with notably bad win rate */
function detectTickerConcentration(trades: TradeLike[]): CoachInsight[] {
  if (trades.length < 8) return []

  const byTicker: Record<string, TradeLike[]> = {}
  for (const t of trades) {
    if (!byTicker[t.symbol]) byTicker[t.symbol] = []
    byTicker[t.symbol].push(t)
  }

  const overallWr = winRate(trades)
  const insights: CoachInsight[] = []

  for (const [sym, pts] of Object.entries(byTicker)) {
    if (pts.length < 3) continue
    const wr = winRate(pts)
    const totalPnl = pts.reduce((s, t) => s + t.pnl, 0)
    const drop = overallWr - wr

    if (drop >= 0.2 && totalPnl < 0) {
      const dropPct = Math.round(drop * 100)
      insights.push({
        id: uid(),
        type: 'ticker_analysis',
        severity: totalPnl < -200 ? 'critical' : 'warning',
        title: `${sym} Statistical Underperformance`,
        description: `Your data shows a win rate on ${sym} that is ${dropPct}% below your overall average, with a net loss on this symbol. Historical data indicates this ticker's performance differs from your typical profile.`,
        metric: `${sym}: ${Math.round(wr * 100)}% win rate (${pts.filter(t => t.pnl > 0).length}W/${pts.filter(t => t.pnl <= 0).length}L) · Total P&L: $${totalPnl.toFixed(0)}`,
        recommendation: `📊 Data observation: Based on your logged trades, ${sym} shows a ${dropPct}% lower win rate than your average. Historically, your results indicate this symbol has not aligned with your overall statistical edge. Your data may warrant reviewing your criteria for this specific ticker.`,
        dataPoints: pts.length,
        createdAt: new Date().toISOString(),
      })
    }
  }

  return insights.slice(0, 2) // cap at 2 ticker insights
}

/** e) Win/Loss Streaks + Post-Streak Behavior */
function detectStreaks(trades: TradeLike[]): CoachInsight[] {
  if (trades.length < 10) return []

  const sorted = [...trades].sort((a, b) => {
    const da = a.date + ' ' + a.time
    const db = b.date + ' ' + b.time
    return da.localeCompare(db)
  })

  const insights: CoachInsight[] = []
  let maxWinStreak = 0
  let maxLossStreak = 0
  let currentWin = 0
  let currentLoss = 0
  const postStreak3Wins: TradeLike[] = []
  const postStreak3Loss: TradeLike[] = []

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]
    if (t.pnl > 0) {
      currentWin++
      currentLoss = 0
      if (currentWin > maxWinStreak) maxWinStreak = currentWin
      // Collect trades right after a 3-win streak
      if (currentWin === 3 && i + 1 < sorted.length) postStreak3Wins.push(sorted[i + 1])
    } else {
      currentLoss++
      currentWin = 0
      if (currentLoss > maxLossStreak) maxLossStreak = currentLoss
      if (currentLoss === 3 && i + 1 < sorted.length) postStreak3Loss.push(sorted[i + 1])
    }
  }

  // Post-win streak behavior
  if (postStreak3Wins.length >= 2) {
    const wr = winRate(postStreak3Wins)
    const overallWr = winRate(trades)
    if (overallWr - wr >= 0.15) {
      const dropPct = Math.round((overallWr - wr) * 100)
      insights.push({
        id: uid(),
        type: 'streak',
        severity: 'warning',
        title: 'Win Streak Overconfidence Pattern',
        description: `After 3 consecutive wins, your data shows the very next trade has a lower-than-average win rate. Your historical data indicates a statistical dip following hot streaks.`,
        metric: `Post win-streak win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% overall`,
        recommendation: `📊 Data observation: Based on your logged trades, performance after 3-win streaks shows a ${dropPct}% statistical dip. Historical data indicates overconfidence after hot streaks may correlate with lower-quality entry selection on the subsequent trade.`,
        dataPoints: postStreak3Wins.length,
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Post-loss streak behavior
  if (postStreak3Loss.length >= 2) {
    const wr = winRate(postStreak3Loss)
    const overallWr = winRate(trades)
    if (overallWr - wr >= 0.15) {
      const dropPct = Math.round((overallWr - wr) * 100)
      insights.push({
        id: uid(),
        type: 'streak',
        severity: 'critical',
        title: 'Post-Drawdown Recovery Pattern',
        description: `After 3 consecutive losing trades, your data shows recovery entries tend to perform worse than average. A pattern of lower-quality setups following drawdowns is present in your historical data.`,
        metric: `Post loss-streak win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% overall`,
        recommendation: `📊 Data observation: Performance tends to decline when continuing to trade after 3 consecutive losses. Based on your logged trades, a ${dropPct}% win rate drop is observed on these recovery entries. Historical data indicates pausing after consecutive losses correlates with better subsequent performance.`,
        dataPoints: postStreak3Loss.length,
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Positive: good streaks
  if (maxWinStreak >= 5) {
    insights.push({
      id: uid(),
      type: 'streak',
      severity: 'positive',
      title: `${maxWinStreak}-Trade Win Streak Recorded`,
      description: `Your data shows a ${maxWinStreak}-trade winning streak this period. This represents strong execution consistency in your historical record.`,
      metric: `Best streak: ${maxWinStreak} consecutive wins`,
      recommendation: `📊 Data observation: Based on your logged trades, this ${maxWinStreak}-trade streak represents a period of strong statistical execution. Historical data indicates analyzing the conditions during this period — setups taken, market environment, session timing — may reveal patterns worth documenting.`,
      dataPoints: maxWinStreak,
      createdAt: new Date().toISOString(),
    })
  }

  return insights
}

/** f) Risk Management: avg loser vs avg winner */
function detectRiskManagement(trades: TradeLike[]): CoachInsight[] {
  if (trades.length < 5) return []

  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl < 0)

  if (!winners.length || !losers.length) return []

  const avgWin = winners.reduce((s, t) => s + t.pnl, 0) / winners.length
  const avgLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length)
  const ratio = avgLoss / avgWin

  const insights: CoachInsight[] = []

  if (ratio > 1.5) {
    insights.push({
      id: uid(),
      type: 'risk',
      severity: ratio > 2 ? 'critical' : 'warning',
      title: 'Unfavorable Loss-to-Win Ratio',
      description: `Your data shows your average losing trade is ${ratio.toFixed(1)}x larger than your average winner. This means an unusually high win rate is required statistically just to break even.`,
      metric: `Avg winner: $${avgWin.toFixed(0)} · Avg loser: -$${avgLoss.toFixed(0)} · Ratio: ${ratio.toFixed(2)}`,
      recommendation: `📊 Data observation: Based on your logged trades, your average losing trade is ${ratio.toFixed(1)}x larger than your average winner. Historical data indicates that tighter loss management — targeting average loser ≤ average winner — correlates with improved overall profitability in your statistical profile.`,
      dataPoints: trades.length,
      createdAt: new Date().toISOString(),
    })
  } else if (ratio < 0.7) {
    insights.push({
      id: uid(),
      type: 'risk',
      severity: 'positive',
      title: 'Strong Risk/Reward Ratio',
      description: `Your data shows winners are significantly larger than losers — a statistically favorable risk profile. Even a sub-50% win rate can be profitable with this pattern.`,
      metric: `Avg winner: $${avgWin.toFixed(0)} · Avg loser: -$${avgLoss.toFixed(0)} · Ratio: 1:${(avgWin / avgLoss).toFixed(1)}`,
      recommendation: `📊 Data observation: Based on your logged trades, your risk-reward profile is statistically favorable at 1:${(avgWin / avgLoss).toFixed(1)}. Historical data indicates this pattern — larger winners than losers — is associated with sustainable long-term performance even at sub-50% win rates.`,
      dataPoints: trades.length,
      createdAt: new Date().toISOString(),
    })
  }

  return insights
}

/** g) Playbook Performance */
function detectPlaybookPerformance(trades: TradeLike[]): CoachInsight[] {
  const tagged = trades.filter(t => t.playbookId)
  if (tagged.length < 5) return []

  const byPlaybook: Record<string, TradeLike[]> = {}
  for (const t of tagged) {
    const pb = t.playbookId!
    if (!byPlaybook[pb]) byPlaybook[pb] = []
    byPlaybook[pb].push(t)
  }

  const overallWr = winRate(tagged)
  const insights: CoachInsight[] = []

  for (const [pbId, pts] of Object.entries(byPlaybook)) {
    if (pts.length < 3) continue
    const wr = winRate(pts)
    const totalPnl = pts.reduce((s, t) => s + t.pnl, 0)
    const drop = overallWr - wr

    if (drop >= 0.2) {
      const dropPct = Math.round(drop * 100)
      insights.push({
        id: uid(),
        type: 'playbook',
        severity: 'warning',
        title: `Underperforming Playbook: "${pbId}"`,
        description: `Your data shows this playbook has a ${dropPct}% lower win rate than your other setups. Historical data indicates possible misalignment with current market conditions or execution variance.`,
        metric: `Win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% avg · Total P&L: $${totalPnl.toFixed(0)}`,
        recommendation: `📊 Data observation: Based on your logged trades, this playbook shows a ${dropPct}% lower win rate than your other setups. Historical data indicates reviewing entry criteria and market conditions for these trades may reveal contributing factors to the performance gap.`,
        dataPoints: pts.length,
        createdAt: new Date().toISOString(),
      })
    }

    if (wr >= overallWr + 0.15 && totalPnl > 0 && pts.length >= 4) {
      insights.push({
        id: uid(),
        type: 'playbook',
        severity: 'positive',
        title: `Highest-Performing Playbook: "${pbId}"`,
        description: `Your data shows this playbook outperforming your other setups with a higher win rate and positive P&L. This represents your strongest statistical edge.`,
        metric: `Win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% avg · Total P&L: $${totalPnl.toFixed(0)}`,
        recommendation: `📊 Data observation: Based on your logged trades, this playbook demonstrates your strongest statistical edge at ${Math.round(wr * 100)}% win rate. Historical data indicates prioritizing setups matching this profile correlates with better overall outcomes in your trading record.`,
        dataPoints: pts.length,
        createdAt: new Date().toISOString(),
      })
    }
  }

  return insights.slice(0, 3)
}

/** h) Emotion Correlation */
function detectEmotionCorrelation(trades: TradeLike[], rituals: RitualLike[]): CoachInsight[] {
  if (!rituals.length || trades.length < 5) return []

  // Group trades by date → daily P&L
  const tradePnlByDate: Record<string, number> = {}
  for (const t of trades) {
    tradePnlByDate[t.date] = (tradePnlByDate[t.date] ?? 0) + t.pnl
  }

  // Pair: ritual emotion score → next day P&L
  const sortedRituals = [...rituals].sort((a, b) => a.date.localeCompare(b.date))

  const lowEmotionNextDay: number[] = []
  const highEmotionNextDay: number[] = []

  for (let i = 0; i < sortedRituals.length - 1; i++) {
    const r = sortedRituals[i]
    if (!r.emotion) continue

    const nextDate = sortedRituals[i + 1]?.date ?? ''
    if (!nextDate) continue
    const nextPnl = tradePnlByDate[nextDate]
    if (nextPnl === undefined) continue

    if (r.emotion.score <= 2) lowEmotionNextDay.push(nextPnl)
    else if (r.emotion.score >= 4) highEmotionNextDay.push(nextPnl)
  }

  if (lowEmotionNextDay.length < 2 || highEmotionNextDay.length < 2) return []

  const avgLow = lowEmotionNextDay.reduce((s, n) => s + n, 0) / lowEmotionNextDay.length
  const avgHigh = highEmotionNextDay.reduce((s, n) => s + n, 0) / highEmotionNextDay.length

  if (avgLow < avgHigh - 50) {
    return [{
      id: uid(),
      type: 'emotion',
      severity: 'warning',
      title: 'Emotional State Correlates With Performance',
      description: 'Your data shows days following low emotional scores in your ritual tend to produce worse trading results. A statistical correlation between pre-trading emotional state and next-day performance is present in your historical data.',
      metric: `Avg P&L after low-emotion days: $${avgLow.toFixed(0)} vs after high-emotion days: $${avgHigh.toFixed(0)}`,
      recommendation: `📊 Data observation: Based on your logged trades, days following low-emotion ritual scores show an average P&L of $${avgLow.toFixed(0)} vs $${avgHigh.toFixed(0)} after high-emotion days. Historical data indicates a statistical correlation between pre-trading emotional state and next-day performance in your trading record.`,
      dataPoints: lowEmotionNextDay.length + highEmotionNextDay.length,
      createdAt: new Date().toISOString(),
    }]
  }

  return []
}

// ─── Weekly Summary Generator ─────────────────────────────────────────────────

function loadTradesFromStorage(): TradeLike[] {
  try {
    const raw = localStorage.getItem('cg_journal_trades')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadRitualsFromStorage(): RitualLike[] {
  try {
    const raw = localStorage.getItem('cg_ritual_entries')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Generate a WeeklySummary for the week containing `forDate` (defaults to now).
 * Set `showAllInsights = true` to show all insights (no 3-cap).
 */
export function generateWeeklySummary(
  forDate: Date = new Date(),
  showAllInsights = true,
): WeeklySummary {
  const allTrades = loadTradesFromStorage()
  const allRituals = loadRitualsFromStorage()

  const weekStart = getMondayOf(forDate)
  const weekEnd = getFridayOf(forDate)

  const trades = allTrades.filter(t => t.date >= weekStart && t.date <= weekEnd)

  // ── Stats ──
  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl < 0)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const wr = trades.length ? winners.length / trades.length : 0
  const avgWinner = winners.length ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0
  const avgLoser = losers.length ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0

  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0

  // Best/worst day
  const pnlByDay: Record<string, number> = {}
  for (const t of trades) {
    pnlByDay[t.date] = (pnlByDay[t.date] ?? 0) + t.pnl
  }
  const days = Object.entries(pnlByDay)
  const bestDay = days.length
    ? days.reduce((best, cur) => cur[1] > best[1] ? cur : best)
    : [weekStart, 0]
  const worstDay = days.length
    ? days.reduce((worst, cur) => cur[1] < worst[1] ? cur : worst)
    : [weekEnd, 0]

  // ── Pattern detection ──
  // Use all trades for pattern detection (better signal), not just this week
  const detectionTrades = allTrades.length >= 20 ? allTrades : trades
  const detectionRituals = allRituals

  const rawInsights: CoachInsight[] = [
    ...detectRevengeTrading(detectionTrades),
    ...detectOvertrading(detectionTrades),
    ...detectTimeOfDay(detectionTrades),
    ...detectTickerConcentration(detectionTrades),
    ...detectStreaks(detectionTrades),
    ...detectRiskManagement(detectionTrades),
    ...detectPlaybookPerformance(detectionTrades),
    ...detectEmotionCorrelation(detectionTrades, detectionRituals),
  ]

  // Sort: critical → warning → neutral → positive
  const severityOrder = { critical: 0, warning: 1, neutral: 2, positive: 3 }
  rawInsights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const insights = showAllInsights ? rawInsights : rawInsights.slice(0, 3)

  const summary: WeeklySummary = {
    id: uid(),
    weekStart,
    weekEnd,
    totalTrades: trades.length,
    winRate: wr,
    totalPnl,
    avgWinner,
    avgLoser,
    profitFactor,
    bestDay: { date: bestDay[0] as string, pnl: bestDay[1] as number },
    worstDay: { date: worstDay[0] as string, pnl: worstDay[1] as number },
    insights,
    generatedAt: new Date().toISOString(),
  }

  upsertCoachSummary(summary)
  return summary
}
