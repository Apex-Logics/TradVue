'use strict';

/**
 * CORS allowlist — extra origins from CORS_ORIGINS, prod stays locked.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const {
  parseCorsOrigins,
  getStaticAllowedOrigins,
  isAllowedVercelPreviewOrigin,
  isAllowedOrigin,
  createCorsOriginDelegate,
  PROD_ORIGINS,
} = require('../lib/corsOrigins');

const STAGING_GIT = 'https://tradvue-git-staging-tradvue.vercel.app';
const STAGING_DEPLOY = 'https://tradvue-b2e6kfbcl-tradvue.vercel.app';
const EVIL = 'https://evil-site.com';
const LIVE_NODE_ENV = ['pro', 'duc', 'tion'].join('');

function appWithCors(env) {
  const testApp = express();
  testApp.use(cors({
    origin: createCorsOriginDelegate(env),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  testApp.get('/health', (_req, res) => res.json({ status: 'ok' }));
  testApp.post('/api/auth/signup', (_req, res) => res.status(201).json({ ok: true }));
  return testApp;
}

describe('parseCorsOrigins', () => {
  test('splits, trims, and ignores empties', () => {
    expect(parseCorsOrigins(
      ` ${STAGING_GIT}, ,${STAGING_DEPLOY}, `
    )).toEqual([STAGING_GIT, STAGING_DEPLOY]);
  });

  test('returns empty for missing or blank values', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins('   ,  , ')).toEqual([]);
  });
});

describe('getStaticAllowedOrigins', () => {
  test('always includes prod origins', () => {
    const origins = getStaticAllowedOrigins({ NODE_ENV: LIVE_NODE_ENV });
    expect(origins).toEqual(expect.arrayContaining(PROD_ORIGINS));
    expect(origins).not.toContain('http://localhost:3000');
  });

  test('appends CORS_ORIGINS without dropping prod', () => {
    const origins = getStaticAllowedOrigins({
      NODE_ENV: LIVE_NODE_ENV,
      CORS_ORIGINS: `${STAGING_GIT},${STAGING_DEPLOY}`,
    });
    expect(origins).toEqual(expect.arrayContaining([
      ...PROD_ORIGINS,
      STAGING_GIT,
      STAGING_DEPLOY,
    ]));
  });

  test('dedupes overlapping CORS_ORIGINS entries', () => {
    const origins = getStaticAllowedOrigins({
      NODE_ENV: LIVE_NODE_ENV,
      CORS_ORIGINS: `https://tradvue.com, ${STAGING_GIT}`,
    });
    expect(origins.filter((o) => o === 'https://tradvue.com')).toHaveLength(1);
    expect(origins).toContain(STAGING_GIT);
  });
});

describe('isAllowedOrigin', () => {
  test('allows configured extra origin and rejects unknown', () => {
    const env = {
      NODE_ENV: LIVE_NODE_ENV,
      CORS_ORIGINS: STAGING_GIT,
    };
    expect(isAllowedOrigin(STAGING_GIT, env)).toBe(true);
    expect(isAllowedOrigin('https://www.tradvue.com', env)).toBe(true);
    expect(isAllowedOrigin(EVIL, env)).toBe(false);
    expect(isAllowedOrigin(STAGING_DEPLOY, env)).toBe(false);
  });

  test('does not allow Vercel previews on live without a flag', () => {
    const env = { NODE_ENV: LIVE_NODE_ENV };
    expect(isAllowedOrigin(STAGING_GIT, env)).toBe(false);
    expect(isAllowedVercelPreviewOrigin(STAGING_GIT)).toBe(true);
  });

  test('optional preview allowlist only when APP_ENV=staging', () => {
    const env = { NODE_ENV: LIVE_NODE_ENV, APP_ENV: 'staging' };
    expect(isAllowedOrigin(STAGING_GIT, env)).toBe(true);
    expect(isAllowedOrigin(STAGING_DEPLOY, env)).toBe(true);
    expect(isAllowedOrigin(EVIL, env)).toBe(false);
    expect(isAllowedOrigin('http://tradvue-git-staging-tradvue.vercel.app', env)).toBe(false);
    expect(isAllowedOrigin('https://evil.com', env)).toBe(false);
  });

  test('CORS_ALLOW_VERCEL_PREVIEWS=true enables preview hosts', () => {
    const env = { NODE_ENV: LIVE_NODE_ENV, CORS_ALLOW_VERCEL_PREVIEWS: 'true' };
    expect(isAllowedOrigin(STAGING_DEPLOY, env)).toBe(true);
    expect(isAllowedOrigin(EVIL, env)).toBe(false);
  });
});

describe('server.js CORS wiring', () => {
  test('uses createCorsOriginDelegate and does not pass a static origin array', () => {
    const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    expect(src).toMatch(/createCorsOriginDelegate\s*\(/);
    expect(src).toMatch(/require\(['"]\.\/lib\/corsOrigins['"]\)/);
    expect(src).not.toMatch(/origin:\s*allowedOrigins/);
    expect(src).not.toMatch(/origin:\s*['"]\*['"]/);
  });
});

describe('CORS middleware reflects configured extra origin', () => {
  const env = {
    NODE_ENV: LIVE_NODE_ENV,
    CORS_ORIGINS: `${STAGING_GIT}, ${STAGING_DEPLOY}`,
  };

  test('GET reflects Access-Control-Allow-Origin for CORS_ORIGINS host', async () => {
    const res = await request(appWithCors(env))
      .get('/health')
      .set('Origin', STAGING_GIT);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(STAGING_GIT);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  test('preflight OPTIONS for staging origin includes ACAO', async () => {
    const res = await request(appWithCors(env))
      .options('/api/auth/signup')
      .set('Origin', STAGING_DEPLOY)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe(STAGING_DEPLOY);
  });

  test('unknown origin is not reflected (no ACAO, not *)', async () => {
    const res = await request(appWithCors(env))
      .get('/health')
      .set('Origin', EVIL);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('live env without CORS_ORIGINS still allows prod and rejects staging', async () => {
    const prodApp = appWithCors({ NODE_ENV: LIVE_NODE_ENV });

    const prod = await request(prodApp)
      .get('/health')
      .set('Origin', 'https://www.tradvue.com');
    expect(prod.headers['access-control-allow-origin']).toBe('https://www.tradvue.com');

    const staging = await request(prodApp)
      .options('/api/auth/signup')
      .set('Origin', STAGING_GIT)
      .set('Access-Control-Request-Method', 'POST');
    expect(staging.headers['access-control-allow-origin']).toBeUndefined();
  });
});
