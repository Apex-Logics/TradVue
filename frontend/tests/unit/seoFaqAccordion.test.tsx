import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import SeoFaqAccordion from '../../app/components/SeoFaqAccordion'

const ITEMS = [
  { q: 'What makes TradVue the best trading journal for day traders?', a: 'TradVue combines journaling, portfolio tracking, 30+ calculators, prop firm monitoring, ritual, and market intel in one trader workflow. You get drawdown gauges, emotion tracking, and pattern analysis with a free account.' },
  { q: 'Is TradVue really free to use?', a: 'Yes. Create a free account (no credit card required) and get a 3-week full trial of all features.' },
]

describe('SeoFaqAccordion', () => {
  test('keeps answers collapsed until a question is opened', async () => {
    const user = userEvent.setup()
    render(<SeoFaqAccordion items={ITEMS} />)

    expect(screen.getByRole('button', { name: ITEMS[0].q })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(ITEMS[0].a)).not.toBeInTheDocument()
    expect(screen.queryByText(ITEMS[1].a)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: ITEMS[0].q }))

    expect(screen.getByRole('button', { name: ITEMS[0].q })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(ITEMS[0].a)).toBeInTheDocument()
    expect(screen.queryByText(ITEMS[1].a)).not.toBeInTheDocument()
  })

  test('collapses the open answer when the same question is clicked again', async () => {
    const user = userEvent.setup()
    render(<SeoFaqAccordion items={ITEMS} />)

    await user.click(screen.getByRole('button', { name: ITEMS[0].q }))
    expect(screen.getByText(ITEMS[0].a)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: ITEMS[0].q }))
    expect(screen.queryByText(ITEMS[0].a)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ITEMS[0].q })).toHaveAttribute('aria-expanded', 'false')
  })
})
