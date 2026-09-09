import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

jest.mock('../app/utils/analytics', () => ({
  trackLogout: jest.fn(),
}))

const initFullSyncMock = jest.fn()
const hydrateWatchlistFromApiMock = jest.fn(async (_token: string) => ({ symbols: [] as string[], entries: [] as { id: number; symbol: string }[] }))

jest.mock('../app/utils/cloudSync', () => ({
  initFullSync: (...args: unknown[]) => initFullSyncMock(...args),
  hydrateWatchlistFromApi: (token: string) => hydrateWatchlistFromApiMock(token),
  getSyncStatus: () => ({ state: 'idle' }),
  subscribeSyncStatus: () => () => {},
  resetJournalPullGate: jest.fn(),
}))

const apiGetMeMock = jest.fn()
const apiGetMeResultMock = jest.fn()
const apiRefreshMock = jest.fn()
const apiLoginMock = jest.fn()

jest.mock('../app/lib/api', () => {
  const actual = jest.requireActual('../app/lib/api')
  return {
    ...actual,
    apiGetMe: (...args: unknown[]) => apiGetMeMock(...args),
    apiGetMeResult: (...args: unknown[]) => apiGetMeResultMock(...args),
    apiRefresh: (...args: unknown[]) => apiRefreshMock(...args),
    apiLogin: (...args: unknown[]) => apiLoginMock(...args),
  }
})

import { AuthProvider, useAuth } from '../app/context/AuthContext'
import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../app/utils/storageKeys'

function AuthStateProbe() {
  const { user, token, loading } = useAuth()
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="token">{token ?? 'none'}</div>
      <div data-testid="email">{user?.email ?? 'none'}</div>
    </div>
  )
}

describe('AuthContext persistence hydration', () => {
  beforeEach(() => {
    localStorageMock.clear()
    initFullSyncMock.mockClear()
    hydrateWatchlistFromApiMock.mockClear()
    hydrateWatchlistFromApiMock.mockResolvedValue({ symbols: [], entries: [] })
    apiGetMeMock.mockReset()
    apiGetMeResultMock.mockReset()
    apiRefreshMock.mockReset()
    apiLoginMock.mockReset()
    apiRefreshMock.mockResolvedValue({ session: null, user: null, error: 'Invalid or expired refresh token' })
  })

  it('hydrates immediately when token and user are already stored', async () => {
    localStorageMock.setItem(AUTH_TOKEN_KEY, 'stored-token')
    localStorageMock.setItem(AUTH_USER_KEY, JSON.stringify({
      id: 'user-1',
      email: 'stored@tradvue.com',
      name: 'Stored User',
      email_verified: true,
      created_at: '2026-03-24T00:00:00.000Z',
      tier: 'free',
    }))

    // Background /api/auth/me refresh is fire-and-forget so tier/admin
    // changes land without blocking first paint of stored credentials.
    // Keep the promise pending until after the ready-paint assertions, then
    // settle it so Jest is not left with an open handle.
    let resolveMe: (value: unknown) => void = () => {}
    apiGetMeResultMock.mockImplementation(
      () => new Promise(resolve => { resolveMe = resolve })
    )

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    expect(screen.getByTestId('token')).toHaveTextContent('stored-token')
    expect(screen.getByTestId('email')).toHaveTextContent('stored@tradvue.com')
    expect(apiGetMeResultMock).toHaveBeenCalledWith('stored-token')
    expect(initFullSyncMock).toHaveBeenCalledWith('stored-token')
    await waitFor(() => expect(hydrateWatchlistFromApiMock).toHaveBeenCalledWith('stored-token'))
    await act(async () => {
      resolveMe({
        ok: true,
        user: {
          id: 'user-1',
          email: 'stored@tradvue.com',
          name: 'Stored User',
          email_verified: true,
          created_at: '2026-03-24T00:00:00.000Z',
          tier: 'free',
        },
      })
    })
  })

  it('rehydrates user from /api/auth/me when only token is stored', async () => {
    localStorageMock.setItem(AUTH_TOKEN_KEY, 'callback-token')
    localStorageMock.setItem(AUTH_REFRESH_TOKEN_KEY, 'refresh-token')
    apiGetMeResultMock.mockResolvedValue({
      ok: true,
      user: {
        id: 'user-2',
        email: 'callback@tradvue.com',
        name: 'Callback User',
        email_verified: true,
        created_at: '2026-03-24T00:00:00.000Z',
        tier: 'free',
      },
    })

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    expect(apiGetMeResultMock).toHaveBeenCalledWith('callback-token')
    expect(screen.getByTestId('token')).toHaveTextContent('callback-token')
    expect(screen.getByTestId('email')).toHaveTextContent('callback@tradvue.com')
    expect(localStorageMock.getItem(AUTH_USER_KEY)).toContain('callback@tradvue.com')
    expect(localStorageMock.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe('refresh-token')
    expect(initFullSyncMock).toHaveBeenCalledWith('callback-token')
    await waitFor(() => expect(hydrateWatchlistFromApiMock).toHaveBeenCalledWith('callback-token'))
  })

  const storedUser = {
    id: 'user-1',
    email: 'stored@tradvue.com',
    name: 'Stored User',
    email_verified: true,
    created_at: '2026-03-24T00:00:00.000Z',
    tier: 'free' as const,
  }

  function seedStoredSession() {
    localStorageMock.setItem(AUTH_TOKEN_KEY, 'stale-token')
    localStorageMock.setItem(AUTH_REFRESH_TOKEN_KEY, 'refresh-token')
    localStorageMock.setItem(AUTH_USER_KEY, JSON.stringify(storedUser))
  }

  it('refreshes a stale access token on hydrate and re-runs full sync', async () => {
    seedStoredSession()
    apiGetMeResultMock.mockResolvedValue({ ok: false, reason: 'auth' })
    apiRefreshMock.mockResolvedValue({
      session: {
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh',
        expires_in: 3600,
        token_type: 'bearer',
      },
      user: { ...storedUser, email: 'stored@tradvue.com' },
    })

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('fresh-token'))
    expect(apiRefreshMock).toHaveBeenCalledWith('refresh-token')
    expect(initFullSyncMock).toHaveBeenCalledWith('stale-token')
    expect(initFullSyncMock).toHaveBeenCalledWith('fresh-token')
    expect(screen.getByTestId('email')).toHaveTextContent('stored@tradvue.com')
  })

  it('clears a zombie signed-in session when /me is unauthorized and refresh fails', async () => {
    seedStoredSession()
    apiGetMeResultMock.mockResolvedValue({ ok: false, reason: 'auth' })
    apiRefreshMock.mockResolvedValue({ session: null, user: null, error: 'Invalid or expired refresh token' })

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('none'))
    expect(screen.getByTestId('email')).toHaveTextContent('none')
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(localStorageMock.getItem(AUTH_USER_KEY)).toBeNull()
    expect(localStorageMock.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull()
  })

  it('clears hydrate when only a stale token is stored and refresh is impossible', async () => {
    localStorageMock.setItem(AUTH_TOKEN_KEY, 'stale-token')
    apiGetMeResultMock.mockResolvedValue({ ok: false, reason: 'auth' })

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    expect(screen.getByTestId('token')).toHaveTextContent('none')
    expect(screen.getByTestId('email')).toHaveTextContent('none')
    expect(apiRefreshMock).not.toHaveBeenCalled()
    expect(initFullSyncMock).not.toHaveBeenCalled()
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('keeps a stored session when /me fails for a non-auth reason and refresh is unavailable', async () => {
    seedStoredSession()
    apiGetMeResultMock.mockResolvedValue({ ok: false, reason: 'error' })

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    await waitFor(() => expect(apiGetMeResultMock).toHaveBeenCalled())
    expect(screen.getByTestId('token')).toHaveTextContent('stale-token')
    expect(screen.getByTestId('email')).toHaveTextContent('stored@tradvue.com')
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBe('stale-token')
  })

  it('does not clear a fresh login when a prior hydrate /me comes back unauthorized', async () => {
    let releaseMe: (value: { ok: false; reason: 'auth' }) => void = () => {}
    const meGate = new Promise<{ ok: false; reason: 'auth' }>(resolve => {
      releaseMe = resolve
    })
    apiGetMeResultMock.mockImplementation(() => meGate)

    const freshUser = { ...storedUser, email: 'erick@tradvue.com' }
    apiLoginMock.mockResolvedValue({
      session: {
        access_token: 'fresh-login-token',
        refresh_token: 'fresh-login-rt',
        expires_in: 3600,
        token_type: 'bearer',
      },
      user: freshUser,
    })

    seedStoredSession()

    function LoginProbe() {
      const { token, user, login } = useAuth()
      return (
        <div>
          <div data-testid="token">{token ?? 'none'}</div>
          <div data-testid="email">{user?.email ?? 'none'}</div>
          <button type="button" onClick={() => { void login('erick@tradvue.com', 'password123') }}>
            do-login
          </button>
        </div>
      )
    }

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('stale-token'))
    await act(async () => {
      screen.getByRole('button', { name: 'do-login' }).click()
    })
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('fresh-login-token'))
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBe('fresh-login-token')

    await act(async () => {
      releaseMe({ ok: false, reason: 'auth' })
    })

    await waitFor(() => expect(apiGetMeResultMock).toHaveBeenCalled())
    expect(screen.getByTestId('token')).toHaveTextContent('fresh-login-token')
    expect(screen.getByTestId('email')).toHaveTextContent('erick@tradvue.com')
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBe('fresh-login-token')
    expect(localStorageMock.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe('fresh-login-rt')
  })
})
