/**
 * Classify GET /api/webhooks/events results.
 * Empty logs must not be shown as errors; network/auth failures must not be
 * shown as an empty log (do not invent events).
 */

export type WebhookEventsPayload = {
  events?: unknown
  error?: string
}

export type EventsLoadResult =
  | { ok: true; events: unknown[] }
  | { ok: false; message: string }

function eventsArray(payload: WebhookEventsPayload | null | undefined): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null
  return Array.isArray(payload.events) ? payload.events : null
}

export function classifyWebhookEventsResponse(
  status: number,
  payload: WebhookEventsPayload | null | undefined,
): EventsLoadResult {
  if (status >= 200 && status < 300) {
    const events = eventsArray(payload)
    if (events) return { ok: true, events }
    return { ok: false, message: 'Failed to load events' }
  }
  if (status === 401 || status === 403) {
    return { ok: false, message: 'Sign in to load events' }
  }
  if (status === 404) {
    return { ok: false, message: 'Events endpoint not found' }
  }
  const apiError = payload && typeof payload.error === 'string' ? payload.error : null
  return { ok: false, message: apiError || 'Failed to load events' }
}

export function classifyWebhookEventsNetworkError(err: unknown): string {
  if (err instanceof TypeError) {
    return 'Could not reach server. Check your connection and try again.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Failed to load events'
}
