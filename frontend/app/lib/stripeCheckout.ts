/**
 * Stripe checkout helpers.
 *
 * Staging often has no STRIPE_SECRET_KEY. Callers must treat that as a
 * disabled checkout state — never invent price IDs, and never surface
 * "Failed to load pricing" for a missing Stripe config.
 */

import { API_BASE } from './api'
import { fetchWithSessionRetry } from './authSession'

export const CHECKOUT_UNAVAILABLE_MESSAGE = "Checkout isn't available in this environment."

export interface StripePriceOption {
  priceId: string
  amount: number
  amountPerMonth?: number
  currency: string
  interval: string
  label: string
  savingsPercent?: number
}

export interface StripePrices {
  monthly: StripePriceOption
  annual: StripePriceOption
}

function isPriceOption(value: unknown): value is StripePriceOption {
  if (!value || typeof value !== 'object') return false
  const priceId = (value as { priceId?: unknown }).priceId
  return typeof priceId === 'string' && priceId.length > 0
}

export async function fetchStripePrices(): Promise<
  | { available: true; prices: StripePrices }
  | { available: false; message: string }
> {
  try {
    const res = await fetch(`${API_BASE}/api/stripe/prices`)
    const data = await res.json().catch(() => ({} as Record<string, unknown>))
    if (res.ok && isPriceOption(data.monthly) && isPriceOption(data.annual)) {
      return {
        available: true,
        prices: { monthly: data.monthly, annual: data.annual },
      }
    }
    return { available: false, message: CHECKOUT_UNAVAILABLE_MESSAGE }
  } catch {
    return { available: false, message: CHECKOUT_UNAVAILABLE_MESSAGE }
  }
}

export async function createCheckoutSession(opts: {
  token: string
  priceId: string
}): Promise<{ url: string }> {
  const res = await fetchWithSessionRetry(`${API_BASE}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({ priceId: opts.priceId }),
  })
  const data = await res.json().catch(() => ({} as { error?: string; code?: string; url?: string }))

  if (res.status === 401 || res.status === 403) {
    throw new Error('Please sign in again to upgrade.')
  }
  if (res.status === 503 || data.code === 'STRIPE_NOT_CONFIGURED') {
    throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE)
  }
  if (!res.ok) throw new Error(data.error || 'Checkout failed')
  if (!data.url) throw new Error('No checkout URL returned')
  return { url: data.url }
}
