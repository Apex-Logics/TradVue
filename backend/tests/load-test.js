/**
 * Basic load test for TradVue API
 *
 * Targets: /api/health, /api/market-data/batch, /api/feed/news, /api/calendar/today
 * Uses Node.js built-in fetch (no external deps required)
 *
 * Usage:
 *   node backend/tests/load-test.js [base_url] [concurrency] [duration_seconds]
 *
 * Defaults:
 *   base_url: https://tradvue-api.onrender.com
 *   concurrency: 20
 *   duration: 30s
 */

const BASE = process.argv[2] || 'https://tradvue-api.onrender.com'
const CONCURRENCY = parseInt(process.argv[3]) || 20
const DURATION_S = parseInt(process.argv[4]) || 30

const ENDPOINTS = [
  { path: '/api/health', weight: 3 },
  { path: '/api/market-data/batch?symbols=AAPL,MSFT,GOOG', weight: 2 },
  { path: '/api/feed/news?limit=5', weight: 2 },
  { path: '/api/calendar/today', weight: 2 },
  { path: '/api/crypto/snapshot', weight: 1 },
]

const totalWeight = ENDPOINTS.reduce((s, e) => s + e.weight, 0)

function pickEndpoint() {
  let r = Math.random() * totalWeight
  for (const ep of ENDPOINTS) {
    r -= ep.weight
    if (r <= 0) return ep.path
  }
  return ENDPOINTS[0].path
}

const stats = { total: 0, ok: 0, fail: 0, latencies: [], errors: {} }

async function makeRequest() {
  const path = pickEndpoint()
  const url = BASE + path
  const start = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const latency = Date.now() - start
    stats.total++
    stats.latencies.push(latency)
    if (res.ok) {
      stats.ok++
    } else {
      stats.fail++
      const key = `${res.status} ${path}`
      stats.errors[key] = (stats.errors[key] || 0) + 1
    }
  } catch (err) {
    stats.total++
    stats.fail++
    const key = `${err.name}: ${path}`
    stats.errors[key] = (stats.errors[key] || 0) + 1
  }
}

async function worker(endTime) {
  while (Date.now() < endTime) {
    await makeRequest()
  }
}

async function run() {
  console.log(`\n⚡ TradVue Load Test`)
  console.log(`   Target:      ${BASE}`)
  console.log(`   Concurrency: ${CONCURRENCY}`)
  console.log(`   Duration:    ${DURATION_S}s`)
  console.log(`   Endpoints:   ${ENDPOINTS.map(e => e.path).join(', ')}`)
  console.log(`\n   Running...\n`)

  const endTime = Date.now() + DURATION_S * 1000
  const workers = Array.from({ length: CONCURRENCY }, () => worker(endTime))
  await Promise.all(workers)

  // Results
  const sorted = stats.latencies.sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0
  const avg = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0
  const rps = (stats.total / DURATION_S).toFixed(1)

  console.log(`── Results ──────────────────────────────`)
  console.log(`   Total requests:  ${stats.total}`)
  console.log(`   Successful:      ${stats.ok}`)
  console.log(`   Failed:          ${stats.fail}`)
  console.log(`   Requests/sec:    ${rps}`)
  console.log(`   Latency avg:     ${avg}ms`)
  console.log(`   Latency p50:     ${p50}ms`)
  console.log(`   Latency p95:     ${p95}ms`)
  console.log(`   Latency p99:     ${p99}ms`)
  if (Object.keys(stats.errors).length) {
    console.log(`   Errors:`)
    for (const [k, v] of Object.entries(stats.errors)) {
      console.log(`     ${k}: ${v}`)
    }
  }
  console.log(`─────────────────────────────────────────\n`)

  // Pass/fail
  const errorRate = stats.total ? (stats.fail / stats.total * 100) : 0
  if (errorRate > 10) {
    console.log(`❌ FAIL: Error rate ${errorRate.toFixed(1)}% exceeds 10% threshold`)
    process.exit(1)
  } else if (p95 > 5000) {
    console.log(`❌ FAIL: p95 latency ${p95}ms exceeds 5000ms threshold`)
    process.exit(1)
  } else {
    console.log(`✅ PASS: ${rps} req/s, p95 ${p95}ms, ${errorRate.toFixed(1)}% error rate`)
  }
}

run()
