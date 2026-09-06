/**
 * Dividend Log Service
 *
 * Handles the portfolio_dividend_log table — an immutable ledger of
 * dividend payments per user/symbol.
 *
 * Key contract:
 *   - Once is_confirmed = true, entries are NEVER auto-updated
 *   - Selling shares does NOT touch historical log entries
 *   - DRIP reinvestment updates portfolio_holdings.shares
 *   - backfill() is idempotent (ON CONFLICT DO NOTHING for confirmed entries)
 *
 * Q6 (P1-C) compounding rules — backfill():
 *   - Payments are applied in payment-date order.
 *   - When drip_enabled, later payments use a running share count that
 *     increases only after a payment whose reinvest price is known and
 *     auditable (caller map, history field, or a prior drip_price on the
 *     log). Never invent a price (no current/market/close proxy).
 *   - If DRIP is on but no auditable price exists for a date, that payment
 *     is recorded at the current share count and shares do NOT increase.
 *   - totalDividends counts eligible payments (after buy_date skip), not
 *     the raw history length.
 *
 * Q6 (P1-C) atomicity — processDRIP():
 *   - Compare-and-swap claim on the log row (drip_reinvested false → true),
 *     then increment holdings, then compensate (unclaim) if holdings fail.
 *   - Retry of a completed row is a no-op (no second share increment).
 *   - Stays on Supabase REST (not db.query): request path was migrated off
 *     direct Postgres to avoid Render IPv6 / DATABASE_URL failures.
 *
 * Q7 (out of scope): sold-position dividend totals remain symbol + date-range
 * until lot-linked FIFO/LIFO attribution lands. See getTotalForSymbol().
 *
 * NOTE: Migrated from db.query (direct Postgres/IPv6) to Supabase REST
 * (HTTPS/IPv4) to fix intermittent connectivity issues on Render.
 *
 * userId is the Supabase Auth UUID string (migration 022). Never parseInt
 * or coerce it — INTEGER portfolio_* user_id 500s every current auth user.
 */

const { createClient } = require('@supabase/supabase-js');
const { getStockInfo } = require('./stockInfo');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getLog(userId, { symbol = null } = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from('portfolio_dividend_log')
    .select('*')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false });
  if (symbol) query = query.eq('symbol', symbol.toUpperCase());
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// Q7 deferred: this sum is symbol + optional payment_date range, not
// lot-linked. Partial sells / FIFO-LIFO / specific-lot attribution stay
// symbol-wide until the lot model lands (Erick). Do not treat the result
// as tax-lot accurate.
async function getTotalForSymbol(userId, symbol, { fromDate = null, toDate = null } = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from('portfolio_dividend_log')
    .select('total_received')
    .eq('user_id', userId)
    .eq('symbol', symbol.toUpperCase());
  if (fromDate) query = query.gte('payment_date', fromDate);
  if (toDate) query = query.lte('payment_date', toDate);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).reduce((sum, row) => sum + parseFloat(row.total_received || 0), 0);
}

async function upsertEntry(userId, entry) {
  const {
    symbol,
    payment_date,
    ex_date = null,
    dividend_per_share,
    shares_held,
    total_received,
    source = 'auto',
    is_confirmed = false,
    drip_reinvested = false,
    drip_shares_added = null,
    drip_price = null,
    notes = null,
  } = entry;

  const supabase = getSupabase();

  // Check if confirmed entry exists first (immutable)
  const { data: existing, error: checkErr } = await supabase
    .from('portfolio_dividend_log')
    .select('*')
    .eq('user_id', userId)
    .eq('symbol', symbol.toUpperCase())
    .eq('payment_date', payment_date)
    .maybeSingle();

  if (checkErr) throw new Error(checkErr.message);

  if (existing && existing.is_confirmed) {
    return { entry: existing, skipped: true };
  }

  const payload = {
    user_id: userId,
    symbol: symbol.toUpperCase(),
    payment_date,
    ex_date,
    dividend_per_share,
    shares_held,
    total_received,
    source,
    is_confirmed,
    drip_reinvested,
    drip_shares_added,
    drip_price,
    notes,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('portfolio_dividend_log')
    .upsert(payload, { onConflict: 'user_id,symbol,payment_date' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { entry: data, skipped: false };
}

async function updateEntry(userId, entryId, updates) {
  const allowedFields = ['shares_held', 'total_received', 'notes', 'dividend_per_share'];
  const payload = { source: 'manual', is_confirmed: true, updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (updates[field] !== undefined) payload[field] = updates[field];
  }
  if (Object.keys(payload).length === 3) throw new Error('No valid fields to update');

  const { data, error } = await getSupabase()
    .from('portfolio_dividend_log')
    .update(payload)
    .eq('id', entryId)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Entry not found or unauthorized');
  return data;
}

async function confirmEntry(userId, entryId) {
  const { data, error } = await getSupabase()
    .from('portfolio_dividend_log')
    .update({ is_confirmed: true, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Entry not found or unauthorized');
  return data;
}

async function deleteEntry(userId, entryId) {
  const supabase = getSupabase();
  // Only non-confirmed entries can be deleted
  const { data: existing, error: checkErr } = await supabase
    .from('portfolio_dividend_log')
    .select('id, is_confirmed')
    .eq('id', entryId)
    .eq('user_id', userId)
    .maybeSingle();

  if (checkErr) throw new Error(checkErr.message);
  if (!existing) throw new Error('Entry not found or unauthorized');
  if (existing.is_confirmed) throw new Error('Cannot delete confirmed entries');

  const { data, error } = await supabase
    .from('portfolio_dividend_log')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Auditable reinvest price only. Ignores current/market/close proxies so
 * backfill never silently invents a DRIP price.
 *
 * Accepted sources (first match wins):
 *   1. reinvestPrices[paymentDate] from the caller
 *   2. history row reinvestPrice / reinvest_price / price
 *   3. existing log drip_price for that payment_date (already persisted)
 */
function resolveAuditableReinvestPrice(div, reinvestPrices = null, existingDripPrice = null) {
  const dateKey = div?.date;
  const candidates = [
    reinvestPrices && dateKey != null ? reinvestPrices[dateKey] : undefined,
    div?.reinvestPrice,
    div?.reinvest_price,
    div?.price,
    existingDripPrice,
  ];
  for (const raw of candidates) {
    if (raw == null || raw === '') continue;
    const price = typeof raw === 'number' ? raw : parseFloat(raw);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return null;
}

function computeDripShares(totalReceived, price) {
  const total = parseFloat(totalReceived);
  const p = parseFloat(price);
  if (!Number.isFinite(total) || !Number.isFinite(p) || p <= 0) return null;
  return parseFloat((total / p).toFixed(6));
}

function addShares(currentShares, added) {
  return parseFloat((parseFloat(currentShares) + parseFloat(added)).toFixed(6));
}

function buildExistingDripPriceMap(rows) {
  const map = {};
  for (const row of rows || []) {
    const p = parseFloat(row.drip_price);
    if (row.payment_date && Number.isFinite(p) && p > 0) {
      map[row.payment_date] = p;
    }
  }
  return map;
}

async function backfill(userId, { symbol, shares, buy_date, drip_enabled = false, reinvestPrices = null }) {
  const upperSymbol = symbol.toUpperCase();
  const buyDate = buy_date ? new Date(buy_date) : null;

  let stockInfo;
  try {
    stockInfo = await getStockInfo(upperSymbol);
  } catch (err) {
    throw new Error(`Failed to fetch stock info for ${upperSymbol}: ${err.message}`);
  }

  const history = stockInfo?.dividendHistory || [];
  if (!history.length) {
    return {
      symbol: upperSymbol,
      inserted: 0,
      skipped: 0,
      errors: 0,
      message: 'No dividend history available from data source',
    };
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  let currentShares = parseFloat(shares);
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let preBuySkipped = 0;
  let dripCompounded = 0;
  let dripSkippedNoPrice = 0;
  let eligiblePayments = 0;

  // Prior drip_price values are auditable (already written to the ledger).
  let existingDripPrices = {};
  try {
    existingDripPrices = buildExistingDripPriceMap(await getLog(userId, { symbol: upperSymbol }));
  } catch (err) {
    console.warn(`[DividendLog] Could not load existing drip prices for ${upperSymbol}:`, err.message);
  }

  for (const div of sorted) {
    if (buyDate && new Date(div.date) <= buyDate) {
      preBuySkipped++;
      continue;
    }
    eligiblePayments++;

    const sharesAtPayment = currentShares;
    const totalReceived = parseFloat((div.amount * sharesAtPayment).toFixed(4));
    const dripPrice = drip_enabled
      ? resolveAuditableReinvestPrice(div, reinvestPrices, existingDripPrices[div.date])
      : null;
    const dripSharesAdded = dripPrice ? computeDripShares(totalReceived, dripPrice) : null;

    if (drip_enabled && !dripSharesAdded) dripSkippedNoPrice++;

    try {
      const result = await upsertEntry(userId, {
        symbol: upperSymbol,
        payment_date: div.date,
        dividend_per_share: div.amount,
        shares_held: sharesAtPayment,
        total_received: totalReceived,
        source: 'auto',
        is_confirmed: false,
      });
      if (result.skipped) skipped++;
      else inserted++;

      // Advance the running share count after this payment is recorded, even
      // when the upsert was skipped (confirmed row). Subsequent auto rows
      // must still compound from the same payment-order path.
      if (dripSharesAdded) {
        currentShares = addShares(currentShares, dripSharesAdded);
        dripCompounded++;
      }
    } catch (err) {
      console.error(`[DividendLog] Error inserting ${upperSymbol} ${div.date}:`, err.message);
      errors++;
      // Do not compound after a failed write — the ledger may not contain
      // this payment, so inventing a share increase would desync later rows.
    }
  }

  return {
    symbol: upperSymbol,
    inserted,
    skipped,
    errors,
    // Eligible payments only — pre-buy dates used to inflate this count.
    totalDividends: eligiblePayments,
    preBuySkipped,
    dripCompounded,
    dripSkippedNoPrice,
    endingShares: currentShares,
  };
}

async function backfillAllHoldings(userId) {
  const supabase = getSupabase();
  const { data: holdings, error } = await supabase
    .from('portfolio_holdings')
    .select('symbol,shares,buy_date,drip_enabled')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  const results = [];
  for (const holding of (holdings || [])) {
    const { count, error: cntErr } = await supabase
      .from('portfolio_dividend_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('symbol', holding.symbol);

    if (cntErr) {
      results.push({ symbol: holding.symbol, status: 'error', error: cntErr.message });
      continue;
    }

    if (count > 0) {
      results.push({ symbol: holding.symbol, status: 'already_populated', count });
      continue;
    }

    try {
      const result = await backfill(userId, {
        symbol: holding.symbol,
        shares: holding.shares,
        buy_date: holding.buy_date,
        drip_enabled: holding.drip_enabled,
      });
      results.push({ ...result, status: 'backfilled' });
    } catch (err) {
      results.push({ symbol: holding.symbol, status: 'error', error: err.message });
    }
  }

  return results;
}

async function fetchDividendEntry(supabase, userId, entryId) {
  const { data: entries, error } = await supabase
    .from('portfolio_dividend_log')
    .select('*')
    .eq('id', entryId)
    .eq('user_id', userId)
    .limit(1);

  if (error) throw new Error(error.message);
  if (!entries || entries.length === 0) throw new Error('Entry not found');
  return entries[0];
}

async function unclaimDRIP(supabase, userId, entryId) {
  const { error } = await supabase
    .from('portfolio_dividend_log')
    .update({
      drip_reinvested: false,
      drip_shares_added: null,
      drip_price: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', userId);
  if (error) {
    console.error(`[DividendLog] Failed to unclaim DRIP entry ${entryId}:`, error.message);
    throw new Error(`DRIP holdings update failed and unclaim failed: ${error.message}`);
  }
}

async function incrementHoldingShares(supabase, userId, symbol, dripSharesAdded) {
  const { data: holding, error: holdingErr } = await supabase
    .from('portfolio_holdings')
    .select('shares')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .maybeSingle();

  if (holdingErr) throw new Error(holdingErr.message);
  if (!holding) throw new Error('Holding not found for symbol');

  const newShares = addShares(holding.shares, dripSharesAdded);
  const { data: updated, error: updateHoldingErr } = await supabase
    .from('portfolio_holdings')
    .update({ shares: newShares, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .select('shares')
    .maybeSingle();

  if (updateHoldingErr) throw new Error(updateHoldingErr.message);
  if (!updated) throw new Error('Holding update failed');
  return parseFloat(updated.shares);
}

/**
 * Apply DRIP to a log entry and the matching holding.
 *
 * State machine (existing columns only — no migration):
 *   idle      drip_reinvested=false
 *   claimed   CAS update sets drip_reinvested=true + drip_* (winner only)
 *   complete  holdings increment succeeded
 *   unclaimed compensating write if holdings increment fails → idle again
 *
 * Concurrent callers: only the CAS winner increments shares. Losers refetch
 * and return alreadyProcessed without a second increment.
 * Retry after success: alreadyProcessed, shares unchanged.
 * Retry after holdings failure: row is idle again, so a later call can apply.
 */
async function processDRIP(userId, entryId, priceAtPayment) {
  if (!(parseFloat(priceAtPayment) > 0)) {
    throw new Error('Invalid price for DRIP calculation');
  }

  const supabase = getSupabase();
  const entry = await fetchDividendEntry(supabase, userId, entryId);

  if (entry.drip_reinvested) {
    return {
      symbol: entry.symbol,
      dripSharesAdded: parseFloat(entry.drip_shares_added),
      priceAtPayment: parseFloat(entry.drip_price),
      totalReceived: entry.total_received,
      newShares: null,
      alreadyProcessed: true,
    };
  }

  const dripSharesAdded = computeDripShares(entry.total_received, priceAtPayment);
  if (dripSharesAdded == null) throw new Error('Invalid price for DRIP calculation');

  // CAS claim — do not mark reinvested unless this caller wins the race.
  const { data: claimed, error: claimErr } = await supabase
    .from('portfolio_dividend_log')
    .update({
      drip_reinvested: true,
      drip_shares_added: dripSharesAdded,
      drip_price: priceAtPayment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', userId)
    .eq('drip_reinvested', false)
    .select()
    .maybeSingle();

  if (claimErr) throw new Error(claimErr.message);

  if (!claimed) {
    const latest = await fetchDividendEntry(supabase, userId, entryId);
    if (latest.drip_reinvested) {
      return {
        symbol: latest.symbol,
        dripSharesAdded: parseFloat(latest.drip_shares_added),
        priceAtPayment: parseFloat(latest.drip_price),
        totalReceived: latest.total_received,
        newShares: null,
        alreadyProcessed: true,
      };
    }
    throw new Error('DRIP claim failed');
  }

  let newShares;
  try {
    newShares = await incrementHoldingShares(supabase, userId, entry.symbol, dripSharesAdded);
  } catch (err) {
    // Compensating unclaim: never leave "reinvested but shares missing".
    await unclaimDRIP(supabase, userId, entryId);
    throw err;
  }

  return {
    symbol: entry.symbol,
    dripSharesAdded,
    priceAtPayment,
    totalReceived: entry.total_received,
    newShares,
    alreadyProcessed: false,
  };
}

module.exports = {
  getLog,
  getTotalForSymbol,
  upsertEntry,
  updateEntry,
  confirmEntry,
  deleteEntry,
  backfill,
  backfillAllHoldings,
  processDRIP,
  resolveAuditableReinvestPrice,
  computeDripShares,
};
