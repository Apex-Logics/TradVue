import {
  classifyWebhookEventsNetworkError,
  classifyWebhookEventsResponse,
} from '../../app/utils/webhookEvents'

describe('webhookEvents classifiers', () => {
  it('treats a 200 with an empty events array as an empty log, not an error', () => {
    expect(classifyWebhookEventsResponse(200, { events: [] })).toEqual({ ok: true, events: [] })
  })

  it('does not invent events when the payload is malformed', () => {
    expect(classifyWebhookEventsResponse(200, {})).toEqual({
      ok: false,
      message: 'Failed to load events',
    })
  })

  it('maps auth and missing-route failures without inventing events', () => {
    expect(classifyWebhookEventsResponse(401, { error: 'Unauthorized' }).ok).toBe(false)
    expect(classifyWebhookEventsResponse(401, {})).toEqual({
      ok: false,
      message: 'Sign in to load events',
    })
    expect(classifyWebhookEventsResponse(404, {})).toEqual({
      ok: false,
      message: 'Events endpoint not found',
    })
    expect(classifyWebhookEventsResponse(500, { error: 'Failed to list events' })).toEqual({
      ok: false,
      message: 'Failed to list events',
    })
  })

  it('maps CORS/network TypeError to a retryable connection message', () => {
    expect(classifyWebhookEventsNetworkError(new TypeError('Failed to fetch'))).toMatch(/Could not reach server/)
  })
})
