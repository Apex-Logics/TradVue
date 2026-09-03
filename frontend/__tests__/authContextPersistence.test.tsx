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

jest.mock('../app/utils/cloudSync', () => ({
  initFullSync: (...args: unknown[]) => initFullSyncMock(...args),
  getSyncStatus: () => ({ state: 'idle' }),
  subscribeSyncStatus: () => () => {},
}))

const apiGetMeMock = jest.fn()
const apiGetWatchlistMock = jest.fn().mockResolvedValue({ watchlist: [] })

jest.mock('../app/lib/api', () => {
  const actual = jest.requireActual('../app/lib/api')
  return {
    ...actual,
    apiGetMe: (...args: unknown[]) => apiGetMeMock(...args),
    apiGetWatchlist: (...args: unknown[]) => apiGetWatchlistMock(...args),
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
    apiGetMeMock.mockReset()
    apiGetWatchlistMock.mockClear()
    apiGetWatchlistMock.mockResolvedValue({ watchlist: [] })
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
    apiGetMeMock.mockImplementation(
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
    expect(apiGetMeMock).toHaveBeenCalledWith('stored-token')
    expect(initFullSyncMock).toHaveBeenCalledWith('stored-token')
    await act(async () => {
      resolveMe({
        id: 'user-1',
        email: 'stored@tradvue.com',
        name: 'Stored User',
        email_verified: true,
        created_at: '2026-03-24T00:00:00.000Z',
        tier: 'free',
      })
    })
  })

  it('rehydrates user from /api/auth/me when only token is stored', async () => {
    localStorageMock.setItem(AUTH_TOKEN_KEY, 'callback-token')
    localStorageMock.setItem(AUTH_REFRESH_TOKEN_KEY, 'refresh-token')
    apiGetMeMock.mockResolvedValue({
      id: 'user-2',
      email: 'callback@tradvue.com',
      name: 'Callback User',
      email_verified: true,
      created_at: '2026-03-24T00:00:00.000Z',
      tier: 'free',
    })

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    expect(apiGetMeMock).toHaveBeenCalledWith('callback-token')
    expect(screen.getByTestId('token')).toHaveTextContent('callback-token')
    expect(screen.getByTestId('email')).toHaveTextContent('callback@tradvue.com')
    expect(localStorageMock.getItem(AUTH_USER_KEY)).toContain('callback@tradvue.com')
    expect(localStorageMock.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe('refresh-token')
    expect(initFullSyncMock).toHaveBeenCalledWith('callback-token')
  })
})
