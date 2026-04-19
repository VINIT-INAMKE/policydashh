'use client'

/**
 * P20: route-level error boundary. Shown for any uncaught error inside a
 * route segment — server component crash, failed tRPC fetch, etc.
 *
 * Next.js 16 passes `unstable_retry` as the canonical recovery path (see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
 * We accept both `unstable_retry` and the legacy `reset` prop so this page
 * keeps working across patch versions.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Props = {
  error: Error & { digest?: string }
  unstable_retry?: () => void
  reset?: () => void
}

export default function ErrorPage({ error, unstable_retry, reset }: Props) {
  useEffect(() => {
    console.error('[app-error-boundary]', error)
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-headline text-4xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-4 text-base text-muted-foreground">
        An unexpected error happened while loading this page. Our team has been
        notified.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {retry ? (
          <Button onClick={() => retry()} variant="default">
            Try again
          </Button>
        ) : null}
        <Button variant="outline" render={<Link href="/" />}>
          Return home
        </Button>
      </div>
    </div>
  )
}
