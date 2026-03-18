import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware — runs at the edge BEFORE any page renders.
 *
 * Blocks internal/ops routes in production so they never flash or serve HTML.
 */

const BLOCKED_PATHS = ['/dashboard', '/ops']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Allow in local development
  if (
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1') ||
    hostname.includes('.local')
  ) {
    return NextResponse.next()
  }

  // Block internal routes in production — redirect to home
  if (BLOCKED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/ops/:path*'],
}
