'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { trackLogin, trackSignup } from '../utils/analytics'

type Mode = 'login' | 'register' | 'reset'

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
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
    setSuccessMessage(null)

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    const result = mode === 'login'
      ? await login(email.trim(), password)
      : await register(email.trim(), password)

    setLoading(false)

    if (result.error) {
      // Friendly rate-limit message
      const errLower = result.error.toLowerCase()
      if (errLower.includes('30 seconds') || errLower.includes('rate') || errLower.includes('too many') || errLower.includes('wait')) {
        setError('Too many attempts. Please wait before trying again.')
      } else {
        setError(result.error)
      }
      return
    }

    if ('needsConfirmation' in result && result.needsConfirmation) {
      // Signup successful but needs email verification
      trackSignup('free')
      setSuccessMessage(
        'Account created! Check your email for a verification link. CHECK YOUR SPAM/JUNK FOLDER — new domain emails often land there. Mark it "Not Spam" to receive future emails in your inbox.'
      )
      return
    }

    // Fully logged in
    if (mode === 'login') {
      trackLogin()
    } else {
      trackSignup('free')
    }
    onSuccess?.()
    onClose()
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError(null)
    setSuccessMessage(null)
    setConfirmPassword('')
    setResetSent(false)
  }

  const goToReset = () => {
    setMode('reset')
    setError(null)
    setSuccessMessage(null)
    setResetSent(false)
  }

  const backToLogin = () => {
    setMode('login')
    setError(null)
    setResetSent(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) { setError('Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return }

    setResetLoading(true)
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com'
      await fetch(`${API}/api/auth/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      // Always show success — don't leak whether email exists
      setResetSent(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setResetLoading(false)
    }
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
            TradVue
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Title */}
        <div className="auth-modal-title">
          <h2>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset Password'}</h2>
          <p className="auth-modal-subtitle">
            {mode === 'login'
              ? 'Sign in to sync your watchlist and preferences'
              : mode === 'register'
              ? 'Start tracking markets with a free account'
              : 'Enter your email to receive a password reset link'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'reset' ? handleResetPassword : handleSubmit} className="auth-form">
          {successMessage && (
            <div className="auth-success" role="status" style={{
              background: 'rgba(0,192,106,0.12)',
              border: '1px solid rgba(0,192,106,0.35)',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 13,
              color: '#00c06a',
              lineHeight: 1.4,
            }}>
              ✓ {successMessage}
              <button
                type="button"
                disabled={resending || resendSuccess}
                onClick={async () => {
                  setResending(true)
                  setResendSuccess(false)
                  try {
                    const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com'
                    const res = await fetch(`${API}/api/auth/resend-verification`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: email.trim().toLowerCase() }),
                    })
                    if (res.ok) {
                      setResendSuccess(true)
                    } else {
                      const d = await res.json().catch(() => ({}))
                      setError(d.error || 'Failed to resend. Try again in a moment.')
                    }
                  } catch {
                    setError('Network error — please try again.')
                  } finally {
                    setResending(false)
                  }
                }}
                style={{
                  display: 'block',
                  marginTop: 8,
                  background: resendSuccess ? 'rgba(0,192,106,0.25)' : 'rgba(74,158,255,0.15)',
                  border: `1px solid ${resendSuccess ? 'rgba(0,192,106,0.4)' : 'rgba(74,158,255,0.35)'}`,
                  borderRadius: 4,
                  padding: '6px 12px',
                  fontSize: 12,
                  color: resendSuccess ? '#00c06a' : '#4a9eff',
                  cursor: resending || resendSuccess ? 'default' : 'pointer',
                  opacity: resending ? 0.6 : 1,
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                {resendSuccess ? '✓ Verification email resent!' : resending ? 'Resending...' : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>Resend Verification Email</>
                )}
              </button>
            </div>
          )}
          {error && mode !== 'reset' && (
            <div className="auth-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>{error}
            </div>
          )}

          {mode === 'reset' && (
            <>
              {resetSent ? (
                <div style={{
                  background: 'rgba(0,192,106,0.12)',
                  border: '1px solid rgba(0,192,106,0.35)',
                  borderRadius: 6,
                  padding: '14px 16px',
                  fontSize: 13,
                  color: '#00c06a',
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>📬</div>
                  If an account exists, we sent a reset link to <strong>{email}</strong>.
                  <br />Check your inbox and spam folder.
                </div>
              ) : (
                <>
                  {error && (
                    <div className="auth-error" role="alert">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>{error}
                    </div>
                  )}
                  <div className="auth-field">
                    <label htmlFor="reset-email">Email</label>
                    <input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      disabled={resetLoading}
                      className="auth-input"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className={`auth-submit-btn${resetLoading ? ' auth-submit-loading' : ''}`}
                    disabled={resetLoading}
                  >
                    {resetLoading ? <span className="auth-spinner" /> : 'Send Reset Link'}
                  </button>
                </>
              )}
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={backToLogin}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-3)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  ← Back to login
                </button>
              </div>
            </>
          )}

          {mode !== 'reset' && !successMessage && (
            <>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="auth-password">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={goToReset}
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-3)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
            </>
          )}
        </form>

        {/* Footer */}
        {mode !== 'reset' && (
          <div className="auth-modal-footer">
            <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
            <button className="auth-switch-btn" onClick={switchMode} disabled={loading}>
              {mode === 'login' ? 'Create one free' : 'Sign in'}
            </button>
          </div>
        )}

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
