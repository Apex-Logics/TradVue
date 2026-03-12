'use client'

import { useEffect, useState } from 'react'
import { useOnboarding } from '../context/OnboardingContext'
import Celebration from './Celebration'

export default function OnboardingChecklist() {
  const {
    state,
    checklistItems,
    completedCount,
    isChecklistComplete,
    canDismissChecklist,
    dismissChecklist,
    toggleChecklistCollapsed,
    markCelebrationShown,
  } = useOnboarding()

  const [showCelebration, setShowCelebration] = useState(false)

  // Show celebration when all 5 done (once)
  useEffect(() => {
    if (isChecklistComplete && !state.celebrationShown) {
      setShowCelebration(true)
    }
  }, [isChecklistComplete, state.celebrationShown])

  const handleCelebrationDone = () => {
    setShowCelebration(false)
    markCelebrationShown()
  }

  // Don't render if dismissed, or if welcome hasn't been shown yet, or all done + celebration seen
  if (state.checklistDismissed) return null
  if (!state.welcomeShown) return null

  const progress = (completedCount / 5) * 100

  return (
    <>
      {showCelebration && <Celebration onDone={handleCelebrationDone} />}

      <div
        className={`onboarding-checklist${state.checklistCollapsed ? ' checklist-collapsed' : ''}`}
        role="region"
        aria-label="Onboarding checklist"
      >
        {/* Header */}
        <div className="checklist-header" onClick={toggleChecklistCollapsed}>
          <div className="checklist-header-left">
            <svg className="checklist-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <span className="checklist-title">Getting Started</span>
            <span className="checklist-progress-badge">{completedCount}/5</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              className="checklist-toggle"
              aria-label={state.checklistCollapsed ? 'Expand checklist' : 'Collapse checklist'}
              onClick={e => { e.stopPropagation(); toggleChecklistCollapsed() }}
            >
              {state.checklistCollapsed ? '▲' : '▼'}
            </button>
            <button
              className="checklist-toggle"
              aria-label="Dismiss checklist"
              title="Don't show again"
              onClick={e => {
                e.stopPropagation()
                try { localStorage.setItem('cg_onboarding_dismissed', '1') } catch {}
                dismissChecklist()
              }}
              style={{ color: '#606070' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {!state.checklistCollapsed && (
          <div className="checklist-progress-bar-wrap" aria-label={`${completedCount} of 5 tasks complete`}>
            <div
              className="checklist-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Items */}
        {!state.checklistCollapsed && (
          <ul className="checklist-items" role="list">
            {checklistItems.map((item, index) => {
              const isNext = !item.done && checklistItems.slice(0, index).every(i => i.done)
              return (
                <li
                  key={item.id}
                  className={`checklist-item${item.done ? ' checklist-item-done' : ''}${isNext ? ' checklist-item-next' : ''}`}
                  role="listitem"
                >
                  <span className={`checklist-check${item.done ? ' check-done' : ''}`} aria-hidden="true">
                    {item.done ? '✓' : '○'}
                  </span>
                  <span className="checklist-item-text">
                    <span className="checklist-item-label">{item.label}</span>
                    {isNext && (
                      <span className="checklist-item-desc">{item.description}</span>
                    )}
                  </span>
                  {isNext && (
                    <span className="checklist-next-badge">NOW</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Footer */}
        {!state.checklistCollapsed && (
          <div className="checklist-footer">
            {isChecklistComplete ? (
              <span className="checklist-complete-msg">You're all set!</span>
            ) : (
              <span className="checklist-encouragement">
                {completedCount === 0 && "Let's get you set up!"}
                {completedCount === 1 && "Great start! Keep going."}
                {completedCount === 2 && "You're on a roll!"}
                {completedCount === 3 && "Almost there — 2 more to go."}
                {completedCount === 4 && "One last step!"}
              </span>
            )}

            <button
              className="checklist-dismiss"
              onClick={() => {
                try { localStorage.setItem('cg_onboarding_dismissed', '1') } catch {}
                dismissChecklist()
              }}
              aria-label="Dismiss onboarding checklist"
            >
              {canDismissChecklist ? 'Dismiss' : '✕ Skip'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
