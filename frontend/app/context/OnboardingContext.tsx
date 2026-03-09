'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string
  label: string
  description: string
  done: boolean
}

export interface OnboardingState {
  welcomeShown: boolean
  checklistDismissed: boolean
  checklistCollapsed: boolean
  tooltipsSeen: string[]
  visitCount: number
  firstVisitDate: string | null
  celebrationShown: boolean
  checklist: {
    addSymbol: boolean
    setAlert: boolean
    customizeTicker: boolean
    enableNotifications: boolean
    completeProfile: boolean
  }
}

interface OnboardingContextValue {
  state: OnboardingState
  showWelcome: boolean
  checklistItems: ChecklistItem[]
  completedCount: number
  isChecklistComplete: boolean
  canDismissChecklist: boolean
  markWelcomeSeen: () => void
  markChecklistItem: (id: keyof OnboardingState['checklist']) => void
  dismissChecklist: () => void
  toggleChecklistCollapsed: () => void
  markTooltipSeen: (id: string) => void
  hasSeenTooltip: (id: string) => boolean
  shouldShowTooltips: boolean
  markCelebrationShown: () => void
}

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT_STATE: OnboardingState = {
  welcomeShown: false,
  checklistDismissed: false,
  checklistCollapsed: false,
  tooltipsSeen: [],
  visitCount: 0,
  firstVisitDate: null,
  celebrationShown: false,
  checklist: {
    addSymbol: false,
    setAlert: false,
    customizeTicker: false,
    enableNotifications: false,
    completeProfile: false,
  },
}

const STORAGE_KEY = 'cg_onboarding' // cg_ = legacy prefix from ChartGenius era (now TradVue); kept to avoid breaking existing user data

function loadState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

// ─── Checklist Definitions ────────────────────────────────────────────────────

const CHECKLIST_DEFS = [
  { id: 'addSymbol',          label: 'Add your first symbol',         description: 'Search and add a stock to your watchlist' },
  { id: 'setAlert',           label: 'Set a price alert',             description: 'Get notified when a stock moves' },
  { id: 'customizeTicker',    label: 'Customize your ticker bar',     description: 'Add symbols to your personal ticker' },
  { id: 'enableNotifications',label: 'Enable notifications',          description: 'Never miss a market move' },
  { id: 'completeProfile',    label: 'Complete your profile',         description: 'Sign in to sync your data across devices' },
]

// ─── Context ──────────────────────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const loaded = loadState()
    const updated = {
      ...loaded,
      visitCount: loaded.visitCount + 1,
      firstVisitDate: loaded.firstVisitDate || new Date().toISOString(),
    }
    setState(updated)
    saveState(updated)
    setHydrated(true)
  }, [])

  const update = useCallback((patch: Partial<OnboardingState>) => {
    setState(prev => {
      const next = { ...prev, ...patch }
      saveState(next)
      return next
    })
  }, [])

  const markWelcomeSeen = useCallback(() => {
    update({ welcomeShown: true })
  }, [update])

  const markChecklistItem = useCallback((id: keyof OnboardingState['checklist']) => {
    setState(prev => {
      const next = {
        ...prev,
        checklist: { ...prev.checklist, [id]: true },
      }
      saveState(next)
      return next
    })
  }, [])

  const dismissChecklist = useCallback(() => {
    update({ checklistDismissed: true })
  }, [update])

  const toggleChecklistCollapsed = useCallback(() => {
    setState(prev => {
      const next = { ...prev, checklistCollapsed: !prev.checklistCollapsed }
      saveState(next)
      return next
    })
  }, [])

  const markTooltipSeen = useCallback((id: string) => {
    setState(prev => {
      if (prev.tooltipsSeen.includes(id)) return prev
      const next = { ...prev, tooltipsSeen: [...prev.tooltipsSeen, id] }
      saveState(next)
      return next
    })
  }, [])

  const hasSeenTooltip = useCallback((id: string) => {
    return state.tooltipsSeen.includes(id)
  }, [state.tooltipsSeen])

  const markCelebrationShown = useCallback(() => {
    update({ celebrationShown: true })
  }, [update])

  // Derived
  const completedCount = Object.values(state.checklist).filter(Boolean).length
  const isChecklistComplete = completedCount === 5
  const canDismissChecklist = completedCount >= 3

  const checklistItems: ChecklistItem[] = CHECKLIST_DEFS.map(def => ({
    ...def,
    done: state.checklist[def.id as keyof OnboardingState['checklist']],
  }))

  // Show welcome only on first visit (welcomeShown = false) and after hydration
  const showWelcome = hydrated && !state.welcomeShown

  // Show tooltips only for first 5 visits
  const shouldShowTooltips = hydrated && state.visitCount <= 5

  return (
    <OnboardingContext.Provider value={{
      state,
      showWelcome,
      checklistItems,
      completedCount,
      isChecklistComplete,
      canDismissChecklist,
      markWelcomeSeen,
      markChecklistItem,
      dismissChecklist,
      toggleChecklistCollapsed,
      markTooltipSeen,
      hasSeenTooltip,
      shouldShowTooltips,
      markCelebrationShown,
    }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}
