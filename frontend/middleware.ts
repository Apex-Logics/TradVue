import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware — runs at the edge BEFORE any page renders.
 *
 * - /dashboard and /ops: fully blocked in production (internal agent tools)
 * - /admin: requires valid Supabase session cookie — unauthenticated users
 *   get redirected to / before any HTML is served. The client-side email
 *   allowlist remains as a secondary check for authorized admin emails.
 */

// Routes that are NEVER accessible in production (no auth bypass)
const BLOCKED_PATHS = ['/dashboard', '/ops']

// Routes that require authentication (Supabase session cookie)
const AUTH_REQUIRED_PATHS = ['/admin']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  const isLocal =
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1') ||
    hostname.includes('.local')

  // Allow everything in local development
  if (isLocal) return NextResponse.next()

  // Fully block internal routes in production
  if (BLOCKED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url, 308)
  }

  // Auth-gated routes — require Supabase session cookie
  if (AUTH_REQUIRED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    // Supabase stores session in cookies named sb-<ref>-auth-token or sb-access-token
    const cookies = request.cookies
    const hasSession = Array.from(cookies.getAll()).some(
      c => c.name.includes('sb-') && c.name.includes('auth-token') && c.value.length > 20
    )

    if (!hasSession) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url, 302)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/ops/:path*', '/admin/:path*'],
}
