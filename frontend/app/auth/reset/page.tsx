'use client'

/**
 * Reset Password Page
 *
 * Supabase sends users here after clicking the reset link in their email.
 * URL contains: #access_token=...&refresh_token=...&type=recovery
 *
 * Flow:
 * 1. Parse hash fragment for access_token (type=recovery)
 * 2. Show set-new-password form
 * 3. Call backend /api/auth/reset with { token, newPassword }
 * 4. On success: redirect to home
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) {
      setStatus('error')
      setErrorMsg('No reset token found. The link may be invalid or expired.')
      return
    }

    const params = new URLSearchParams(hash)
    const token = params.get('access_token')
    const type = params.get('type')
    const errorCode = params.get('error_code')
    const errorDesc = params.get('error_description')

    if (errorCode || errorDesc) {
      setStatus('error')
      setErrorMsg(errorDesc?.replace(/\+/g, ' ') || 'The reset link is invalid or expired.')
      return
    }

    if (!token) {
      setStatus('error')
      setErrorMsg('Invalid reset link. Please request a new one.')
      return
    }

    if (type !== 'recovery') {
      setStatus('error')
      setErrorMsg('This link is not a password reset link.')
      return
    }

    setAccessToken(token)
    setStatus('form')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!password) { setFormError('Password is required'); return }
    if (password.length < 8) { setFormError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setFormError('Passwords do not match'); return }

    setSubmitting(true)
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com'
      const res = await fetch(`${API}/api/auth/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: accessToken, newPassword: password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = data.error || 'Failed to update password.'
        if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
          setStatus('error')
          setErrorMsg('This reset link has expired or is invalid. Please request a new one.')
        } else {
          setFormError(msg)
        }
        return
      }

      setStatus('success')
      setTimeout(() => router.replace('/'), 2500)
    } catch {
      setFormError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-0, #0f0f12)',
    fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    padding: '20px',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-2, #1a1a20)',
    border: '1px solid var(--border, rgba(255,255,255,0.08))',
    borderRadius: 12,
    padding: '40px 40px 36px',
    maxWidth: 400,
    width: '100%',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  }

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <div style={logoStyle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #3b82f6)" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-0, #e8e8f0)' }}>TradVue</span>
        </div>

        {status === 'loading' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid var(--border, rgba(255,255,255,0.08))',
              borderTopColor: 'var(--accent, #3b82f6)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: 'var(--text-2, #8888a0)', fontSize: 14, margin: 0 }}>Validating reset link…</p>
          </div>
        )}

        {status === 'form' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-0, #e8e8f0)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              Set New Password
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-2, #8888a0)', margin: '0 0 20px', lineHeight: 1.4 }}>
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {formError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 12px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 6,
                  color: '#ef4444',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label htmlFor="new-password" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-1, #c0c0d0)', letterSpacing: '0.03em' }}>
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                  autoFocus
                  style={{
                    padding: '9px 12px',
                    background: 'var(--bg-3, #1e1e26)',
                    border: '1px solid var(--border, rgba(255,255,255,0.08))',
                    borderRadius: 6,
                    color: 'var(--text-0, #e8e8f0)',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                    opacity: submitting ? 0.5 : 1,
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label htmlFor="confirm-password" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-1, #c0c0d0)', letterSpacing: '0.03em' }}>
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                  style={{
                    padding: '9px 12px',
                    background: 'var(--bg-3, #1e1e26)',
                    border: '1px solid var(--border, rgba(255,255,255,0.08))',
                    borderRadius: 6,
                    color: 'var(--text-0, #e8e8f0)',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                    opacity: submitting ? 0.5 : 1,
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '10px',
                  background: 'var(--accent, #3b82f6)',
                  color: '#fff',
                  borderRadius: 6,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  border: 'none',
                  opacity: submitting ? 0.65 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  minHeight: 40,
                  width: '100%',
                  transition: 'opacity 0.15s',
                }}
              >
                {submitting ? (
                  <span style={{
                    width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }} />
                ) : 'Update Password'}
              </button>
            </form>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <a href="/" style={{ fontSize: 12, color: 'var(--text-3, #606080)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                Back to TradVue
              </a>
            </div>
          </>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(0,192,106,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 24,
            }}>✓</div>
            <h2 style={{ color: '#00c06a', margin: '0 0 8px', fontSize: 18 }}>Password Updated!</h2>
            <p style={{ color: 'var(--text-2, #8888a0)', fontSize: 14, margin: 0 }}>
              Redirecting you back to TradVue…
            </p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2 style={{ color: '#ef4444', margin: '0 0 8px', fontSize: 18 }}>Link Invalid or Expired</h2>
            <p style={{ color: 'var(--text-2, #8888a0)', fontSize: 14, margin: '0 0 20px', lineHeight: 1.4 }}>
              {errorMsg}
            </p>
            <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: 'var(--accent, #3b82f6)',
                color: '#fff',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Back to TradVue
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
