/**
 * Auth Gating & AI Coach Toggle Tests
 *
 * Tests:
 * 1. AuthGate shows sign-in prompt for unauthenticated users
 * 2. Bottom promo bars hide when the user has a session
 * 3. AI Coach toggle persists to localStorage
 * 4. Account page renders all required sections
 * 5. Export and delete buttons are present
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { clearStoredAuth, persistStoredAuth } from '../app/utils/storageKeys'

// ─── localStorage mock ───────────────────────────────────────────────────────

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

const signedOutAuth = { user: null, token: null, loading: false }
const signedInAuth = {
  user: { id: 'user-1', email: 'test@tradvue.com' },
  token: 'access-123',
  loading: false,
}

jest.mock('../app/context/AuthContext', () => ({
  useAuth: jest.fn(() => signedOutAuth),
}))

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}))

// Minimal mock AuthModal (not testing the modal itself)
jest.mock('../app/components/AuthModal', () => {
  return function MockAuthModal({ onClose }: { onClose: () => void }) {
    return <div data-testid="auth-modal"><button onClick={onClose}>Close</button></div>
  }
})

import { useAuth } from '../app/context/AuthContext'
import { usePathname } from 'next/navigation'
import AuthGate from '../app/components/AuthGate'
import AppFooter from '../app/components/AppFooter'
import FeaturesShowcase from '../app/components/FeaturesShowcase'

const mockUseAuth = useAuth as jest.Mock
const mockUsePathname = usePathname as jest.Mock

describe('AuthGate', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(signedOutAuth)
  })

  it('shows the current sample-data signup prompt', () => {
    render(
      <AuthGate featureName="Trade Playbooks">
        <div>Protected content</div>
      </AuthGate>
    )
    expect(screen.getByText(/You're viewing sample data\./i)).toBeInTheDocument()
    expect(screen.getByText(/start tracking your own trades/i)).toBeInTheDocument()
  })

  it('shows Sign Up Free and Sign In buttons', () => {
    render(
      <AuthGate featureName="AI Coach">
        <div>Protected content</div>
      </AuthGate>
    )
    expect(screen.getByRole('button', { name: /sign up free/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('opens AuthModal when signup CTA is clicked', () => {
    render(
      <AuthGate featureName="Rule Cop">
        <div>Protected content</div>
      </AuthGate>
    )
    fireEvent.click(screen.getByRole('button', { name: /sign up free/i }))
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument()
  })

  it('renders children behind the banner', () => {
    render(
      <AuthGate featureName="Prop Firm Tracker">
        <div data-testid="bg-content">Background</div>
      </AuthGate>
    )
    expect(screen.getByTestId('bg-content')).toBeInTheDocument()
  })

  it('hides the sticky signup bar when the user is signed in', () => {
    mockUseAuth.mockReturnValue(signedInAuth)
    render(
      <AuthGate featureName="Trading Journal">
        <div data-testid="bg-content">Background</div>
      </AuthGate>
    )
    expect(screen.getByTestId('bg-content')).toBeInTheDocument()
    expect(screen.queryByText(/You're viewing sample data\./i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign up free/i })).not.toBeInTheDocument()
  })
})

describe('guest promo bars', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(signedOutAuth)
    mockUsePathname.mockReturnValue('/')
  })

  it('shows the footer promo bar for signed-out visitors', () => {
    render(<AppFooter />)
    expect(screen.getByText(/Best Trading Journal/i)).toBeInTheDocument()
    expect(screen.getByText(/Help & Support/i)).toBeInTheDocument()
  })

  it('hides the footer promo bar when the user is signed in', () => {
    mockUseAuth.mockReturnValue(signedInAuth)
    render(<AppFooter />)
    expect(screen.queryByText(/Best Trading Journal/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Help & Support/i)).not.toBeInTheDocument()
  })

  it('shows the dashboard feature promo for signed-out visitors', () => {
    render(<FeaturesShowcase />)
    expect(screen.getByRole('heading', { name: /Everything You Need to Trade Smarter/i })).toBeInTheDocument()
  })

  it('hides the dashboard feature promo when the user is signed in', () => {
    mockUseAuth.mockReturnValue(signedInAuth)
    render(<FeaturesShowcase />)
    expect(screen.queryByRole('heading', { name: /Everything You Need to Trade Smarter/i })).not.toBeInTheDocument()
  })
})

// ─── SettingsContext: AI Coach toggle ─────────────────────────────────────────

import { SettingsProvider, useSettings } from '../app/context/SettingsContext'

function AICoachToggleConsumer() {
  const { settings, setAiCoachEnabled } = useSettings()
  return (
    <div>
      <span data-testid="ai-status">{settings.aiCoachEnabled ? 'enabled' : 'disabled'}</span>
      <button onClick={() => setAiCoachEnabled(false)}>Disable AI Coach</button>
      <button onClick={() => setAiCoachEnabled(true)}>Enable AI Coach</button>
    </div>
  )
}

describe('storageKeys auth helpers', () => {
  beforeEach(() => localStorageMock.clear())

  it('clears access token, user, and refresh token on logout cleanup', () => {
    persistStoredAuth('access-123', { email: 'test@tradvue.com' }, 'refresh-456')

    expect(localStorageMock.getItem('cg_token')).toBe('access-123')
    expect(localStorageMock.getItem('cg_user')).toContain('test@tradvue.com')
    expect(localStorageMock.getItem('cg_refresh_token')).toBe('refresh-456')

    clearStoredAuth()

    expect(localStorageMock.getItem('cg_token')).toBeNull()
    expect(localStorageMock.getItem('cg_user')).toBeNull()
    expect(localStorageMock.getItem('cg_refresh_token')).toBeNull()
  })
})

describe('SettingsContext: aiCoachEnabled', () => {
  beforeEach(() => localStorageMock.clear())

  it('defaults to true', () => {
    render(
      <SettingsProvider>
        <AICoachToggleConsumer />
      </SettingsProvider>
    )
    expect(screen.getByTestId('ai-status')).toHaveTextContent('enabled')
  })

  it('can be disabled', () => {
    render(
      <SettingsProvider>
        <AICoachToggleConsumer />
      </SettingsProvider>
    )
    fireEvent.click(screen.getByText('Disable AI Coach'))
    expect(screen.getByTestId('ai-status')).toHaveTextContent('disabled')
  })

  it('persists to localStorage when toggled', () => {
    render(
      <SettingsProvider>
        <AICoachToggleConsumer />
      </SettingsProvider>
    )
    fireEvent.click(screen.getByText('Disable AI Coach'))
    const stored = JSON.parse(localStorageMock.getItem('cg_settings') || '{}')
    expect(stored.aiCoachEnabled).toBe(false)
  })

  it('can be re-enabled', () => {
    render(
      <SettingsProvider>
        <AICoachToggleConsumer />
      </SettingsProvider>
    )
    fireEvent.click(screen.getByText('Disable AI Coach'))
    fireEvent.click(screen.getByText('Enable AI Coach'))
    expect(screen.getByTestId('ai-status')).toHaveTextContent('enabled')
  })
})
