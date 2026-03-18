'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast, type Toast as ToastItem, type ToastType } from '../context/ToastContext'

// ─── Icons ────────────────────────────────────────────────────────────────────

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'success') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
  if (type === 'error') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
  if (type === 'warning') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

const LABELS: Record<ToastType, string> = {
  success: 'Success',
  error:   'Error',
  warning: 'Warning',
  info:    'Info',
}

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  // Trigger slide-in after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => onDismiss(toast.id), 300) // wait for slide-out
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`toast toast--${toast.type} ${visible ? 'toast--visible' : ''}`}
    >
      <span className="toast__icon" aria-label={LABELS[toast.type]}>
        <ToastIcon type={toast.type} />
      </span>
      <span className="toast__message">{toast.message}</span>
      <button
        className="toast__close"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  )
}

// ─── Toast Container ──────────────────────────────────────────────────────────

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  return (
    <div
      className="toast-container"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}
