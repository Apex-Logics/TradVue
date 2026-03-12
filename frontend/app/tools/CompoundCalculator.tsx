'use client'
import { useState, useMemo, useEffect } from 'react'
import Tooltip from '../components/Tooltip'
import { IconInfo } from '../components/Icons'

const STORAGE_KEY = 'cg_compound_calc'

const PRESETS = [
  { label: '0.5%', value: '0.5' },
  { label: '1%', value: '1' },
  { label: '2%', value: '2' },
  { label: '3%', value: '3' },
  { label: '5%', value: '5' },
]

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

export default function CompoundCalculator() {
  const [start, setStart] = useState('10000')
  const [monthly, setMonthly] = useState('500')
  const [rate, setRate] = useState('1')
  const [years, setYears] = useState('10')
  const [freq, setFreq] = useState<'monthly' | 'weekly'>('monthly')
  const [showTable, setShowTable] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (s.start) setStart(s.start)
      if (s.monthly) setMonthly(s.monthly)
      if (s.rate) setRate(s.rate)
      if (s.years) setYears(s.years)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ start, monthly, rate, years })) } catch {}
  }, [start, monthly, rate, years])

  const startN = parseFloat(start) || 0
  const monthlyN = parseFloat(monthly) || 0
  const rateN = parseFloat(rate) / 100
  const yearsN = parseInt(years) || 0

  const { yearlyData, finalBalance, totalContrib, totalProfit } = useMemo(() => {
    const periodsPerYear = freq === 'monthly' ? 12 : 52
    // rateN is already a monthly rate — use directly for monthly, convert for weekly
    const ratePerPeriod = freq === 'monthly' ? rateN : rateN * 12 / 52
    const contribPerPeriod = freq === 'monthly' ? monthlyN : monthlyN * 12 / 52

    let balance = startN
    const yearlyData = []
    let totalContrib = startN

    for (let y = 1; y <= yearsN; y++) {
      const startBalance = balance
      let yearContrib = 0
      for (let p = 0; p < periodsPerYear; p++) {
        balance = balance * (1 + ratePerPeriod) + contribPerPeriod
        yearContrib += contribPerPeriod
      }
      totalContrib += yearContrib
      yearlyData.push({
        year: y,
        startBalance,
        contributions: yearContrib,
        endBalance: balance,
        totalContrib,
        gains: balance - totalContrib,
      })
    }

    return { yearlyData, finalBalance: balance, totalContrib, totalProfit: balance - totalContrib }
  }, [startN, monthlyN, rateN, yearsN, freq])

  const multiplier = startN > 0 ? finalBalance / startN : 0

  // Chart: area chart showing contributions vs gains
  const chartData = yearlyData
  const maxVal = finalBalance || 1
  const chartW = 560
  const chartH = 120

  const contribPoints = [
    '0,120',
    ...chartData.map((d, i) => `${(i + 1) * chartW / (yearsN || 1)},${120 - (d.totalContrib / maxVal) * 110}`),
    `${chartW},120`
  ].join(' ')

  const gainPoints = [
    ...chartData.map((d, i) => `${(i + 1) * chartW / (yearsN || 1)},${120 - (d.endBalance / maxVal) * 110}`),
    `${chartW},120`,
    `0,120`,
  ].join(' ')

  const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  // "If you started X years ago" comparison
  const pastYears = [5, 10, 20]

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      <style>{`@media(max-width:640px){.cc-grid{grid-template-columns:1fr!important}.cc-wrap{flex-wrap:wrap}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Compound Growth Calculator</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Contributions, growth chart, year-by-year breakdown</div>
        </div>
        <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showHowTo ? 'Hide' : 'How to use'}
        </button>
      </div>

      {showHowTo && (
        <div style={{ background: 'var(--accent-dim)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          Enter your starting capital, monthly contribution amount, and expected monthly return rate. The chart shows how contributions (blue) and investment gains (green) stack up over time. Consistent contributions are often more impactful than return rate.
        </div>
      )}

      <div className="cc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
        <div>
          <InputField label="Starting Capital" tooltip="How much you're starting with today." value={start} onChange={setStart} placeholder="10000" prefix="$" />
          <InputField label="Monthly Contribution" tooltip="How much you add each month. Even small amounts compound dramatically over time." value={monthly} onChange={setMonthly} placeholder="500" prefix="$" />
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Monthly Return % <Tooltip text="Expected return per month. S&P 500 averages ~0.83%/month (10%/year). Adjust to your strategy." position="right" />
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {PRESETS.map(p => (
                <button key={p.value} onClick={() => setRate(p.value)}
                  style={{ flex: 1, padding: '5px 2px', borderRadius: 6, border: `1px solid ${rate === p.value ? 'var(--accent)' : 'var(--border)'}`, background: rate === p.value ? 'var(--accent-dim)' : 'transparent', color: rate === p.value ? 'var(--accent)' : 'var(--text-2)', fontSize: 11, cursor: 'pointer', fontWeight: rate === p.value ? 700 : 400 }}>
                  {p.label}
                </button>
              ))}
            </div>
            <InputField label="" tooltip="" value={rate} onChange={setRate} placeholder="e.g. 1.5" step="0.1" />
          </div>
          <InputField label="Years" tooltip="Investment horizon. The longer the better — compounding accelerates dramatically after year 7." value={years} onChange={setYears} placeholder="10" step="1" />
          <div style={{ display: 'flex', gap: 8 }}>
            {(['monthly', 'weekly'] as const).map(f => (
              <button key={f} onClick={() => setFreq(f)}
                style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: `1px solid ${freq === f ? 'var(--accent)' : 'var(--border)'}`, background: freq === f ? 'var(--accent-dim)' : 'transparent', color: freq === f ? 'var(--accent)' : 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontWeight: 700, textTransform: 'capitalize' }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 12 }}>RESULTS AFTER {yearsN} YEARS</div>
            {[
              { label: 'Final Balance', value: fmt(finalBalance), color: 'var(--accent)' },
              { label: 'Total Invested', value: fmt(totalContrib), color: 'var(--text-1)' },
              { label: 'Investment Gains', value: fmt(totalProfit), color: 'var(--green)' },
              { label: 'Profit Multiplier', value: `${multiplier.toFixed(2)}×`, color: 'var(--yellow)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: r.color }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Comparisons */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>IF YOU&apos;D STARTED N YEARS AGO</div>
            {pastYears.map(py => {
              let bal = startN
              const periods = freq === 'monthly' ? 12 : 52
              const r = freq === 'monthly' ? rateN : rateN * 12 / 52
              const c = freq === 'monthly' ? monthlyN : monthlyN * 12 / 52
              for (let i = 0; i < py * periods; i++) bal = bal * (1 + r) + c
              return (
                <div key={py} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-3)' }}>Started {py} yrs ago</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontWeight: 700 }}>{fmt(bal)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Area Chart */}
      {yearsN > 0 && finalBalance > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>PORTFOLIO GROWTH OVER TIME</div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 10, color: 'var(--text-3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, background: 'rgba(74,158,255,0.5)', borderRadius: 2, display: 'inline-block' }} />Contributions</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, background: 'rgba(34,197,94,0.5)', borderRadius: 2, display: 'inline-block' }} />Investment Gains</span>
            </div>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} style={{ display: 'block' }}>
              <defs>
                <linearGradient id="gainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.5"/><stop offset="100%" stopColor="#22c55e" stopOpacity="0.1"/></linearGradient>
                <linearGradient id="contribFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a9eff" stopOpacity="0.5"/><stop offset="100%" stopColor="#4a9eff" stopOpacity="0.1"/></linearGradient>
              </defs>
              {/* Gains area (total balance) */}
              <polygon points={gainPoints} fill="url(#gainFill)" />
              {/* Contributions area */}
              <polygon points={contribPoints} fill="url(#contribFill)" />
              {/* Balance line */}
              <polyline
                points={chartData.map((d, i) => `${(i + 1) * chartW / (yearsN)},${chartH - (d.endBalance / maxVal) * 110}`).join(' ')}
                fill="none" stroke="#22c55e" strokeWidth="2" />
              {/* Contrib line */}
              <polyline
                points={chartData.map((d, i) => `${(i + 1) * chartW / (yearsN)},${chartH - (d.totalContrib / maxVal) * 110}`).join(' ')}
                fill="none" stroke="#4a9eff" strokeWidth="1.5" strokeDasharray="4,3" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>
              <span>Year 1</span><span>Year {Math.ceil(yearsN / 2)}</span><span>Year {yearsN}</span>
            </div>
          </div>
        </div>
      )}

      {/* Year-by-year table */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowTable(t => !t)} style={{ fontSize: 11, padding: '5px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showTable ? 'Hide' : 'Show'} Year-by-Year Breakdown
        </button>
      </div>

      {showTable && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-3)' }}>
                {['Year', 'Starting Balance', 'Annual Contribution', 'Returns', 'Ending Balance'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-2)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearlyData.map(d => (
                <tr key={d.year} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{d.year}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(d.startBalance)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(d.contributions)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--green)' }}>{fmt(d.endBalance - d.startBalance - d.contributions)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-0)' }}>{fmt(d.endBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Calculations assume constant return rate. Real returns vary. Doesn&apos;t account for taxes or inflation. Past performance doesn&apos;t guarantee future results.</span>
      </div>
    </div>
  )
}
