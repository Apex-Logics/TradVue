/**
 * Onboarding Context — Unit Tests
 * TDD approach: tests define the expected behavior, implementation must satisfy them.
 */

import React from 'react'
import { render, act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Lightweight localStorage mock ───────────────────────────────────────────

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

// ─── Import after mocking ─────────────────────────────────────────────────────

import { OnboardingProvider, useOnboarding, OnboardingState } from '../app/context/OnboardingContext'

// Helper test consumer
function TestConsumer({ action }: { action?: (ctx: ReturnType<typeof useOnboarding>) => void }) {
  const ctx = useOnboarding()
  return (
    <div>
      <span data-testid="welcome-shown">{String(ctx.state.welcomeShown)}</span>
      <span data-testid="completed-count">{ctx.completedCount}</span>
      <span data-testid="can-dismiss">{String(ctx.canDismissChecklist)}</span>
      <span data-testid="is-complete">{String(ctx.isChecklistComplete)}</span>
      <span data-testid="visit-count">{ctx.state.visitCount}</span>
      <span data-testid="checklist-dismissed">{String(ctx.state.checklistDismissed)}</span>
      <button data-testid="btn-mark-welcome" onClick={() => ctx.markWelcomeSeen()} />
      <button data-testid="btn-mark-symbol" onClick={() => ctx.markChecklistItem('addSymbol')} />
      <button data-testid="btn-mark-alert" onClick={() => ctx.markChecklistItem('setAlert')} />
      <button data-testid="btn-mark-ticker" onClick={() => ctx.markChecklistItem('customizeTicker')} />
      <button data-testid="btn-mark-notif" onClick={() => ctx.markChecklistItem('enableNotifications')} />
      <button data-testid="btn-mark-profile" onClick={() => ctx.markChecklistItem('completeProfile')} />
      <button data-testid="btn-dismiss" onClick={() => ctx.dismissChecklist()} />
      <button data-testid="btn-tooltip" onClick={() => ctx.markTooltipSeen('test-tip')} />
      <span data-testid="tooltip-seen">{String(ctx.hasSeenTooltip('test-tip'))}</span>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <OnboardingProvider>
      <TestConsumer />
    </OnboardingProvider>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OnboardingContext', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('starts with welcomeShown = false on first visit', () => {
    renderWithProvider()
    expect(screen.getByTestId('welcome-shown').textContent).toBe('false')
  })

  it('increments visitCount on each mount', () => {
    renderWithProvider()
    // First visit = count 1
    expect(screen.getByTestId('visit-count').textContent).toBe('1')
  })

  it('markWelcomeSeen sets welcomeShown to true', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-mark-welcome'))
    expect(screen.getByTestId('welcome-shown').textContent).toBe('true')
  })

  it('starts with completedCount = 0', () => {
    renderWithProvider()
    expect(screen.getByTestId('completed-count').textContent).toBe('0')
  })

  it('increments completedCount when checklist items are marked', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-mark-symbol'))
    expect(screen.getByTestId('completed-count').textContent).toBe('1')
    await user.click(screen.getByTestId('btn-mark-alert'))
    expect(screen.getByTestId('completed-count').textContent).toBe('2')
  })

  it('cannot dismiss checklist when fewer than 3 items done', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    expect(screen.getByTestId('can-dismiss').textContent).toBe('false')
    await user.click(screen.getByTestId('btn-mark-symbol'))
    await user.click(screen.getByTestId('btn-mark-alert'))
    expect(screen.getByTestId('can-dismiss').textContent).toBe('false')
  })

  it('can dismiss checklist when 3+ items done', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-mark-symbol'))
    await user.click(screen.getByTestId('btn-mark-alert'))
    await user.click(screen.getByTestId('btn-mark-ticker'))
    expect(screen.getByTestId('can-dismiss').textContent).toBe('true')
  })

  it('dismissing checklist persists state', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-mark-symbol'))
    await user.click(screen.getByTestId('btn-mark-alert'))
    await user.click(screen.getByTestId('btn-mark-ticker'))
    await user.click(screen.getByTestId('btn-dismiss'))
    expect(screen.getByTestId('checklist-dismissed').textContent).toBe('true')
  })

  it('isChecklistComplete is false with 4 items', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-mark-symbol'))
    await user.click(screen.getByTestId('btn-mark-alert'))
    await user.click(screen.getByTestId('btn-mark-ticker'))
    await user.click(screen.getByTestId('btn-mark-notif'))
    expect(screen.getByTestId('is-complete').textContent).toBe('false')
    expect(screen.getByTestId('completed-count').textContent).toBe('4')
  })

  it('isChecklistComplete is true with all 5 items', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-mark-symbol'))
    await user.click(screen.getByTestId('btn-mark-alert'))
    await user.click(screen.getByTestId('btn-mark-ticker'))
    await user.click(screen.getByTestId('btn-mark-notif'))
    await user.click(screen.getByTestId('btn-mark-profile'))
    expect(screen.getByTestId('is-complete').textContent).toBe('true')
    expect(screen.getByTestId('completed-count').textContent).toBe('5')
  })

  it('marking same item twice does not increase count', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-mark-symbol'))
    await user.click(screen.getByTestId('btn-mark-symbol'))
    expect(screen.getByTestId('completed-count').textContent).toBe('1')
  })

  it('hasSeenTooltip returns false initially', () => {
    renderWithProvider()
    expect(screen.getByTestId('tooltip-seen').textContent).toBe('false')
  })

  it('markTooltipSeen marks tooltip as seen', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-tooltip'))
    expect(screen.getByTestId('tooltip-seen').textContent).toBe('true')
  })

  it('persists state to localStorage', async () => {
    renderWithProvider()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-mark-welcome'))
    await user.click(screen.getByTestId('btn-mark-symbol'))

    const saved = JSON.parse(localStorageMock.getItem('cg_onboarding') || '{}')
    expect(saved.welcomeShown).toBe(true)
    expect(saved.checklist.addSymbol).toBe(true)
  })

  it('loads persisted state from localStorage', () => {
    // Pre-seed localStorage
    const seeded: Partial<OnboardingState> = {
      welcomeShown: true,
      checklist: {
        addSymbol: true,
        setAlert: true,
        customizeTicker: false,
        enableNotifications: false,
        completeProfile: false,
      },
      checklistDismissed: false,
      checklistCollapsed: false,
      tooltipsSeen: ['test-tip'],
      visitCount: 3,
      firstVisitDate: '2026-01-01T00:00:00.000Z',
      celebrationShown: false,
    }
    localStorageMock.setItem('cg_onboarding', JSON.stringify(seeded))

    renderWithProvider()
    expect(screen.getByTestId('welcome-shown').textContent).toBe('true')
    expect(screen.getByTestId('completed-count').textContent).toBe('2')
    expect(screen.getByTestId('tooltip-seen').textContent).toBe('true')
  })

  it('marks add-symbol complete and dismisses overlay when holdings already exist', () => {
    localStorageMock.setItem('cg_portfolio_holdings', JSON.stringify([
      { ticker: 'AAPL', shares: 10, avgCost: 180 },
      { ticker: 'MSFT', shares: 4, avgCost: 400 },
    ]))
    localStorageMock.setItem('cg_token', 'jwt-from-qa-user')

    renderWithProvider()
    expect(screen.getByTestId('completed-count').textContent).not.toBe('0')
    expect(screen.getByTestId('checklist-dismissed').textContent).toBe('true')
    expect(screen.getByTestId('welcome-shown').textContent).toBe('true')
  })
})
