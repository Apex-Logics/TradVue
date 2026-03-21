'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import StockSearch from './StockSearch'
import OnboardingTooltip from './OnboardingTooltip'
import { IconChart, IconSettings } from './Icons'
import { fmt } from '../utils/formatting'
import { CRYPTO_SYMBOL_MAP, MAX_TICKER_CUSTOM } from '../constants'
import type { Quote, CryptoCoin } from '../types'

interface Props {
  watchlist: string[]
  setWatchlist: React.Dispatch<React.SetStateAction<string[]>>
  watchlistSyncing: boolean
  token: string | null
  quotes: Record<string, Quote>
  tickerQuotes: Record<string, Quote>
  cryptoCoins: CryptoCoin[]
  loadingQuotes: boolean
  watchlistFetchStartRef: React.MutableRefObject<number>
  watchlistFetchedRef: React.MutableRefObject<Set<string>>
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  setAuthModalOpen: (open: boolean) => void
  toggleWatch: (sym: string) => void
  openStockDetail: (sym: string, name?: string) => void
  /** Called instead of openStockDetail when not on the dashboard — only updates the selected ticker, no chart modal */
  onSelectTicker: (sym: string) => void
  /** The current nav tab from HomeClient — determines contextual click behavior */
  activeNav: string
  customTickerSymbols: string[]
  removeFromTicker: (sym: string) => void
}

/**
 * Left sidebar: watchlist panel with search, live prices, drag-reorder,
 * +LOG shortcuts, remove buttons, and custom ticker tags.
 */
export default function WatchlistPanel({
  watchlist,
  setWatchlist,
  watchlistSyncing,
  token,
  quotes,
  tickerQuotes,
  cryptoCoins,
  loadingQuotes,
  watchlistFetchStartRef,
  watchlistFetchedRef,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  setAuthModalOpen,
  toggleWatch,
  openStockDetail,
  onSelectTicker,
  activeNav,
  customTickerSymbols,
  removeFromTicker,
}: Props) {
  // On the dashboard (Markets tab) clicking a ticker opens the chart modal.
  // On any other tab (Analysis, etc.) it only selects the ticker.
  const handleTickerClick = useCallback((sym: string, name?: string) => {
    if (activeNav === 'Markets') {
      openStockDetail(sym, name)
    } else {
      onSelectTicker(sym)
    }
  }, [activeNav, openStockDetail, onSelectTicker])
  // Internal state — does not need to live in HomeClient
  const [watchlistSize, setWatchlistSize] = useState<'compact' | 'normal' | 'large'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v = localStorage.getItem('cg_watchlist_size')
        if (v === 'compact' || v === 'large') return v
      } catch {}
    }
    return 'normal'
  })
  const [watchlistSettingsOpen, setWatchlistSettingsOpen] = useState(false)
  const [watchlistEditMode, setWatchlistEditMode]         = useState(false)
  const [dragOverIndex, setDragOverIndex]                 = useState<number | null>(null)
  const [draggingIndex, setDraggingIndex]                 = useState<number | null>(null)

  const wlSettingsRef   = useRef<HTMLDivElement>(null)
  const dragIndexRef    = useRef<number | null>(null)
  const touchStartYRef  = useRef<number>(0)
  const touchStartIndexRef = useRef<number>(0)

  useEffect(() => {
    try { localStorage.setItem('cg_watchlist_size', watchlistSize) } catch {}
  }, [watchlistSize])

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!watchlistSettingsOpen) return
    const h = (e: MouseEvent) => {
      if (wlSettingsRef.current && !wlSettingsRef.current.contains(e.target as Node)) {
        setWatchlistSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [watchlistSettingsOpen])

  // Resolve the best available quote for a watchlist symbol
  const getWatchlistQuote = useCallback((sym: string): Quote | null => {
    if (quotes[sym])              return quotes[sym]
    if (tickerQuotes[sym])        return tickerQuotes[sym]
    if (tickerQuotes[sym + '-USD']) return tickerQuotes[sym + '-USD']
    const cryptoSym = CRYPTO_SYMBOL_MAP[sym.toUpperCase()]
    if (cryptoSym) {
      const coin = cryptoCoins.find(c => c.symbol.toUpperCase() === cryptoSym)
      if (coin) {
        return {
          symbol: sym,
          current: coin.price,
          change: coin.price * coin.change24h / 100,
          changePct: coin.change24h,
          high: coin.price * 1.02,
          low: coin.price * 0.98,
          open: coin.price,
          prevClose: coin.price,
          timestamp: new Date().toISOString(),
          source: 'finnhub' as const,
        }
      }
    }
    return null
  }, [quotes, tickerQuotes, cryptoCoins])

  return (
    <div className={`col-watchlist${mobileSidebarOpen ? ' mobile-sidebar-open' : ''}`}>

      {/* Mobile sidebar overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Watchlist header */}
      <div className="watchlist-header">
        <span className="watchlist-header-title">★ WATCHLIST</span>
        <div className="watchlist-header-right">
          {/* Gear settings button + dropdown */}
          <div className="wl-settings-wrap" ref={wlSettingsRef} style={{ position: 'relative' }}>
            <button
              className={`wl-settings-btn${watchlistSettingsOpen ? ' active' : ''}`}
              onClick={() => setWatchlistSettingsOpen(o => !o)}
              title="Watchlist settings"
              aria-label="Watchlist settings"
              aria-expanded={watchlistSettingsOpen}
            >
              <IconSettings size={14} />
            </button>
            {watchlistSettingsOpen && (
              <div className="wl-settings-dropdown" role="dialog" aria-label="Watchlist settings">
                <div className="wl-settings-section">
                  <div className="wl-settings-label">SIZE</div>
                  <div className="wl-settings-row">
                    {(['compact', 'normal', 'large'] as const).map(s => (
                      <button
                        key={s}
                        className={`wl-size-opt${watchlistSize === s ? ' active' : ''}`}
                        onClick={() => setWatchlistSize(s)}
                        aria-label={`Set watchlist size to ${s}`}
                        aria-pressed={watchlistSize === s}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="wl-settings-section" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="wl-settings-label">REORDER</div>
                  <button
                    className={`wl-reorder-btn${watchlistEditMode ? ' active' : ''}`}
                    onClick={() => {
                      setWatchlistEditMode(m => !m)
                      setWatchlistSettingsOpen(false)
                    }}
                    aria-pressed={watchlistEditMode}
                  >
                    {watchlistEditMode ? 'Done Editing' : '≡ Edit Order'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {watchlistEditMode && (
            <button className="wl-done-btn" onClick={() => setWatchlistEditMode(false)} aria-label="Done editing watchlist order">
              Done
            </button>
          )}
          {token && (
            <span className={`watchlist-sync-badge${watchlistSyncing ? ' syncing' : ''}`} aria-label={watchlistSyncing ? 'Syncing watchlist' : 'Watchlist synced'}>
              {watchlistSyncing ? '⟳' : '✓'}
            </span>
          )}
          {!token && watchlist.length > 0 && (
            <button
              onClick={() => setAuthModalOpen(true)}
              aria-label="Sign in to sync your watchlist"
              style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', cursor: 'pointer' }}
            >
              sync ↑
            </button>
          )}
          {/* Mobile close button */}
          <button
            className="mobile-sidebar-close"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close watchlist"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Search + Add to Watchlist */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <OnboardingTooltip
              id="stock-search"
              content="Search any stock ticker to add to your watchlist"
              position="bottom"
              delayMs={3000}
            >
              <StockSearch onSelect={(sym, name) => {
                if (!watchlist.includes(sym)) toggleWatch(sym)
                handleTickerClick(sym, name)
              }} />
            </OnboardingTooltip>
          </div>
          <button
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>('.symbol-search')
              el?.focus()
            }}
            title="Add ticker to watchlist"
            aria-label="Add ticker to watchlist"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              width: 28,
              height: 28,
              fontSize: 'var(--fs-xl)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >+</button>
        </div>
      </div>

      {/* Watchlist items */}
      <div className={`watchlist-list wl-${watchlistSize}`} role="list" aria-label="Watchlist">
        {watchlist.length === 0 ? (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>
            <div style={{ marginBottom: 8 }}>Your watchlist is empty</div>
            <button
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', cursor: 'pointer' }}
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>('.symbol-search')
                el?.focus()
              }}
              aria-label="Search to add a ticker to your watchlist"
            >
              Search to add a ticker →
            </button>
          </div>
        ) : (
          watchlist.map((sym, idx) => {
            const q = getWatchlistQuote(sym)
            const isCrypto = !!CRYPTO_SYMBOL_MAP[sym.toUpperCase()]
            const fetchAge  = watchlistFetchStartRef.current
              ? Date.now() - watchlistFetchStartRef.current
              : 99999
            const isFetched = watchlistFetchedRef.current.has(sym)
            const showSkeleton = !q && loadingQuotes && fetchAge < 5000 && !isFetched
            const isForex = sym.length === 6 && /^[A-Z]{6}$/.test(sym) && !isCrypto
            const isDragging  = draggingIndex === idx
            const isDragOver  = dragOverIndex === idx

            return (
              <div
                key={sym}
                role="listitem"
                className={`watchlist-row${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
                onClick={() => !watchlistEditMode && handleTickerClick(sym)}
                style={{ position: 'relative', cursor: watchlistEditMode ? 'default' : 'pointer' }}
                aria-label={`${sym} watchlist item`}
                draggable={watchlistEditMode}
                onDragStart={watchlistEditMode ? (e) => {
                  dragIndexRef.current = idx
                  setDraggingIndex(idx)
                  e.dataTransfer.effectAllowed = 'move'
                } : undefined}
                onDragOver={watchlistEditMode ? (e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragIndexRef.current !== null && dragIndexRef.current !== idx) {
                    setDragOverIndex(idx)
                  }
                } : undefined}
                onDragLeave={watchlistEditMode ? () => setDragOverIndex(null) : undefined}
                onDrop={watchlistEditMode ? (e) => {
                  e.preventDefault()
                  const from = dragIndexRef.current
                  if (from !== null && from !== idx) {
                    const next = [...watchlist]
                    const [item] = next.splice(from, 1)
                    next.splice(idx, 0, item)
                    setWatchlist(next)
                    try { localStorage.setItem('cg_wl', JSON.stringify(next)) } catch {}
                  }
                  dragIndexRef.current = null
                  setDraggingIndex(null)
                  setDragOverIndex(null)
                } : undefined}
                onDragEnd={watchlistEditMode ? () => {
                  dragIndexRef.current = null
                  setDraggingIndex(null)
                  setDragOverIndex(null)
                } : undefined}
                onTouchStart={watchlistEditMode ? (e) => {
                  touchStartYRef.current = e.touches[0].clientY
                  touchStartIndexRef.current = idx
                } : undefined}
                onTouchMove={watchlistEditMode ? (e) => {
                  e.preventDefault()
                  const y  = e.touches[0].clientY
                  const el = document.elementFromPoint(e.touches[0].clientX, y)
                  const row = el?.closest('.watchlist-row')
                  if (row) {
                    const rows = Array.from(document.querySelectorAll('.watchlist-row'))
                    const overIdx = rows.indexOf(row as Element)
                    if (overIdx >= 0 && overIdx !== touchStartIndexRef.current) {
                      setDragOverIndex(overIdx)
                    }
                  }
                } : undefined}
                onTouchEnd={watchlistEditMode ? () => {
                  const from = touchStartIndexRef.current
                  const to   = dragOverIndex
                  if (to !== null && from !== to) {
                    const next = [...watchlist]
                    const [item] = next.splice(from, 1)
                    next.splice(to, 0, item)
                    setWatchlist(next)
                    try { localStorage.setItem('cg_wl', JSON.stringify(next)) } catch {}
                  }
                  setDragOverIndex(null)
                  setDraggingIndex(null)
                } : undefined}
              >
                {watchlistEditMode && (
                  <span className="wl-drag-handle" title="Drag to reorder" aria-hidden="true">≡</span>
                )}
                <div className="watchlist-row-left">
                  <span className="watchlist-sym">{sym}</span>
                  {isCrypto && <span className="watchlist-tag-crypto">crypto</span>}
                  {isForex  && <span className="watchlist-tag-crypto" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--purple)' }}>fx</span>}
                </div>
                {q ? (
                  <div className="watchlist-row-right">
                    <span className="watchlist-price">
                      {q.current == null ? '—'
                        : q.current >= 1000 ? fmt(q.current, 0)
                        : q.current >= 1    ? fmt(q.current, 2)
                        : fmt(q.current, 4)}
                    </span>
                    <span className={(q.changePct ?? 0) >= 0 ? 'watchlist-chg-up' : 'watchlist-chg-down'}>
                      {q.changePct == null ? '—' : `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`}
                    </span>
                  </div>
                ) : showSkeleton ? (
                  <div className="watchlist-row-right" style={{ gap: 4 }}>
                    <span className="shimmer" style={{ width: 44, height: 11, borderRadius: 3, display: 'inline-block' }} />
                    <span className="shimmer" style={{ width: 36, height: 10, borderRadius: 3, display: 'inline-block' }} />
                  </div>
                ) : (
                  <div className="watchlist-row-right">
                    <span className="watchlist-price" style={{ color: 'var(--text-3)' }}>—</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>n/a</span>
                  </div>
                )}
                {!watchlistEditMode && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const quote = getWatchlistQuote(sym)
                      const price = quote?.current
                      const params = new URLSearchParams({ symbol: sym, asset: 'Stock' })
                      if (price) params.set('price', price.toFixed(2))
                      window.location.href = `/journal?${params.toString()}`
                    }}
                    title={`Log trade for ${sym}`}
                    aria-label={`Log trade for ${sym}`}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-3)', padding: '1px 5px', fontSize: 'var(--fs-xs)', fontWeight: 700, marginRight: 2 }}
                  >
                    +LOG
                  </button>
                )}
                {!watchlistEditMode && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleWatch(sym) }}
                    className="watchlist-remove-btn"
                    title={`Remove ${sym}`}
                    aria-label={`Remove ${sym} from watchlist`}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Custom Ticker tags */}
      {customTickerSymbols.length > 0 && (
        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
          <div className="sidebar-title">
            <IconChart size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> MY TICKER BAR
          </div>
          <div style={{ padding: '4px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {customTickerSymbols.map(sym => (
              <span key={sym} className="ticker-tag">
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleTickerClick(sym)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${sym} details`}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleTickerClick(sym) }}
                >
                  {sym}
                </span>
                <button
                  className="ticker-tag-remove"
                  onClick={() => removeFromTicker(sym)}
                  title={`Remove ${sym} from ticker`}
                  aria-label={`Remove ${sym} from ticker bar`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', padding: '2px 14px 6px', textAlign: 'right' }}>
            {customTickerSymbols.length}/{MAX_TICKER_CUSTOM} slots
          </div>
        </div>
      )}
    </div>
  )
}
