'use strict';

/**
 * Browser Content-Security-Policy for the Next.js frontend.
 *
 * connect-src includes the origin of NEXT_PUBLIC_API_URL so Preview/staging
 * builds automatically allow the staging API. Live builds that set
 * NEXT_PUBLIC_API_URL to the prod API do not list the staging host.
 *
 * Do not hardcode both APIs into one policy — that would let a prod page
 * talk to staging (and vice versa).
 */

const STATIC_CONNECT_SRC = Object.freeze([
  "'self'",
  'https://www.google-analytics.com',
  'https://open.er-api.com',
]);

const DEFAULT_API_URL = 'http://localhost:3001';

function originFromApiUrl(apiUrl) {
  if (typeof apiUrl !== 'string' || !apiUrl.trim()) return null;
  try {
    const url = new URL(apiUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function connectSrcForApiUrl(apiUrl) {
  const origin = originFromApiUrl(apiUrl);
  const tokens = [...STATIC_CONNECT_SRC];
  if (origin && !tokens.includes(origin)) {
    tokens.splice(1, 0, origin);
  }
  return tokens;
}

function buildContentSecurityPolicy({ apiUrl } = {}) {
  const resolved = apiUrl === undefined || apiUrl === null || apiUrl === ''
    ? DEFAULT_API_URL
    : apiUrl;
  const connectSrc = connectSrcForApiUrl(resolved).join(' ');
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    'frame-src https://s.tradingview.com https://www.tradingview.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

module.exports = {
  DEFAULT_API_URL,
  STATIC_CONNECT_SRC,
  originFromApiUrl,
  connectSrcForApiUrl,
  buildContentSecurityPolicy,
};
