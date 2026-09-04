/**
 * Frontend CSP: connect-src must follow NEXT_PUBLIC_API_URL.
 *
 * Staging Vercel builds set that env to the staging API. Live builds
 * set it to the prod API. The static vercel.json CSP is gone so it cannot
 * pin every environment to the prod host.
 */

import * as fs from 'fs'
import * as path from 'path'

const {
  buildContentSecurityPolicy,
  connectSrcForApiUrl,
  originFromApiUrl,
  DEFAULT_API_URL,
} = require('../../lib/contentSecurityPolicy') as {
  buildContentSecurityPolicy: (opts?: { apiUrl?: string }) => string
  connectSrcForApiUrl: (apiUrl?: string) => string[]
  originFromApiUrl: (apiUrl?: string) => string | null
  DEFAULT_API_URL: string
}

const STAGING_API = 'https://tradvue-api-staging.onrender.com'
const PROD_API = 'https://tradvue-api.onrender.com'
const ROOT = path.join(__dirname, '../..')

function connectSrcClause(policy: string): string {
  const match = policy.match(/connect-src ([^;]+)/)
  if (!match) throw new Error(`no connect-src in: ${policy}`)
  return match[1]
}

describe('originFromApiUrl', () => {
  test('strips path and rejects non-http(s)', () => {
    expect(originFromApiUrl(`${STAGING_API}/api/auth/login`)).toBe(STAGING_API)
    expect(originFromApiUrl('http://localhost:3001/')).toBe('http://localhost:3001')
    expect(originFromApiUrl('ftp://example.com')).toBeNull()
    expect(originFromApiUrl('not a url')).toBeNull()
    expect(originFromApiUrl('')).toBeNull()
  })
})

describe('connect-src follows NEXT_PUBLIC_API_URL', () => {
  test('staging API URL allows staging host and not the prod API', () => {
    const tokens = connectSrcForApiUrl(STAGING_API)
    expect(tokens).toContain(STAGING_API)
    expect(tokens).not.toContain(PROD_API)

    const clause = connectSrcClause(buildContentSecurityPolicy({ apiUrl: STAGING_API }))
    expect(clause).toContain(STAGING_API)
    expect(clause).not.toContain(PROD_API)
    expect(clause).toContain("'self'")
    expect(clause).toContain('https://www.google-analytics.com')
    expect(clause).toContain('https://open.er-api.com')
  })

  test('prod API URL allows prod host and not the staging API', () => {
    const clause = connectSrcClause(buildContentSecurityPolicy({ apiUrl: PROD_API }))
    expect(clause).toContain(PROD_API)
    expect(clause).not.toContain('tradvue-api-staging')
  })

  test('unset / default API URL does not unlock staging', () => {
    expect(DEFAULT_API_URL).toBe('http://localhost:3001')
    const clause = connectSrcClause(buildContentSecurityPolicy({}))
    expect(clause).toContain('http://localhost:3001')
    expect(clause).not.toContain('tradvue-api-staging')
  })
})

describe('CSP wiring (next.config / vercel.json)', () => {
  test('vercel.json no longer ships a static CSP (would pin every env to prod API)', () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
    const headerKeys = (vercel.headers || []).flatMap((entry: { headers?: { key: string }[] }) =>
      (entry.headers || []).map((h) => h.key)
    )
    expect(headerKeys).not.toContain('Content-Security-Policy')
    const raw = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')
    expect(raw).not.toMatch(/connect-src/)
  })

  test('next.config.js builds CSP from NEXT_PUBLIC_API_URL via the helper', () => {
    const src = fs.readFileSync(path.join(ROOT, 'next.config.js'), 'utf8')
    expect(src).toMatch(/require\(\s*['"]\.\/lib\/contentSecurityPolicy['"]\s*\)/)
    expect(src).toMatch(/buildContentSecurityPolicy\s*\(/)
    expect(src).toMatch(/NEXT_PUBLIC_API_URL/)
    expect(src).toMatch(/headers\s*\(/)
  })
})
