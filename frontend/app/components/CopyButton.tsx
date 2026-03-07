'use client'

import { useState, useCallback } from 'react'

// ─── Icons ────────────────────────────────────────────────────────────────────

const ClipboardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="2" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface CopyButtonProps {
  /** The text to copy to clipboard */
  text: string
  /** Optional label shown in tooltip. Defaults to "Copy" */
  label?: string
  /** Extra className for the button */
  className?: string
  /** Reset delay in ms. Defaults to 2000 */
  resetDelay?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CopyButton({
  text,
  label = 'Copy',
  className = '',
  resetDelay = 2000,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (copied) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), resetDelay)
    } catch {
      // Fallback for older browsers / non-secure contexts
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), resetDelay)
    }
  }, [text, copied, resetDelay])

  return (
    <div className="copy-button-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied!' : label}
        title={copied ? 'Copied!' : label}
        className={`copy-button ${copied ? 'copy-button--copied' : ''} ${className}`}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '4px',
          border:         '1px solid',
          borderColor:    copied ? '#22c55e' : 'rgba(255,255,255,0.15)',
          borderRadius:   '6px',
          background:     copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
          color:          copied ? '#22c55e' : 'rgba(255,255,255,0.5)',
          cursor:         copied ? 'default' : 'pointer',
          transition:     'color 0.15s, border-color 0.15s, background 0.15s',
          lineHeight:     1,
        }}
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </button>

      {/* Tooltip rendered via CSS title attribute — also supports custom hover label */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position:  'absolute',
          bottom:    'calc(100% + 6px)',
          left:      '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize:  '11px',
          padding:   '3px 7px',
          borderRadius: '4px',
          background: copied ? '#22c55e' : 'rgba(30,30,30,0.9)',
          color:     '#fff',
          pointerEvents: 'none',
          opacity:   copied ? 1 : 0,
          transition: 'opacity 0.15s',
          zIndex:    50,
        }}
      >
        {copied ? 'Copied!' : label}
      </span>
    </div>
  )
}
