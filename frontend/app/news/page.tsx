'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import PersistentNav from '../components/PersistentNav'
import { apiFetchSafe } from '../lib/apiFetch'
import { formatRelativeTime } from '../lib/timezone'
import MarketIntel from '../components/MarketIntel'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsArticle {
  id: string
  title: string
  summary: string
  url: string | null
  source: string
  category: string
  publishedAt: string
  sentimentScore: number
  sentimentLabel: 'bullish' | 'bearish' | 'neutral'
  impactScore: number
  impactLabel: 'High' | 'Medium' | 'Low'
  tags: string[]
  symbols: string[]
  imageUrl: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Equities', 'Forex', 'Crypto', 'Commodities', 'Macro', 'Market Intel']
const CAT_MAP: Record<string, string> = {
  All: 'all',
  Equities: 'stocks',
  Forex: 'forex',
  Crypto: 'crypto',
  Commodities: 'commodities',
  Macro: 'economy',
}
const ARTICLE_COUNTS = [10, 25, 50, 100]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(dateStr: string) {
  return formatRelativeTime(dateStr) || ''
}

function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: NewsArticle }) {
  const isHigh = article.impactLabel === 'High'
  const isBull = article.sentimentLabel === 'bullish'
  const isBear = article.sentimentLabel === 'bearish'

  const sentimentColor = isBull ? 'var(--green)' : isBear ? 'var(--red)' : 'var(--text-3)'
  const sentimentIcon  = isBull ? '▲' : isBear ? '▼' : '●'

  return (
    <a
      href={article.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="news-card"
    >
      {article.imageUrl && (
        <div className="news-card-img-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.imageUrl}
            alt={article.title}
            className="news-card-img"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}
      <div className="news-card-body">
        <div className="news-card-meta">
          <span className="news-card-source">{article.source}</span>
          {isHigh && <span className="news-card-impact-high">● HIGH</span>}
          <span style={{ color: sentimentColor, fontSize: 10, fontWeight: 700 }}>
            {sentimentIcon} {article.sentimentLabel.toUpperCase()}
          </span>
          <span className="news-card-time">{fmtTime(article.publishedAt)}</span>
        </div>
        <h3 className="news-card-title">{article.title}</h3>
        {article.summary && (
          <p className="news-card-summary">{article.summary}</p>
        )}
        <div className="news-card-footer">
          {article.symbols.length > 0 && (
            <div className="news-card-symbols">
              {article.symbols.slice(0, 4).map(sym => (
                <span key={sym} className="news-card-symbol-tag">{sym}</span>
              ))}
            </div>
          )}
          <span className="news-card-date">{fmtDate(article.publishedAt)}</span>
        </div>
      </div>
    </a>
  )
}

// ─── Skeleton Cards ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="news-card news-card-skeleton">
      <div className="news-card-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div className="shimmer" style={{ height: 12, width: 60, borderRadius: 3 }} />
          <div className="shimmer" style={{ height: 12, width: 40, borderRadius: 3 }} />
        </div>
        <div className="shimmer" style={{ height: 16, width: '85%', borderRadius: 3, marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 16, width: '60%', borderRadius: 3, marginBottom: 12 }} />
        <div className="shimmer" style={{ height: 11, width: '95%', borderRadius: 3, marginBottom: 4 }} />
        <div className="shimmer" style={{ height: 11, width: '80%', borderRadius: 3 }} />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try { return Number(localStorage.getItem('cg_news_count')) || 25 } catch {}
    }
    return 25
  })
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const fetchNews = useCallback(async (cat: string, sym: string, pg: number, append = false, size?: number) => {
    setLoading(true)
    setError(false)
    const limit = size ?? pageSize
    try {
      let url: string
      if (sym.trim()) {
        url = `${API_BASE}/api/feed/news/symbol/${encodeURIComponent(sym.trim().toUpperCase())}?limit=${limit}&page=${pg}`
      } else {
        const apiCat = CAT_MAP[cat] || 'all'
        const p = new URLSearchParams({ limit: String(limit), page: String(pg) })
        if (apiCat !== 'all') p.set('category', apiCat)
        url = `${API_BASE}/api/feed/news?${p.toString()}`
      }
      const j = await apiFetchSafe<{ success: boolean; data: NewsArticle[] }>(url)
      if (j?.success) {
        const data = j.data || []
        setArticles(prev => append ? [...prev, ...data] : data)
        setHasMore(data.length >= limit)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize])

  // Initial load and category/symbol changes
  useEffect(() => {
    setPage(1)
    setArticles([])
    fetchNews(category, symbolFilter, 1, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, symbolFilter])

  // Debounced symbol filter
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      setSymbolFilter(val)
    }, 500)
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchNews(category, symbolFilter, nextPage, true)
  }

  // Filter by search text (client-side) for title/source
  const filtered = search.trim() && !symbolFilter
    ? articles.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.source.toLowerCase().includes(search.toLowerCase()) ||
        a.symbols.some(s => s.toLowerCase().includes(search.toLowerCase()))
      )
    : articles

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      {/* Persistent Navigation */}
      <PersistentNav />

      {/* Page Header */}
      <header className="page-header">
        <Link href="/" className="back-link">
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>← TradVue</span>
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div className="page-header-title">
          <span className="live-dot" style={{ width: 7, height: 7, flexShrink: 0 }} />
          News Feed
        </div>
        <div className="page-header-desc">{filtered.length} articles</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            className="news-page-search"
            placeholder="Search headline, source, ticker…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setPage(1); setArticles([]); fetchNews(category, symbolFilter, 1) }}
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Category filters + count selector */}
      <div className="news-page-header" style={{ paddingTop: 0, borderTop: 'none', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
        {/* Category filters + count selector */}
        <div className="news-page-cats">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`news-filter-tab${category === cat ? ' active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="news-count-label">Show:</span>
            {ARTICLE_COUNTS.map(n => (
              <button
                key={n}
                className={`news-count-btn${pageSize === n ? ' active' : ''}`}
                onClick={() => {
                  setPageSize(n)
                  try { localStorage.setItem('cg_news_count', String(n)) } catch {}
                  setPage(1)
                  setArticles([])
                  fetchNews(category, symbolFilter, 1, false, n)
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Market Intel Tab — shows instead of articles */}
      {category === 'Market Intel' && (
        <div style={{ padding: '24px' }}>
          <MarketIntel />
        </div>
      )}

      {/* Grid */}
      <div className="news-page-content" style={{ display: category === 'Market Intel' ? 'none' : undefined }}>
        {error && !loading && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>
            <div style={{ marginBottom: 12 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <div style={{ fontSize: 14, marginBottom: 16 }}>News feed temporarily unavailable</div>
            <button
              className="btn btn-secondary"
              onClick={() => fetchNews(category, symbolFilter, 1)}
            >
              ↻ Try Again
            </button>
          </div>
        )}

        {loading && articles.length === 0 && (
          Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
        )}

        {filtered.map(a => (
          <ArticleCard key={a.id} article={a} />
        ))}

        {filtered.length === 0 && !loading && !error && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text-3)', fontSize: 13 }}>
            No articles found{search ? ` matching "${search}"` : ''}.
          </div>
        )}
      </div>

      {/* Load More */}
      {category !== 'Market Intel' && !loading && hasMore && filtered.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <button className="btn btn-secondary" onClick={loadMore}>
            Load More
          </button>
        </div>
      )}

      {category !== 'Market Intel' && loading && articles.length > 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)', fontSize: 12 }}>
          Loading more…
        </div>
      )}



            {/* Footer */}
      <footer style={{
        padding: '12px 24px',
        borderTop: '1px solid var(--border)',
        fontSize: 10,
        color: 'var(--text-3)',
        textAlign: 'center',
        background: 'var(--bg-1)',
      }}>
        News and calendar data is aggregated from third-party sources. TradVue does not verify the accuracy of third-party content and is not responsible for investment decisions based on this information.{' '}
        <Link href="/legal/disclaimer" style={{ color: 'var(--accent)' }}>Disclaimer</Link>
      </footer>
    </div>
  )
}
