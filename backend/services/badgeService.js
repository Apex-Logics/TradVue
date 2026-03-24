const crypto = require('crypto')

function canonicalize(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}'
  }
  return JSON.stringify(value)
}

function getOrCreateSigningKeyPair() {
  if (!global.__tradvueBadgeKeys) {
    global.__tradvueBadgeKeys = crypto.generateKeyPairSync('ed25519')
  }
  return global.__tradvueBadgeKeys
}

function getPrivateKey() {
  if (process.env.BADGE_PRIVATE_KEY) {
    return crypto.createPrivateKey(process.env.BADGE_PRIVATE_KEY)
  }
  return getOrCreateSigningKeyPair().privateKey
}

function getPublicKey() {
  if (process.env.BADGE_PUBLIC_KEY) {
    return crypto.createPublicKey(process.env.BADGE_PUBLIC_KEY)
  }
  return getOrCreateSigningKeyPair().publicKey
}

function signBadgePayload(payload) {
  const canonicalPayload = canonicalize(payload)
  const signature = crypto.sign(null, Buffer.from(canonicalPayload), getPrivateKey()).toString('base64')
  return { payload, signature, canonicalPayload }
}

function verifyBadgeSignature(payload, signature) {
  const canonicalPayload = canonicalize(payload)
  return crypto.verify(null, Buffer.from(canonicalPayload), getPublicKey(), Buffer.from(signature, 'base64'))
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(canonicalize(payload)).digest('hex').slice(0, 10)
}

function buildPeriodRange(input = {}) {
  if (input.period === 'monthly' && input.month) {
    const [year, month] = input.month.split('-').map(Number)
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 0))
    return {
      key: input.month,
      label: start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }
  }

  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return {
    key: start.toISOString().slice(0, 7),
    label: start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function normalizeDate(dateLike) {
  if (!dateLike) return ''
  return String(dateLike).slice(0, 10)
}

function isEligibleTrade(trade) {
  return ['csv', 'webhook'].includes(String(trade?.source || '').toLowerCase())
}

function aggregateEligibleTrades(trades, period) {
  const eligible = (Array.isArray(trades) ? trades : []).filter((trade) => {
    const date = normalizeDate(trade.date)
    return isEligibleTrade(trade) && date >= period.start && date <= period.end && Number.isFinite(Number(trade.pnl))
  })

  const netPnl = eligible.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0)
  const winners = eligible.filter((trade) => Number(trade.pnl || 0) > 0).length
  const winRate = eligible.length ? Number(((winners / eligible.length) * 100).toFixed(2)) : 0

  return {
    eligible,
    summary: {
      netPnl: Number(netPnl.toFixed(2)),
      winRate,
      tradeCount: eligible.length,
    },
  }
}

function renderBadgeSvg(badge) {
  const pnlColor = badge.netPnl >= 0 ? '#10b981' : '#ef4444'
  const pnlPrefix = badge.netPnl >= 0 ? '+' : '-'
  const pnlAbs = Math.abs(badge.netPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" rx="28" fill="#0f172a"/>
    <rect x="24" y="24" width="1152" height="582" rx="24" fill="#111827" stroke="#334155"/>
    <text x="70" y="90" fill="#a78bfa" font-family="Arial, sans-serif" font-size="28" font-weight="700">✓ VERIFIED BY TRADVUE</text>
    <text x="70" y="160" fill="#f8fafc" font-family="Arial, sans-serif" font-size="54" font-weight="800">${escapeXml(badge.traderDisplayName)}</text>
    <text x="70" y="215" fill="#94a3b8" font-family="Arial, sans-serif" font-size="28">${escapeXml(badge.periodLabel)}</text>

    <text x="70" y="320" fill="#94a3b8" font-family="Arial, sans-serif" font-size="24">Net P&amp;L</text>
    <text x="70" y="380" fill="${pnlColor}" font-family="Arial, sans-serif" font-size="64" font-weight="800">${pnlPrefix}$${pnlAbs}</text>

    <text x="70" y="465" fill="#94a3b8" font-family="Arial, sans-serif" font-size="24">Win Rate</text>
    <text x="70" y="515" fill="#f8fafc" font-family="Arial, sans-serif" font-size="40" font-weight="700">${badge.winRate}%</text>

    <text x="390" y="465" fill="#94a3b8" font-family="Arial, sans-serif" font-size="24">Trades</text>
    <text x="390" y="515" fill="#f8fafc" font-family="Arial, sans-serif" font-size="40" font-weight="700">${badge.tradeCount}</text>

    <text x="70" y="575" fill="#64748b" font-family="Arial, sans-serif" font-size="22">tradvue.com/verify/${badge.verifyHash}</text>
    <text x="815" y="575" fill="#64748b" font-family="Arial, sans-serif" font-size="20">Past performance is not financial advice.</text>
  </svg>`
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

module.exports = {
  canonicalize,
  signBadgePayload,
  verifyBadgeSignature,
  hashPayload,
  buildPeriodRange,
  aggregateEligibleTrades,
  renderBadgeSvg,
}
