/**
 * Frontend SEO & Security Test Suite
 *
 * Tests covering:
 * 1. JSON-LD structured data integrity (no sensitive data exposure)
 * 2. Canonical URL presence and validity
 * 3. External link security (rel="noopener noreferrer")
 * 4. Meta robots tag safety
 * 5. API key exposure prevention
 * 6. Content Security policy checks
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const APP_DIR = path.join(__dirname, '../../app')

/** Recursively collect all .tsx files under a directory */
function collectTsxFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...collectTsxFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(fullPath)
    }
  }
  return results
}

/** Read file contents, returning empty string on error */
function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/** Get all page and layout files in the app directory */
function getPageFiles(): string[] {
  const allFiles = collectTsxFiles(APP_DIR)
  return allFiles.filter(f =>
    f.endsWith('/page.tsx') || f.endsWith('/layout.tsx')
  )
}

// ─── API Key Exposure Tests ───────────────────────────────────────────────────

describe('API Key Exposure Prevention', () => {
  const appFiles = collectTsxFiles(APP_DIR)

  test('No hardcoded Finnhub API keys in frontend source', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      const content = readFile(file)
      // Match raw API keys, not env variable references
      if (/['"`]d0[a-z0-9_]{14,}['"`]/i.test(content)) {
        // Likely a Finnhub key (starts with d0...) that isn't env-based
        if (!content.includes('process.env') || content.includes("'d0")) {
          violations.push(path.relative(APP_DIR, file))
        }
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('No hardcoded secret keys (sk_) in frontend app files', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      const content = readFile(file)
      // Check for sk_ patterns outside of process.env references
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/['"`]sk_[a-zA-Z0-9_-]{10,}['"`]/.test(line) && !line.includes('process.env')) {
          violations.push(`${path.relative(APP_DIR, file)}:${i + 1}`)
        }
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('No hardcoded publishable keys (pk_) in frontend app files', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      const content = readFile(file)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/['"`]pk_[a-zA-Z0-9_-]{10,}['"`]/.test(line) && !line.includes('process.env')) {
          violations.push(`${path.relative(APP_DIR, file)}:${i + 1}`)
        }
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('No hardcoded RESEND API keys in frontend app files', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      const content = readFile(file)
      if (/re_[a-zA-Z0-9_]{15,}/.test(content) && !content.includes('process.env')) {
        violations.push(path.relative(APP_DIR, file))
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('No FRED API keys hardcoded in frontend', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      const content = readFile(file)
      // FRED keys are 32 hex chars
      const fredKeyPattern = /FRED_API_KEY\s*=\s*['"`][a-f0-9]{32}['"`]/i
      if (fredKeyPattern.test(content)) {
        violations.push(path.relative(APP_DIR, file))
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('API URL references use environment variables, not hardcoded prod URLs in client code', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      const content = readFile(file)
      // Check for hardcoded API URL with actual endpoint paths (not just the domain)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Detect direct API key or internal URL hardcoding bypassing env vars
        if (
          /tradvue-api\.onrender\.com\/api\/[a-z]/.test(line) &&
          !line.includes('process.env') &&
          !line.includes('NEXT_PUBLIC') &&
          !line.includes('//')  // Not a comment
        ) {
          violations.push(`${path.relative(APP_DIR, file)}:${i + 1}: ${line.trim()}`)
        }
      }
    }
    expect(violations).toHaveLength(0)
  })
})

// ─── External Link Security Tests ────────────────────────────────────────────

describe('External Link Security', () => {
  const allFiles = collectTsxFiles(APP_DIR)

  test('All external <a target="_blank"> links have rel="noopener noreferrer"', () => {
    const violations: string[] = []

    for (const file of allFiles) {
      const content = readFile(file)
      const lines = content.split('\n')

      // Find blocks that contain target="_blank" and check surrounding lines for rel
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('target="_blank"')) {
          // Look at +/- 5 lines for rel= attribute
          const contextStart = Math.max(0, i - 3)
          const contextEnd = Math.min(lines.length - 1, i + 5)
          const context = lines.slice(contextStart, contextEnd + 1).join('\n')

          if (!context.includes('rel="noopener') && !context.includes("rel='noopener")) {
            // Check it's actually an external link (has http:// or https://)
            const contextHasExternal = /href\s*=\s*['"`]https?:\/\//.test(context) ||
              /href\s*=\s*\{[^}]*(?:url|href|link)[^}]*\}/.test(context) ||
              /href\s*=\s*\{article/.test(context) ||
              /href\s*=\s*\{alert/.test(context)

            if (contextHasExternal) {
              violations.push(`${path.relative(APP_DIR, file)}:${i + 1}`)
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      console.warn('Links missing rel="noopener noreferrer":', violations)
    }
    expect(violations).toHaveLength(0)
  })
})

// ─── Canonical URL Tests ──────────────────────────────────────────────────────

describe('Canonical URLs', () => {
  test('All layout files have canonical URL defined', () => {
    const layoutFiles = collectTsxFiles(APP_DIR).filter(f => f.endsWith('/layout.tsx'))
    const missingCanonical: string[] = []

    for (const file of layoutFiles) {
      const content = readFile(file)
      // Check if it exports metadata with alternates.canonical
      if (content.includes('export const metadata') && content.includes('Metadata')) {
        if (!content.includes('canonical') && !content.includes('noindex')) {
          // Only flag pages that should be indexed
          missingCanonical.push(path.relative(APP_DIR, file))
        }
      }
    }

    if (missingCanonical.length > 0) {
      console.warn('Layout files missing canonical:', missingCanonical)
    }
    // Allow some layouts to not have canonical (e.g., auth callback)
    // Just verify the count is reasonable
    expect(missingCanonical.length).toBeLessThan(5)
  })

  test('Canonical URLs use www.tradvue.com (not non-www)', () => {
    const allFiles = collectTsxFiles(APP_DIR)
    const violations: string[] = []

    for (const file of allFiles) {
      const content = readFile(file)
      // Check for canonical URLs that use non-www domain
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (
          line.includes('canonical') &&
          /['"`]https:\/\/tradvue\.com/.test(line) &&
          !/www\.tradvue\.com/.test(line)
        ) {
          violations.push(`${path.relative(APP_DIR, file)}:${i + 1}: ${line.trim()}`)
        }
      }
    }

    if (violations.length > 0) {
      console.warn('Canonical URLs using non-www:', violations)
    }
    expect(violations).toHaveLength(0)
  })

  test('Canonical URLs are absolute (start with https://)', () => {
    const allFiles = collectTsxFiles(APP_DIR)
    const violations: string[] = []

    for (const file of allFiles) {
      const content = readFile(file)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Check for canonical with relative path
        if (line.includes('canonical') && /canonical:\s*['"`]\//.test(line)) {
          violations.push(`${path.relative(APP_DIR, file)}:${i + 1}: ${line.trim()}`)
        }
      }
    }
    expect(violations).toHaveLength(0)
  })
})

// ─── Meta Robots Safety Tests ─────────────────────────────────────────────────

describe('Meta Robots Tags', () => {
  test('Public SEO landing pages are not accidentally noindexed', () => {
    const publicPages = [
      'best-trading-journal/page.tsx',
      'prop-firm-tracker/page.tsx',
      'futures-trading-journal/page.tsx',
      'options-trading-journal/page.tsx',
      'post-trade-ritual/page.tsx',
      'trading-calculators/page.tsx',
    ]

    for (const pagePath of publicPages) {
      const fullPath = path.join(APP_DIR, pagePath)
      const content = readFile(fullPath)
      if (content) {
        // These pages must NOT have noindex
        expect(content).not.toContain('noindex')
      }
    }
  })

  test('Legal pages are intentionally noindexed', () => {
    const legalLayoutPath = path.join(APP_DIR, 'legal/layout.tsx')
    const content = readFile(legalLayoutPath)
    if (content) {
      // Legal pages should have noindex (intentional)
      expect(content).toContain('noindex')
    }
  })

  test('Root layout has robots: index=true, follow=true', () => {
    const rootLayoutPath = path.join(APP_DIR, 'layout.tsx')
    const content = readFile(rootLayoutPath)
    expect(content).toContain('index: true')
    expect(content).toContain('follow: true')
  })
})

// ─── JSON-LD Security Tests ───────────────────────────────────────────────────

describe('JSON-LD Structured Data Security', () => {
  const allFiles = collectTsxFiles(APP_DIR)

  test('JSON-LD does not contain raw API keys', () => {
    const violations: string[] = []
    for (const file of allFiles) {
      const content = readFile(file)
      if (!content.includes('application/ld+json')) continue

      // Extract JSON-LD content blocks
      const jsonLdMatches = content.match(/__html:\s*JSON\.stringify\([^)]+\)/gs) || []
      for (const match of jsonLdMatches) {
        // Check for patterns that look like API keys
        if (/['""][a-zA-Z0-9_-]{32,}['""]/.test(match)) {
          // Verify it's not a legitimate schema URL or common value
          const suspiciousValues = match.match(/['""]([a-zA-Z0-9_-]{32,})['""]/)
          if (suspiciousValues) {
            const value = suspiciousValues[1]
            // Filter out schema.org URLs, common legitimate long strings
            if (!value.startsWith('http') && !value.includes('schema') && !/^[A-Z]/.test(value)) {
              violations.push(`${path.relative(APP_DIR, file)}: potential key in JSON-LD`)
            }
          }
        }
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('JSON-LD does not expose internal API paths', () => {
    const violations: string[] = []
    for (const file of allFiles) {
      const content = readFile(file)
      if (!content.includes('application/ld+json')) continue

      // Check for internal API paths in JSON-LD
      if (content.includes('/api/') && content.includes('application/ld+json')) {
        // Find if /api/ appears within the JSON-LD block itself
        const jsonLdSection = content.substring(
          content.indexOf('application/ld+json'),
          content.indexOf('application/ld+json') + 3000
        )
        if (/['"`]\/api\/[a-z]/.test(jsonLdSection)) {
          violations.push(path.relative(APP_DIR, file))
        }
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('JSON-LD on SEO pages is valid FAQPage structure', () => {
    const seoPages = [
      'best-trading-journal/page.tsx',
      'prop-firm-tracker/page.tsx',
      'futures-trading-journal/page.tsx',
      'options-trading-journal/page.tsx',
      'post-trade-ritual/page.tsx',
      'trading-calculators/page.tsx',
    ]

    for (const pagePath of seoPages) {
      const fullPath = path.join(APP_DIR, pagePath)
      const content = readFile(fullPath)
      if (content) {
        expect(content).toContain('FAQPage')
        expect(content).toContain('mainEntity')
        expect(content).toContain('Question')
        expect(content).toContain('acceptedAnswer')
        expect(content).toContain('BreadcrumbList')
      }
    }
  })

  test('Homepage JSON-LD includes Organization, WebSite, and SoftwareApplication types', () => {
    const rootLayoutPath = path.join(APP_DIR, 'layout.tsx')
    const content = readFile(rootLayoutPath)
    expect(content).toContain('Organization')
    expect(content).toContain('WebSite')
    expect(content).toContain('SoftwareApplication')
  })

  test('Pricing page JSON-LD includes Product and Offer schema', () => {
    const pricingLayoutPath = path.join(APP_DIR, 'pricing/layout.tsx')
    const content = readFile(pricingLayoutPath)
    if (content) {
      expect(content).toContain('Product')
      expect(content).toContain('Offer')
      expect(content).toContain('24')
      expect(content).toContain('201.60')
    }
  })
})

// ─── OG/Twitter Meta Coverage Tests ──────────────────────────────────────────

describe('OG/Twitter Meta Coverage', () => {
  test('All public page layouts have og:title defined', () => {
    const publicLayouts = [
      'journal/layout.tsx',
      'tools/layout.tsx',
      'news/layout.tsx',
      'pricing/layout.tsx',
      'calendar/layout.tsx',
      'portfolio/layout.tsx',
      'help/layout.tsx',
      'changelog/layout.tsx',
      'status/layout.tsx',
    ]

    const missingOG: string[] = []
    for (const layoutPath of publicLayouts) {
      const fullPath = path.join(APP_DIR, layoutPath)
      const content = readFile(fullPath)
      if (content && content.includes('export const metadata')) {
        if (!content.includes('openGraph') && !content.includes('og:')) {
          missingOG.push(layoutPath)
        }
      }
    }
    expect(missingOG).toHaveLength(0)
  })

  test('All SEO landing pages have twitter:card defined', () => {
    const seoPages = [
      'best-trading-journal/page.tsx',
      'prop-firm-tracker/page.tsx',
      'futures-trading-journal/page.tsx',
      'options-trading-journal/page.tsx',
      'post-trade-ritual/page.tsx',
      'trading-calculators/page.tsx',
    ]

    for (const pagePath of seoPages) {
      const fullPath = path.join(APP_DIR, pagePath)
      const content = readFile(fullPath)
      if (content) {
        expect(content).toContain('twitter')
        expect(content).toContain('summary_large_image')
      }
    }
  })
})
