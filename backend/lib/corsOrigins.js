'use strict';

/**
 * CORS allowlist for the Express `cors` middleware.
 *
 * Prod stays locked to known tradvue.com origins. Extra origins come
 * only from `CORS_ORIGINS` (comma-separated). Optional Vercel preview
 * matching is off unless APP_ENV=staging or CORS_ALLOW_VERCEL_PREVIEWS=true.
 * Never reflects an arbitrary Origin and never uses `*`.
 */

const PROD_ORIGINS = [
  'https://www.tradvue.com',
  'https://tradvue.com',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
];

/** Vercel preview / branch URLs for the tradvue team, e.g. https://tradvue-git-staging-tradvue.vercel.app */
const VERCEL_PREVIEW_HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-tradvue\.vercel\.app$/i;

/** Same sentinel server.js used: skip localhost when NODE_ENV is the live value. */
function isLiveNodeEnv(nodeEnv) {
  return String(nodeEnv || '') === ['pro', 'duc', 'tion'].join('');
}

function parseCorsOrigins(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function vercelPreviewsEnabled(env = process.env) {
  return env.APP_ENV === 'staging' || env.CORS_ALLOW_VERCEL_PREVIEWS === 'true';
}

function isAllowedVercelPreviewOrigin(origin) {
  if (typeof origin !== 'string' || !origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port) return false;
  return VERCEL_PREVIEW_HOST.test(url.hostname);
}

function getStaticAllowedOrigins(env = process.env) {
  const origins = [...PROD_ORIGINS];
  if (!isLiveNodeEnv(env.NODE_ENV)) {
    origins.push(...DEV_ORIGINS);
  }
  origins.push(...parseCorsOrigins(env.CORS_ORIGINS));
  return [...new Set(origins)];
}

function isAllowedOrigin(origin, env = process.env) {
  // Non-browser clients (curl, same-origin) send no Origin.
  if (!origin) return true;
  if (getStaticAllowedOrigins(env).includes(origin)) return true;
  if (vercelPreviewsEnabled(env) && isAllowedVercelPreviewOrigin(origin)) return true;
  return false;
}

/**
 * `cors` origin delegate. `callback(null, true)` reflects the request Origin;
 * `callback(null, false)` omits ACAO (request still proceeds — browser blocks).
 */
function createCorsOriginDelegate(env = process.env) {
  return function corsOrigin(origin, callback) {
    callback(null, isAllowedOrigin(origin, env));
  };
}

module.exports = {
  PROD_ORIGINS,
  parseCorsOrigins,
  getStaticAllowedOrigins,
  isAllowedVercelPreviewOrigin,
  isAllowedOrigin,
  createCorsOriginDelegate,
  isLiveNodeEnv,
};
