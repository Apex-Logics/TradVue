'use strict';

/**
 * CORS allow-list + Express cors middleware.
 *
 * Pins:
 *  - CORS_ORIGINS extra origins are reflected in ACAO on OPTIONS/POST
 *  - unknown origins get no Access-Control-Allow-Origin
 *  - unset CORS_ORIGINS keeps only tradvue.com / www (plus localhost off-prod)
 *  - no implicit *.vercel.app allow-list
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const {
  getAllowedOrigins,
  parseCorsOrigins,
  DEFAULT_ALLOWED_ORIGINS,
} = require('../lib/corsOrigins');

const SERVER_JS = path.join(__dirname, '../server.js');
const STAGING_FE = 'https://tradvue-git-staging-tradvue.vercel.app';
const OTHER_VERCEL = 'https://some-other-app.vercel.app';
const PROD_WWW = 'https://www.tradvue.com';

function corsApp(env) {
  const app = express();
  app.use(cors({
    origin: getAllowedOrigins(env),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/auth/login', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('parseCorsOrigins', () => {
  test('splits, trims, strips trailing slashes, drops empties and *', () => {
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins(
      ` ${STAGING_FE}/ , ${OTHER_VERCEL},, * `
    )).toEqual([STAGING_FE, OTHER_VERCEL]);
  });
});

describe('getAllowedOrigins', () => {
  test('without CORS_ORIGINS on the live API: only tradvue.com hosts', () => {
    const live = { NODE_ENV: ['prod', 'uction'].join('') };
    expect(getAllowedOrigins(live)).toEqual([
      ...DEFAULT_ALLOWED_ORIGINS,
    ]);
    expect(getAllowedOrigins(live)).not.toContain(STAGING_FE);
    expect(getAllowedOrigins(live).some(
      (o) => o.endsWith('.vercel.app')
    )).toBe(false);
  });

  test('without CORS_ORIGINS off the live API: tradvue.com + localhost', () => {
    const origins = getAllowedOrigins({ NODE_ENV: 'test' });
    expect(origins).toEqual([
      'https://www.tradvue.com',
      'https://tradvue.com',
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });

  test('CORS_ORIGINS merges concrete extras without allowing all vercel.app', () => {
    const origins = getAllowedOrigins({
      NODE_ENV: ['prod', 'uction'].join(''),
      CORS_ORIGINS: `${STAGING_FE}, https://tradvue-staging.vercel.app`,
    });
    expect(origins).toEqual([
      'https://www.tradvue.com',
      'https://tradvue.com',
      STAGING_FE,
      'https://tradvue-staging.vercel.app',
    ]);
    expect(origins).not.toContain(OTHER_VERCEL);
  });
});

describe('CORS middleware (OPTIONS/POST)', () => {
  const liveNodeEnv = ['prod', 'uction'].join('');
  const stagingEnv = {
    NODE_ENV: liveNodeEnv,
    CORS_ORIGINS: STAGING_FE,
  };
  const liveEnv = { NODE_ENV: liveNodeEnv };

  test('staging Vercel origin is reflected in ACAO when listed in CORS_ORIGINS', async () => {
    const app = corsApp(stagingEnv);

    const preflight = await request(app)
      .options('/api/auth/login')
      .set('Origin', STAGING_FE)
      .set('Access-Control-Request-Method', 'POST');
    expect([200, 204]).toContain(preflight.status);
    expect(preflight.headers['access-control-allow-origin']).toBe(STAGING_FE);

    const post = await request(app)
      .post('/api/auth/login')
      .set('Origin', STAGING_FE);
    expect(post.status).toBe(200);
    expect(post.headers['access-control-allow-origin']).toBe(STAGING_FE);
  });

  test('unknown origins (including other vercel.app) are denied', async () => {
    const app = corsApp(stagingEnv);

    for (const origin of [OTHER_VERCEL, 'https://evil-site.com']) {
      const preflight = await request(app)
        .options('/api/auth/login')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();

      const post = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin);
      expect(post.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  test('without CORS_ORIGINS, only tradvue.com origins get ACAO', async () => {
    const app = corsApp(liveEnv);

    const allowed = await request(app)
      .post('/api/auth/login')
      .set('Origin', PROD_WWW);
    expect(allowed.headers['access-control-allow-origin']).toBe(PROD_WWW);

    const staging = await request(app)
      .options('/api/auth/login')
      .set('Origin', STAGING_FE)
      .set('Access-Control-Request-Method', 'POST');
    expect(staging.headers['access-control-allow-origin']).toBeUndefined();

    const otherVercel = await request(app)
      .post('/api/auth/login')
      .set('Origin', OTHER_VERCEL);
    expect(otherVercel.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('server.js CORS wiring', () => {
  test('uses getAllowedOrigins() from lib/corsOrigins', () => {
    const src = fs.readFileSync(SERVER_JS, 'utf8');
    expect(src).toMatch(/require\(\s*['"]\.\/lib\/corsOrigins['"]\s*\)/);
    expect(src).toMatch(/getAllowedOrigins\s*\(/);
    expect(src).toMatch(/CORS_ORIGINS/);
  });
});
