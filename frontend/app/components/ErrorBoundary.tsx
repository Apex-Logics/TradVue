'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  label?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Reusable error boundary that catches render errors in its subtree.
 * Shows a friendly "Something went wrong" message with a retry button.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          role="alert"
          aria-label={this.props.label ? `Error in ${this.props.label}` : 'Something went wrong'}
          style={{
            padding: '20px 16px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}
          </span>
          {this.state.error && (
            <span style={{ fontSize: 10, color: 'var(--text-3)', maxWidth: 280 }}>
              {this.state.error.message}
            </span>
          )}
          <button
            onClick={this.handleRetry}
            aria-label="Retry loading this section"
            style={{
              marginTop: 4,
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            ↻ Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
