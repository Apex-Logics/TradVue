/**
 * PropFirmPresets — Verified rule presets for prop trading firms
 *
 * All numbers sourced from official firm websites. Only firms with fully
 * verified, specific dollar amounts are included. Firms with UNVERIFIED
 * amounts are excluded — use "Custom Firm" to enter your own verified rules.
 *
 * Included firms (verified March 15, 2026):
 *   TopStep, The 5%ers, My Funded Futures, Earn2Trade,
 *   Leeloo Trading, FundedNext Futures (Rapid), Lucid Trading (LucidFlex),
 *   Tradeify + Custom (9 total)
 *
 * Removed (unverified or forex-only):
 *   FTMO              — forex only, NOT a futures prop firm
 *   Apex Trader Funding — Cloudflare blocking; amounts unverifiable
 *   Alpha Futures     — minimal website; official amounts not accessible
 *   Alpha Funded      — vague/hidden terms; amounts UNVERIFIED
 *   Take Profit Trader — profit target & drawdown amounts UNVERIFIED
 *   Bulenox           — profit target & DLL amounts UNVERIFIED
 *   TradeDay          — profit target & DLL amounts UNVERIFIED
 *   LucidPro          — specific amounts not yet verified (TODO)
 *   LucidDirect       — specific amounts not yet verified (TODO)
 *
 * Verification report: /docs/research/prop-firm-rules-verification.md
 * Last updated: March 15, 2026
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

// ─── TopStep ──────────────────────────────────────────────────────────────────
// Source: topstep.com | Verified March 2026
// Trailing EOD drawdown (floor rises as equity grows — harder than static drawdown)
// No minimum trading days required
// News trading: Allowed
// Futures ONLY (CME, CBOT, NYMEX, COMEX)
// Max payout per request: $6,000 or 50% of account balance (whichever is lower)
// Monthly subscription model (~$375/month for $150K Combine)

const topstepPreset: FirmPreset = {
  id: 'topstep',
  displayName: 'TopStep',
  shortName: 'TopStep',
  color: '#00b4d8',
  accountSizes: [50000, 100000, 150000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // Profit target ~6%, trailing EOD drawdown, daily loss limit varies by plan
    const ratios: Record<number, { profit: number; drawdown: number; daily: number }> = {
      50000:  { profit: 3000, drawdown: 2000, daily: 1000 },
      100000: { profit: 6000, drawdown: 3000, daily: 2000 },
      150000: { profit: 9000, drawdown: 4500, daily: 3000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.03, daily: accountSize * 0.02 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 }, // EOD trailing
        dailyLossLimit: { limit: r.daily, todayPnl: 0 },
        profitTarget: { target: r.profit, currentPnl: 0 },
        // No minimum trading days required
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    // Funded
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: r.daily, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── The 5%ers Futures ────────────────────────────────────────────────────────
// Source: the5ers.com/futures | Verified March 2026
// Dedicated FUTURES program (not the standard forex 5%ers)
// Static drawdown from initial balance (NOT trailing)
// Consistency rule: 30% (best single day ≤ 30% of total profits)
// Max contracts: 2 mini / 20 micro (eval & funded)
// Scaling: 10% profit triggers scale; scales to $500K+ max allocation
// Fees: $50 eval + $70 activation on pass (fees refundable on first payout)

const fivePctersPreset: FirmPreset = {
  id: '5ers',
  displayName: 'The 5%ers',
  shortName: '5%ers',
  color: '#d97706',
  accountSizes: [25000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // Eval: 6% profit target, 3% static max loss from initial balance, no DLL
    // Funded stage: 4% profit target, 3% static max loss continues
    const drawdown = accountSize * 0.03 // 3% static from initial balance (verified)

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'static', limit: drawdown, current: 0 }, // Static (not trailing)
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // No separate daily loss limit
        profitTarget: { target: accountSize * 0.06, currentPnl: 0 }, // 6% eval target
        // No minimum trading days explicitly stated
        tradingDaysCompleted: 0,
        maxContracts: 2, // 2 mini / 20 micro (verified)
        newsTrading: true,
      }
    }
    // Funded stage: 4% profit target, same 3% static max loss
    return {
      maxDrawdown: { type: 'static', limit: drawdown, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 },
      profitTarget: { target: accountSize * 0.04, currentPnl: 0 }, // 4% funded target (verified)
      tradingDaysCompleted: 0,
      maxContracts: 2,
      newsTrading: true,
    }
  },
}

// ─── My Funded Futures (MFF) — Rapid Plan ────────────────────────────────────
// Source: myfundedfutures.com | Verified March 2026
// "Rapid Plan" is the current standard model (streamlined 2025-2026)
// EOD trailing drawdown — NO daily loss limit (major perk vs competitors)
// Consistency rule: 50% (eval only)
// Max contracts: 5 mini / 50 micro
// First withdrawal requires $2,100+ in realized profits built up
// NOTE: Only $50K Rapid plan has verified specific amounts (March 2026)
//       Other sizes ($100K/$150K/$25K Flex) available but amounts unverified

const mffPreset: FirmPreset = {
  id: 'mff',
  displayName: 'My Funded Futures',
  shortName: 'MFF',
  color: '#059669',
  accountSizes: [50000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // $50K Rapid: $3,000 profit, $2,000 EOD trailing drawdown, NO daily loss limit, min 2 days
    const ratios: Record<number, { profit: number; drawdown: number }> = {
      50000: { profit: 3000, drawdown: 2000 },
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.04 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 }, // EOD trailing
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // NO daily loss limit — key MFF feature
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 2, // Reduced from legacy 5+ days (verified)
        tradingDaysCompleted: 0,
        maxContracts: 5, // 5 mini / 50 micro (verified)
        newsTrading: true,
      }
    }
    // Funded (Sim Funded): no DLL, EOD drawdown only; max loss lock trails to $100 above start
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 }, // No DLL on funded either (verified)
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      maxContracts: 5,
      newsTrading: true,
    }
  },
}

// ─── Earn2Trade — Gauntlet Mini ───────────────────────────────────────────────
// Source: earn2trade.com | Verified March 2026
// Gauntlet Mini: fast path to funding (10-day minimum)
// EOD trailing drawdown (measured at end of each trading day)
// Subscription-based monthly rebilling until pass or cancel
// Activation fee: $139 on pass (deducted from first withdrawal)
// Covers all 4 CME exchanges. Contract ladder applies by account balance.

const earn2TradePreset: FirmPreset = {
  id: 'earn2trade',
  displayName: 'Earn2Trade',
  shortName: 'E2T',
  color: '#f59e0b',
  accountSizes: [50000, 100000, 150000, 200000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // All dollar amounts verified from earn2trade.com Gauntlet Mini page (March 2026)
    const ratios: Record<number, { profit: number; drawdown: number; daily: number }> = {
      50000:  { profit: 3000,  drawdown: 2000, daily: 1100 }, // $50K: $3K profit, $2K EOD, $1.1K daily
      100000: { profit: 6000,  drawdown: 3500, daily: 2200 }, // $100K: $6K, $3.5K EOD, $2.2K daily
      150000: { profit: 9000,  drawdown: 4500, daily: 3300 }, // $150K: $9K, $4.5K EOD, $3.3K daily
      200000: { profit: 11000, drawdown: 6000, daily: 4400 }, // $200K: $11K, $6K EOD, $4.4K daily
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.055, drawdown: accountSize * 0.03, daily: accountSize * 0.022 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 }, // EOD trailing
        dailyLossLimit: { limit: r.daily, todayPnl: 0 },
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 10, // 10-day minimum (verified — "Gauntlet Mini" emphasis)
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    // Funded
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: r.daily, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── Leeloo Trading — Foundation Accounts ─────────────────────────────────────
// Source: leelootrading.com | Verified March 2026
// Three Foundation accounts: LB Bundle Aspire ($25K), Kickstart ($75K), Leeloo Express ($100K)
// Trailing drawdown (continues from evaluation into funded Performance Account)
// NO separate daily loss limit (EOD trailing drawdown only)
// Consistency rule: 30% (daily profits ≤ 30% of net profit from initial balance)
// Min trading days: 10 U.S. market hours trading days for evaluation
// Supports 12+ platforms (NinjaTrader, Rithmic Pro, EdgeProX, etc.)

const leelooPreset: FirmPreset = {
  id: 'leeloo',
  displayName: 'Leeloo Trading',
  shortName: 'Leeloo',
  color: '#06b6d4',
  accountSizes: [25000, 75000, 100000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // All amounts verified from leelootrading.com Foundation account pages (March 2026)
    // $25K = LB Bundle Aspire | $75K = Kickstart | $100K = Leeloo Express
    const ratios: Record<number, { profit: number; drawdown: number; maxMini: number }> = {
      25000:  { profit: 1500, drawdown: 1500, maxMini: 3  },  // LB Bundle Aspire (verified)
      75000:  { profit: 4500, drawdown: 2750, maxMini: 10 },  // Kickstart (verified)
      100000: { profit: 6000, drawdown: 3000, maxMini: 12 },  // Leeloo Express (verified)
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.03, maxMini: 5 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 }, // Trailing from peak
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // No separate daily loss limit
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 10, // 10 U.S. market hours trading days (verified)
        tradingDaysCompleted: 0,
        maxContracts: r.maxMini, // mini contracts (verified per size)
        newsTrading: true,
      }
    }
    // Funded (Performance Account): trailing drawdown continues, 30% consistency rule
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      maxContracts: r.maxMini,
      newsTrading: true,
    }
  },
}

// ─── FundedNext Futures — Rapid Challenge ────────────────────────────────────
// Source: fundednext.com/futures + helpfutures.fundednext.com | Verified March 2026
// Rapid path: EOD trailing drawdown, no DLL, unlimited time, 40% consistency rule
// Funded: 80% profit split (up to 90%), first payout after 14 days, fees refundable
// Max funded capital: $300K per account
// Also offers Legacy and Bolt challenges — see fundednext.com/futures for details

const fundednextPreset: FirmPreset = {
  id: 'fundednext',
  displayName: 'FundedNext Futures',
  shortName: 'FundedNext',
  color: '#6d28d9',
  accountSizes: [25000, 50000, 100000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // All amounts verified from helpfutures.fundednext.com Rapid Challenge (March 2026)
    const ratios: Record<number, { profit: number; drawdown: number }> = {
      25000:  { profit: 1500, drawdown: 1000 }, // $25K: $1,500 profit, $1,000 EOD trailing
      50000:  { profit: 3000, drawdown: 2000 }, // $50K: $3,000 profit, $2,000 EOD trailing
      100000: { profit: 5000, drawdown: 2500 }, // $100K: $5,000 profit, $2,500 EOD trailing
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.05, drawdown: accountSize * 0.025 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 }, // EOD trailing
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // No daily loss limit on Rapid (verified)
        profitTarget: { target: r.profit, currentPnl: 0 },
        // No minimum trading days on Rapid challenge (verified: unlimited time)
        tradingDaysCompleted: 0,
        newsTrading: true, // News trading allowed (verified)
      }
    }
    // Funded: no DLL, no consistency rule in funded phase, 80-90% profit split
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 },
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── Lucid Trading — LucidFlex ────────────────────────────────────────────────
// Source: lucidtrading.com | Verified March 2026 (program launched Nov 2025)
// KEY FEATURE: NO daily loss limit — during evaluation OR funded (major differentiator)
// EOD trailing drawdown only; no time pressure on evaluation
// Consistency rule: 50% (eval only; completely relaxed once funded)
// Funded: 100% profit on first $10K payouts, then 90/10 split; no payout buffer
// Claimed 2-minute payout processing
// Also offers LucidPro (has DLL) and LucidDirect (instant funding) — see lucidtrading.com

const lucidFlexPreset: FirmPreset = {
  id: 'lucidflex',
  displayName: 'Lucid Trading (LucidFlex)',
  shortName: 'LucidFlex',
  color: '#14b8a6',
  accountSizes: [25000, 50000, 100000, 150000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // All amounts verified from lucidtrading.com support docs (March 2026)
    const ratios: Record<number, { profit: number; drawdown: number }> = {
      25000:  { profit: 1250, drawdown: 1000 }, // $25K: $1,250 (5%), $1,000 EOD
      50000:  { profit: 3000, drawdown: 2000 }, // $50K: $3,000 (6%), $2,000 EOD
      100000: { profit: 6000, drawdown: 3000 }, // $100K: $6,000 (6%), $3,000 EOD
      150000: { profit: 9000, drawdown: 4500 }, // $150K: $9,000 (6%), $4,500 EOD
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.03 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 }, // EOD trailing
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // NO daily loss limit — key LucidFlex feature (verified)
        profitTarget: { target: r.profit, currentPnl: 0 },
        // No time limit on evaluation (verified)
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    // Funded: no DLL, no consistency rule, max loss lock trails to starting balance + $100
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 }, // No DLL on funded either (verified)
      profitTarget: { target: 0, currentPnl: 0 },
      tradingDaysCompleted: 0,
      newsTrading: true,
    }
  },
}

// ─── Tradeify — Standard Evaluation ──────────────────────────────────────────
// Source: tradeify.co | Verified March 2026
// $150M+ verified payouts, 80,000+ active traders
// EOD trailing drawdown, no daily loss limit during evaluation
// No consistency rule during evaluation
// Min 4 trading days to pass evaluation (1-hour payout guarantee on funded)
// NOTE: Only $150K Standard Evaluation verified with specific amounts (March 2026)
//       Other sizes may be available — verify at tradeify.co before using
// Also offers Lightning Funded (instant, no eval) — see tradeify.co

const tradeifyPreset: FirmPreset = {
  id: 'tradeify',
  displayName: 'Tradeify',
  shortName: 'Tradeify',
  color: '#f97316',
  accountSizes: [150000],
  phases: ['phase1', 'funded'],
  getRules: (accountSize: number, phase: PhaseId): PropFirmRules => {
    // $150K Standard Evaluation verified from tradeify.co (March 2026)
    const ratios: Record<number, { profit: number; drawdown: number }> = {
      150000: { profit: 9000, drawdown: 4500 }, // $150K: $9,000 (6%), $4,500 EOD trailing
    }
    const r = ratios[accountSize] ?? { profit: accountSize * 0.06, drawdown: accountSize * 0.03 }

    if (phase === 'phase1') {
      return {
        maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 }, // EOD trailing
        dailyLossLimit: { limit: 0, todayPnl: 0 }, // No DLL during evaluation (verified)
        profitTarget: { target: r.profit, currentPnl: 0 },
        minTradingDays: 4, // Must complete 4 trading days minimum (verified)
        tradingDaysCompleted: 0,
        newsTrading: true,
      }
    }
    // Funded (Daily Payout or Flex Payout paths — see tradeify.co for path-specific rules)
    return {
      maxDrawdown: { type: 'trailing', limit: r.drawdown, current: 0 },
      dailyLossLimit: { limit: 0, todayPnl: 0 },
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
  topstep:    topstepPreset,
  '5ers':     fivePctersPreset,
  mff:        mffPreset,
  earn2trade: earn2TradePreset,
  leeloo:     leelooPreset,
  fundednext: fundednextPreset,
  lucidflex:  lucidFlexPreset,
  tradeify:   tradeifyPreset,
  custom:     customPreset,
}

export const FIRM_LIST: FirmPreset[] = [
  topstepPreset,
  fivePctersPreset,
  mffPreset,
  earn2TradePreset,
  leelooPreset,
  fundednextPreset,
  lucidFlexPreset,
  tradeifyPreset,
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
