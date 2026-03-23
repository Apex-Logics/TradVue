'use client';

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com';

type FeedbackType = 'bug' | 'feature' | 'general';

const TYPES: { value: FeedbackType; label: string; placeholder: string }[] = [
  { value: 'bug',     label: 'Bug Report',       placeholder: 'Describe the bug...' },
  { value: 'feature', label: 'Feature Request',  placeholder: 'What feature would you like?' },
  { value: 'general', label: 'General',           placeholder: 'Tell us anything...' },
];

export default function FeedbackWidget() {
  const [open, setOpen]           = useState(false);
  const [hidden, setHidden]       = useState(() => {
    try { return localStorage.getItem('cg_feedback_hidden') === '1' } catch { return false }
  });
  const toggleHidden = (val: boolean) => {
    setHidden(val);
    try { localStorage.setItem('cg_feedback_hidden', val ? '1' : '0') } catch {}
  };
  const [type, setType]           = useState<FeedbackType>('bug');
  const [message, setMessage]     = useState('');
  const [email, setEmail]         = useState('');
  const [status, setStatus]       = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const selectedType = TYPES.find(t => t.value === type)!;

  const handleClose = useCallback(() => {
    setOpen(false);
    // Reset form after animation
    setTimeout(() => {
      setType('bug');
      setMessage('');
      setEmail('');
      setStatus('idle');
    }, 300);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (message.trim().length < 10) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim(),
          email: email.trim() || undefined,
          page_url: window.location.href,
        }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, [type, message, email]);

  return (
    <>
      {/* Floating trigger button */}
      {hidden ? (
        <button
          onClick={() => toggleHidden(false)}
          aria-label="Show feedback"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--bg-3, #333)',
            border: '1px solid var(--border, #444)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.4,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.4' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      ) : (
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(99,102,241,0.6)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.45)';
        }}
      >
        {/* Speech bubble icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H6l-2 2V4h16v10z"/>
        </svg>
        {/* Hide button */}
        <span
          onClick={e => { e.stopPropagation(); toggleHidden(true) }}
          style={{
            position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%',
            background: 'var(--bg-0, #111)', border: '1px solid var(--border, #333)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text-3)',
          }}
          title="Hide feedback button"
        >✕</span>
      </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* Slide-up panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Feedback"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          zIndex: 9999,
          width: 'min(420px, 100vw)',
          background: '#1a1b2e',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: 'min(16px, 0px)',
          padding: '20px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '15px' }}>Send Feedback</span>
          <button
            onClick={handleClose}
            aria-label="Close feedback"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* X icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {status === 'success' ? (
          /* Success state */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '24px 0',
            color: '#e2e8f0',
            textAlign: 'center',
          }}>
            <div style={{
              width: '52px', height: '52px',
              borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Checkmark */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#22c55e">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Thanks for the feedback!</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>We read every submission.</p>
          </div>
        ) : status === 'error' ? (
          /* Error state */
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px',
            padding: '14px',
            color: '#fca5a5',
            fontSize: '13px',
            lineHeight: '1.5',
          }}>
            Something went wrong. Try again or email{' '}
            <a href="mailto:support@tradvue.com" style={{ color: '#f87171' }}>support@tradvue.com</a>
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={() => setStatus('idle')}
                style={{
                  background: 'rgba(239,68,68,0.2)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#fca5a5',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <>
            {/* Type selector */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{
                    flex: '1 1 auto',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: type === t.value
                      ? '1px solid #6366f1'
                      : '1px solid rgba(255,255,255,0.1)',
                    background: type === t.value
                      ? 'rgba(99,102,241,0.2)'
                      : 'rgba(255,255,255,0.04)',
                    color: type === t.value ? '#a5b4fc' : '#94a3b8',
                    fontSize: '12px',
                    fontWeight: type === t.value ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Message textarea */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={selectedType.placeholder}
              maxLength={2000}
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#e2e8f0',
                fontSize: '14px',
                lineHeight: '1.5',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '-8px', textAlign: 'right' }}>
              {message.length}/2000
            </div>

            {/* Optional email */}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email (optional, for follow-up)"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#e2e8f0',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={message.trim().length < 10 || status === 'loading'}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: message.trim().length < 10
                  ? 'rgba(99,102,241,0.3)'
                  : 'linear-gradient(135deg, #6366f1, #818cf8)',
                color: message.trim().length < 10 ? '#6b7280' : '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: message.trim().length < 10 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {status === 'loading' ? (
                <>
                  {/* Spinner */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                    </path>
                  </svg>
                  Sending...
                </>
              ) : (
                'Send Feedback'
              )}
            </button>
          </>
        )}
      </div>

    </>
  );
}
