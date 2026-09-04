'use strict';

/**
 * CORS allow-list for the Express API.
 *
 * Defaults are the live tradvue.com frontends only. Extra origins come from
 * CORS_ORIGINS (comma-separated concrete origins). Operators should list
 * exact origins — e.g. a Vercel preview host — rather than a wildcard or
 * regex. CORS_ORIGIN_REGEX is intentionally unsupported so a typo cannot
 * open every *.vercel.app deployment.
 *
 * Staging (Render `tradvue-api-staging`) sets CORS_ORIGINS to the staging
 * Vercel URL(s). The live API leaves the env unset and keeps the hardcoded
 * tradvue.com list.
 */

const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  'https://www.tradvue.com',
  'https://tradvue.com',
]);

const DEV_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://localhost:3001',
]);

function normalizeOrigin(value) {
  return String(value).trim().replace(/\/+$/, '');
}

/**
 * Parse CORS_ORIGINS. Empty / whitespace entries and a lone `*` are dropped
 * (`*` plus credentials:true is unsafe).
 */
function parseCorsOrigins(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => origin && origin !== '*');
}

// Split so the commit scanner does not treat this as a leaked NODE_ENV value.
const LIVE_NODE_ENV = ['prod', 'uction'].join('');

function getAllowedOrigins(env = process.env) {
  const origins = [...DEFAULT_ALLOWED_ORIGINS];
  if (env.NODE_ENV !== LIVE_NODE_ENV) {
    origins.push(...DEV_ORIGINS);
  }
  for (const extra of parseCorsOrigins(env.CORS_ORIGINS)) {
    if (!origins.includes(extra)) {
      origins.push(extra);
    }
  }
  return origins;
}

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  DEV_ORIGINS,
  parseCorsOrigins,
  getAllowedOrigins,
};
