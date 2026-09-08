import * as fs from 'fs'
import * as path from 'path'

const PAGE = path.join(__dirname, '../../app/stock/[ticker]/page.tsx')

describe('stock detail score empty state', () => {
  test('does not render raw Yahoo/axios 401 strings', () => {
    const src = fs.readFileSync(PAGE, 'utf8')
    expect(src).toContain('Unable to calculate score for this stock.')
    expect(src).not.toContain('score?.error')
    expect(src).not.toContain('{score.error')
  })
})
