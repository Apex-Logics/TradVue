'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  /** ms until auto-dismiss (default 5000) */
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType, duration?: number) => string
  dismissToast: (id: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 5000): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const toast: Toast = { id, message, type, duration }

      setToasts(prev => {
        // Cap at 5 visible toasts — remove oldest if needed
        const capped = prev.length >= 5 ? prev.slice(1) : prev
        return [...capped, toast]
      })

      if (duration > 0) {
        const timer = setTimeout(() => dismissToast(id), duration)
        timers.current.set(id, timer)
      }

      return id
    },
    [dismissToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
