'use client'

import { fmtTime, fmtPct, fmt } from '../utils/formatting'
import { NEWS_CATEGORIES, NEWS_ARTICLE_COUNTS } from '../constants'
import DataError from './DataError'
import { IconTrendingUp, IconTrendingDown, IconMinus } from './Icons'
import type { NewsArticle, Quote } from '../types'

// ─── NewsRow ───────────────────────────────────────────────────────────────────

function NewsRow({ article, index }: { article: NewsArticle; index: number }) {
  // Defensive guards — backend may return articles with missing/malformed fields
  const isHigh = article.impactLabel === 'High'
  const symbols = Array.isArray(article.symbols) ? article.symbols : []
  const publishedAt = article.publishedAt || new Date().toISOString()
  const title = article.title || 'Untitled'
  const source = article.source || 'Unknown'
  const url = article.url || '#'

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`news-row ${index % 2 !== 0 ? 'news-row-even' : ''}`}
      aria-label={`${title} — ${source}, ${fmtTime(publishedAt)} ago`}
    >
      <span className="news-time">{fmtTime(publishedAt)}</span>
      <span className="news-source">{source}</span>
      <span className="news-title">
        {isHigh && <span className="news-flag-high" aria-label="High impact">●</span>}
        {title}
      </span>
      <span className="news-sentiment" aria-hidden="true">
        {article.sentimentLabel === 'bullish' && <span className="sentiment-bull">▲</span>}
        {article.sentimentLabel === 'bearish' && <span className="sentiment-bear">▼</span>}
      </span>
      <span className="news-symbols">{symbols.slice(0, 2).join(' ')}</span>
    </a>
  )
}

// ─── MoverRow ──────────────────────────────────────────────────────────────────

function MoverRow({
  quote,
  onClick,
}: {
  quote: Quote
  onClick?: (sym: string) => void
}) {
  const isUp = (quote.changePct ?? 0) >= 0
  return (
    <div
      className={`mover-row${onClick ? ' mover-row-clickable' : ''}`}
      title={`H: $${fmt(quote.high)}  L: $${fmt(quote.low)}  O: $${fmt(quote.open)}`}
      onClick={() => onClick?.(quote.symbol)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${quote.symbol} ${fmtPct(quote.changePct)}`}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(quote.symbol) } : undefined}
    >
      <span className="mover-symbol">{quote.symbol}</span>
      <span className="mover-price">${fmt(quote.current)}</span>
      <span className={isUp ? 'mover-up' : 'mover-down'}>{fmtPct(quote.changePct)}</span>
    </div>
  )
}

// ─── NewsSkeletons ─────────────────────────────────────────────────────────────

function NewsSkeletons({ count = 20 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="news-row-skeleton" style={{ animationDelay: `${i * 0.05}s` }} />
      ))}
    </>
  )
}

// ─── AnalysisView ──────────────────────────────────────────────────────────────

function AnalysisView({
  gainers,
  losers,
  newsArticles,
  onOpenStock,
}: {
  gainers: Quote[]
  losers: Quote[]
  newsArticles: NewsArticle[]
  onOpenStock: (sym: string) => void
}) {
  // Guard: filter out any articles with unexpected shapes before processing
  const safeArticles = newsArticles.filter(a => a && typeof a === 'object' && a.title)
  const bullishCount = safeArticles.filter(a => a.sentimentLabel === 'bullish').length
  const bearishCount = safeArticles.filter(a => a.sentimentLabel === 'bearish').length
  const neutralCount  = safeArticles.filter(a => a.sentimentLabel === 'neutral').length
  const total = safeArticles.length
  const bullPct = total > 0 ? Math.round((bullishCount / total) * 100) : 0
  const bearPct = total > 0 ? Math.round((bearishCount / total) * 100) : 0
  const sentimentScore = bullishCount + bearishCount > 0
    ? (bullishCount / (bullishCount + bearishCount)) * 100
    : 50
  const sentimentLabel = sentimentScore > 60
    ? <><IconTrendingUp size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Bullish</>
    : sentimentScore < 40
      ? <><IconTrendingDown size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Bearish</>
      : <><IconMinus size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Neutral</>
  const sentimentColor = sentimentScore > 60 ? 'var(--green)' : sentimentScore < 40 ? 'var(--red)' : 'var(--accent)'
  const highImpact = newsArticles.filter(a => a.impactLabel === 'High').slice(0, 8)

  return (
    <div style={{ padding: '0 0 24px' }} role="region" aria-label="Market analysis">
      {/* Sentiment header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="feed-title" style={{ marginBottom: 10 }}>
          <span className="live-dot" />
          MARKET ANALYSIS
        </div>

        {/* Sentiment bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>▲ Bullish {bullPct}%</span>
            <span style={{ color: sentimentColor, fontWeight: 700, fontSize: 12 }}>{sentimentLabel}</span>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>Bearish {bearPct}% ▼</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-3)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ height: '100%', width: `${bullPct}%`, background: 'var(--green)', transition: 'width 0.5s' }} />
            <div style={{ height: '100%', width: `${neutralCount > 0 ? Math.round((neutralCount / total) * 100) : 0}%`, background: 'var(--accent)', opacity: 0.4 }} />
            <div style={{ height: '100%', flex: 1, background: 'var(--red)', opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 4, textAlign: 'center' }}>
            Based on {total} recent news articles
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { label: 'BULLISH', val: bullishCount, col: 'var(--green)' },
            { label: 'NEUTRAL', val: neutralCount, col: 'var(--accent)' },
            { label: 'BEARISH', val: bearishCount, col: 'var(--red)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-2)', borderRadius: 5, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.col, fontFamily: 'var(--mono)' }}>{s.val}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Movers */}
      {(gainers.length > 0 || losers.length > 0) && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="sidebar-title sidebar-title-gain" style={{ marginBottom: 4 }}>▲ TOP GAINERS</div>
            {gainers.slice(0, 5).map(q => (
              <MoverRow key={q.symbol} quote={q} onClick={onOpenStock} />
            ))}
          </div>
          <div>
            <div className="sidebar-title sidebar-title-loss" style={{ marginBottom: 4 }}>▼ TOP LOSERS</div>
            {losers.slice(0, 5).map(q => (
              <MoverRow key={q.symbol} quote={q} onClick={onOpenStock} />
            ))}
          </div>
        </div>
      )}

      {/* High-impact news */}
      {highImpact.length > 0 && (
        <div>
          <div style={{ padding: '8px 16px 4px', borderBottom: '1px solid var(--border)' }}>
            <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
              HIGH IMPACT NEWS
            </div>
          </div>
          {highImpact.map((a, i) => <NewsRow key={a.id} article={a} index={i} />)}
        </div>
      )}

      {gainers.length === 0 && newsArticles.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
          Loading market analysis…
        </div>
      )}
    </div>
  )
}

// ─── NewsFeed ──────────────────────────────────────────────────────────────────

interface Props {
  newsArticles: NewsArticle[]
  loadingNews: boolean
  newsError: string | null
  newsCategory: string
  newsArticleCount: number
  newsSymbolFilter: string
  showAlerts: boolean
  activeNav: string
  hasRealTickerData: boolean
  gainers: Quote[]
  losers: Quote[]
  onNewsCategory: (cat: string) => void
  onArticleCount: (count: number) => void
  onFetchNews: (cat: string, sym?: string, count?: number) => void
  onSymbolFilter: (sym: string) => void
  onOpenStock: (sym: string) => void
}

/**
 * Center column: news feed with category filters, symbol filter, live/sim badge,
 * and an Analysis view (sentiment + top movers + high-impact news).
 */
export default function NewsFeed({
  newsArticles,
  loadingNews,
  newsError,
  newsCategory,
  newsArticleCount,
  newsSymbolFilter,
  showAlerts,
  activeNav,
  hasRealTickerData,
  gainers,
  losers,
  onNewsCategory,
  onArticleCount,
  onFetchNews,
  onSymbolFilter,
  onOpenStock,
}: Props) {
  return (
    <div className="col-news" role="main" aria-label="News feed">
      {/* Analysis view */}
      {activeNav === 'Analysis' && (
        <AnalysisView
          gainers={gainers}
          losers={losers}
          newsArticles={newsArticles}
          onOpenStock={onOpenStock}
        />
      )}

      {/* News toolbar: category + count filters */}
      {!showAlerts && activeNav !== 'Analysis' && (
        <div className="news-toolbar" role="toolbar" aria-label="News filters">
          <div className="news-filter-tabs" style={{ borderBottom: 'none', flex: 1, minWidth: 0 }}>
            {NEWS_CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`news-filter-tab${newsCategory === cat ? ' active' : ''}`}
                onClick={() => onNewsCategory(cat)}
                aria-label={`Filter news by ${cat}`}
                aria-pressed={newsCategory === cat}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="news-count-selector">
            <span className="news-count-label">Show:</span>
            {NEWS_ARTICLE_COUNTS.map(n => (
              <button
                key={n}
                className={`news-count-btn${newsArticleCount === n ? ' active' : ''}`}
                onClick={() => {
                  onArticleCount(n)
                  onFetchNews(newsCategory, newsSymbolFilter, n)
                }}
                aria-label={`Show ${n} articles`}
                aria-pressed={newsArticleCount === n}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed header */}
      {!showAlerts && activeNav !== 'Analysis' && (
        <div className="feed-header">
          <span className="feed-title">
            <span className="live-dot" />
            LIVE FEED
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>
            {hasRealTickerData ? '● LIVE' : '○ SIM'}
          </span>
          <span className="feed-count">{newsArticles.length}</span>
          <input
            type="text"
            className="symbol-search news-symbol-filter"
            placeholder="Symbol…"
            value={newsSymbolFilter}
            onChange={e => onSymbolFilter(e.target.value)}
            aria-label="Filter news by symbol"
            style={{ width: 90, marginLeft: 4 }}
          />
          <a href="/news" style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 4, whiteSpace: 'nowrap' }}>
            Full page →
          </a>
          <button
            onClick={() => onFetchNews(newsCategory, newsSymbolFilter)}
            className="refresh-btn"
            aria-label="Refresh news feed"
          >
            ↻
          </button>
        </div>
      )}

      {/* Column headers */}
      {!showAlerts && activeNav !== 'Analysis' && (
        <div className="feed-col-header" style={{
          display: 'grid',
          gridTemplateColumns: '36px 80px 1fr auto auto',
          gap: '0 8px',
          padding: '4px 14px',
          borderBottom: '1px solid var(--border-b)',
          background: 'var(--bg-0)',
        }}>
          {['AGO', 'SOURCE', 'HEADLINE', '', 'SYMS'].map((h, i) => (
            <span key={i} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: i === 0 ? 'right' : 'left' }}>
              {h}
            </span>
          ))}
        </div>
      )}

      {/* News list */}
      {!showAlerts && activeNav !== 'Analysis' && (
        <div className="news-list">
          {loadingNews
            ? <NewsSkeletons count={newsArticleCount} />
            : newsError
              ? (
                <DataError
                  onRetry={() => onFetchNews(newsCategory, newsSymbolFilter)}
                  autoRetryAfter={10}
                  message="News feed is temporarily unavailable. Please try again in a moment."
                />
              )
              : newsArticles.length > 0
                ? newsArticles.map((a, i) => <NewsRow key={a.id} article={a} index={i} />)
                : <div className="feed-empty">No articles found{newsSymbolFilter ? ` for "${newsSymbolFilter.toUpperCase()}"` : ''}.</div>
          }
        </div>
      )}
    </div>
  )
}
