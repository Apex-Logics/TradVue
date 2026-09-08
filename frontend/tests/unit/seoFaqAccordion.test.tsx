import * as fs from 'fs'
import * as path from 'path'

const SRC = fs.readFileSync(
  path.join(__dirname, '../../app/components/SeoFaqAccordion.tsx'),
  'utf-8',
)

describe('SeoFaqAccordion', () => {
  test('is a real accordion — answers render only when open', () => {
    expect(SRC).toContain("useState<number | null>(null)")
    expect(SRC).toContain('aria-expanded={isOpen}')
    expect(SRC).toContain('{isOpen && (')
    expect(SRC).toContain("className=\"seo-faq-a\"")
    expect(SRC).toContain("{isOpen ? '−' : '+'}")
  })

  test('clicking a question toggles that index', () => {
    expect(SRC).toContain('setOpenIndex(isOpen ? null : index)')
    expect(SRC).toContain('type="button"')
  })
})
