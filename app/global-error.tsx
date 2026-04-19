'use client'

/**
 * P20: global error boundary. Replaces the root layout when an uncaught
 * error occurs in layout.tsx itself (e.g. ClerkProvider initialization
 * failure). Next.js 16 requires this file to include its own <html> +
 * <body> tags; no providers, no fonts — keep it framework-agnostic so it
 * renders even when the app shell is broken.
 */

import { useEffect } from 'react'

type Props = {
  error: Error & { digest?: string }
  unstable_retry?: () => void
  reset?: () => void
}

export default function GlobalError({ error, unstable_retry, reset }: Props) {
  useEffect(() => {
    console.error('[global-error-boundary]', error)
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#fafaf9',
          color: '#1c1917',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 520, padding: '0 1.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: '1rem',
              fontSize: '1rem',
              color: '#57534e',
              lineHeight: 1.5,
            }}
          >
            A critical error prevented the page from loading. Please refresh, or
            come back in a few minutes.
          </p>
          {error.digest ? (
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#78716c' }}>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
          <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            {retry ? (
              <button
                onClick={() => retry()}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1c1917',
                  color: '#fafaf9',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            ) : null}
            <a
              href="/"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 6,
                border: '1px solid #d6d3d1',
                color: '#1c1917',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Return home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
