const request = require('supertest')
const express = require('express')

const mockSingleQueue = []
const mockSelectQueue = []
const mockInsertQueue = []

function buildQueryBuilder() {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    single: jest.fn(async () => mockSingleQueue.shift() || { data: null, error: null }),
    maybeSingle: jest.fn(async () => mockSingleQueue.shift() || { data: null, error: null }),
    insert: jest.fn(async () => mockInsertQueue.shift() || { data: null, error: null }),
    upsert: jest.fn(async () => mockInsertQueue.shift() || { data: null, error: null }),
    then: (resolve, reject) => Promise.resolve(mockSelectQueue.shift() || { data: [], error: null }).then(resolve, reject),
  }
  return builder
}

const mockSupabase = { from: jest.fn(() => buildQueryBuilder()) }

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}))

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'user-1', name: 'Trader One', email: 'trader@example.com' }
    next()
  },
}))

describe('Verified badges routes', () => {
  let app

  beforeEach(() => {
    delete process.env.BADGE_PRIVATE_KEY
    delete process.env.BADGE_PUBLIC_KEY
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockSingleQueue.length = 0
    mockSelectQueue.length = 0
    mockInsertQueue.length = 0
    mockSupabase.from.mockClear()

    app = express()
    app.use(express.json())
    app.use('/api/badges', require('../routes/badges'))
    app.use('/api/verify', require('../routes/verify'))
  })

  test('POST /api/badges/generate returns 400 when no eligible verified trades exist', async () => {
    mockSingleQueue.push({
      data: {
        data: {
          trades: [
            { id: 'm1', date: '2026-03-05', pnl: 100, source: 'manual' },
          ],
        },
        updated_at: '2026-03-23T12:00:00.000Z',
      },
      error: null,
    })

    const res = await request(app)
      .post('/api/badges/generate')
      .set('Authorization', 'Bearer test-token')
      .send({ period: 'monthly', month: '2026-03' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/eligible verified trades/i)
  })

  test('POST /api/badges/generate creates a signed badge from csv/webhook trades', async () => {
    mockSingleQueue.push({
      data: {
        data: {
          trades: [
            { id: 't1', date: '2026-03-05', pnl: 250, source: 'csv' },
            { id: 't2', date: '2026-03-08', pnl: -100, source: 'webhook' },
            { id: 't3', date: '2026-03-10', pnl: 175, source: 'manual' },
          ],
        },
        updated_at: '2026-03-23T12:00:00.000Z',
      },
      error: null,
    })
    mockInsertQueue.push({ data: [{ id: 'badge-1' }], error: null })

    const res = await request(app)
      .post('/api/badges/generate')
      .set('Authorization', 'Bearer test-token')
      .send({ period: 'monthly', month: '2026-03', template: 'dark' })

    expect(res.status).toBe(201)
    expect(res.body.badge).toBeTruthy()
    expect(res.body.badge.netPnl).toBe(150)
    expect(res.body.badge.tradeCount).toBe(2)
    expect(res.body.badge.verifyUrl).toMatch(/\/verify\//)
    expect(res.body.badge.signatureValid).toBe(true)
  })

  test('GET /api/verify/:hash returns verification payload and validates signature', async () => {
    const badgePayload = {
      traderDisplayName: 'Trader One',
      periodLabel: 'March 2026',
      netPnl: 900,
      winRate: 66.67,
      tradeCount: 3,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      generatedAt: '2026-03-23T12:00:00.000Z',
    }

    const badgeService = require('../services/badgeService')
    const signed = badgeService.signBadgePayload(badgePayload)

    mockSingleQueue.push({
      data: {
        id: 'badge-1',
        verify_hash: 'abc123',
        payload: signed.payload,
        signature: signed.signature,
        image_svg: '<svg></svg>',
        status: 'active',
        template: 'dark',
      },
      error: null,
    })

    const res = await request(app).get('/api/verify/abc123')

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(res.body.badge.verifyHash).toBe('abc123')
    expect(res.body.badge.netPnl).toBe(900)
  })
})
