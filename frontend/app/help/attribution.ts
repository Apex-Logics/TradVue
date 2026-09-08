/** True when a data-source URL is a real outbound link (not empty / hash). */
export function isAttributionHref(url: string | undefined | null): boolean {
  const href = String(url ?? '').trim()
  return href.length > 0 && href !== '#'
}
