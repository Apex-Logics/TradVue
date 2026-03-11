'use client'
import { useState, useMemo, useEffect } from 'react'
import Tooltip from '../components/Tooltip'
import { IconInfo, IconTarget } from '../components/Icons'

const STORAGE_KEY = 'cg_position_sizer'

type AssetClass = 'Stock' | 'Futures' | 'Forex' | 'Crypto'

const ASSET_TIPS: Record<AssetClass, string> = {
  Stock: 'Position size = dollar risk ÷ (entry − stop). Use shares.',
  Futures: 'Size in contracts. Each contract has a multiplier. Margin varies by broker.',
  Forex: 'Size in lots. 1 standard lot = 100,000 units. Use micro lots (0.01) to start.',
  Crypto: 'Size in coins or fractions. High volatility means smaller position sizes.',
}

const ASSET_UNITS: Record<AssetClass, string> = {
  Stock: 'shares', Futures: 'contracts', Forex: 'lots', Crypto: 'coins'
}

export default function PositionSizer() {
  const [account, setAccount] = useState('10000')
  const [riskPct, setRiskPct] = useState(2)
  const [entry, setEntry] = useState('150')
  const [stop, setStop] = useState('145')
  const [asset, setAsset] = useState<AssetClass>('Stock')
  const [contractMultiplier, setContractMultiplier] = useState('50')
  const [showHowTo, setShowHowTo] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (s.account) setAccount(s.account)
      if (s.riskPct) setRiskPct(s.riskPct)
      if (s.entry) setEntry(s.entry)
      if (s.stop) setStop(s.stop)
      if (s.asset) setAsset(s.asset)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ account, riskPct, entry, stop, asset })) } catch {}
  }, [account, riskPct, entry, stop, asset])

  const acctN = parseFloat(account) || 0
  const entryN = parseFloat(entry) || 0
  const stopN = parseFloat(stop) || 0
  const multiplier = asset === 'Futures' ? (parseFloat(contractMultiplier) || 1) : 1

  const riskDollar = acctN * (riskPct / 100)
  const stopDistance = Math.abs(entryN - stopN)
  const positionSize = stopDistance > 0
    ? (asset === 'Futures' ? riskDollar / (stopDistance * multiplier) : riskDollar / stopDistance)
    : 0
  const positionValue = asset === 'Futures'
    ? positionSize * entryN * multiplier
    : positionSize * entryN
  const buyingPowerUsed = acctN > 0 ? (positionValue / acctN) * 100 : 0

  // Quick scenarios
  const scenarios = [0.5, 1, 1.5, 2, 3].map(r => {
    const dr = acctN * (r / 100)
    const ps = stopDistance > 0
      ? (asset === 'Futures' ? dr / (stopDistance * multiplier) : dr / stopDistance)
      : 0
    return { risk: r, size: ps }
  })

  const fmt = (n: number, d = 0) => isNaN(n) || !isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  const fmtD = (n: number) => `$${fmt(n, 2)}`

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <IconTarget size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Universal Position Sizer</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Stocks, Futures, Forex, Crypto — risk-based sizing</div>
          </div>
        </div>
        <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showHowTo ? 'Hide' : 'How to use'}
        </button>
      </div>

      {showHowTo && (
        <div style={{ background: 'var(--accent-dim)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          Enter your account balance, the % you want to risk, entry price, and stop loss price. The calculator tells you exactly how many shares/contracts/lots to buy to keep your risk at that exact dollar amount. Most professional traders risk 1–2% per trade.
        </div>
      )}

      {/* Asset class tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['Stock', 'Futures', 'Forex', 'Crypto'] as AssetClass[]).map(a => (
          <button key={a} onClick={() => setAsset(a)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${asset === a ? 'var(--accent)' : 'var(--border)'}`, background: asset === a ? 'var(--accent-dim)' : 'transparent', color: asset === a ? 'var(--accent)' : 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontWeight: asset === a ? 700 : 400 }}>
            {a}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16, padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 6 }}>
        {ASSET_TIPS[asset]}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          {/* Account balance */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Account Balance <Tooltip text="Your total trading capital." position="right" />
            </label>
            <input type="number" value={account} onChange={e => setAccount(e.target.value)} placeholder="10000" step="1000"
              style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Risk % slider */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Risk Per Trade <Tooltip text="The % of your account you're willing to lose if the stop is hit. Most pros use 1–2%." position="right" /></span>
              <span style={{ fontSize: 14, fontWeight: 800, color: riskPct <= 2 ? 'var(--green)' : riskPct <= 3 ? 'var(--yellow)' : 'var(--red)', fontFamily: 'var(--mono)' }}>{riskPct}%</span>
            </label>
            <input type="range" min="0.5" max="10" step="0.5" value={riskPct} onChange={e => setRiskPct(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: riskPct <= 2 ? 'var(--green)' : riskPct <= 3 ? 'var(--yellow)' : 'var(--red)', cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
              <span>0.5% (Conservative)</span><span>5%</span><span>10% (Aggressive)</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>
              {riskPct <= 1 ? 'Conservative — professional standard' : riskPct <= 2 ? 'Moderate — suitable for most traders' : riskPct <= 3 ? 'Elevated — experienced traders only' : 'High — significant ruin risk'}
            </div>
          </div>

          {/* Entry + Stop */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Entry Price <Tooltip text="Your planned entry price." position="right" />
            </label>
            <input type="number" value={entry} onChange={e => setEntry(e.target.value)} placeholder="150.00" step="any"
              style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Stop Loss Price <Tooltip text="Where you'll exit to limit losses. Set this BEFORE entering." position="right" />
            </label>
            <input type="number" value={stop} onChange={e => setStop(e.target.value)} placeholder="145.00" step="any"
              style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {asset === 'Futures' && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Contract Multiplier <Tooltip text="Dollar value per point. ES=50, NQ=20, YM=5, CL=1000, GC=100." position="right" />
              </label>
              <input type="number" value={contractMultiplier} onChange={e => setContractMultiplier(e.target.value)} placeholder="50" step="any"
                style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        <div>
          {/* Main result */}
          <div style={{ background: 'var(--accent-dim)', borderRadius: 12, padding: 20, marginBottom: 12, textAlign: 'center', border: '1px solid rgba(74,158,255,0.3)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Position Size</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--accent)', lineHeight: 1 }}>
              {positionSize > 0 ? (asset === 'Stock' ? Math.floor(positionSize).toLocaleString() : positionSize.toFixed(asset === 'Forex' ? 2 : 1)) : '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{ASSET_UNITS[asset]}</div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
              at {riskPct}% risk = {fmtD(riskDollar)} max loss
            </div>
          </div>

          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>BREAKDOWN</div>
            {[
              { label: 'Dollar at Risk', value: fmtD(riskDollar), color: 'var(--red)', tip: 'Maximum loss if stop hit.' },
              { label: 'Stop Distance', value: stopDistance > 0 ? fmtD(stopDistance) : '—', tip: 'Distance between entry and stop.' },
              { label: 'Position Value', value: positionValue > 0 ? fmtD(positionValue) : '—', tip: 'Total dollar exposure.' },
              { label: 'Buying Power Used', value: buyingPowerUsed > 0 ? `${buyingPowerUsed.toFixed(1)}%` : '—', color: buyingPowerUsed > 100 ? 'var(--red)' : 'var(--text-0)', tip: 'Position value as % of account.' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {r.label}<Tooltip text={r.tip} position="right" />
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: r.color || 'var(--text-0)' }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Buying power bar */}
          {buyingPowerUsed > 0 && (
            <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>BUYING POWER USAGE</div>
              <div style={{ height: 8, background: 'var(--bg-1)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, buyingPowerUsed)}%`, background: buyingPowerUsed > 100 ? 'var(--red)' : buyingPowerUsed > 50 ? 'var(--yellow)' : 'var(--green)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>{buyingPowerUsed.toFixed(1)}% of account value</div>
            </div>
          )}
        </div>
      </div>

      {/* Quick scenarios table */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>QUICK RISK SCENARIOS</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-3)' }}>
                {['Risk %', 'Dollar Risk', 'Position Size', 'Position Value'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => (
                <tr key={s.risk} style={{ borderBottom: '1px solid var(--border)', background: s.risk === riskPct ? 'var(--bg-3)' : undefined }}>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: s.risk === riskPct ? 700 : 400, color: s.risk <= 2 ? 'var(--green)' : s.risk <= 3 ? 'var(--yellow)' : 'var(--red)' }}>{s.risk}%</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtD(acctN * s.risk / 100)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: s.risk === riskPct ? 700 : 400, color: s.risk === riskPct ? 'var(--accent)' : 'var(--text-0)' }}>
                    {s.size > 0 ? (asset === 'Stock' ? Math.floor(s.size).toLocaleString() : s.size.toFixed(2)) : '—'} {ASSET_UNITS[asset]}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    {s.size > 0 ? fmtD(asset === 'Futures' ? s.size * entryN * (parseFloat(contractMultiplier) || 1) : s.size * entryN) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Rule of thumb: Most professionals risk 1–2% per trade. At 2% risk, it takes 50 consecutive full losses to wipe an account.</span>
      </div>
    </div>
  )
}
