'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface RegisterFormProps {
  workshopId: string
  workshopTitle: string
  disabled?: boolean
  prefillName?: string | null
  prefillEmail?: string | null
}

export function RegisterForm({ workshopId, workshopTitle, disabled, prefillName, prefillEmail }: RegisterFormProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(prefillName || '')
  const [email, setEmail] = useState(prefillEmail || '')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)
  const isPrefilled = Boolean(prefillName && prefillEmail)

  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? ''

  if (disabled) {
    return (
      <Button className="h-11 w-full text-base font-semibold" disabled>
        Fully booked
      </Button>
    )
  }

  if (success) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800">
          You&apos;re registered! Check your email for confirmation.
        </p>
      </div>
    )
  }

  async function submitRegistration(payload: { name: string; email: string }) {
    if (!turnstileToken) {
      setError('Please complete the security check.')
      return false
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/intake/workshop-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId,
          name: payload.name,
          email: payload.email,
          turnstileToken,
        }),
      })
      if (res.status === 403) {
        // Spent / invalid token — reset the widget so the user can solve
        // a fresh challenge without reloading the page.
        setTurnstileToken(null)
        turnstileRef.current?.reset()
        setError('Security check failed. Please complete the check again.')
        return false
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Registration failed')
      }
      setSuccess(true)
      // F32: refresh server data so sibling cards see the new state.
      router.refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePrefillSubmit() {
    await submitRegistration({
      name: (prefillName ?? '').trim(),
      email: (prefillEmail ?? '').trim(),
    })
  }

  function renderTurnstile() {
    return (
      <div role="region" aria-label="Security check" className="rounded-md bg-[var(--cl-surface-container,#ebeef0)] px-3 py-3">
        {siteKey ? (
          <Turnstile
            ref={turnstileRef}
            siteKey={siteKey}
            options={{ theme: 'light', size: 'normal' }}
            onSuccess={(token: string) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
          />
        ) : (
          <p role="alert" className="text-sm text-destructive">
            Security check unavailable. Please try again later.
          </p>
        )}
      </div>
    )
  }

  // Prefilled confirmation view for logged-in users
  if (isPrefilled && !expanded) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--cl-on-surface-variant)]">
          Register as <span className="font-medium text-[var(--cl-on-surface)]">{prefillName}</span> ({prefillEmail})
        </p>
        {renderTurnstile()}
        {error ? (
          <p role="alert" aria-live="assertive" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <Button
          onClick={handlePrefillSubmit}
          className="w-full h-11 font-semibold"
          style={{ backgroundColor: 'var(--cl-on-tertiary-container, #179d53)', color: '#ffffff' }}
          disabled={submitting || !turnstileToken}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Registration'}
        </Button>
      </div>
    )
  }

  if (!expanded && !isPrefilled) {
    return (
      <Button
        className="h-11 w-full text-base font-semibold"
        style={{ backgroundColor: 'var(--cl-on-tertiary-container, #179d53)', color: '#ffffff' }}
        onClick={() => setExpanded(true)}
        aria-label={`Register for ${workshopTitle}`}
      >
        Register
      </Button>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    await submitRegistration({ name: name.trim(), email: email.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <Input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="h-10"
      />
      <Input
        type="email"
        placeholder="Email address"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-10"
      />
      {renderTurnstile()}
      {error ? (
        <p role="alert" aria-live="assertive" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-10 flex-1"
          onClick={() => setExpanded(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-10 flex-1 font-semibold"
          style={{ backgroundColor: 'var(--cl-on-tertiary-container, #179d53)', color: '#ffffff' }}
          disabled={submitting || !email.trim() || !turnstileToken}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
        </Button>
      </div>
    </form>
  )
}
