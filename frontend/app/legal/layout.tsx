import Link from 'next/link'
import type { Metadata } from 'next'
import LegalBreadcrumbs from './LegalBreadcrumbs'

export const metadata: Metadata = {
  robots: 'noindex, follow',
}

const legalLinks = [
  { label: 'Terms of Service',  href: '/legal/terms' },
  { label: 'Privacy Policy',    href: '/legal/privacy' },
  { label: 'Cookie Policy',     href: '/legal/cookies' },
  { label: 'Disclaimer',        href: '/legal/disclaimer' },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font)',
      background: 'var(--bg-0)',
      color: 'var(--text-0)',
      minHeight: '100vh',
    }}>
      {/* ── Top nav bar ── */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,12,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-0)', letterSpacing: '-0.02em' }}>
              TradVue
            </span>
          </Link>

          {/* Back to home */}
          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-2)',
            textDecoration: 'none',
            padding: '6px 14px',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            transition: 'all 0.15s',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Home
          </Link>
        </div>
      </nav>

      {/* ── Breadcrumbs ── */}
      <LegalBreadcrumbs />

      {/* ── Main layout ── */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '40px 24px 80px',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: '48px',
        alignItems: 'start',
      }}
        className="legal-grid"
      >
        {/* ── Sidebar ── */}
        <aside style={{
          position: 'sticky',
          top: '72px',
        }}>
          <div style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Legal
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {legalLinks.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      color: 'var(--text-2)',
                      textDecoration: 'none',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Disclaimer blurb */}
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
              fontSize: '11px',
              color: 'var(--text-3)',
              lineHeight: 1.5,
            }}>
              ⚠️ Not financial advice. Trading involves substantial risk of loss.
            </div>
          </div>
        </aside>

        {/* ── Page content ── */}
        <main>
          {children}
        </main>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-1)',
        padding: '20px 24px',
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            © 2026 TradVue. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {legalLinks.map(link => (
              <Link key={link.href} href={link.href} style={{
                fontSize: '12px',
                color: 'var(--text-3)',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .legal-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
