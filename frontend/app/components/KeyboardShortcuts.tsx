'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShortcutDef {
  keys: string
  description: string
  category: string
}

export const SHORTCUTS: ShortcutDef[] = [
  { keys: '/',       description: 'Focus search',         category: 'Navigation' },
  { keys: '⌘K',     description: 'Focus search',         category: 'Navigation' },
  { keys: 'Esc',    description: 'Close modal',           category: 'Navigation' },
  { keys: '?',      description: 'Show keyboard shortcuts', category: 'Navigation' },
  { keys: 'g h',    description: 'Go to Home',            category: 'Go To' },
  { keys: 'g a',    description: 'Go to Alerts',          category: 'Go To' },
  { keys: 'g s',    description: 'Open Settings',         category: 'Go To' },
  { keys: 'F',      description: 'Cycle chart size (modal open)', category: 'Chart' },
]

// ─── Help Modal ───────────────────────────────────────────────────────────────

function ShortcutsHelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const el = document.getElementById('kb-shortcuts-modal')
    el?.focus()
  }, [])

  const grouped = SHORTCUTS.reduce<Record<string, ShortcutDef[]>>((acc, s) => {
    ;(acc[s.category] ??= []).push(s)
    return acc
  }, {})

  return (
    <>
      <div
        className="kb-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="kb-shortcuts-modal"
        className="kb-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
      >
        <div className="kb-modal-header">
          <span className="kb-modal-title">⌨ Keyboard Shortcuts</span>
          <button className="kb-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="kb-modal-body">
          {Object.entries(grouped).map(([category, shortcuts]) => (
            <div key={category} className="kb-group">
              <div className="kb-group-label">{category}</div>
              {shortcuts.map((s) => (
                <div key={s.keys} className="kb-row">
                  <kbd className="kb-key">{s.keys}</kbd>
                  <span className="kb-desc">{s.description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="kb-modal-footer">
          Press <kbd className="kb-key kb-key-sm">?</kbd> or <kbd className="kb-key kb-key-sm">Esc</kbd> to dismiss
        </div>
      </div>

      <style>{`
        .kb-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(2px);
          z-index: 9000;
          animation: kbFadeIn 0.15s ease;
        }
        .kb-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 9001;
          background: #0f1117;
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 12px;
          width: min(480px, 92vw);
          box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.15);
          animation: kbSlideIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
          outline: none;
        }
        .kb-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .kb-modal-title {
          font-size: 15px;
          font-weight: 600;
          color: #e2e8f0;
          letter-spacing: 0.02em;
        }
        .kb-close-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 16px;
          padding: 2px 6px;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
          line-height: 1;
        }
        .kb-close-btn:hover {
          color: #e2e8f0;
          background: rgba(255,255,255,0.08);
        }
        .kb-modal-body {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .kb-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .kb-group-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6366f1;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(99,102,241,0.15);
        }
        .kb-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .kb-key {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 52px;
          padding: 3px 8px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-bottom-width: 2px;
          border-radius: 5px;
          font-family: ui-monospace, 'SFMono-Regular', monospace;
          font-size: 12px;
          color: #cbd5e1;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .kb-key-sm {
          min-width: unset;
          font-size: 11px;
          padding: 2px 6px;
        }
        .kb-desc {
          font-size: 13px;
          color: #94a3b8;
        }
        .kb-modal-footer {
          padding: 10px 20px 14px;
          font-size: 12px;
          color: #475569;
          border-top: 1px solid rgba(255,255,255,0.07);
          text-align: center;
        }
        @keyframes kbFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes kbSlideIn {
          from { opacity: 0; transform: translate(-50%, -52%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface KeyboardShortcutsProps {
  /** Called when the user triggers "focus search" (/ or Cmd+K) */
  onFocusSearch?: () => void
  /** Called when the user triggers "go to alerts" (g a) */
  onGoToAlerts?: () => void
  /** Called when the user triggers "go to home" (g h) */
  onGoToHome?: () => void
  /** Called when the user triggers "open settings" (g s) */
  onOpenSettings?: () => void
  /** Called when Escape is pressed (close modals etc.) */
  onEscape?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KeyboardShortcuts({
  onFocusSearch,
  onGoToAlerts,
  onGoToHome,
  onOpenSettings,
  onEscape,
}: KeyboardShortcutsProps) {
  const [helpOpen, setHelpOpen] = useState(false)

  // Track "g" prefix for two-key sequences (g h / g a / g s)
  const gPendingRef = useRef(false)
  const gTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeHelp = useCallback(() => setHelpOpen(false), [])

  useEffect(() => {
    function isTypingTarget(el: Element | null): boolean {
      if (!el) return false
      const tag = (el as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if ((el as HTMLElement).isContentEditable) return true
      return false
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as Element

      // ── Escape: always fires, even in inputs ─────────────────────────────
      if (e.key === 'Escape') {
        if (helpOpen) { setHelpOpen(false); return }
        onEscape?.()
        return
      }

      // ── Don't fire shortcuts when user is typing ─────────────────────────
      if (isTypingTarget(target)) return

      // ── Cmd+K / Ctrl+K — focus search ───────────────────────────────────
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onFocusSearch?.()
        return
      }

      // Ignore remaining shortcuts when modifier keys are held
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // ── "/" — focus search ───────────────────────────────────────────────
      if (e.key === '/') {
        e.preventDefault()
        onFocusSearch?.()
        return
      }

      // ── "?" — show help modal ────────────────────────────────────────────
      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(v => !v)
        return
      }

      // ── "g …" two-key sequences ──────────────────────────────────────────
      if (gPendingRef.current) {
        // Clear the pending timer
        if (gTimerRef.current) clearTimeout(gTimerRef.current)
        gPendingRef.current = false

        switch (e.key) {
          case 'h':
            e.preventDefault()
            onGoToHome?.()
            break
          case 'a':
            e.preventDefault()
            onGoToAlerts?.()
            break
          case 's':
            e.preventDefault()
            onOpenSettings?.()
            break
        }
        return
      }

      if (e.key === 'g') {
        gPendingRef.current = true
        // Auto-cancel the "g" prefix after 1 s of no follow-up
        gTimerRef.current = setTimeout(() => {
          gPendingRef.current = false
        }, 1000)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (gTimerRef.current) clearTimeout(gTimerRef.current)
    }
  }, [helpOpen, onFocusSearch, onGoToAlerts, onGoToHome, onOpenSettings, onEscape])

  if (!helpOpen) return null
  return <ShortcutsHelpModal onClose={closeHelp} />
}
