'use client'
import { useState, useMemo, useEffect } from 'react'
import Tooltip from '../components/Tooltip'
import { IconInfo, IconDollar, IconPlus, IconClose } from '../components/Icons'

const STORAGE_KEY = 'cg_dividend_planner'

const PRESET_STOCKS = [
  { ticker: 'KO',   name: 'Coca-Cola',            yield: 3.1,  freq: 'Q' },
  { ticker: 'JNJ',  name: 'Johnson & Johnson',     yield: 3.0,  freq: 'Q' },
  { ticker: 'PG',   name: 'Procter & Gamble',      yield: 2.4,  freq: 'Q' },
  { ticker: 'PEP',  name: 'PepsiCo',               yield: 3.3,  freq: 'Q' },
  { ticker: 'VZ',   name: 'Verizon',               yield: 6.7,  freq: 'Q' },
  { ticker: 'T',    name: 'AT&T',                  yield: 6.4,  freq: 'Q' },
  { ticker: 'MO',   name: 'Altria',                yield: 9.1,  freq: 'Q' },
  { ticker: 'ABBV', name: 'AbbVie',                yield: 3.5,  freq: 'Q' },
  { ticker: 'O',    name: 'Realty Income (REIT)',  yield: 5.8,  freq: 'M' },
  { ticker: 'MAIN', name: 'Main Street Capital',   yield: 6.9,  freq: 'M' },
  { ticker: 'STAG', name: 'STAG Industrial',       yield: 3.8,  freq: 'M' },
  { ticker: 'ENB',  name: 'Enbridge',              yield: 7.2,  freq: 'Q' },
  { ticker: 'EPD',  name: 'Enterprise Products',   yield: 7.1,  freq: 'Q' },
  { ticker: 'JPC',  name: 'Nuveen Preferred',      yield: 8.4,  freq: 'M' },
  { ticker: 'SCHD', name: 'Schwab Dividend ETF',   yield: 3.5,  freq: 'Q' },
  { ticker: 'VYM',  name: 'Vanguard High Div ETF', yield: 2.9,  freq: 'Q' },
]

interface Holding { id: string; ticker: string; name: string; invested: string; yieldPct: string; freq: 'M' | 'Q' | 'A' }

function uid() { return Math.random().toString(36).slice(2, 9) }

export default function DividendPlanner() {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: uid(), ticker: 'KO', name: 'Coca-Cola', invested: '5000', yieldPct: '3.1', freq: 'Q' },
    { id: uid(), ticker: 'O',  name: 'Realty Income', invested: '5000', yieldPct: '5.8', freq: 'M' },
  ])
  const [drip, setDrip] = useState(true)
  const [horizon, setHorizon] = useState<5 | 10 | 20>(10)
  const [targetIncome, setTargetIncome] = useState('500')
  const [showPresets, setShowPresets] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)
  const [customTicker, setCustomTicker] = useState('')
  const [customName, setCustomName] = useState('')
  const [customYield, setCustomYield] = useState('')
  const [customInvested, setCustomInvested] = useState('')
  const [customFreq, setCustomFreq] = useState<'M' | 'Q' | 'A'>('Q')

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (s.holdings?.length) setHoldings(s.holdings)
      if (s.drip !== undefined) setDrip(s.drip)
      if (s.horizon) setHorizon(s.horizon)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ holdings, drip, horizon })) } catch {}
  }, [holdings, drip, horizon])

  const totals = useMemo(() => {
    const totalInvested = holdings.reduce((s, h) => s + (parseFloat(h.invested) || 0), 0)
    const annualIncome = holdings.reduce((s, h) => {
      const inv = parseFloat(h.invested) || 0
      const y = parseFloat(h.yieldPct) / 100
      return s + inv * y
    }, 0)
    const monthlyIncome = annualIncome / 12
    const quarterlyIncome = annualIncome / 4
    const avgYield = totalInvested > 0 ? annualIncome / totalInvested * 100 : 0

    // DRIP projection
    const horizonData = [1, 2, 3, 4, 5, 7, 10, 15, 20].filter(y => y <= horizon + 1)
    const projections = horizonData.map(yr => {
      if (!drip) {
        return { year: yr, balance: totalInvested, income: annualIncome, totalEarned: annualIncome * yr }
      }
      // Simple DRIP: reinvest dividends each year
      let bal = totalInvested
      const wAvgYield = avgYield / 100
      for (let y = 0; y < yr; y++) {
        const yIncome = bal * wAvgYield
        bal += yIncome
      }
      const incomeThisYear = bal * wAvgYield
      return { year: yr, balance: bal, income: incomeThisYear, totalEarned: bal - totalInvested }
    })

    return { totalInvested, annualIncome, monthlyIncome, quarterlyIncome, avgYield, projections }
  }, [holdings, drip, horizon])

  // Monthly breakdown by stock (for bar chart)
  const monthlyByHolding = holdings.map(h => ({
    ticker: h.ticker,
    monthly: (parseFloat(h.invested) || 0) * (parseFloat(h.yieldPct) / 100) / 12,
    freq: h.freq,
  }))

  const targetN = parseFloat(targetIncome) || 0
  const investedNeeded = totals.avgYield > 0 ? (targetN * 12 / (totals.avgYield / 100)) : 0
  const additionalNeeded = Math.max(0, investedNeeded - totals.totalInvested)

  const maxMonthly = Math.max(...monthlyByHolding.map(h => h.monthly), 1)

  const removeHolding = (id: string) => setHoldings(h => h.filter(x => x.id !== id))
  const updateHolding = (id: string, field: keyof Holding, val: string) =>
    setHoldings(h => h.map(x => x.id === id ? { ...x, [field]: val } : x))

  const addPreset = (p: typeof PRESET_STOCKS[0]) => {
    setHoldings(h => [...h, { id: uid(), ticker: p.ticker, name: p.name, invested: '5000', yieldPct: String(p.yield), freq: p.freq as 'M' | 'Q' | 'A' }])
    setShowPresets(false)
  }
  const addCustom = () => {
    if (!customTicker || !customYield || !customInvested) return
    setHoldings(h => [...h, { id: uid(), ticker: customTicker.toUpperCase(), name: customName || customTicker.toUpperCase(), invested: customInvested, yieldPct: customYield, freq: customFreq }])
    setCustomTicker(''); setCustomName(''); setCustomYield(''); setCustomInvested('')
  }

  const fmt = (n: number) => n >= 10000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(2)}`

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
            <IconDollar size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Dividend Income Planner</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Plan passive income from dividends. DRIP simulation.</div>
          </div>
        </div>
        <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showHowTo ? 'Hide' : 'How to use'}
        </button>
      </div>

      {showHowTo && (
        <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          Add dividend-paying stocks or ETFs with your investment amount and dividend yield. Toggle DRIP to see how reinvesting dividends compounds your income over time. Use the reverse calculator to find how much you need to invest for a target monthly income.
        </div>
      )}

      {/* Holdings list */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>HOLDINGS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {holdings.map(h => {
            const annual = (parseFloat(h.invested) || 0) * (parseFloat(h.yieldPct) / 100)
            return (
              <div key={h.id} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-3)', borderRadius: 8, padding: '8px 12px', flexWrap: 'wrap' }}>
                <span style={{ width: 48, fontWeight: 700, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{h.ticker}</span>
                <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>INVESTED</div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>$</span>
                      <input type="number" value={h.invested} onChange={e => updateHolding(h.id, 'invested', e.target.value)}
                        style={{ width: 80, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-0)', fontSize: 12, outline: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>YIELD %</div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input type="number" value={h.yieldPct} onChange={e => updateHolding(h.id, 'yieldPct', e.target.value)} step="0.1"
                        style={{ width: 60, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-0)', fontSize: 12, outline: 'none' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>FREQUENCY</div>
                    <select value={h.freq} onChange={e => updateHolding(h.id, 'freq', e.target.value as 'M' | 'Q' | 'A')}
                      style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-0)', fontSize: 12, outline: 'none' }}>
                      <option value="M">Monthly</option>
                      <option value="Q">Quarterly</option>
                      <option value="A">Annual</option>
                    </select>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-3)' }}>ANNUAL</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmt(annual)}</div>
                  </div>
                </div>
                <button onClick={() => removeHolding(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                  <IconClose size={14} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Add buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowPresets(p => !p)} style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, cursor: 'pointer', color: 'var(--green)', fontWeight: 600 }}>
            + Popular Dividend Stocks
          </button>
        </div>

        {showPresets && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {PRESET_STOCKS.filter(p => !holdings.some(h => h.ticker === p.ticker)).map(p => (
              <button key={p.ticker} onClick={() => addPreset(p)}
                style={{ padding: '6px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{p.ticker}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 6 }}>{p.yield}% · {p.freq === 'M' ? 'Monthly' : p.freq === 'Q' ? 'Quarterly' : 'Annual'}</span>
              </button>
            ))}
          </div>
        )}

        {/* Custom stock */}
        <div style={{ marginTop: 8, background: 'var(--bg-3)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>ADD CUSTOM STOCK</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { p: customTicker, sp: setCustomTicker, w: 70, placeholder: 'TICK', label: 'Ticker' },
              { p: customName, sp: setCustomName, w: 120, placeholder: 'Name', label: 'Name' },
              { p: customInvested, sp: setCustomInvested, w: 90, placeholder: '$5000', label: 'Invested' },
              { p: customYield, sp: setCustomYield, w: 60, placeholder: '4.5', label: 'Yield %' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>{f.label}</div>
                <input type={f.label === 'Ticker' || f.label === 'Name' ? 'text' : 'number'} value={f.p} onChange={e => f.sp(e.target.value)} placeholder={f.placeholder}
                  style={{ width: f.w, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', color: 'var(--text-0)', fontSize: 12, outline: 'none' }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>Frequency</div>
              <select value={customFreq} onChange={e => setCustomFreq(e.target.value as 'M' | 'Q' | 'A')}
                style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', color: 'var(--text-0)', fontSize: 12, outline: 'none' }}>
                <option value="M">Monthly</option><option value="Q">Quarterly</option><option value="A">Annual</option>
              </select>
            </div>
            <button onClick={addCustom} style={{ padding: '4px 12px', background: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#0a0a0c', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconPlus size={12} />Add
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Monthly Income', value: fmt(totals.monthlyIncome), color: 'var(--green)' },
          { label: 'Quarterly Income', value: fmt(totals.quarterlyIncome), color: 'var(--accent)' },
          { label: 'Annual Income', value: fmt(totals.annualIncome), color: 'var(--yellow)' },
          { label: 'Avg Yield', value: `${totals.avgYield.toFixed(2)}%`, color: 'var(--text-0)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Per-holding income bar chart */}
      {holdings.length > 0 && (
        <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>MONTHLY INCOME BY HOLDING</div>
          {monthlyByHolding.filter(h => h.monthly > 0).map(h => (
            <div key={h.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 40, fontSize: 10, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{h.ticker}</span>
              <div style={{ flex: 1, height: 8, background: 'var(--bg-1)', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${(h.monthly / maxMonthly) * 100}%`, background: h.freq === 'M' ? 'var(--green)' : h.freq === 'Q' ? 'var(--accent)' : 'var(--yellow)', borderRadius: 4 }} />
              </div>
              <span style={{ width: 50, fontSize: 10, fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--text-1)' }}>{fmt(h.monthly)}</span>
              <span style={{ fontSize: 9, color: 'var(--text-3)', width: 50 }}>{h.freq === 'M' ? 'Monthly' : h.freq === 'Q' ? 'Quarterly' : 'Annual'}</span>
            </div>
          ))}
        </div>
      )}

      {/* DRIP toggle + horizon */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={drip} onChange={e => setDrip(e.target.checked)} />
          <span style={{ color: drip ? 'var(--green)' : 'var(--text-2)', fontWeight: drip ? 700 : 400 }}>DRIP (Dividend Reinvestment)</span>
          <Tooltip text="DRIP automatically buys more shares with dividend income, compounding your returns." position="right" />
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([5, 10, 20] as const).map(h => (
            <button key={h} onClick={() => setHorizon(h)}
              style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${horizon === h ? 'var(--accent)' : 'var(--border)'}`, background: horizon === h ? 'var(--accent-dim)' : 'transparent', color: horizon === h ? 'var(--accent)' : 'var(--text-2)', fontSize: 11, cursor: 'pointer', fontWeight: horizon === h ? 700 : 400 }}>
              {h}yr
            </button>
          ))}
        </div>
      </div>

      {/* DRIP projection table */}
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
          {drip ? 'DRIP' : 'NO DRIP'} PROJECTION
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-3)' }}>
              {['Year', 'Balance', 'Annual Income', 'Total Earned'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {totals.projections.map(p => (
              <tr key={p.year} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--text-2)' }}>{p.year}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt(p.balance)}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--green)' }}>{fmt(p.income)}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{fmt(p.totalEarned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reverse calculator */}
      <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>REVERSE CALCULATOR — HOW MUCH TO INVEST?</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>I want</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--text-3)' }}>$</span>
            <input type="number" value={targetIncome} onChange={e => setTargetIncome(e.target.value)} placeholder="500"
              style={{ width: 80, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-0)', fontSize: 13, outline: 'none' }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>per month passive dividend income.</span>
        </div>
        {totals.avgYield > 0 && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--text-2)' }}>At your portfolio&apos;s average yield of </span>
            <strong style={{ color: 'var(--accent)' }}>{totals.avgYield.toFixed(2)}%</strong>
            <span style={{ color: 'var(--text-2)' }}>, you need </span>
            <strong style={{ color: 'var(--green)', fontSize: 14 }}>{fmt(investedNeeded)}</strong>
            <span style={{ color: 'var(--text-2)' }}> invested. </span>
            {additionalNeeded > 0 && (
              <span style={{ color: 'var(--yellow)' }}>You need {fmt(additionalNeeded)} more.</span>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Yields are approximate and change over time. Dividends can be cut. DRIP projection assumes constant yield. Not financial advice.</span>
      </div>
    </div>
  )
}
