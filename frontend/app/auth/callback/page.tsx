'use client'

/**
 * Auth Callback Page
 *
 * Handles Supabase email verification redirects.
 * Supabase sends users to: https://www.tradvue.com/#access_token=...&refresh_token=...
 *
 * The Supabase JS client (when present) auto-detects this hash fragment.
 * This page handles it manually since we use a custom backend auth flow.
 *
 * Flow:
 * 1. Parse hash fragment for access_token + refresh_token
 * 2. Store tokens in localStorage (same keys as AuthContext)
 * 3. Redirect to dashboard with a success toast param
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY } from '../../utils/storageKeys'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Verifying your email…')

  useEffect(() => {
    // Parse the URL hash fragment (e.g. #access_token=...&refresh_token=...&type=signup)
    const hash = window.location.hash.slice(1) // remove leading '#'
    if (!hash) {
      setStatus('error')
      setMessage('No auth token found. The link may be invalid or expired.')
      return
    }

    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const tokenType = params.get('type') // 'signup', 'recovery', etc.
    const errorCode = params.get('error_code')
    const errorDesc = params.get('error_description')

    // Handle error params from Supabase
    if (errorCode || errorDesc) {
      setStatus('error')
      setMessage(errorDesc?.replace(/\+/g, ' ') || 'Verification failed. Please try again.')
      return
    }

    if (!accessToken) {
      setStatus('error')
      setMessage('Invalid verification link. Please request a new one.')
      return
    }

    try {
      // Store in localStorage under the same keys AuthContext uses
      // (cg_ prefix = legacy ChartGenius prefix kept for backwards compat)
      localStorage.setItem(AUTH_TOKEN_KEY, accessToken)
      if (refreshToken) {
        localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken)
      }

      setStatus('success')

      // Redirect to dashboard after short delay so user sees success message
      const redirectTarget = tokenType === 'recovery' ? '/?reset=1' : '/?verified=1'
      setTimeout(() => {
        router.replace(redirectTarget)
      }, 1500)
    } catch {
      setStatus('error')
      setMessage('Failed to save session. Please try logging in manually.')
    }
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-0, #0f0f12)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      <div style={{
        background: 'var(--bg-1, #16161a)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: 12,
        padding: '40px 48px',
        maxWidth: 400,
        width: '90vw',
        textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #3b82f6)" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-0, #e8e8f0)' }}>TradVue</span>
        </div>

        {status === 'processing' && (
          <>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid var(--border, rgba(255,255,255,0.08))',
              borderTopColor: 'var(--accent, #3b82f6)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: 'var(--text-1, #c0c0d0)', fontSize: 15, margin: 0 }}>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(0,192,106,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 24,
            }}>✓</div>
            <h2 style={{ color: '#00c06a', margin: '0 0 8px', fontSize: 18 }}>Email Verified!</h2>
            <p style={{ color: 'var(--text-2, #8888a0)', fontSize: 14, margin: 0 }}>
              Redirecting you to the dashboard…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 24,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2 style={{ color: '#ef4444', margin: '0 0 8px', fontSize: 18 }}>Verification Failed</h2>
            <p style={{ color: 'var(--text-2, #8888a0)', fontSize: 14, margin: '0 0 20px' }}>{message}</p>
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
          </>
        )}
      </div>
    </div>
  )
}
