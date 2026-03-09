'use client'

import { useEffect, useRef } from 'react'

interface Props {
  onDone: () => void
}

// Lightweight pure-CSS confetti + "You're all set!" overlay
export default function Celebration({ onDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-dismiss after 3.5 seconds
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])

  // Generate confetti pieces
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1}s`,
    duration: `${1.5 + Math.random() * 1.5}s`,
    color: ['#00c06a', '#4a9eff', '#f0a500', '#ff4560', '#a78bfa', '#34d399'][i % 6],
    size: `${6 + Math.random() * 8}px`,
    rotate: `${Math.random() * 360}deg`,
  }))

  return (
    <div
      ref={containerRef}
      className="celebration-overlay"
      role="status"
      aria-live="polite"
      aria-label="Onboarding complete!"
      onClick={onDone}
    >
      {/* Confetti */}
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            background: p.color,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotate})`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Center message */}
      <div className="celebration-card">
        <div className="celebration-check" aria-hidden="true">✓</div>
        <h2 className="celebration-heading">You're all set!</h2>
        <p className="celebration-sub">
          Your trading dashboard is ready.<br />
          We'll ping you when things move.
        </p>
        <button className="celebration-btn" onClick={onDone}>
          Explore TradVue
        </button>
      </div>
    </div>
  )
}
