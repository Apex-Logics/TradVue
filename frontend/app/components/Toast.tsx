'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast, type Toast as ToastItem, type ToastType } from '../context/ToastContext'

// ─── Icons ────────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
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
        {ICONS[toast.type]}
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
