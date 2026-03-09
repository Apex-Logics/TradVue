'use client'

import { useEffect, useState, useCallback } from 'react'
import Breadcrumbs from '../components/Breadcrumbs'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown'

interface Service {
  id: string
  name: string
  description: string
  status: ServiceStatus
  latencyMs?: number
  lastChecked?: Date
  detail?: string
}

const STATUS_CONFIG: Record<ServiceStatus, { emoji: string; label: string; color: string; bg: string }> = {
  operational: { emoji: '🟢', label: 'Operational',   color: '#22c55e', bg: 'rgba(34,197,94,0.08)'   },
  degraded:    { emoji: '🟡', label: 'Degraded',      color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  down:        { emoji: '🔴', label: 'Down',          color: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
  unknown:     { emoji: '⚪', label: 'Unknown',       color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

const INITIAL_SERVICES: Service[] = [
  { id: 'frontend',    name: 'Frontend',       description: 'Next.js app (Vercel)',      status: 'unknown' },
  { id: 'backend',     name: 'Backend API',    description: 'Express API server',        status: 'unknown' },
  { id: 'database',    name: 'Database',       description: 'Supabase PostgreSQL',       status: 'unknown' },
  { id: 'marketdata',  name: 'Market Data',    description: 'Finnhub real-time quotes',  status: 'unknown' },
  { id: 'newsfeed',    name: 'News Feed',      description: 'RSS aggregator feed',       status: 'unknown' },
]

async function checkWithTimeout(url: string, timeoutMs = 8000): Promise<{ ok: boolean; latencyMs: number; data?: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const t0 = Date.now()
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    const latencyMs = Date.now() - t0
    clearTimeout(timer)
    return { ok: res.ok, latencyMs, data: res.ok ? await res.json().catch(() => null) : undefined }
  } catch {
    clearTimeout(timer)
    return { ok: false, latencyMs: Date.now() - t0 }
  }
}

async function runChecks(): Promise<Service[]> {
  const now = new Date()

  // 1. Frontend — always green (the page loaded)
  const frontend: Service = {
    id: 'frontend',
    name: 'Frontend',
    description: 'Next.js app (Vercel)',
    status: 'operational',
    lastChecked: now,
    detail: 'Page loaded successfully',
  }

  // 2. Backend API — GET /health
  const backendResult = await checkWithTimeout(`${API_BASE}/health`)
  const backendStatus: ServiceStatus = backendResult.ok
    ? (backendResult.latencyMs > 3000 ? 'degraded' : 'operational')
    : 'down'
  const backend: Service = {
    id: 'backend',
    name: 'Backend API',
    description: 'Express API server',
    status: backendStatus,
    latencyMs: backendResult.latencyMs,
    lastChecked: now,
    detail: backendResult.ok ? `${backendResult.latencyMs}ms` : 'Health check failed',
  }

  // 3. Database — derived from backend /health response
  const healthData = backendResult.data as Record<string, unknown> | null
  let dbStatus: ServiceStatus = 'unknown'
  let dbDetail = 'No data from backend'
  if (!backendResult.ok) {
    dbStatus = 'unknown'
    dbDetail = 'Backend unreachable'
  } else if (healthData) {
    // If backend exposes db status, use it; otherwise infer from backend being up
    const raw = (healthData as Record<string, unknown>).database
    if (typeof raw === 'string') {
      dbStatus = raw === 'ok' || raw === 'connected' ? 'operational' : 'degraded'
      dbDetail = raw
    } else {
      // Backend is up → assume DB is reachable
      dbStatus = 'operational'
      dbDetail = 'Reported via backend health'
    }
  }
  const database: Service = {
    id: 'database',
    name: 'Database',
    description: 'Supabase PostgreSQL',
    status: dbStatus,
    lastChecked: now,
    detail: dbDetail,
  }

  // 4. Market Data — GET /api/market/quote/AAPL (or a lightweight health-style endpoint)
  const marketResult = await checkWithTimeout(`${API_BASE}/api/market/quote/AAPL`)
  const marketStatus: ServiceStatus = marketResult.ok
    ? (marketResult.latencyMs > 4000 ? 'degraded' : 'operational')
    : 'down'
  const marketdata: Service = {
    id: 'marketdata',
    name: 'Market Data',
    description: 'Finnhub real-time quotes',
    status: marketStatus,
    latencyMs: marketResult.latencyMs,
    lastChecked: now,
    detail: marketResult.ok ? `${marketResult.latencyMs}ms` : 'Quote fetch failed',
  }

  // 5. News Feed — GET /api/feed/news?limit=1
  const newsResult = await checkWithTimeout(`${API_BASE}/api/feed/news?limit=1`)
  const newsStatus: ServiceStatus = newsResult.ok
    ? (newsResult.latencyMs > 5000 ? 'degraded' : 'operational')
    : 'down'
  const newsfeed: Service = {
    id: 'newsfeed',
    name: 'News Feed',
    description: 'RSS aggregator feed',
    status: newsStatus,
    latencyMs: newsResult.latencyMs,
    lastChecked: now,
    detail: newsResult.ok ? `${newsResult.latencyMs}ms` : 'Feed unavailable',
  }

  return [frontend, backend, database, marketdata, newsfeed]
}

export default function StatusPage() {
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(30)

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = await runChecks()
    setServices(results)
    setLastRefresh(new Date())
    setLoading(false)
    setCountdown(30)
  }, [])

  // Initial check
  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-refresh every 30 s
  useEffect(() => {
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  // Countdown ticker
  useEffect(() => {
    if (loading) return
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1_000)
    return () => clearInterval(tick)
  }, [loading])

  const allOk = services.every(s => s.status === 'operational' || s.status === 'unknown')
  const anyDown = services.some(s => s.status === 'down')
  const overallStatus: ServiceStatus = loading
    ? 'unknown'
    : anyDown
    ? 'down'
    : services.some(s => s.status === 'degraded')
    ? 'degraded'
    : allOk
    ? 'operational'
    : 'unknown'

  const overall = STATUS_CONFIG[overallStatus]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-0, #0a0a0b)',
      color: 'var(--text-0, #f0f0f2)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '0 24px',
    }}>
      {/* ── Breadcrumbs ── */}
      <Breadcrumbs
        maxWidth="720px"
        items={[{ label: 'Home', href: '/' }, { label: 'System Status' }]}
      />

      {/* Header */}
      <header style={{
        maxWidth: '720px', margin: '0 auto',
        padding: '48px 0 32px',
        borderBottom: '1px solid var(--border, #1e1e24)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <a href="/landing" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-header.svg"
              alt="TradVue"
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            />
          </a>
          <span style={{ color: 'var(--text-3, #555)', fontSize: '14px' }}>/</span>
          <span style={{ fontSize: '14px', color: 'var(--text-2, #888)' }}>Status</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          System Status
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-2, #888)', margin: 0 }}>
          Real-time health of TradVue services
        </p>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 0 80px' }}>

        {/* Overall banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 20px',
          borderRadius: '12px',
          background: overall.bg,
          border: `1px solid ${overall.color}33`,
          marginBottom: '32px',
        }}>
          <span style={{ fontSize: '22px', lineHeight: 1 }}>{overall.emoji}</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: overall.color }}>
              {loading
                ? 'Checking services…'
                : overallStatus === 'operational'
                ? 'All systems operational'
                : overallStatus === 'degraded'
                ? 'Some systems experiencing issues'
                : overallStatus === 'down'
                ? 'One or more systems are down'
                : 'Checking services…'}
            </div>
            {lastRefresh && !loading && (
              <div style={{ fontSize: '12px', color: 'var(--text-3, #555)', marginTop: '2px' }}>
                Last checked: {lastRefresh.toLocaleTimeString()} · Refreshing in {countdown}s
              </div>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              marginLeft: 'auto',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border, #1e1e24)',
              background: 'var(--bg-2, #16161a)',
              color: 'var(--text-1, #c8c8d0)',
              fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Checking…' : '↻ Refresh'}
          </button>
        </div>

        {/* Service list */}
        <div style={{
          border: '1px solid var(--border, #1e1e24)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {services.map((svc, idx) => {
            const cfg = STATUS_CONFIG[svc.status]
            return (
              <div
                key={svc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px 20px',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border, #1e1e24)',
                  background: loading ? 'transparent' : cfg.bg + '55',
                  transition: 'background 0.3s',
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: loading ? '#333' : cfg.color,
                  flexShrink: 0,
                  boxShadow: loading ? 'none' : `0 0 6px ${cfg.color}88`,
                  transition: 'background 0.3s',
                }} />

                {/* Name + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-0, #f0f0f2)' }}>
                    {svc.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3, #555)', marginTop: '1px' }}>
                    {svc.description}
                    {svc.detail && !loading && (
                      <span style={{ marginLeft: '8px', color: 'var(--text-3, #555)' }}>· {svc.detail}</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', borderRadius: '20px',
                  background: loading ? 'var(--bg-2, #16161a)' : cfg.bg,
                  border: `1px solid ${loading ? '#1e1e24' : cfg.color + '44'}`,
                  flexShrink: 0,
                  transition: 'all 0.3s',
                }}>
                  <span style={{ fontSize: '11px' }}>{loading ? '⚪' : cfg.emoji}</span>
                  <span style={{
                    fontSize: '12px', fontWeight: 600,
                    color: loading ? 'var(--text-3, #555)' : cfg.color,
                  }}>
                    {loading ? 'Checking' : cfg.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Last updated */}
        {lastRefresh && (
          <p style={{ fontSize: '12px', color: 'var(--text-3, #555)', marginTop: '16px', textAlign: 'center' }}>
            Auto-refreshes every 30 seconds · Last updated {lastRefresh.toLocaleString()}
          </p>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        maxWidth: '720px', margin: '0 auto',
        padding: '24px 0 40px',
        borderTop: '1px solid var(--border, #1e1e24)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text-3, #555)', margin: 0 }}>
          © 2026 TradVue · <a href="/landing" style={{ color: 'var(--text-3, #555)', textDecoration: 'none' }}>Home</a>
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-3, #555)', margin: 0 }}>
          {overallStatus === 'operational'
            ? '🟢 All systems operational'
            : overallStatus === 'degraded'
            ? '🟡 Some systems experiencing issues'
            : overallStatus === 'down'
            ? '🔴 Service disruption detected'
            : '⚪ Checking status…'}
        </p>
      </footer>
    </div>
  )
}
