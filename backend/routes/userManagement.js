/**
 * User Management Routes
 *
 * GET  /api/user/export-data    — Export all user data (JWT required, 1/hr rate limit)
 * DELETE /api/user/delete-account — Soft-delete user account (JWT required)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

// In-memory rate limit for exports: userId -> last export timestamp
const exportRateLimit = new Map();
const EXPORT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function createUserClient(accessToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function getAccessToken(req) {
  return req.headers['authorization']?.slice(7).trim() || null;
}

// ── GET /api/user/export-data ─────────────────────────────────────────────────
/**
 * Returns a JSON export of user data.
 * Rate limited: 1 export per user per hour.
 * IMPORTANT: Does NOT include proprietary data (scores, AI analysis internals).
 */
router.get('/export-data', requireAuth, async (req, res) => {
  const userId = req.user.id;

  // Rate limiting (in-memory per userId)
  const lastExport = exportRateLimit.get(userId);
  if (lastExport && Date.now() - lastExport < EXPORT_WINDOW_MS) {
    const waitMs = EXPORT_WINDOW_MS - (Date.now() - lastExport);
    const waitMin = Math.ceil(waitMs / 60000);
    return res.status(429).json({
      error: `Export rate limit reached. Please wait ${waitMin} minute(s) before exporting again.`,
      retryAfterMs: waitMs,
    });
  }

  try {
    const token = getAccessToken(req);
    const supabase = createUserClient(token);

    // Fetch all user data types
    const { data: rows, error } = await supabase
      .from('user_data')
      .select('data_type, data, updated_at')
      .eq('user_id', userId);

    if (error) {
      console.error('[Export] Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    // Build export object — only include user-owned data, no proprietary internals
    const exportData = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      user_id: userId,
      // Note: No scores, no AI analysis results, no internal system fields
      data: {},
    };

    const SAFE_TYPES = ['journal', 'portfolio', 'settings', 'watchlist'];

    (rows || []).forEach(row => {
      if (SAFE_TYPES.includes(row.data_type)) {
        // Strip any proprietary fields that might have leaked into stored data
        let safeData = row.data;
        if (row.data_type === 'journal' && safeData && typeof safeData === 'object') {
          // Remove AI analysis results and scoring fields if present
          const { aiInsights, scoringData, internalScore, ...userOwnedData } = safeData;
          safeData = userOwnedData;
        }
        exportData.data[row.data_type] = safeData;
        // Do NOT export updated_at for privacy (could reveal activity patterns)
      }
    });

    // Record this export for rate limiting
    exportRateLimit.set(userId, Date.now());

    // Clean up old entries from rate limit map (prevent memory leak)
    if (exportRateLimit.size > 10000) {
      const cutoff = Date.now() - EXPORT_WINDOW_MS;
      for (const [uid, ts] of exportRateLimit.entries()) {
        if (ts < cutoff) exportRateLimit.delete(uid);
      }
    }

    const filename = `tradvue-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);

  } catch (err) {
    console.error('[Export] Error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ── DELETE /api/user/delete-account ───────────────────────────────────────────
/**
 * Soft-deletes a user account.
 * Marks account for deletion — does NOT immediately purge data.
 * Per ToS §7: data is retained for up to 90 days before permanent deletion.
 */
router.delete('/delete-account', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;

  try {
    const token = getAccessToken(req);
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error('[Delete] Missing service role key — cannot soft-delete');
      return res.status(503).json({ error: 'Account deletion is temporarily unavailable' });
    }

    // Use service role client to update account status (user token can't update auth.users)
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Soft-delete: mark user metadata as pending deletion
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        deletion_requested: true,
        deletion_requested_at: new Date().toISOString(),
        // Hard deletion will be processed by a scheduled job after 90 days
      },
      // Disable the account so they can't log in
      ban_duration: '876000h', // ~100 years (effectively permanent until cleanup job runs)
    });

    if (updateError) {
      console.error('[Delete] Failed to mark account for deletion:', updateError.message);
      return res.status(500).json({ error: 'Failed to delete account. Please contact support.' });
    }

    console.log(`[Delete] Account marked for deletion: ${userId} (${userEmail})`);

    // TODO: Send confirmation email via your email service
    // For now we log it; wire up to SendGrid/Resend when available
    console.log(`[Delete] Should send confirmation email to: ${userEmail}`);

    res.json({
      message: 'Your account has been marked for deletion. Your data will be permanently deleted within approximately 90 days per our Terms of Service.',
      deleted_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[Delete] Error:', err.message);
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

module.exports = router;
