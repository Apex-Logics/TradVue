'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register'

interface AuthModalProps {
  onClose: () => void
  onSuccess?: () => void
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  // Focus email on mount
  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  // Escape key closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const validate = (): string | null => {
    if (!email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address'
    if (!password) return 'Password is required'
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (mode === 'register' && password !== confirmPassword) return 'Passwords do not match'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    const result = mode === 'login'
      ? await login(email.trim(), password)
      : await register(email.trim(), password)

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      onSuccess?.()
      onClose()
    }
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError(null)
    setConfirmPassword('')
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label={mode === 'login' ? 'Sign In' : 'Create Account'}>
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-modal-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18" />
            </svg>
            ChartGenius
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Title */}
        <div className="auth-modal-title">
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-modal-subtitle">
            {mode === 'login'
              ? 'Sign in to sync your watchlist and preferences'
              : 'Start tracking markets with a free account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error" role="alert">
              <span>⚠</span> {error}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              ref={emailRef}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={loading}
              className="auth-input"
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="auth-confirm">Confirm Password</label>
              <input
                id="auth-confirm"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
                className="auth-input"
              />
            </div>
          )}

          <button
            type="submit"
            className={`auth-submit-btn${loading ? ' auth-submit-loading' : ''}`}
            disabled={loading}
          >
            {loading
              ? <span className="auth-spinner" />
              : mode === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>

        {/* Footer */}
        <div className="auth-modal-footer">
          <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
          <button className="auth-switch-btn" onClick={switchMode} disabled={loading}>
            {mode === 'login' ? 'Create one free' : 'Sign in'}
          </button>
        </div>

        {/* Features */}
        {mode === 'register' && (
          <div className="auth-features">
            {['Sync watchlist across devices', 'Save custom settings', 'Enable price alerts'].map(f => (
              <div key={f} className="auth-feature-item">
                <span className="auth-feature-check">✓</span> {f}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
