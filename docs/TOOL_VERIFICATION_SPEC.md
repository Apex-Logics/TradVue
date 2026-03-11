# Tool Verification Spec — Independent QA

Every calculator must be verified with real-world numbers by a SEPARATE agent.
Bolt builds. Zip verifies. No exceptions.

## Verification Method
For each tool:
1. Read the source code — understand the formula
2. Calculate expected results BY HAND (in the verification script)
3. Compare hand-calculated results to what the code produces
4. Flag ANY discrepancy, no matter how small

## Test Cases Per Tool

### Futures Calculator (existing — re-verify)
- ES: Entry 5000, Stop 4990, Target 5030, 1 contract → Risk $500, Reward $1500, R:R 1:3
- NQ: Entry 17500, Stop 17480, Target 17560, 2 contracts → Risk $800, Reward $2400
- MES: Entry 5000, Stop 4990, Target 5030, 5 contracts → Risk $250, Reward $750
- GC: Entry 2000, Stop 1990, Target 2030, 1 contract → Risk $1000, Reward $3000

### Options Profit Calculator
- AAPL Call: Stock $175, Strike $180, Premium $3.50, 1 contract
  → Break-even: $183.50, Max loss: $350, Max profit: unlimited
  → At $190: profit = ($190-$183.50)×100 = $650
  → At $170: loss = $350 (premium paid)
- SPY Put: Stock $550, Strike $540, Premium $5, 2 contracts
  → Break-even: $535, Max loss: $1000
  → At $520: profit = ($535-$520)×200 = $3000

### Compound Growth Calculator
- $10,000 start, $500/mo, 2% monthly, 5 years
  → Verify month-by-month compounding is correct
  → Final balance should be approximately $131,000-135,000
- $25,000 start, $0/mo, 1% monthly, 10 years → ~$81,000

### Risk of Ruin Calculator
- 50% win rate, 1:2 R:R, 2% risk → Low ruin probability (<5%)
- 40% win rate, 1:1 R:R, 5% risk → High ruin probability (>50%)
- Kelly Criterion: 60% win, 1:1 R:R → Kelly = 2×0.6-1 = 0.20 (20%)

### Forex Pip Calculator
- EUR/USD: 1 standard lot, pip = 0.0001 → pip value = $10
- USD/JPY: 1 standard lot, pip = 0.01 → pip value ≈ $6.67 (at 150.00)
- GBP/USD: 0.1 lot, entry 1.2700, SL 30 pips → risk = $30

### Position Sizer
- $50,000 account, 2% risk, entry $100, stop $95
  → Risk per share: $5, max risk: $1000, position: 200 shares
- $10,000 account, 1% risk, entry $50, stop $48
  → Risk per share: $2, max risk: $100, position: 50 shares

### Trade Expectancy
- 55% win rate, avg win $500, avg loss $300
  → Expectancy = (0.55 × $500) - (0.45 × $300) = $275 - $135 = $140 per trade
- 40% win rate, avg win $1000, avg loss $400
  → Expectancy = (0.40 × $1000) - (0.60 × $400) = $400 - $240 = $160 per trade

### Dividend Planner / DRIP
- $10,000 in stock yielding 4%, quarterly payments
  → Annual income: $400, quarterly: $100
  → With DRIP after 10 years at 4% yield, 0% price appreciation: ~$14,800 value

### Correlation Matrix
- Verify SPY vs QQQ should show high positive correlation (~0.9+)
- Verify SPY vs GLD should show low/negative correlation

## Pass Criteria
- Every calculation must match hand-calculated result within 0.01% (floating point tolerance)
- Any rounding must be documented and consistent
- Edge cases: zero values, negative numbers, very large numbers must not crash
