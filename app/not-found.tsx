/**
 * P20: 404 page for any route that calls `notFound()` AND for unmatched
 * URLs across the app (Next.js 16 routes both into this file when the
 * root app/not-found.tsx exists).
 *
 * Kept as a Server Component (no hooks) so it renders fast and is
 * cache-eligible.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="mt-4 font-headline text-4xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-4 text-base text-muted-foreground">
        The page you are looking for does not exist, or has been moved.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button variant="default" render={<Link href="/" />}>
          Return home
        </Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          Go to dashboard
        </Button>
      </div>
    </div>
  )
}
