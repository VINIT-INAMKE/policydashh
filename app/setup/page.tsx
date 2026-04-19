'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { AlertCircle, Loader2, RotateCw } from 'lucide-react'

// C5: stop polling after this many seconds. Clerk webhooks typically arrive
// within a few seconds; anything past two minutes indicates a real failure
// (missing CLERK_WEBHOOK_SECRET, svix misconfig, DB offline, etc.).
const POLL_TIMEOUT_SEC = 120

export default function SetupPage() {
  const router = useRouter()
  const clerk = useClerk()
  const [dots, setDots] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    // Clear any prior intervals when attempt changes (retry button).
    for (const id of timersRef.current) clearInterval(id)
    timersRef.current = []
    setElapsed(0)
    setTimedOut(false)

    const dotInterval = window.setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 500)

    const timer = window.setInterval(() => {
      setElapsed((e) => {
        const next = e + 1
        if (next >= POLL_TIMEOUT_SEC) {
          setTimedOut(true)
          // Stop polling once we hit the cap.
          for (const id of timersRef.current) clearInterval(id)
          timersRef.current = []
        }
        return next
      })
    }, 1000)

    const poll = window.setInterval(async () => {
      try {
        const res = await fetch('/api/auth/check')
        const data = await res.json()
        if (data.ready) {
          for (const id of timersRef.current) clearInterval(id)
          timersRef.current = []
          router.replace('/dashboard')
        }
      } catch {
        // Retry on next interval.
      }
    }, 2000)

    timersRef.current = [dotInterval, timer, poll]

    return () => {
      for (const id of timersRef.current) clearInterval(id)
      timersRef.current = []
    }
  }, [router, attempt])

  if (timedOut) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div className="max-w-md text-center">
          <h1 className="text-[20px] font-semibold">Account setup didn&apos;t complete</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            We waited 2 minutes for your account to sync and didn&apos;t hear back.
            This usually means the Clerk webhook is misconfigured or the server
            isn&apos;t receiving events.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--cl-primary)] px-4 py-2 text-sm font-medium text-[var(--cl-on-primary)]"
            >
              <RotateCw className="h-4 w-4" />
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                clerk.signOut({ redirectUrl: '/sign-in' }).catch(() => {
                  router.replace('/sign-in')
                })
              }}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
            >
              Sign out
            </button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            If this keeps happening, contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <div className="text-center">
        <h1 className="text-[20px] font-semibold">Setting up your account{dots}</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          This usually takes a few seconds.
        </p>
        {elapsed > 10 && (
          <p className="mt-4 text-[14px] text-muted-foreground">
            Taking longer than expected. We&apos;ll keep trying for up to 2 minutes.
          </p>
        )}
        {elapsed > 60 && (
          <p className="mt-2 text-[14px] text-destructive">
            Still waiting on Clerk webhook... ({POLL_TIMEOUT_SEC - elapsed}s left)
          </p>
        )}
      </div>
    </div>
  )
}
