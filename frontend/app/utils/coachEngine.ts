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
    title: 'Revenge Trading Detected',
    description: `You took ${revengeTrades.length} trades within 15 minutes of a loss with equal or larger position size. These trades perform significantly worse than your average.`,
    metric: `Win rate drops ${pctDrop}% on revenge trades (${Math.round(revengeWr * 100)}% vs ${Math.round(overallWr * 100)}% overall)`,
    recommendation: 'After a losing trade, step away for at least 15–30 minutes before re-entering the market. Set a hard rule: no new trade until a timer expires.',
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

  return [{
    id: uid(),
    type: 'pattern',
    severity: 'warning',
    title: 'Overtrading Pattern',
    description: `On ${overtradeDays} trading days with 5+ trades, your performance declined significantly on trades 4 and beyond compared to your first 3 trades of the day.`,
    metric: `Avg P&L per trade: First 3 = $${(early3Pnl / overtradeDays).toFixed(0)}, Trades 4+ = $${(later4Pnl / overtradeDays).toFixed(0)}`,
    recommendation: 'Consider setting a daily trade limit of 3–4. Once you hit your profit target or trade limit, close the platform. Your edge diminishes as the day goes on.',
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
      insights.push({
        id: uid(),
        type: 'time_analysis',
        severity: drop >= 0.25 ? 'critical' : 'warning',
        title: `Weak ${period} Performance`,
        description: `Your win rate during ${period} is significantly below your average. Consider avoiding or reducing position sizes during this time window.`,
        metric: `Win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% average · Avg P&L: $${avgPeriodPnl.toFixed(0)}`,
        recommendation: `Review the ${period} trades that lost money. Are there common patterns — news events, low liquidity, fatigue? Consider a rule to skip this window.`,
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
      insights.push({
        id: uid(),
        type: 'ticker_analysis',
        severity: totalPnl < -200 ? 'critical' : 'warning',
        title: `${sym} Is Hurting Your P&L`,
        description: `Your win rate on ${sym} is significantly below average, and you've lost money on it overall. This ticker may not fit your current strategy.`,
        metric: `${sym}: ${Math.round(wr * 100)}% win rate (${pts.filter(t => t.pnl > 0).length}W/${pts.filter(t => t.pnl <= 0).length}L) · Total P&L: $${totalPnl.toFixed(0)}`,
        recommendation: `Consider taking ${sym} off your watchlist until you understand why it's not working for you. Wait for a clear setup that matches your best patterns.`,
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
      insights.push({
        id: uid(),
        type: 'streak',
        severity: 'warning',
        title: 'Win Streak Overconfidence',
        description: `After 3 consecutive wins, your very next trade has a lower-than-average win rate. Hot streaks may be leading to overconfidence and less selective entries.`,
        metric: `Post win-streak win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% overall`,
        recommendation: 'After 3 wins in a row, be extra selective. Review your criteria before taking the next trade — don\'t "ride the wave" into a bad setup.',
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
      insights.push({
        id: uid(),
        type: 'streak',
        severity: 'critical',
        title: 'Chasing Losses After Drawdown',
        description: `After 3 consecutive losing trades, your recovery trades tend to perform worse than average. You may be taking lower-quality setups to win back losses.`,
        metric: `Post loss-streak win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% overall`,
        recommendation: 'After 3 consecutive losses, stop trading for the day. Come back tomorrow with a fresh mindset. Chasing losses compounds the damage.',
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
      title: `Impressive ${maxWinStreak}-Trade Win Streak`,
      description: `You achieved a ${maxWinStreak}-trade winning streak this period. That's evidence of strong execution when you're in the zone.`,
      metric: `Best streak: ${maxWinStreak} consecutive wins`,
      recommendation: 'Study the conditions around this streak — what was your mindset, what setups did you take? Try to replicate those conditions.',
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
      title: 'Losers Are Too Big',
      description: `Your average losing trade is ${ratio.toFixed(1)}x larger than your average winner. This means you need an unusually high win rate just to break even.`,
      metric: `Avg winner: $${avgWin.toFixed(0)} · Avg loser: -$${avgLoss.toFixed(0)} · Ratio: ${ratio.toFixed(2)}`,
      recommendation: 'Focus on cutting losses faster. Set hard stop-losses before entering trades. Your target should be: avg loser ≤ avg winner.',
      dataPoints: trades.length,
      createdAt: new Date().toISOString(),
    })
  } else if (ratio < 0.7) {
    insights.push({
      id: uid(),
      type: 'risk',
      severity: 'positive',
      title: 'Strong Risk/Reward Ratio',
      description: `Your winners are significantly larger than your losers, which is excellent risk management. Even a sub-50% win rate can be profitable with this profile.`,
      metric: `Avg winner: $${avgWin.toFixed(0)} · Avg loser: -$${avgLoss.toFixed(0)} · Ratio: 1:${(avgWin / avgLoss).toFixed(1)}`,
      recommendation: 'Maintain this discipline. Don\'t feel pressured to increase win rate — your edge is in letting winners run and cutting losers short.',
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
      insights.push({
        id: uid(),
        type: 'playbook',
        severity: 'warning',
        title: `Underperforming Playbook: "${pbId}"`,
        description: `This playbook has a notably lower win rate than your other setups. Either the setup is currently out of market regime, or execution needs improvement.`,
        metric: `Win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% avg · Total P&L: $${totalPnl.toFixed(0)}`,
        recommendation: 'Pause this playbook and do a deep review. Are you entering at the right time? Is the market environment suitable? Consider paper-trading it before going live again.',
        dataPoints: pts.length,
        createdAt: new Date().toISOString(),
      })
    }

    if (wr >= overallWr + 0.15 && totalPnl > 0 && pts.length >= 4) {
      insights.push({
        id: uid(),
        type: 'playbook',
        severity: 'positive',
        title: `Best Playbook: "${pbId}"`,
        description: `This playbook is outperforming your other setups with a higher win rate and positive P&L. This is your edge.`,
        metric: `Win rate: ${Math.round(wr * 100)}% vs ${Math.round(overallWr * 100)}% avg · Total P&L: $${totalPnl.toFixed(0)}`,
        recommendation: 'Double down on this playbook. Focus your trading sessions on finding more of these setups and avoiding lower-quality alternatives.',
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
      title: 'Emotional State Predicts Performance',
      description: 'Days following low emotional scores in your ritual tend to produce worse trading results. Your mindset the night before affects your performance the next day.',
      metric: `Avg P&L after low-emotion days: $${avgLow.toFixed(0)} vs after high-emotion days: $${avgHigh.toFixed(0)}`,
      recommendation: 'On low-emotion days, consider trading smaller size or taking fewer trades. Use your ritual to flag when you\'re not in the right headspace.',
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
 * Set `betaMode = true` to show all insights (no 3-cap).
 */
export function generateWeeklySummary(
  forDate: Date = new Date(),
  betaMode = true,
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

  const insights = betaMode ? rawInsights : rawInsights.slice(0, 3)

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
