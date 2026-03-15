import type { Playbook } from './playbookData'

const now = new Date().toISOString()

export const DEFAULT_PLAYBOOKS: Playbook[] = [
  {
    id: 'default-orb',
    name: 'Opening Range Breakout (ORB)',
    description:
      'The Opening Range Breakout is one of the most time-tested setups in day trading. ' +
      'During the first 5, 15, or 30 minutes of the trading session, the market establishes a ' +
      '"opening range" — the high and low of that initial period. When price breaks above or below ' +
      'this range with conviction (volume confirmation), it often signals a directional move for the day. ' +
      'This strategy works best on trending days with high relative volume and a clear pre-market catalyst. ' +
      'The key is patience: wait for the range to form, then trade the break — never anticipate it.',
    category: 'breakout',
    assetTypes: ['stock', 'futures'],
    entryRules: [
      'Identify the opening range (first 5, 15, or 30 min high/low)',
      'Wait for price to break above (long) or below (short) the range on a candle close',
      'Confirm with volume: relative volume > 1.5x average',
      'Check market context — overall market should align with trade direction',
      'Enter on the first candle close outside the range, not the wick',
    ],
    exitRules: [
      'Primary target: 1:1 of the range size projected from the breakout point',
      'Stretch target: 2:1 of range size on strong trending days',
      'Stop loss: opposite side of the opening range',
      'Time stop: if price stalls for 10+ minutes after breakout, exit',
    ],
    idealConditions:
      'High gap stocks with pre-market catalyst (news, earnings), first 30 minutes of market open, trending day (SPY/QQQ directional), relative volume > 1.5x before open.',
    riskParams: {
      riskRewardTarget: '1:1 minimum, target 2:1',
    },
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'default-vwap-bounce',
    name: 'VWAP Bounce',
    description:
      'VWAP (Volume Weighted Average Price) is the most important intraday level in day trading. ' +
      'It represents the average price paid by all participants throughout the day, weighted by volume. ' +
      'Institutional algorithms and smart money frequently use VWAP as a benchmark — they buy when price ' +
      'is below VWAP and sell when above. This creates natural support and resistance at VWAP throughout ' +
      'the session. The VWAP Bounce strategy capitalizes on these predictable reactions: enter when price ' +
      'touches VWAP and shows signs of reversal with volume confirmation.',
    category: 'reversal',
    assetTypes: ['stock', 'futures'],
    entryRules: [
      'Price approaches VWAP from above (short setup) or below (long setup)',
      'Wait for a "test" — price touches VWAP and first candle shows reversal (hammer, doji, engulfing)',
      'Confirm with RSI: oversold (<40) for longs, overbought (>60) for shorts at VWAP touch',
      'Volume should increase on the reversal candle vs prior candles',
      'Enter on the candle close after the reversal candle confirms',
    ],
    exitRules: [
      'Target: prior session high (for longs) or prior session low (for shorts)',
      'If no clear prior level, target 1:1 from VWAP to entry distance',
      'Stop loss: 1-2 candles below VWAP (for longs) — if VWAP breaks and holds, thesis is wrong',
      'Trail stop using 2-min moving average once in profit',
    ],
    idealConditions:
      'Range-bound days (SPY flat or oscillating), stocks with clear VWAP respect history, mid-morning (10:00-11:30 AM) or afternoon (1:00-3:00 PM) session — avoid around major news events.',
    riskParams: {
      riskRewardTarget: '2:1',
    },
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'default-gap-and-go',
    name: 'Gap and Go',
    description:
      'Gap and Go is a momentum strategy that capitalizes on stocks with significant pre-market gaps ' +
      'fueled by news, earnings, upgrades, or sector catalysts. When a stock gaps up 3-5%+ and ' +
      'continues to hold above the gap level in the first 15 minutes, institutional momentum often ' +
      'carries it higher throughout the session. The key insight: strong gaps on real catalysts attract ' +
      'buyers — retail chasing, shorts covering, and momentum algorithms all create sustained directional ' +
      'moves. The setup requires discipline: only trade genuine catalyst gaps, not random overnight moves.',
    category: 'momentum',
    assetTypes: ['stock'],
    entryRules: [
      'Stock gaps up 3%+ (or down 3%+ for short) pre-market on a real catalyst (news, earnings, FDA, analyst)',
      'Pre-market relative volume > 3x average — confirms institutional participation',
      'In first 5 minutes: stock holds above the gap level (previous day close) — no fill',
      'Volume on first candle is above average for that time of day',
      'Price is above VWAP and VWAP is trending in gap direction',
      'Enter on a 1-min or 5-min pullback to VWAP or first 5-min candle high/low',
    ],
    exitRules: [
      'Primary target: 2x the gap size projected from the gap level',
      'Trail stop using 1-min 9 EMA — exit on close below (for longs)',
      'Hard stop: gap level (previous day close) — if gap fills, momentum is broken',
      'Time stop: if no follow-through by 10:15 AM, reduce position or exit',
    ],
    idealConditions:
      'Pre-market catalyst (specific news — not just rumors), high relative volume before open, above VWAP in pre-market, overall market not in severe downtrend.',
    riskParams: {
      riskRewardTarget: '2:1 minimum',
    },
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'default-red-to-green',
    name: 'Red to Green / Green to Red',
    description:
      'The Red-to-Green (R2G) and Green-to-Red (G2R) are classic reversal setups that exploit ' +
      'the psychological significance of the prior day\'s close. When a stock opens below yesterday\'s ' +
      'close (opens red) and then crosses above it (goes green), it signals a shift in sentiment — ' +
      'shorts panic-cover, buyers pile in, and momentum builds rapidly. The opposite is true for G2R. ' +
      'This is one of the most reliable reversal triggers in day trading because the prior close is ' +
      'a universally watched level by both humans and algorithms. The key is the volume spike on the cross.',
    category: 'reversal',
    assetTypes: ['stock'],
    entryRules: [
      'Stock opens red (below prior close) for R2G, or green (above prior close) for G2R',
      'Wait for price to cross the prior day\'s close level on a candle close',
      'Volume spike on the crossing candle — should be 2x+ the average candle volume',
      'The cross should happen cleanly, not through choppy back-and-forth action',
      'Ideal timing: 9:30-10:30 AM for maximum momentum potential',
      'Check overall market direction: market should support the reversal bias',
    ],
    exitRules: [
      'For R2G: target prior session HOD (high of day) or pre-market high',
      'For G2R: target prior session LOD (low of day) or pre-market low',
      'Stop loss: below the prior close level for R2G (the key level should hold as support)',
      'Trail stop once at 1:1 — lock in profit, let rest run to target',
    ],
    idealConditions:
      'Early market session (9:30-10:30 AM) for strongest momentum, stocks with significant pre-market volume, clear pre-market high/low reference points, not during market-wide panic or euphoria.',
    riskParams: {
      riskRewardTarget: '2:1',
    },
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'default-breakout',
    name: 'Breakout / Breakdown',
    description:
      'The Breakout/Breakdown strategy targets stocks or futures that break through significant ' +
      'price levels — daily highs, 52-week highs, key resistance zones, or multi-week consolidation ' +
      'boundaries — with volume confirmation. These levels are significant because they represent points ' +
      'where supply and demand have previously been in equilibrium. When price breaks through with strong ' +
      'volume, it indicates a shift in that balance. Tight consolidation before the break is critical: ' +
      'longer consolidation = more powerful breakout. The measured move target (height of consolidation ' +
      'projected from breakout) provides a data-driven exit target.',
    category: 'breakout',
    assetTypes: ['stock', 'futures', 'options'],
    entryRules: [
      'Identify the key level: daily high, prior resistance, 52-week high, or consolidation boundary',
      'Look for tight consolidation (low-volatility price compression) approaching the level — at least 3-5 candles',
      'On the breakout candle: volume must be above average (1.5-2x typical volume at that time)',
      'Wait for a candle close above resistance (not just a wick poke)',
      'Optional: wait for a 1-candle retest of the broken level as new support before entering',
      'Ensure the breakout aligns with overall market direction',
    ],
    exitRules: [
      'Primary target: measured move — height of the prior consolidation range projected upward from breakout',
      'Stop loss: just below the breakout level (or consolidation low for shorts)',
      'If breakout fails (price closes back below key level), exit immediately — do not hold a failed breakout',
      'Partial profit at 1:1, trail stop for remainder to capture extended momentum',
    ],
    idealConditions:
      'Tight prior consolidation (coiled spring pattern), volume expansion on the break, overall market in uptrend (for breakouts), sector strength aligned, not immediately before major news events.',
    riskParams: {
      riskRewardTarget: '2:1 to 3:1',
    },
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
]
