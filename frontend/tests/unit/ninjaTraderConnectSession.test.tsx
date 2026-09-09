import * as fs from 'fs'
import * as path from 'path'

const NT = fs.readFileSync(
  path.join(__dirname, '../../app/components/NinjaTraderConnect.tsx'),
  'utf-8',
)
const ACCOUNT = fs.readFileSync(
  path.join(__dirname, '../../app/account/page.tsx'),
  'utf-8',
)

describe('NinjaTrader token fetches use session retry', () => {
  test('NT modal loads and creates tokens via fetchWithSessionRetry', () => {
    expect(NT).toContain("import { fetchWithSessionRetry } from '../lib/authSession'")
    expect(NT).toContain("const res = await fetchWithSessionRetry(API_BASE + '/api/webhooks/tokens'")
    expect(NT).toContain("const create = await fetchWithSessionRetry(API_BASE + '/api/webhooks/tokens'")
    expect(NT).toMatch(/fetchWithSessionRetry\(API_BASE \+ '\/api\/webhooks\/tokens',\s*\{\s*method:\s*'POST'/)
    expect(NT).not.toMatch(/await fetch\(API_BASE \+ '\/api\/webhooks\/tokens'/)
  })

  test('account page NT status, disconnect, and modal close use the retry helper', () => {
    expect(ACCOUNT).toContain("import { fetchWithSessionRetry } from '../lib/authSession'")
    expect(ACCOUNT).toContain('fetchNtWebhookTokens')
    expect(ACCOUNT).toContain("fetchWithSessionRetry(API_BASE + '/api/webhooks/tokens'")
    expect(ACCOUNT).toContain('fetchWithSessionRetry(`${API_BASE}/api/webhooks/tokens/${t.id}`')
    expect(ACCOUNT).not.toMatch(/fetch\(API_BASE \+ '\/api\/webhooks\/tokens'/)
  })
})
