'use client'

import { useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com'

interface Announcement {
  id: string
  message: string
  type: 'info' | 'warning' | 'success'
  expires_at: string | null
  created_at: string
}

const COLORS = {
  info:    { bg: 'rgba(74,158,255,0.12)', border: 'rgba(74,158,255,0.35)', text: '#4a9eff', icon: 'info' },
  warning: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', text: '#f97316', icon: 'warn' },
  success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', text: '#22c55e', icon: 'check' },
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/announcements`)
      .then(r => r.json())
      .then(({ announcement: a }) => {
        if (!a) return
        // Check if already dismissed
        try {
          const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]')
          if (dismissed.includes(a.id)) return
        } catch {}
        setAnnouncement(a)
      })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    if (!announcement) return
    try {
      const existing = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]')
      existing.push(announcement.id)
      localStorage.setItem('dismissed_announcements', JSON.stringify(existing.slice(-20)))
    } catch {}
    setDismissed(true)
  }

  if (!announcement || dismissed) return null

  const c = COLORS[announcement.type] || COLORS.info

  return (
    <div style={{
      background: c.bg,
      borderBottom: `1px solid ${c.border}`,
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      position: 'relative',
      zIndex: 100,
      fontSize: 14,
      color: c.text,
    }}>
      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
        {c.icon === 'warn' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        ) : c.icon === 'check' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </span>
      <span style={{ color: 'var(--text-0)', flex: 1, textAlign: 'center' }}>{announcement.message}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-2)', padding: '2px 6px', borderRadius: 4, fontSize: 16,
          lineHeight: 1, flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
