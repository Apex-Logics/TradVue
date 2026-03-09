# Google Calendar API Integration Research

## Overview

The Google Calendar API is a RESTful API (v3) that allows applications to integrate with Google Calendar for reading, creating, and managing calendar events. It's ideal for TradVue to enable users to automatically schedule trading alerts, earnings announcements, and market events directly to their calendars.

---

## Setup & Getting Started

### 1. Prerequisites
- Google Cloud Project (free to create at https://console.cloud.google.com)
- Billing account (for quota increases, though basic usage is free)
- OAuth 2.0 credentials (Service Account or User Account depending on use case)

### 2. Initial Setup Steps
1. Create a Google Cloud Project
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials:
   - For user-facing app: Create a "Web application" credential type
   - For server-to-server: Create a "Service Account" credential type
4. Configure OAuth consent screen
5. Set appropriate scopes for your application

### 3. Authentication Methods

#### OAuth 2.0 (User Authorization)
- **Best for:** User-facing features where you need user's permission
- **Flow:**
  1. Redirect user to Google's consent screen
  2. User grants permission to scopes
  3. Receive authorization code
  4. Exchange code for access token + refresh token
  5. Use access token to make API calls
  6. Refresh token when access token expires

#### Service Account (Domain-Wide Delegation)
- **Best for:** Backend automation without user interaction
- **Requires:** Admin approval in Google Workspace organization
- **Benefits:** No user login needed, automated calendar operations

### 4. Required Scopes

```
https://www.googleapis.com/auth/calendar.readonly
  → Read-only access to user's calendars

https://www.googleapis.com/auth/calendar
  → Full access to manage calendars and events (use sparingly)

https://www.googleapis.com/auth/calendar.events
  → Manage events, but not calendar settings
```

**Recommendation:** For TradVue, use `calendar.events` scope to allow creating trading alerts and events without accessing sensitive calendar settings.

---

## Free Tier Limits & Quotas

### Per-Project Quotas
- **Requests per minute (per project):** 1,000 requests/minute (standard)
- **Can be increased** via Google Cloud Console if needed for higher traffic

### Per-User Quotas  
- **Requests per minute (per project per user):** 100 requests/user/minute
- **Not recommended to increase** above default, as it may hit Calendar service limits

### Important Notes on Rate Limiting
- Rate limits are enforced using a **sliding window** (1-minute window)
- Exceeding quota returns:
  - **403 usageLimits** status code (quota exceeded)
  - **429 Too Many Requests** (rate limited)
- **No additional charges** for exceeding quotas — your app is simply rate-limited

### Best Practices to Avoid Rate Limiting
1. **Use exponential backoff** when you receive 403/429 responses
2. **Randomize traffic patterns** — don't batch all requests at specific times (e.g., midnight)
3. **Use push notifications** instead of polling for changes
4. **Allocate load to different users** if using service accounts (via `quotaUser` parameter)

### Cost  
- **Google Calendar API usage is completely free**
- No charges even if you exceed quota limits
- Charges may apply for other Google Cloud services used alongside it

---

## Key API Endpoints

### Event Methods

#### List Events
```
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
```
**Parameters:**
- `calendarId` (required): Calendar ID (use "primary" for user's main calendar)
- `timeMin` / `timeMax`: Filter events by date range
- `maxResults`: Limit number of results
- `orderBy`: "startTime" or "updated"
- `singleEvents`: true (to expand recurring events)

**Use Case:** Fetch upcoming events, check for conflicts before creating new events

---

#### Get Single Event
```
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}
```
**Use Case:** Retrieve details of a specific event

---

#### Create Event
```
POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
Content-Type: application/json

{
  "summary": "AAPL Earnings Announcement",
  "description": "Expected EPS: $6.05 | Actual: Pending",
  "start": {
    "dateTime": "2026-04-28T16:00:00",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2026-04-28T17:00:00",
    "timeZone": "America/New_York"
  },
  "reminders": {
    "useDefault": false,
    "overrides": [
      {
        "method": "popup",
        "minutes": 15
      },
      {
        "method": "email",
        "minutes": 1440
      }
    ]
  },
  "transparency": "transparent"
}
```

**Key Fields:**
- `summary`: Event title
- `description`: Event details (supports plain text and HTML)
- `start.dateTime`: Event start time (RFC 3339 format, e.g., "2026-04-28T16:00:00Z")
- `start.timeZone`: Optional timezone specification
- `reminders.overrides[]`: Custom reminders (email, popup, SMS if supported)
- `transparency`: "opaque" (blocks time) or "transparent" (doesn't block time)

**TradVue Example:**
```json
{
  "summary": "BTC Price Alert: $45,000 Threshold",
  "description": "Bitcoin is approaching your alert threshold. Current price: $44,920",
  "start": {
    "dateTime": "2026-03-05T14:32:00",
    "timeZone": "UTC"
  },
  "end": {
    "dateTime": "2026-03-05T14:37:00",
    "timeZone": "UTC"
  },
  "reminders": {
    "useDefault": false,
    "overrides": [
      {
        "method": "popup",
        "minutes": 0
      }
    ]
  },
  "transparency": "transparent"
}
```

---

#### Update Event
```
PUT https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}
PATCH https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}
```
- **PUT:** Full replacement of event
- **PATCH:** Partial update (only fields provided are updated)

**Use Case:** Update event details, reschedule, or modify reminders

---

#### Delete Event
```
DELETE https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}
```

---

### Quick Add (Text-Based Event Creation)
```
POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/quickAdd?text={text}
```

**Example:**
```
POST /calendars/primary/events/quickAdd?text=TSLA earnings tomorrow at 4pm
```

**Benefit:** Natural language processing — useful for quick alert creation

---

## Reminders System

### Supported Reminder Methods
1. **popup** — Browser/mobile notification (no delivery guarantee)
2. **email** — Email notification (reliable)
3. **sms** — SMS (if supported by calendar provider; not standard)

### Reminder Constraints
- **Maximum 5 override reminders per event**
- **Minutes before event:** 0–40,320 (4 weeks in minutes)
- **Minimum gap:** Events must be at least 1 minute apart

### Example Multi-Reminder Event
```json
{
  "reminders": {
    "useDefault": false,
    "overrides": [
      {
        "method": "popup",
        "minutes": 30
      },
      {
        "method": "popup",
        "minutes": 5
      },
      {
        "method": "email",
        "minutes": 1440
      }
    ]
  }
}
```

---

## Push Notifications (Advanced)

Instead of polling for changes, subscribe to push notifications:

```
POST /calendars/{calendarId}/events/watch
```

**Benefit:** Get instant notifications when events change, reducing API quota usage.

**Flow:**
1. Setup push notification endpoint (must be HTTPS with valid SSL)
2. Subscribe to calendar changes
3. Google sends POST request to your endpoint when changes occur
4. Process changes and skip unnecessary API calls

---

## TradVue Integration Strategy

### Use Cases

#### 1. **Trading Alerts → Calendar Events**
- When price alert triggers, create calendar event
- Set reminders for critical alerts (popup + email)
- Keep event transparent so it doesn't "block" calendar time

#### 2. **Earnings Calendar Integration**
- Sync earnings dates for watchlist stocks
- Create multi-day events for earnings week
- Add description with expected vs actual EPS

#### 3. **Economic Events Calendar**
- Track Fed announcements, unemployment data, etc.
- Create events with impact assessment in description
- Set different reminder frequencies based on importance

#### 4. **User Preferences Integration**
- Store `googleCalendarId` in TradVue user profile
- Allow users to opt-in/out of calendar sync per watchlist
- Use subscription tier to determine reminder frequency

### Recommended Implementation

```javascript
// Pseudo-code for TradVue integration
async function createPriceAlert(userId, symbol, threshold, googleCalendarId) {
  const currentPrice = await getPrice(symbol);
  
  const event = {
    summary: `${symbol} Alert: ${threshold} threshold`,
    description: `Price alert for ${symbol}. Current: ${currentPrice}, Threshold: ${threshold}`,
    start: {
      dateTime: new Date().toISOString(),
      timeZone: getUserTimezone(userId)
    },
    end: {
      dateTime: new Date(Date.now() + 5 * 60000).toISOString(), // 5 min duration
      timeZone: getUserTimezone(userId)
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 0 },
        ...(isPremiumUser(userId) ? [{ method: 'email', minutes: 0 }] : [])
      ]
    },
    transparency: 'transparent'
  };

  return callGoogleCalendarAPI('POST', 
    `/calendars/${googleCalendarId}/events`, 
    event
  );
}
```

---

## Error Handling & Best Practices

### Common Errors
1. **401 Unauthorized** — Invalid/expired access token → refresh token
2. **403 Forbidden** — Insufficient scopes or quota exceeded
3. **404 Not Found** — Invalid calendar/event ID
4. **409 Conflict** — Event already exists or concurrent modification

### Retry Strategy
- Implement **exponential backoff** (e.g., 1s → 2s → 4s → 8s)
- Retry on 403, 429, 5xx errors
- Don't retry on 401 (refresh token instead), 404, or 422

### Rate Limit Handling
```javascript
async function callCalendarAPI(method, endpoint, data) {
  let retries = 0;
  const maxRetries = 5;
  const baseDelay = 1000; // 1 second

  while (retries < maxRetries) {
    try {
      return await makeRequest(method, endpoint, data);
    } catch (error) {
      if (error.status === 429 || error.status === 403) {
        const delay = baseDelay * Math.pow(2, retries);
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
        retries++;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Conclusion

Google Calendar API is a robust, free, and scalable solution for integrating trading alerts into users' calendars. The generous free quotas (100 requests/user/minute) support TradVue's core use cases without additional cost. Implementing push notifications can further optimize API usage for production-scale applications.

**Next Steps:**
1. Obtain Google Cloud API credentials
2. Implement OAuth flow in TradVue frontend
3. Store user's calendar ID in profile
4. Build calendar event creation service
5. Add calendar sync settings to user preferences
