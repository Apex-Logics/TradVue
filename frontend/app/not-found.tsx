import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f1117',
        color: '#e2e8f0',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ fontSize: '6rem', lineHeight: 1 }}>📉</div>
      <h1 style={{ fontSize: '5rem', fontWeight: 700, color: '#6366f1', margin: '0.5rem 0 0' }}>
        404
      </h1>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0.5rem 0' }}>
        Page Not Found
      </h2>
      <p style={{ color: '#94a3b8', maxWidth: '400px', lineHeight: 1.6 }}>
        Looks like this chart ran off the edge. The page you&apos;re looking for doesn&apos;t exist
        or has been moved.
      </p>
      <Link
        href="/"
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1.75rem',
          background: '#6366f1',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '1rem',
          transition: 'background 0.2s',
        }}
      >
        ← Back to Home
      </Link>
    </div>
  )
}
