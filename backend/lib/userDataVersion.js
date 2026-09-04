'use strict';

/**
 * Q2 — last-write-wins journal blob: version helpers.
 *
 * user_data already has updated_at (migration 010). No new version column.
 * PUT /data/:type accepts an optional precondition:
 *   - header If-Match (quoted or raw ISO timestamp)
 *   - header X-Expected-Updated-At
 *   - body field expectedUpdatedAt (stripped before persist)
 *
 * Missing precondition = legacy last-write-wins (old clients).
 * Present + mismatch = 409 with the current server copy.
 */

function stripQuotes(value) {
  const s = String(value).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s.startsWith('W/"') && s.endsWith('"')) return s.slice(3, -1);
  return s;
}

function normalizeExpectedValue(raw) {
  if (raw === undefined) return { provided: false, value: undefined };
  if (raw === null) return { provided: true, value: null };
  const s = stripQuotes(raw);
  if (s === '' || s === 'null' || s === 'undefined') return { provided: true, value: null };
  return { provided: true, value: s };
}

/**
 * @returns {{ provided: boolean, value: string|null|undefined }}
 *   provided=false → old client, no precondition
 *   provided=true, value=null → client believes no row exists
 *   provided=true, value=string → client believes this updated_at is current
 */
function parseExpectedUpdatedAt(req) {
  if (req.headers && req.headers['if-match'] != null) {
    return normalizeExpectedValue(req.headers['if-match']);
  }
  if (req.headers && req.headers['x-expected-updated-at'] != null) {
    return normalizeExpectedValue(req.headers['x-expected-updated-at']);
  }
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      && Object.prototype.hasOwnProperty.call(req.body, 'expectedUpdatedAt')) {
    return normalizeExpectedValue(req.body.expectedUpdatedAt);
  }
  return { provided: false, value: undefined };
}

function persistableBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const { expectedUpdatedAt, ...rest } = body;
  return rest;
}

function timestampsMatch(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (String(a) === String(b)) return true;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta === tb;
  return false;
}

function conflictPayload(type, existing) {
  return {
    error: 'version_conflict',
    message: `${type} was updated elsewhere`,
    type,
    updated_at: existing?.updated_at ?? null,
    data: existing?.data ?? null,
  };
}

module.exports = {
  parseExpectedUpdatedAt,
  persistableBody,
  timestampsMatch,
  conflictPayload,
  stripQuotes,
};
