/**
 * Dividend Log API Client
 *
 * Client-side wrappers for the portfolio_dividend_log endpoints.
 * Replaces the ephemeral autoCalculatedDividends approach with persistent DB records.
 */

import { getStoredAuthToken } from './storageKeys'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getStoredAuthToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // Surface a clear message for 404s from dividend backfill (likely delisted ticker)
    if (res.status === 404 && path.includes('dividend')) {
      throw new Error('No dividend data available — this ticker may be delisted');
    }
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface DividendLogEntry {
  id: number;
  user_id: number;
  symbol: string;
  payment_date: string;
  ex_date: string | null;
  dividend_per_share: number;
  shares_held: number;
  total_received: number;
  source: 'auto' | 'manual';
  is_confirmed: boolean;
  drip_reinvested: boolean;
  drip_shares_added: number | null;
  drip_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackfillResult {
  symbol: string;
  inserted: number;
  skipped: number;
  errors: number;
  totalDividends?: number;
  message?: string;
  status?: string;
}

/**
 * Get all dividend log entries, optionally filtered by symbol.
 */
export async function getDividendLog(symbol?: string): Promise<DividendLogEntry[]> {
  const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
  const data = await apiFetch(`/api/portfolio/dividend-log${qs}`);
  return data.entries || [];
}

/**
 * Get dividend log summary total for a symbol.
 */
export async function getDividendSummary(
  symbol: string,
  fromDate?: string,
  toDate?: string
): Promise<{ symbol: string; total: number }> {
  const params = new URLSearchParams();
  if (fromDate) params.set('from_date', fromDate);
  if (toDate) params.set('to_date', toDate);
  const qs = params.toString() ? `?${params}` : '';
  return apiFetch(`/api/portfolio/dividend-log/summary/${encodeURIComponent(symbol)}${qs}`);
}

/**
 * Create or upsert a dividend log entry manually.
 */
export async function createDividendEntry(entry: {
  symbol: string;
  payment_date: string;
  dividend_per_share: number;
  shares_held: number;
  total_received?: number;
  ex_date?: string;
  notes?: string;
}): Promise<{ entry: DividendLogEntry; skipped: boolean }> {
  return apiFetch('/api/portfolio/dividend-log', {
    method: 'POST',
    body: JSON.stringify({ ...entry, source: 'manual', is_confirmed: true }),
  });
}

/**
 * Edit a dividend log entry (sets source='manual', is_confirmed=true).
 */
export async function updateDividendEntry(
  id: number,
  updates: {
    shares_held?: number;
    total_received?: number;
    dividend_per_share?: number;
    notes?: string;
  }
): Promise<DividendLogEntry> {
  const data = await apiFetch(`/api/portfolio/dividend-log/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.entry;
}

/**
 * Confirm a dividend log entry.
 */
export async function confirmDividendEntry(id: number): Promise<DividendLogEntry> {
  const data = await apiFetch(`/api/portfolio/dividend-log/confirm/${id}`, {
    method: 'POST',
  });
  return data.entry;
}

/**
 * Delete a dividend log entry (only non-confirmed entries).
 */
export async function deleteDividendEntry(id: number): Promise<void> {
  await apiFetch(`/api/portfolio/dividend-log/${id}`, { method: 'DELETE' });
}

/**
 * Trigger dividend backfill for a single holding.
 */
export async function backfillDividends(params: {
  symbol: string;
  shares: number;
  buy_date?: string;
  drip_enabled?: boolean;
}): Promise<BackfillResult> {
  return apiFetch('/api/portfolio/dividend-log/backfill', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Trigger dividend backfill for all holdings.
 */
export async function backfillAllDividends(): Promise<{ results: BackfillResult[] }> {
  return apiFetch('/api/portfolio/dividend-log/backfill-all', { method: 'POST' });
}

/**
 * Process DRIP for a dividend log entry.
 */
export async function processDrip(
  entryId: number,
  priceAtPayment: number
): Promise<{ symbol: string; dripSharesAdded: number; priceAtPayment: number; totalReceived: number }> {
  return apiFetch(`/api/portfolio/dividend-log/drip/${entryId}`, {
    method: 'POST',
    body: JSON.stringify({ price_at_payment: priceAtPayment }),
  });
}

/**
 * Build a DividendCell map (year-month-symbol → total) from log entries.
 * Compatible with the existing DividendCell format used by DividendsTab.
 */
export function buildDividendCellFromLog(entries: DividendLogEntry[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of entries) {
    const date = new Date(entry.payment_date);
    const yr = date.getFullYear();
    const mi = date.getMonth(); // 0-indexed
    const key = `${yr}-${mi}-${entry.symbol}`;
    result[key] = parseFloat(((result[key] || 0) + entry.total_received).toFixed(4));
  }
  return result;
}

/**
 * Get total dividends per symbol from log entries.
 */
export function getTotalsBySymbol(entries: DividendLogEntry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    totals[entry.symbol] = parseFloat(((totals[entry.symbol] || 0) + entry.total_received).toFixed(4));
  }
  return totals;
}

/**
 * Normalized dividend entry for display and type safety.
 * Maps to DividendLogEntry fields with cleaner names.
 * Historical entries are immutable — never recalculated when shares change.
 */
export interface DividendEntry {
  ticker: string       // stock symbol
  date: string         // payment date (ISO string)
  amount: number       // total dividend received (shares_held × per_share at payment time)
  sharesAtTime: number // shares held WHEN the dividend was paid (immutable historical fact)
  perShare: number     // dividend per share
  source: 'manual' | 'calculated' // user-entered vs auto-calculated
}

/**
 * Convert a DividendLogEntry to a DividendEntry (normalized view).
 */
export function toDividendEntry(entry: DividendLogEntry): DividendEntry {
  return {
    ticker: entry.symbol,
    date: entry.payment_date,
    amount: entry.total_received,
    sharesAtTime: entry.shares_held,
    perShare: entry.dividend_per_share,
    source: entry.source === 'manual' ? 'manual' : 'calculated',
  }
}

/**
 * Calculate proportional dividends for a partial sell.
 * 
 * Rule: Sell 50 of 100 shares → sold record gets 50% of historical dividends.
 * The dividend LOG entries themselves NEVER change.
 * 
 * @param totalDividendsInLog - Sum of all dividend log entries for the ticker
 * @param sharesSold - Number of shares being sold
 * @param totalSharesHeld - Total shares held before the sell
 * @returns Proportional dividend amount to assign to the sold position record
 */
export function calculateProportionalDividends(
  totalDividendsInLog: number,
  sharesSold: number,
  totalSharesHeld: number
): number {
  if (totalSharesHeld <= 0 || sharesSold <= 0) return 0
  const proportion = Math.min(sharesSold / totalSharesHeld, 1)
  return parseFloat((totalDividendsInLog * proportion).toFixed(2))
}
