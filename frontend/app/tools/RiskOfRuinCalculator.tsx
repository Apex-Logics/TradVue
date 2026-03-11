'use client'
import { useState, useMemo, useEffect } from 'react'
import Tooltip from '../components/Tooltip'
import { IconAlert, IconCheck, IconInfo } from '../components/Icons'

const STORAGE_KEY = 'cg_ruin_calc'

function InputField({ label, tooltip, value, onChange, placeholder, step = 'any', min }: {
  label: string; tooltip: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: string; min?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label} <Tooltip text={tooltip} position="right" />
      </label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} step={step} min={min}
        style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )
}

// Analytical Risk of Ruin formula
function calcRuinProbability(winRate: number, rr: number, riskPct: number, maxDrawdownPct: number): number {
  if (winRate <= 0 || winRate >= 1 || rr <= 0 || riskPct <= 0) return 1
  const lossRate = 1 - winRate
  // Kelly criterion
  const edge = winRate * rr - lossRate
  // Approximate RoR using gambler's ruin
  // P(ruin) ≈ ((1-edge/rr) / (edge/rr + 1))^N where N = maxDrawdown/riskPerTrade
  const p = winRate; const q = lossRate; const r = rr
  // Using exact formula for symmetric random walk adapted for R:R
  const ratio = (q / p) * (1 / r)
  const tradesNeeded = Math.round(maxDrawdownPct / riskPct)
  if (ratio >= 1) return 1 // negative edge = certain ruin
  return Math.min(1, Math.pow(ratio, tradesNeeded))
}

// Simplified Kelly
function kelly(winRate: number, rr: number): number {
  return (winRate * rr - (1 - winRate)) / rr
}

export default function RiskOfRuinCalculator() {
  const [winRate, setWinRate] = useState('45')
  const [rr, setRr] = useState('2')
  const [riskPct, setRiskPct] = useState('2')
  const [numTrades, setNumTrades] = useState('100')
  const [ruinLevel, setRuinLevel] = useState('20')
  const [showHowTo, setShowHowTo] = useState(false)
  const [simRuns, setSimRuns] = useState<number[][]>([])

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (s.winRate) setWinRate(s.winRate)
      if (s.rr) setRr(s.rr)
      if (s.riskPct) setRiskPct(s.riskPct)
      if (s.numTrades) setNumTrades(s.numTrades)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ winRate, rr, riskPct, numTrades })) } catch {}
  }, [winRate, rr, riskPct, numTrades])

  const wr = parseFloat(winRate) / 100
  const rrN = parseFloat(rr)
  const riskN = parseFloat(riskPct) / 100
  const tradesN = parseInt(numTrades) || 100
  const ruinLevelN = parseFloat(ruinLevel)

  const kellyPct = useMemo(() => kelly(wr, rrN) * 100, [wr, rrN])
  const ev = useMemo(() => wr * rrN - (1 - wr), [wr, rrN])
  const ruinProb = useMemo(() => calcRuinProbability(wr, rrN, parseFloat(riskPct), ruinLevelN), [wr, rrN, riskPct, ruinLevelN])

  // Monte Carlo simulation (1000 runs, 100 trades each)
  const monteData = useMemo(() => {
    const RUNS = 500; const seed = Math.round(wr * 1000 + rrN * 100 + riskN * 1000)
    // Seeded pseudo-random for consistency
    let state = seed || 12345
    const rand = () => { state = (state * 1103515245 + 12345) & 0x7fffffff; return state / 0x7fffffff }

    const runs: number[][] = []
    let ruinCount = 0
    let doubleCount = 0
    const ruinThreshold = 1 - ruinLevelN / 100

    for (let r = 0; r < RUNS; r++) {
      const equity: number[] = [1.0]
      let bal = 1.0
      let ruined = false
      for (let t = 0; t < tradesN; t++) {
        if (bal <= ruinThreshold) { ruined = true; break }
        const win = rand() < wr
        bal = win ? bal + bal * riskN * rrN : bal - bal * riskN
        equity.push(bal)
      }
      if (ruined) ruinCount++
      if (bal >= 2) doubleCount++
      runs.push(equity)
    }
    return { runs, ruinCount: ruinCount / RUNS, doubleCount: doubleCount / RUNS }
  }, [wr, rrN, riskN, tradesN, ruinLevelN])

  // Draw a subset of runs on SVG
  const displayRuns = useMemo(() => {
    return monteData.runs.filter((_, i) => i % 5 === 0).slice(0, 100)
  }, [monteData.runs])

  const medianFinal = useMemo(() => {
    const finals = monteData.runs.map(r => r[r.length - 1]).sort((a, b) => a - b)
    return finals[Math.floor(finals.length / 2)]
  }, [monteData.runs])

  // SVG chart
  const chartW = 560; const chartH = 150
  const maxVal = Math.min(3, Math.max(...displayRuns.flatMap(r => r)))
  const minVal = Math.max(0, Math.min(...displayRuns.flatMap(r => r)))

  const toX = (i: number, len: number) => (i / (len - 1)) * chartW
  const toY = (v: number) => chartH - ((Math.min(v, maxVal) - 0) / (maxVal - 0)) * (chartH - 10)

  const riskLevel = ruinProb < 0.05 ? 'Low' : ruinProb < 0.15 ? 'Medium' : ruinProb < 0.35 ? 'High' : 'Extreme'
  const riskColor = { Low: 'var(--green)', Medium: 'var(--yellow)', High: '#f97316', Extreme: 'var(--red)' }[riskLevel]

  const recommendations: string[] = []
  if (ev < 0) recommendations.push('Negative expectancy — increase win rate or R:R before trading.')
  if (riskN > 0.02) recommendations.push(`${(riskN * 100).toFixed(1)}% risk/trade is aggressive — consider ${(riskN * 50).toFixed(1)}% or less.`)
  if (kellyPct > 0 && riskN * 100 > kellyPct * 0.5) recommendations.push(`Kelly says ${kellyPct.toFixed(1)}%. Many pros use half-Kelly: ${(kellyPct / 2).toFixed(1)}%.`)
  if (wr < 0.4) recommendations.push(`${winRate}% win rate is low — needs strong R:R (${(1 / (1 - wr)).toFixed(1)}:1+) to be profitable.`)
  if (recommendations.length === 0) recommendations.push('Parameters look reasonable. Stick to your plan and manage emotions.')

  const fmt = (n: number, d = 1) => isNaN(n) ? '—' : n.toFixed(d)

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Risk of Ruin Calculator</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Monte Carlo simulation, Kelly criterion, ruin probability</div>
        </div>
        <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showHowTo ? 'Hide' : 'How to use'}
        </button>
      </div>

      {showHowTo && (
        <div style={{ background: 'var(--accent-dim)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          Risk of Ruin tells you the probability of losing a specific percentage of your account. Enter your system parameters and see 500 simulated equity curves. The ruin threshold is the drawdown level you want to avoid — typically 20-50% of account.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <InputField label="Win Rate %" tooltip="Your historical or expected win rate." value={winRate} onChange={setWinRate} placeholder="45" step="1" min="1" />
          <InputField label="Average R:R Ratio" tooltip="Average win divided by average loss. 2.0 = you make $2 for every $1 lost." value={rr} onChange={setRr} placeholder="2" step="0.1" min="0.1" />
          <InputField label="Risk per Trade %" tooltip="What % of account you risk per trade. Keep under Kelly Criterion." value={riskPct} onChange={setRiskPct} placeholder="2" step="0.5" min="0.1" />
          <InputField label="Number of Trades" tooltip="How many trades to simulate. 100 = about 1-2 months. 1000 = about 1 year." value={numTrades} onChange={setNumTrades} placeholder="100" step="50" min="10" />
          <InputField label="Ruin Level %" tooltip="The drawdown % that would be catastrophic. 20% = stop trading if down 20%." value={ruinLevel} onChange={setRuinLevel} placeholder="20" step="5" min="5" />
        </div>

        <div>
          {/* Risk Badge */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: '4px 12px', borderRadius: 20, background: riskColor + '25', border: `1px solid ${riskColor}`, color: riskColor, fontSize: 12, fontWeight: 700 }}>
                {riskLevel} Risk
              </div>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', color: riskColor }}>{(ruinProb * 100).toFixed(1)}%</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
              probability of hitting -{ruinLevel}% drawdown in {numTrades} trades
            </div>

            {[
              { label: 'Expectancy/trade', value: `${ev >= 0 ? '+' : ''}${fmt(ev * 100, 1)}¢ per $1`, color: ev >= 0 ? 'var(--green)' : 'var(--red)', tip: 'Expected gain/loss per dollar risked' },
              { label: 'Kelly Criterion', value: `${kellyPct > 0 ? fmt(kellyPct) : '0'}% (half: ${kellyPct > 0 ? fmt(kellyPct / 2) : '0'}%)`, color: 'var(--yellow)', tip: 'Optimal bet size. Most pros use half-Kelly.' },
              { label: 'Prob. of Doubling', value: `${fmt(monteData.doubleCount * 100)}%`, color: 'var(--green)', tip: 'Simulated probability of doubling account before ruin' },
              { label: 'Median Final Balance', value: `${fmt(medianFinal * 100)}%`, color: medianFinal > 1 ? 'var(--green)' : 'var(--red)', tip: '50th percentile final balance across simulations' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {r.label}<Tooltip text={r.tip} position="right" />
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: r.color }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>RECOMMENDATIONS</div>
            {recommendations.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-2)', marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ color: riskLevel === 'Low' ? 'var(--green)' : 'var(--yellow)', marginTop: 1 }}>
                  {riskLevel === 'Low' ? <IconCheck size={11} /> : <IconAlert size={11} />}
                </span>
                {r}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monte Carlo Chart */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>
          MONTE CARLO SIMULATION — 500 EQUITY CURVES ({numTrades} TRADES EACH)
        </div>
        <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12 }}>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} style={{ display: 'block' }}>
            {/* Ruin threshold */}
            {(() => {
              const ruinY = toY(1 - ruinLevelN / 100)
              return <line x1="0" y1={ruinY} x2={chartW} y2={ruinY} stroke="var(--red)" strokeWidth="1" strokeDasharray="5,3" opacity="0.6" />
            })()}
            {/* Equity curves */}
            {displayRuns.map((run, i) => (
              <polyline key={i}
                points={run.map((v, j) => `${toX(j, run.length).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')}
                fill="none" stroke={run[run.length - 1] < 1 ? '#ef4444' : '#22c55e'} strokeWidth="0.5" opacity="0.15" />
            ))}
            {/* Median line */}
            {(() => {
              const medianRun = [...monteData.runs].sort((a, b) => a[a.length - 1] - b[b.length - 1])[Math.floor(monteData.runs.length / 2)]
              return medianRun ? (
                <polyline
                  points={medianRun.map((v, j) => `${toX(j, medianRun.length).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')}
                  fill="none" stroke="var(--accent)" strokeWidth="2" />
              ) : null
            })()}
            {/* Baseline */}
            <line x1="0" y1={toY(1)} x2={chartW} y2={toY(1)} stroke="var(--text-3)" strokeWidth="0.5" />
            {/* Labels */}
            <text x="4" y={toY(1) - 4} fontSize="8" fill="var(--text-3)">Start (100%)</text>
            <text x="4" y={toY(1 - ruinLevelN / 100) - 4} fontSize="8" fill="var(--red)">Ruin -{ruinLevel}%</text>
            <text x={chartW - 60} y="14" fontSize="9" fill="var(--accent)">— Median</text>
          </svg>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
            Green = surviving curves · Red = ruined curves · Blue = median path
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Simulation uses seeded pseudo-random to ensure consistent results. Real trading has additional risks (gaps, slippage, psychology). Not financial advice.</span>
      </div>
    </div>
  )
}
