'use strict';

/**
 * Webhook auth / logging helpers (Q5 / Review B3–B5).
 *
 * B3 — Client IP must come from Express `req.ip` after `trust proxy` is set to
 *      the number of hops we control (Render = 1). Never take the leftmost
 *      X-Forwarded-For value; attackers can prepend anything.
 * B4 — Token path segments must never appear in access logs.
 * B5 — Token lookup is dual-read: SHA-256 hex first, then legacy plaintext.
 */

const crypto = require('crypto');

/** Render sits behind a single reverse proxy. `req.ip` is then the last untrusted hop. */
const TRUST_PROXY_HOPS = 1;

function hashWebhookToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function normalizeClientIp(ip) {
  if (!ip) return 'unknown';
  const trimmed = String(ip).trim();
  if (!trimmed) return 'unknown';
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7);
  return trimmed;
}

/**
 * Client IP for allowlisting. Relies on Express `trust proxy` so `req.ip` is
 * the last untrusted hop (or the socket address when no proxy headers exist).
 */
function getSourceIP(req) {
  const ip = (req && req.ip) || (req && req.socket && req.socket.remoteAddress) || 'unknown';
  return normalizeClientIp(ip);
}

/**
 * Redact `/api/webhook/tv/:token` and `/api/webhook/nt/:token` path segments
 * (and any query/hash suffix stays, minus the secret).
 */
function redactWebhookPath(url) {
  if (!url) return url;
  return String(url).replace(
    /(\/api\/webhook\/(?:tv|nt)\/)([^/?#]+)/gi,
    '$1[REDACTED]'
  );
}

function tokenLogId(token) {
  return hashWebhookToken(token).slice(0, 8);
}

module.exports = {
  TRUST_PROXY_HOPS,
  hashWebhookToken,
  normalizeClientIp,
  getSourceIP,
  redactWebhookPath,
  tokenLogId,
};
