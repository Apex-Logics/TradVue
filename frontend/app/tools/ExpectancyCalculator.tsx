'use client'
import { useState, useMemo, useEffect } from 'react'
import Tooltip from '../components/Tooltip'
import { IconInfo, IconCheck, IconAlert, IconTrendingUp } from '../components/Icons'

const STORAGE_KEY = 'cg_expectancy_calc'

function InputField({ label, tooltip, value, onChange, placeholder, step = 'any', prefix }: {
  label: string; tooltip: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: string; prefix?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label} <Tooltip text={tooltip} position="right" />
      </label>
      <div style={{ position: 'relative' }}>
        {prefix && <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 13 }}>{prefix}</span>}
        <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} step={step}
          style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: `7px 10px 7px ${prefix ? 22 : 10}px`, color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>
    </div>
  )
}

const TRADE_SCENARIOS = [100, 500, 1000]

export default function ExpectancyCalculator() {
  const [winRate, setWinRate] = useState('55')
  const [avgWin, setAvgWin] = useState('300')
  const [avgLoss, setAvgLoss] = useState('150')
  const [tradesPerMonth, setTradesPerMonth] = useState('20')
  const [showHowTo, setShowHowTo] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (s.winRate) setWinRate(s.winRate)
      if (s.avgWin) setAvgWin(s.avgWin)
      if (s.avgLoss) setAvgLoss(s.avgLoss)
      if (s.tradesPerMonth) setTradesPerMonth(s.tradesPerMonth)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ winRate, avgWin, avgLoss, tradesPerMonth })) } catch {}
  }, [winRate, avgWin, avgLoss, tradesPerMonth])

  const wr = parseFloat(winRate) / 100
  const lr = 1 - wr
  const winN = parseFloat(avgWin) || 0
  const lossN = parseFloat(avgLoss) || 0
  const monthTrades = parseFloat(tradesPerMonth) || 0

  // Core expectancy
  const expectancyPerTrade = wr * winN - lr * lossN
  const rrRatio = lossN > 0 ? winN / lossN : 0
  const breakEvenWR = lossN > 0 ? lossN / (winN + lossN) : 0

  const monthlyExpectancy = expectancyPerTrade * monthTrades
  const annualExpectancy = monthlyExpectancy * 12

  // Projection over N trades
  const tradeProjections = useMemo(() => {
    return TRADE_SCENARIOS.map(n => ({
      trades: n,
      expected: expectancyPerTrade * n,
      months: monthTrades > 0 ? (n / monthTrades).toFixed(1) : '—',
    }))
  }, [expectancyPerTrade, monthTrades])

  // Equity curve simulation (deterministic walk)
  const equityCurve = useMemo(() => {
    if (!wr || !winN || !lossN) return []
    const N = Math.min(100, Math.max(20, Math.round(monthTrades * 6)))
    const points: { t: number; value: number; avg: number }[] = [{ t: 0, value: 0, avg: 0 }]
    // Use alternating pattern based on win rate
    const winInterval = wr > 0 ? Math.round(1 / wr) : 2
    for (let i = 1; i <= N; i++) {
      const isWin = (i % winInterval === 0) || (wr > 0.5 && i % 2 === 0 && (i % winInterval !== 1))
      const delta = isWin ? winN : -lossN
      points.push({ t: i, value: points[i - 1].value + delta, avg: expectancyPerTrade * i })
    }
    return points
  }, [wr, winN, lossN, expectancyPerTrade, monthTrades])

  // Verdicts
  const isPositive = expectancyPerTrade > 0
  const strength = Math.abs(expectancyPerTrade) / (lossN || 1)

  const chartW = 560; const chartH = 120
  const maxVal = Math.max(...equityCurve.map(p => p.value), ...equityCurve.map(p => p.avg), 0)
  const minVal = Math.min(...equityCurve.map(p => p.value), ...equityCurve.map(p => p.avg), 0)
  const range = maxVal - minVal || 1
  const toX = (t: number) => (t / (equityCurve.length - 1 || 1)) * chartW
  const toY = (v: number) => chartH - ((v - minVal) / range) * (chartH - 10) - 5
  const zeroY = toY(0)

  const fmt = (n: number) => `$${n >= 0 ? '' : '-'}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <IconTrendingUp size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Trade Expectancy Calculator</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Is your trading system actually profitable?</div>
          </div>
        </div>
        <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showHowTo ? 'Hide' : 'How to use'}
        </button>
      </div>

      {showHowTo && (
        <div style={{ background: 'var(--accent-dim)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          Expectancy tells you how much you expect to make on average per trade. A positive expectancy means your system has an edge and will be profitable over many trades. Use your real trade statistics from the past 3–6 months for accuracy.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <InputField label="Win Rate %" tooltip="What % of your trades end in profit. Use real historical data." value={winRate} onChange={setWinRate} placeholder="55" step="1" />
          <InputField label="Average Win ($)" tooltip="Your average profit on winning trades. Calculate from your trade log." value={avgWin} onChange={setAvgWin} placeholder="300" prefix="$" />
          <InputField label="Average Loss ($)" tooltip="Your average loss on losing trades (enter as positive number)." value={avgLoss} onChange={setAvgLoss} placeholder="150" prefix="$" />
          <InputField label="Trades Per Month" tooltip="How many trades you typically take each month." value={tradesPerMonth} onChange={setTradesPerMonth} placeholder="20" step="1" />

          {/* Break-even analysis */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>BREAK-EVEN ANALYSIS</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
              At {winN > 0 && lossN > 0 ? `${rrRatio.toFixed(2)}:1 R:R` : 'this R:R'}, you need:
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>
              {(breakEvenWR * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>win rate to break even</div>
            {wr > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: wr > breakEvenWR ? 'var(--green)' : 'var(--red)' }}>
                Your {winRate}% is {wr > breakEvenWR ? `${((wr - breakEvenWR) * 100).toFixed(1)}% above` : `${((breakEvenWR - wr) * 100).toFixed(1)}% below`} break-even
              </div>
            )}
          </div>
        </div>

        <div>
          {/* Main verdict */}
          <div style={{
            background: isPositive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isPositive ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            borderRadius: 12, padding: 16, marginBottom: 12, textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              {isPositive ? <IconCheck size={24} style={{ color: 'var(--green)' }} /> : <IconAlert size={24} style={{ color: 'var(--red)' }} />}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', color: isPositive ? 'var(--green)' : 'var(--red)' }}>
              {expectancyPerTrade >= 0 ? '+' : ''}{fmt(expectancyPerTrade)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>expectancy per trade</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
              {isPositive ? `Your system has ${strength > 0.5 ? 'strong' : 'positive'} expectancy — keep trading it consistently.` : 'Negative expectancy — increase win rate, improve R:R, or reduce commissions.'}
            </div>
          </div>

          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>PROJECTIONS</div>
            {[
              { label: 'Monthly Expected P&L', value: fmt(monthlyExpectancy), color: monthlyExpectancy >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Annual Expected P&L', value: fmt(annualExpectancy), color: annualExpectancy >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Win/Loss Ratio', value: rrRatio > 0 ? `${rrRatio.toFixed(2)}:1` : '—', color: rrRatio >= 2 ? 'var(--green)' : rrRatio >= 1 ? 'var(--yellow)' : 'var(--red)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: r.color }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Equity curve chart */}
      {equityCurve.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>SIMULATED EQUITY CURVE</div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 10, color: 'var(--text-3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--accent)', display: 'inline-block' }} />Simulated curve</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--green)', display: 'inline-block', borderTop: '1px dashed var(--green)' }} />Expected average</span>
            </div>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} style={{ display: 'block' }}>
              {/* Zero line */}
              <line x1="0" y1={zeroY} x2={chartW} y2={zeroY} stroke="var(--border)" strokeWidth="1" strokeDasharray="4,3" />
              {/* Expected line */}
              <polyline
                points={equityCurve.map(p => `${toX(p.t)},${toY(p.avg)}`).join(' ')}
                fill="none" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
              {/* Actual simulated line */}
              <polyline
                points={equityCurve.map(p => `${toX(p.t)},${toY(p.value)}`).join(' ')}
                fill="none" stroke="var(--accent)" strokeWidth="2" />
            </svg>
          </div>
        </div>
      )}

      {/* Trade count scenarios */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>EXPECTED OUTCOME OVER N TRADES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {tradeProjections.map(p => (
            <div key={p.trades} style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{p.trades} trades (~{p.months} months)</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: p.expected >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {p.expected >= 0 ? '+' : ''}{fmt(p.expected)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Expectancy assumes consistent execution. Real results vary due to psychology, commissions, and market conditions. Use at least 50 trades for reliable statistics.</span>
      </div>
    </div>
  )
}
