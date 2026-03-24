import type { Metadata } from 'next'

async function getBadge(hash: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'https://tradvue-api.onrender.com'
  try {
    const res = await fetch(`${apiBase}/api/verify/${hash}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }): Promise<Metadata> {
  const { hash } = await params
  const data = await getBadge(hash)
  if (!data?.badge) return { title: 'Badge not found — TradVue Verify' }
  const badge = data.badge
  const pnlPrefix = badge.netPnl >= 0 ? '+' : '-'
  return {
    title: `Verified: ${pnlPrefix}$${Math.abs(badge.netPnl).toLocaleString()} in ${badge.periodLabel} — TradVue`,
    description: `TradVue verified performance badge for ${badge.traderDisplayName}. ${badge.winRate}% win rate across ${badge.tradeCount} trades.`,
    openGraph: {
      title: `Verified: ${pnlPrefix}$${Math.abs(badge.netPnl).toLocaleString()} in ${badge.periodLabel}`,
      description: `Verified by TradVue · ${badge.winRate}% win rate · ${badge.tradeCount} trades`,
      url: `https://www.tradvue.com/verify/${hash}`,
      type: 'website',
    },
  }
}

export default async function VerifyBadgePage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  const data = await getBadge(hash)
  const badge = data?.badge
  const valid = data?.valid

  if (!badge) return <div style={{ padding: 40, color: '#e5e7eb' }}>Badge not found.</div>

  return (
    <main style={{ minHeight: '100vh', background: '#0f172a', color: '#e5e7eb', padding: '48px 20px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: valid ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${valid ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, color: valid ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 13 }}>
          {valid ? '✓ Signature verified by TradVue' : 'Invalid or inactive badge'}
        </div>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: '18px 0 10px', color: '#f8fafc' }}>{badge.traderDisplayName}&apos;s verified performance</h1>
        <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 28 }}>Summary only — no private trade log, account size, or broker credentials are exposed.</p>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 26 }}>
          <StatCard label="Period" value={badge.periodLabel} />
          <StatCard label="Net P&L" value={`${badge.netPnl >= 0 ? '+' : '-'}$${Math.abs(badge.netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} accent={badge.netPnl >= 0 ? '#10b981' : '#ef4444'} />
          <StatCard label="Win Rate" value={`${badge.winRate}%`} />
          <StatCard label="Trades" value={String(badge.tradeCount)} />
        </section>
        <section style={{ padding: 20, borderRadius: 18, background: '#111827', border: '1px solid rgba(148,163,184,0.18)', marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', marginBottom: 12 }}>How verification works</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', lineHeight: 1.8, fontSize: 14 }}>
            <li>Only CSV-imported or auto-synced/webhook trades are included.</li>
            <li>Manual journal entries are excluded from verified badges.</li>
            <li>The badge payload is cryptographically signed by TradVue.</li>
            <li>Any future tampering breaks signature verification.</li>
          </ul>
        </section>
        <section style={{ padding: 20, borderRadius: 18, background: '#111827', border: '1px solid rgba(148,163,184,0.18)' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 8 }}>Verification hash</div>
          <code style={{ color: '#e2e8f0', fontSize: 15 }}>{hash}</code>
          <p style={{ marginTop: 16, color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>Want your own verified badge? Start free, import real trades, and generate a signed performance snapshot you can share anywhere. Past performance does not guarantee future results and is not financial advice.</p>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ padding: 18, borderRadius: 16, background: '#111827', border: '1px solid rgba(148,163,184,0.18)' }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || '#f8fafc' }}>{value}</div>
    </div>
  )
}
