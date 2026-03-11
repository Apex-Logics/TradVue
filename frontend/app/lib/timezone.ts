/**
 * timezone.ts — Timezone utilities for TradVue
 *
 * Priority:   tv_timezone_manual (user override) → auto-detected
 * Storage:    localStorage keys tv_timezone_manual / tv_timezone
 */

export const TIMEZONES = [
  { value: 'America/New_York',    label: 'US Eastern (ET)',    abbr: 'ET'  },
  { value: 'America/Chicago',     label: 'US Central (CT)',    abbr: 'CT'  },
  { value: 'America/Denver',      label: 'US Mountain (MT)',   abbr: 'MT'  },
  { value: 'America/Los_Angeles', label: 'US Pacific (PT)',    abbr: 'PT'  },
  { value: 'America/Anchorage',   label: 'US Alaska (AKT)',    abbr: 'AKT' },
  { value: 'Pacific/Honolulu',    label: 'US Hawaii (HST)',    abbr: 'HST' },
  { value: 'UTC',                 label: 'UTC',                abbr: 'UTC' },
  { value: 'Europe/London',       label: 'London (GMT/BST)',   abbr: 'GMT' },
  { value: 'Europe/Berlin',       label: 'Berlin (CET/CEST)', abbr: 'CET' },
  { value: 'Europe/Paris',        label: 'Paris (CET/CEST)',  abbr: 'CET' },
  { value: 'Europe/Zurich',       label: 'Zurich (CET/CEST)', abbr: 'CET' },
  { value: 'Asia/Tokyo',          label: 'Tokyo (JST)',        abbr: 'JST' },
  { value: 'Asia/Shanghai',       label: 'Shanghai (CST)',     abbr: 'CST' },
  { value: 'Asia/Hong_Kong',      label: 'Hong Kong (HKT)',   abbr: 'HKT' },
  { value: 'Asia/Singapore',      label: 'Singapore (SGT)',   abbr: 'SGT' },
  { value: 'Asia/Dubai',          label: 'Dubai (GST)',        abbr: 'GST' },
  { value: 'Australia/Sydney',    label: 'Sydney (AEST/AEDT)','abbr': 'AEST'},
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)',   abbr: 'AEST'},
]

const MANUAL_KEY = 'tv_timezone_manual'
const AUTO_KEY   = 'tv_timezone'

/** Returns the active timezone (manual override → auto-detected). */
export function getUserTimezone(): string {
  if (typeof window === 'undefined') return 'America/New_York'
  try {
    const manual = localStorage.getItem(MANUAL_KEY)
    if (manual) return manual

    // Detect & cache auto timezone
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    try { localStorage.setItem(AUTO_KEY, detected) } catch {}
    return detected
  } catch {
    return 'America/New_York'
  }
}

/** Sets a manual timezone override. Pass null to revert to auto-detection. */
export function setManualTimezone(tz: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (tz) {
      localStorage.setItem(MANUAL_KEY, tz)
    } else {
      localStorage.removeItem(MANUAL_KEY)
    }
  } catch {}
}

/** Returns true if the user has a manual timezone override set. */
export function hasManualTimezone(): boolean {
  if (typeof window === 'undefined') return false
  try { return !!localStorage.getItem(MANUAL_KEY) } catch { return false }
}

/** Returns a short abbreviation like "ET", "PT", "UTC" for the given IANA tz string. */
export function getTimezoneAbbr(tz: string): string {
  const match = TIMEZONES.find(t => t.value === tz)
  if (match) return match.abbr

  // Fallback: use Intl to get the short form (e.g. "EST", "PST")
  try {
    const short = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value
    return short || tz
  } catch {
    return tz
  }
}

/**
 * Formats a UTC time string or Date in the user's timezone.
 * Returns a string like "9:30 AM ET".
 *
 * @param input   ISO string, Date, or epoch ms
 * @param tz      IANA timezone (defaults to getUserTimezone())
 * @param opts    Override formatting options
 */
export function formatEventTime(
  input: string | Date | number,
  tz?: string,
  opts: { showDate?: boolean; showSeconds?: boolean } = {}
): string {
  if (!input) return '—'
  const timezone = tz || getUserTimezone()
  const abbr = getTimezoneAbbr(timezone)

  try {
    const d = typeof input === 'number' ? new Date(input) : new Date(input)
    if (isNaN(d.getTime())) return '—'

    const formatOpts: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }
    if (opts.showSeconds) formatOpts.second = '2-digit'
    if (opts.showDate) {
      formatOpts.month = 'short'
      formatOpts.day = 'numeric'
    }

    return `${new Intl.DateTimeFormat('en-US', formatOpts).format(d)} ${abbr}`
  } catch {
    return '—'
  }
}

/**
 * Formats a date-only string (YYYY-MM-DD) as a locale date in the user's timezone.
 * Returns e.g. "Wed, Mar 12".
 */
export function formatEventDate(input: string | Date, tz?: string): string {
  if (!input) return '—'
  const timezone = tz || getUserTimezone()
  try {
    // For date-only strings, use noon UTC to avoid off-by-one from timezone shifts
    const d = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
      ? new Date(input + 'T12:00:00Z')
      : new Date(input)
    if (isNaN(d.getTime())) return String(input)

    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return String(input)
  }
}

/**
 * Returns relative time label ("just now", "3m ago", "2h ago", "Mar 5")
 * with timestamps localized to user timezone.
 */
export function formatRelativeTime(input: string | Date, tz?: string): string {
  if (!input) return ''
  try {
    const d = new Date(input)
    if (isNaN(d.getTime())) return ''
    const diff = Date.now() - d.getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    // Older than 24h: show locale date
    const timezone = tz || getUserTimezone()
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return ''
  }
}
