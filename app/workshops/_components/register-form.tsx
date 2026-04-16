'use client'

import { useState } from 'react'
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
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(prefillName || '')
  const [email, setEmail] = useState(prefillEmail || '')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPrefilled = Boolean(prefillName && prefillEmail)

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
          You're registered! Check your email for confirmation.
        </p>
      </div>
    )
  }

  async function handlePrefillSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/intake/workshop-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId, name: (prefillName ?? '').trim(), email: (prefillEmail ?? '').trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Registration failed')
      }
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // Prefilled confirmation view for logged-in users
  if (isPrefilled && !expanded) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--cl-on-surface-variant)]">
          Register as <span className="font-medium text-[var(--cl-on-surface)]">{prefillName}</span> ({prefillEmail})
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button
          onClick={handlePrefillSubmit}
          className="w-full h-11 font-semibold"
          style={{ backgroundColor: 'var(--cl-on-tertiary-container, #179d53)', color: '#ffffff' }}
          disabled={submitting}
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

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/intake/workshop-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId, name: name.trim(), email: email.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Registration failed')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
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
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
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
          disabled={submitting || !email.trim()}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
        </Button>
      </div>
    </form>
  )
}
