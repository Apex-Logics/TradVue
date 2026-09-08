'use client'

import { useState } from 'react'

export type SeoFaqItem = {
  q: string
  a: string
}

/** Honest accordion for SEO lander FAQs — answers stay collapsed until opened. */
export default function SeoFaqAccordion({ items }: { items: SeoFaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="seo-faq-list">
      {items.map((item, index) => {
        const isOpen = openIndex === index
        const panelId = `seo-faq-panel-${index}`
        const buttonId = `seo-faq-button-${index}`
        return (
          <div key={item.q} className={`seo-faq-item${isOpen ? ' is-open' : ''}`}>
            <button
              id={buttonId}
              type="button"
              className="seo-faq-q"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span>{item.q}</span>
              <span className="seo-faq-q-icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <div id={panelId} role="region" aria-labelledby={buttonId} className="seo-faq-a">
                {item.a}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
