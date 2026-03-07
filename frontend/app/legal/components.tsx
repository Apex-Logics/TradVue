import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Shared legal page components
// ─────────────────────────────────────────────────────────────────────────────

interface LegalPageProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <article>
      {/* Page header */}
      <header style={{ marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          display: 'inline-block',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#4a9eff',
          background: 'rgba(74,158,255,0.08)',
          border: '1px solid rgba(74,158,255,0.2)',
          borderRadius: '4px',
          padding: '3px 10px',
          marginBottom: '16px',
        }}>
          Legal
        </div>
        <h1 style={{
          fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--text-0)',
          lineHeight: 1.15,
          marginBottom: '12px',
        }}>
          {title}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Last updated: {lastUpdated}
        </p>
      </header>

      {/* Page sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
        {children}
      </div>
    </article>
  )
}

interface SectionProps {
  id?: string
  title: string
  children: React.ReactNode
}

export function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
      <h2 style={{
        fontSize: '1.15rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--text-0)',
        marginBottom: '16px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: '14.5px',
        color: 'var(--text-1)',
        lineHeight: 1.75,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {children}
      </div>
    </section>
  )
}

interface SubSectionProps {
  title: string
  children: React.ReactNode
}

export function SubSection({ title, children }: SubSectionProps) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <h3 style={{
        fontWeight: 700,
        color: 'var(--text-0)',
        marginBottom: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontSize: '11px',
      }}>
        {title}
      </h3>
      <div style={{
        fontSize: '14.5px',
        color: 'var(--text-1)',
        lineHeight: 1.75,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {children}
      </div>
    </div>
  )
}

export function UL({ items }: { items: string[] }) {
  return (
    <ul style={{
      paddingLeft: '0',
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      margin: '4px 0',
    }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14.5px', color: 'var(--text-1)', lineHeight: 1.65 }}>
          <span style={{ color: '#4a9eff', flexShrink: 0, marginTop: '5px', fontSize: '10px' }}>▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function OL({ items }: { items: string[] }) {
  return (
    <ol style={{
      paddingLeft: '0',
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      margin: '4px 0',
      counterReset: 'legal-ol',
    }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14.5px', color: 'var(--text-1)', lineHeight: 1.65 }}>
          <span style={{
            flexShrink: 0,
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'rgba(74,158,255,0.1)',
            border: '1px solid rgba(74,158,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: '#4a9eff',
            marginTop: '1px',
          }}>
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderLeft: '3px solid #ef4444',
      borderRadius: '8px',
      padding: '20px 24px',
      marginBottom: '40px',
      fontSize: '14.5px',
      color: 'var(--text-1)',
      lineHeight: 1.7,
    }}>
      {children}
    </div>
  )
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(74,158,255,0.06)',
      border: '1px solid rgba(74,158,255,0.2)',
      borderLeft: '3px solid #4a9eff',
      borderRadius: '8px',
      padding: '20px 24px',
      marginBottom: '24px',
      fontSize: '14.5px',
      color: 'var(--text-1)',
      lineHeight: 1.7,
    }}>
      {children}
    </div>
  )
}

export function AcknowledgmentBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '24px',
      marginTop: '16px',
      marginBottom: '8px',
      fontSize: '14px',
      color: 'var(--text-2)',
      lineHeight: 1.7,
      textAlign: 'center',
      fontStyle: 'italic',
    }}>
      {children}
    </div>
  )
}

interface CookieTableProps {
  rows: { name: string; purpose: string; duration: string; type: string }[]
}

export function CookieTable({ rows }: CookieTableProps) {
  return (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
        color: 'var(--text-1)',
      }}>
        <thead>
          <tr>
            {['Cookie Name', 'Purpose', 'Duration', 'Type'].map(h => (
              <th key={h} style={{
                textAlign: 'left',
                padding: '10px 14px',
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-0)',
                fontWeight: 600,
                fontSize: '12px',
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 14px' }}>
                <code style={{
                  background: 'rgba(74,158,255,0.08)',
                  color: '#4a9eff',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}>
                  {row.name}
                </code>
              </td>
              <td style={{ padding: '10px 14px', lineHeight: 1.5 }}>{row.purpose}</td>
              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-2)' }}>{row.duration}</td>
              <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>{row.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ImpactTableProps {
  rows: { type: string; impact: string }[]
}

export function ImpactTable({ rows }: ImpactTableProps) {
  return (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
        color: 'var(--text-1)',
      }}>
        <thead>
          <tr>
            {['Cookie Type', 'If Disabled'].map(h => (
              <th key={h} style={{
                textAlign: 'left',
                padding: '10px 14px',
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-0)',
                fontWeight: 600,
                fontSize: '12px',
                letterSpacing: '0.03em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-0)', whiteSpace: 'nowrap' }}>{row.type}</td>
              <td style={{ padding: '10px 14px', lineHeight: 1.5 }}>{row.impact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
