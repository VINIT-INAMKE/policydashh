'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const [dots, setDots] = useState('')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 500)

    const timer = setInterval(() => {
      setElapsed((e) => e + 1)
    }, 1000)

    // Poll /api/auth/check every 2 seconds
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/check')
        const data = await res.json()
        if (data.ready) {
          clearInterval(poll)
          clearInterval(dotInterval)
          clearInterval(timer)
          router.replace('/dashboard')
        }
      } catch {
        // Retry on next interval
      }
    }, 2000)

    return () => {
      clearInterval(poll)
      clearInterval(dotInterval)
      clearInterval(timer)
    }
  }, [router])

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
            Taking longer than expected. If this persists, try refreshing the page.
          </p>
        )}
        {elapsed > 30 && (
          <p className="mt-2 text-[14px] text-destructive">
            Something may be wrong with the webhook configuration. Please contact support.
          </p>
        )}
      </div>
    </div>
  )
}
