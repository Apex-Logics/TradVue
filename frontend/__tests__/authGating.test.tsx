/**
 * Auth Gating & AI Coach Toggle Tests
 *
 * Tests:
 * 1. AuthGate shows sign-in prompt for unauthenticated users
 * 2. AI Coach toggle persists to localStorage
 * 3. Account page renders all required sections
 * 4. Export and delete buttons are present
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

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

// ─── Auth Gate ────────────────────────────────────────────────────────────────

// Minimal mock AuthModal (not testing the modal itself)
jest.mock('../app/components/AuthModal', () => {
  return function MockAuthModal({ onClose }: { onClose: () => void }) {
    return <div data-testid="auth-modal"><button onClick={onClose}>Close</button></div>
  }
})

import AuthGate from '../app/components/AuthGate'

describe('AuthGate', () => {
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
