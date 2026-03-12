/**
 * PostgreSQL Database Service
 * 
 * Supabase-backed connection pool.
 * All routes import this and call db.query() directly.
 *
 * NOTE: Force IPv4 before creating the Pool — Render/Supabase IPv6 is unreachable.
 */
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  // Suppress noisy per-connection logs in production
  if (process.env.NODE_ENV === 'development') {
    console.info('[DB] New PostgreSQL connection established');
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client (non-fatal):', err.message);
});

// Test connection after a delay (let healthcheck pass first)
setTimeout(() => {
  pool.query('SELECT NOW()')
    .then(r => console.info(`[DB] ✅ PostgreSQL connected — server time: ${r.rows[0].now}`))
    .catch(e => console.error('[DB] ⚠️ PostgreSQL connection failed (will retry on first request):', e.message));
}, 5000);

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
