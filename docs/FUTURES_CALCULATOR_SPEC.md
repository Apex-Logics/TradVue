# Futures Risk/Reward Calculator — Spec

## References
- https://insider-week.com/en/futures-calculator/
- https://futurecontractcalculator.com/

## Overview
A comprehensive futures trading calculator on the Tools page. Combines position sizing, risk/reward analysis, and profit/loss calculation for futures contracts. Must be beginner-friendly with clear instructions.

## Core Features

### 1. Contract Selector
Dropdown with 30+ popular futures contracts, grouped by category:
- **Indices:** ES (E-mini S&P 500), NQ (E-mini Nasdaq), YM (E-mini Dow), RTY (E-mini Russell), MES (Micro E-mini S&P), MNQ (Micro Nasdaq), MYM (Micro Dow)
- **Energy:** CL (Crude Oil), NG (Natural Gas), MCL (Micro Crude), RB (RBOB Gasoline), HO (Heating Oil)
- **Metals:** GC (Gold), SI (Silver), HG (Copper), PL (Platinum), MGC (Micro Gold), SIL (Micro Silver)
- **Agriculture:** ZC (Corn), ZS (Soybeans), ZW (Wheat), ZL (Soybean Oil), CT (Cotton), KC (Coffee), SB (Sugar), LE (Live Cattle), HE (Lean Hogs)
- **Currencies:** 6E (Euro FX), 6B (British Pound), 6J (Japanese Yen), 6A (Australian Dollar), 6C (Canadian Dollar)
- **Rates:** ZB (30-Year Bond), ZN (10-Year Note), ZF (5-Year Note), ZT (2-Year Note)
- **Crypto:** BTC (Bitcoin), MBT (Micro Bitcoin), ETH (Ether)

Each contract stores:
```json
{
  "symbol": "ES",
  "name": "E-mini S&P 500",
  "exchange": "CME",
  "tickSize": 0.25,
  "tickValue": 12.50,
  "pointValue": 50,
  "contractSize": "$50 × index",
  "tradingHours": "Sun-Fri 6:00pm-5:00pm ET",
  "initialMargin": 12650,
  "maintenanceMargin": 11500,
  "category": "indices"
}
```

### 2. Calculator Inputs
- **Direction:** Long / Short toggle
- **Entry Price:** number input
- **Stop Loss Price:** number input
- **Target Price:** number input (optional — can add multiple targets)
- **Number of Contracts:** number input (default 1)
- **Account Size:** number input (optional — for position sizing)
- **Max Risk %:** slider or input (1-10%, default 2%)

### 3. Calculated Outputs

#### Risk Analysis
- **Ticks at Risk:** |Entry - Stop| / tickSize
- **Dollar Risk per Contract:** ticks × tickValue
- **Total Dollar Risk:** dollarRisk × contracts
- **Risk % of Account:** totalRisk / accountSize × 100

#### Reward Analysis
- **Ticks to Target:** |Entry - Target| / tickSize
- **Dollar Reward per Contract:** ticks × tickValue
- **Total Dollar Reward:** dollarReward × contracts
- **Risk:Reward Ratio:** displayed as 1:X

#### Position Sizing (when account size provided)
- **Max Contracts (by risk):** floor(accountSize × maxRisk% / dollarRiskPerContract)
- **Max Contracts (by margin):** floor(accountSize / initialMargin)
- **Recommended Contracts:** min of both

#### Contract Info Panel
- Tick size & tick value
- Point value
- Contract size
- Exchange
- Trading hours
- Initial / maintenance margin
- Day trading margin (typically 50% of initial)

### 4. Visual Risk/Reward Bar
Horizontal bar showing entry, stop, and target visually:
```
STOP ←——[red]——→ ENTRY ←——[green]——→ TARGET
   $500 risk         $1,500 reward
              R:R = 1:3
```

### 5. Multiple Targets
Allow up to 3 profit targets with partial position sizing:
- Target 1: X contracts at price Y
- Target 2: X contracts at price Z
- Target 3: remainder at price W
Calculates blended R:R and expected value.

### 6. Instructions Panel
Collapsible "How to Use" section at top:
1. Select your futures contract
2. Choose your direction (Long or Short)
3. Enter your entry price
4. Enter your stop loss price
5. Enter your target price
6. Adjust the number of contracts
7. (Optional) Enter your account size for position sizing

Include tooltips on every field explaining what it means.

## Design
- Lives on the Tools page as a new tool card + dedicated section/modal
- Matches existing tool design (blue accent icons, dark theme, CSS vars)
- Responsive — works on mobile
- Real-time calculation (no "Calculate" button — updates as you type)
- Save last used settings in localStorage (key: `cg_futures_calc`)

## Non-Goals
- No live price fetching (user enters their own prices)
- No brokerage integration
- No order execution
