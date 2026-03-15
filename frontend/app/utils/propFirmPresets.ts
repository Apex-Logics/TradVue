/**
 * PropFirmPresets — Rule presets for major prop trading firms
 * Firms: FTMO, TopStep, Apex Trader Funding, My Funded Futures, The 5%ers,
 *        Take Profit Trader, Earn2Trade, Bulenox, TradeDay, Leeloo Trading
 *
 * ⚠️ Rule presets are approximate and may change. Always verify with your prop firm.
 */

import type { FirmId, PhaseId, PropFirmRules } from './propFirmData'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FirmPreset {
  id: FirmId
  displayName: string
  shortName: string
  color: string
  accountSizes: number[]
  phases: PhaseId[]
  getRules: (accountSize: number, phase: PhaseId) => PropFirmRules
}

// ─── FTMO ─────────────────────────────────────────────────────────────────────

const ftmoPreset: FirmPreset = {
  id: 'ftmo',
  displayName: 'FTMO',
  shortName: 'FTMO',
  color: '#1a6dff',
  accountSizes: [10000, 25000, 50000, 100000, 200000],
  phases: ['phase1', 'phase2', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    const drawdownLimit = accountSize * 0.10  // 10% max drawdown (trailing from peak)
    const dailyLimit    = accountSize * 0.05  // 5% daily loss limit

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: drawdownLimit, current: 0 },
        dailyLossLimit: { limit: dailyLimit, todayPnl: 0 },
        profitTarget: { target: accountSize * 0.10, currentPnl: 0 }, // 10% target
        minTradingDays: 4,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    if (phase === 'phase2') {
      return {
        maxDrawdown: { type: 'trailing', limit: drawdownLimit, current: 0 },
        dailyLossLimit: { limit: dailyLimit, todayPnl: 0 },
        profitTarget: { target: accountSize * 0.05, currentPnl: 0 }, // 5% target
        minTradingDays: 4,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    // Funded
    return {
      maxDrawdown: { type: 'trailing', limit: drawdownLimit, current: 0 },
      dailyLossLimit: { limit: dailyLimit, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 }, // No target for funded
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── TopStep ──────────────────────────────────────────────────────────────────

const topstepPreset: FirmPreset = {
  id: 'topstep',
  displayName: 'TopStep',
  shortName: 'TopStep',
  color: '#00b4d8',
  accountSizes: [50000, 100000, 150000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // TopStep 150K: $9K profit, $4.5K trailing drawdown, $3K daily loss
    const ratios: Record<number, { profit: number; drawdown: number; daily: number }> = {
      50000:  { profit: 3000,  drawdown: 2000,  daily: 1000 },
      100000: { profit: 6000,  drawdown: 3000,  daily: 2000 },
      150000: { profit: 9000,  drawdown: 4500,  daily: 3000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.03, daily: accountSize * 0.02 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
        dailyLossLimit: { limit: r.daily, todayPnl: 0 },
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 5,
        tradingDaysCompleted: 0,
        newsTrading: false, // TopStep restricts news trading
      }
    }
    // Funded
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: r.daily, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: false,
    }
  },
}

// ─── Apex Trader Funding ──────────────────────────────────────────────────────

const apexPreset: FirmPreset = {
  id: 'apex',
  displayName: 'Apex Trader Funding',
  shortName: 'Apex',
  color: '#7c3aed',
  accountSizes: [25000, 50000, 75000, 100000, 150000, 250000, 300000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // Apex 150K: $9K profit target, $5.25K trailing drawdown, no daily loss limit, min 7 days
    const ratios: Record<number, { profit: number; drawdown: number }> = {
      25000:  { profit: 1500,  drawdown: 1500  },
      50000:  { profit: 3000,  drawdown: 2500  },
      75000:  { profit: 4250,  drawdown: 2750  },
      100000: { profit: 6000,  drawdown: 3500  },
      150000: { profit: 9000,  drawdown: 5250  },
      250000: { profit: 15000, drawdown: 8750  },
      300000: { profit: 20000, drawdown: 10500 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.035 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // No daily loss limit
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 7,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    // Funded
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── My Funded Futures (MFF) ──────────────────────────────────────────────────

const mffPreset: FirmPreset = {
  id: 'mff',
  displayName: 'My Funded Futures',
  shortName: 'MFF',
  color: '#059669',
  accountSizes: [50000, 100000, 150000, 250000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // MFF 150K: $9K profit, $5K static drawdown, $3K daily loss, min 5 days
    const ratios: Record<number, { profit: number; drawdown: number; daily: number }> = {
      50000:  { profit: 3000,  drawdown: 2000, daily: 1000 },
      100000: { profit: 6000,  drawdown: 3500, daily: 2000 },
      150000: { profit: 9000,  drawdown: 5000, daily: 3000 },
      250000: { profit: 15000, drawdown: 7500, daily: 5000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.033, daily: accountSize * 0.02 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'static', limit: r.drawdown, current: 0 },
        dailyLossLimit: { limit: r.daily, todayPnl: 0 },
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 5,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    // Funded
    return {
      maxDrawdown: { type: 'static', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: r.daily, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── The 5%ers ────────────────────────────────────────────────────────────────

const fivePctersPreset: FirmPreset = {
  id: '5ers',
  displayName: 'The 5%ers',
  shortName: '5%ers',
  color: '#d97706',
  accountSizes: [6000, 24000, 60000, 100000],
  phases: ['phase1', 'phase2', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // 5%ers Hyper Growth $100K: 10% profit ($10K), 6% drawdown ($6K), no daily loss limit
    const profitPct   = 0.10
    const drawdownPct = 0.06

    if (phase === 'phase1' || phase === 'phase2') {
      return {
        maxDrawdown: { type: 'static', limit: accountSize * drawdownPct, current: 0 },
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // No daily loss limit
        profitTarget: { target: accountSize * profitPct, currentPnl: 0 },
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    // Funded
    return {
      maxDrawdown: { type: 'static', limit: accountSize * drawdownPct, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── Take Profit Trader ───────────────────────────────────────────────────────

const tptPreset: FirmPreset = {
  id: 'tpt',
  displayName: 'Take Profit Trader',
  shortName: 'TPT',
  color: '#10b981',
  accountSizes: [50000, 100000, 150000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    const ratios: Record<number, { profit: number; drawdown: number; daily: number }> = {
      50000:  { profit: 3000, drawdown: 2000, daily: 1000 },
      100000: { profit: 6000, drawdown: 3000, daily: 2000 },
      150000: { profit: 9000, drawdown: 4500, daily: 3000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.03, daily: accountSize * 0.02 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
        dailyLossLimit: { limit: r.daily, todayPnl: 0 },
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 5,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: r.daily, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── Earn2Trade ───────────────────────────────────────────────────────────────

const earn2TradePreset: FirmPreset = {
  id: 'earn2trade',
  displayName: 'Earn2Trade',
  shortName: 'E2T',
  color: '#f59e0b',
  accountSizes: [50000, 100000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    const ratios: Record<number, { profit: number; drawdown: number; daily: number }> = {
      50000:  { profit: 3000, drawdown: 2000, daily: 1000 },
      100000: { profit: 6000, drawdown: 3500, daily: 2000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.035, daily: accountSize * 0.02 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
        dailyLossLimit: { limit: r.daily, todayPnl: 0 },
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 10,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: r.daily, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── Bulenox ──────────────────────────────────────────────────────────────────

const bulenoxPreset: FirmPreset = {
  id: 'bulenox',
  displayName: 'Bulenox',
  shortName: 'Bulenox',
  color: '#ef4444',
  accountSizes: [50000, 150000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    const ratios: Record<number, { profit: number; drawdown: number }> = {
      50000:  { profit: 3000, drawdown: 2500 },
      150000: { profit: 9000, drawdown: 5000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.033 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'static', limit: r.drawdown, current: 0 }, // EOD drawdown ≈ static
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // No daily loss limit
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 5,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    return {
      maxDrawdown: { type: 'static', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── TradeDay ─────────────────────────────────────────────────────────────────

const tradeDayPreset: FirmPreset = {
  id: 'tradeday',
  displayName: 'TradeDay',
  shortName: 'TradeDay',
  color: '#8b5cf6',
  accountSizes: [100000, 150000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    const ratios: Record<number, { profit: number; drawdown: number; daily: number }> = {
      100000: { profit: 6000, drawdown: 3000, daily: 2000 },
      150000: { profit: 9000, drawdown: 4500, daily: 3000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.03, daily: accountSize * 0.02 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
        dailyLossLimit: { limit: r.daily, todayPnl: 0 },
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 7,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: r.daily, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── Leeloo Trading ───────────────────────────────────────────────────────────

const leelooPreset: FirmPreset = {
  id: 'leeloo',
  displayName: 'Leeloo Trading',
  shortName: 'Leeloo',
  color: '#06b6d4',
  accountSizes: [100000, 150000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    const ratios: Record<number, { profit: number; drawdown: number; daily: number }> = {
      100000: { profit: 6000, drawdown: 3000, daily: 2000 },
      150000: { profit: 9000, drawdown: 4500, daily: 3000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.03, daily: accountSize * 0.02 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
        dailyLossLimit: { limit: r.daily, todayPnl: 0 },
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 10,
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: r.daily, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── Custom ───────────────────────────────────────────────────────────────────

const customPreset: FirmPreset = {
  id: 'custom',
  displayName: 'Custom Firm',
  shortName: 'Custom',
  color: '#6366f1',
  accountSizes: [10000, 25000, 50000, 100000, 200000],
  phases: ['phase1', 'phase2', 'funded', 'payout'],
  getRules: (accountSize: number, _phase: PhaseId): PropFirmRules => ({
    maxDrawdown: { type: 'static', limit: accountSize * 0.10, current: 0 },
    dailyLossLimit: { limit: accountSize * 0.05, todayPnl: 0 },
    profitTarget: { target: accountSize * 0.10, currentPnl: 0 },
    tradingDaysCompleted: 0,
    newsTrading: true,
  }),
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const FIRM_PRESETS: Record<FirmId, FirmPreset> = {
  ftmo:       ftmoPreset,
  topstep:    topstepPreset,
  apex:       apexPreset,
  mff:        mffPreset,
  '5ers':     fivePctersPreset,
  tpt:        tptPreset,
  earn2trade: earn2TradePreset,
  bulenox:    bulenoxPreset,
  tradeday:   tradeDayPreset,
  leeloo:     leelooPreset,
  custom:     customPreset,
}

export const FIRM_LIST: FirmPreset[] = [
  ftmoPreset,
  topstepPreset,
  apexPreset,
  mffPreset,
  fivePctersPreset,
  tptPreset,
  earn2TradePreset,
  bulenoxPreset,
  tradeDayPreset,
  leelooPreset,
  customPreset,
]

/** Get a preset by firm ID */
export function getFirmPreset(firmId: FirmId): FirmPreset | null {
  return FIRM_PRESETS[firmId] ?? null
}

/** Get default rules for a given firm, size, and phase */
export function getPresetRules(firmId: FirmId, accountSize: number, phase: PhaseId): PropFirmRules {
  const preset = FIRM_PRESETS[firmId]
  if (!preset) return customPreset.getRules(accountSize, phase)
  return preset.getRules(accountSize, phase)
}

/** Format account size as "$100K" etc. */
export function formatAccountSize(size: number): string {
  if (size >= 1_000_000) return `$${(size / 1_000_000).toFixed(1)}M`
  if (size >= 1000) return `$${(size / 1000).toFixed(0)}K`
  return `$${size.toLocaleString()}`
}
