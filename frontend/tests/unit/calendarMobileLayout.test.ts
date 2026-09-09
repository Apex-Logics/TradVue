import * as fs from 'fs'
import * as path from 'path'

const APP = path.join(__dirname, '../../app')

function read(rel: string): string {
  return fs.readFileSync(path.join(APP, rel), 'utf-8')
}

describe('Calendar phone-width layout', () => {
  const page = read('calendar/page.tsx')
  const css = read('globals.css')

  test('header actions use the shared page-header-actions wrap', () => {
    expect(page).toContain('className="page-header-actions"')
    expect(page).toContain('className="cal-tz-badge"')
    expect(page).not.toMatch(/marginLeft:\s*'auto',\s*display:\s*'flex'/)
  })

  test('period label does not force a 200px min-width', () => {
    expect(page).toContain('className="cal-period-label"')
    expect(page).not.toMatch(/minWidth:\s*200/)
  })

  test('month grid columns can shrink below title min-content', () => {
    expect(css).toMatch(/\.cal-month-grid[\s\S]{0,200}repeat\(7,\s*minmax\(0,\s*1fr\)\)/)
    expect(page).toContain('className="cal-month-grid"')
    expect(page).toContain('className="cal-month-cell"')
    expect(page).toContain('cal-day-name-full')
    expect(page).toContain('cal-day-name-abbr')
  })

  test('week view stacks to one column at phone width', () => {
    expect(page).toContain('className="cal-week-grid"')
    const mobile = css.slice(css.indexOf('MOBILE RESPONSIVE'))
    const phoneBlock = mobile.slice(0, mobile.indexOf('SMALL MOBILE'))
    expect(phoneBlock).toMatch(/\.cal-week-grid[\s\S]{0,80}grid-template-columns:\s*minmax\(0,\s*1fr\)/)
    expect(phoneBlock).toMatch(/\.cal-period-nav[\s\S]{0,80}flex:\s*1 1 100%/)
  })

  test('filter chips and event tables scroll inside the page instead of clipping it', () => {
    expect(page).toContain('className="cal-filter-scroll"')
    expect(page).toContain('className="cal-detail-scroll"')
    expect(page).toContain('className="cal-agenda-scroll"')
    const mobile = css.slice(css.indexOf('MOBILE RESPONSIVE'))
    expect(mobile).toMatch(/\.cal-filter-scroll[\s\S]{0,160}overflow-x:\s*auto/)
    expect(css).toMatch(/\.cal-detail-scroll[\s\S]{0,120}overflow-x:\s*auto/)
  })

  test('390px breakpoint further compacts month cells', () => {
    const xs = css.slice(css.indexOf('max-width: 390px'))
    expect(xs).toMatch(/\.cal-month-cell[\s\S]{0,80}min-height:\s*44px/)
  })
})
