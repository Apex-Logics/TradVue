/**
 * apiFetch — Robust fetch wrapper for TradVue
 *
 * Features:
 * - Always hits the network on the success path (`cache: 'no-store'`). The
 *   in-memory map is NOT a read-through cache — it is stale fallback only.
 * - Retries 429 with exponential backoff (1s → 2s → 4s, up to 3x)
 * - Retries 5xx once after 2s
 * - Serves stale cache when API is unreachable
 * - Throws ApiError with clean user-facing messages (never raw stack traces)
 * - apiFetchSafe() variant returns null instead of throwing
 *
 * Browser HTTP cache used to freeze dashboard quotes: GET /market-data/batch
 * is sent with Cache-Control: public, max-age=30, and fetch() defaults to
 * using that cache. Hard refresh bypasses it, which matched "prices sit still
 * until I refresh the page."
 */

import { WL_CACHE_TTL } from '../constants'

// ─── In-memory response cache (error fallback only) ───────────────────────────

const cache = new Map<string, { data: unknown; ts: number }>()
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes — non-quote endpoints

export function getCachedData<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > ttl) { cache.delete(key); return null }
  return entry.data as T
}

export function setCachedData(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() })
}

export function clearApiFetchCache(): void {
  cache.clear()
}

/** Quote/batch URLs share the 60s server cache — don't serve 5-min stale as "fresh". */
function staleTtlMs(url: string): number {
  return url.includes('/market-data/') ? WL_CACHE_TTL : DEFAULT_TTL
}

// ─── Error type ───────────────────────────────────────────────────────────────

/** ApiError carries a clean user-facing message and optional technical details for the console. */
export class ApiError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly status?: number,
    technical?: string,
  ) {
    super(technical ?? userMessage)
    this.name = 'ApiError'
  }
}

// ─── sleep helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── apiFetch ────────────────────────────────────────────────────────────────

/**
 * Fetch wrapper with retry + caching.
 * Throws ApiError with user-friendly messages on all failure paths.
 */
export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const MAX_429_RETRIES = 3

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    try {
      // Bypass browser/CDN HTTP cache. Success must not read the in-memory map.
      const res = await fetch(url, { cache: 'no-store', ...init })

      // ── 429 Rate Limited ──────────────────────────────────────────────────
      if (res.status === 429) {
        if (attempt >= MAX_429_RETRIES) {
          console.warn(`[apiFetch] 429 after ${MAX_429_RETRIES} retries:`, url)
          const stale = getCachedData<T>(url, staleTtlMs(url))
          if (stale !== null) {
            console.info('[apiFetch] serving stale cache after 429 exhaustion')
            return stale
          }
          throw new ApiError(
            'Market data is temporarily unavailable. Please try again in a moment.',
            429,
            `429 Too Many Requests: ${url}`,
          )
        }
        const delay = Math.pow(2, attempt) * 1000  // 1s, 2s, 4s
        console.warn(`[apiFetch] 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}):`, url)
        await sleep(delay)
        continue
      }

      // ── 5xx Server Error ──────────────────────────────────────────────────
      if (res.status >= 500) {
        if (attempt === 0) {
          console.warn(`[apiFetch] ${res.status} server error, retrying in 2s:`, url)
          await sleep(2000)
          continue
        }
        console.error(`[apiFetch] ${res.status} persists:`, url)
        const stale = getCachedData<T>(url, staleTtlMs(url))
        if (stale !== null) {
          console.info('[apiFetch] serving stale cache after server error')
          return stale
        }
        throw new ApiError(
          'Market data is currently unavailable. Please try again in a moment.',
          res.status,
          `HTTP ${res.status}: ${url}`,
        )
      }

      // ── 304: fetch() should hide this behind cache:'default'; handle if it surfaces
      if (res.status === 304) {
        const stale = getCachedData<T>(url, staleTtlMs(url))
        if (stale !== null) return stale
        throw new ApiError(
          'Data temporarily unavailable.',
          304,
          `HTTP 304: ${url}`,
        )
      }

      // ── Other non-OK ──────────────────────────────────────────────────────
      if (!res.ok) {
        throw new ApiError(
          'Data temporarily unavailable.',
          res.status,
          `HTTP ${res.status}: ${url}`,
        )
      }

      // ── Success ───────────────────────────────────────────────────────────
      const data = await res.json() as T
      cache.set(url, { data, ts: Date.now() })
      return data

    } catch (err) {
      if (err instanceof ApiError) throw err

      // Network error: Failed to fetch, DNS, CORS, offline, etc.
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[apiFetch] network error:', msg, url)

      const stale = getCachedData<T>(url, staleTtlMs(url))
      if (stale !== null) {
        console.info('[apiFetch] serving stale cache after network error:', url)
        return stale
      }

      throw new ApiError(
        'Unable to connect to market data. Check your connection.',
        undefined,
        msg,
      )
    }
  }

  // Unreachable, but TypeScript requires it
  throw new ApiError('Market data is currently unavailable. Please try again in a moment.')
}

// ─── apiFetchSafe ─────────────────────────────────────────────────────────────

/**
 * Like apiFetch but returns null instead of throwing.
 * Logs errors to console but never surfaces technical details to the UI.
 * Use when the calling code already handles null gracefully.
 */
export async function apiFetchSafe<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    return await apiFetch<T>(url, init)
  } catch (err) {
    if (err instanceof ApiError) {
      console.warn('[apiFetchSafe]', err.message)
    } else {
      console.warn('[apiFetchSafe] unexpected error:', err)
    }
    return null
  }
}
