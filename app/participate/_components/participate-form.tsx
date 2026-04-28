'use client'

import { useState, useCallback, useRef } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ParticipateSuccess } from './participate-success'

type OrgType = 'government' | 'industry' | 'legal' | 'academia' | 'civil_society' | 'internal'

interface FormState {
  name: string
  email: string
  // Option C (migration 0028): `designation` is a free-text title that
  // replaces the old `role` radio group — that radio asked the user to pick
  // their "role" from the same enum as orgType, which was redundant and
  // stored nothing useful. A designation like "Partner, Fintech Practice" or
  // "Research Fellow" is what the /stakeholders directory actually shows.
  designation: string
  orgType: OrgType | ''
  orgName: string
  expertise: string
  howHeard: string
}

const INITIAL: FormState = {
  name: '',
  email: '',
  designation: '',
  orgType: '',
  orgName: '',
  expertise: '',
  howHeard: '',
}

const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
  { value: 'government', label: 'Government' },
  { value: 'industry', label: 'Industry' },
  { value: 'legal', label: 'Legal' },
  { value: 'academia', label: 'Academia' },
  { value: 'civil_society', label: 'Civil Society' },
  { value: 'internal', label: 'Internal' },
]

const HOW_HEARD_OPTIONS = [
  'Social media',
  'Email / newsletter',
  'Colleague / referral',
  'Search engine',
  'News article / press',
  'Other',
]

interface Errors {
  name?: string
  email?: string
  designation?: string
  orgType?: string
  orgName?: string
  expertise?: string
}

function validate(state: FormState): Errors {
  const errs: Errors = {}
  if (state.name.trim().length < 2) errs.name = 'Please enter your full name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) errs.email = 'Please enter a valid email address.'
  if (state.designation.trim().length < 2) errs.designation = 'Please enter your title or designation.'
  if (!state.orgType) errs.orgType = 'Please select your organization type.'
  if (state.orgName.trim().length < 2) errs.orgName = 'Please enter your organization name.'
  if (state.expertise.trim().length < 20) {
    errs.expertise = 'Please describe your area of expertise (at least 20 characters).'
  }
  return errs
}

export function ParticipateForm() {
  const [state, setState] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Errors>({})
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [topError, setTopError] = useState<string | null>(null)
  const successEmail = useRef<string>('')
  const successOrg = useRef<string>('')
  // S25: ref to the Turnstile widget so we can call .reset() after the
  // server rejects a token (403). A spent token will never re-verify, so
  // we must tear it down and surface a fresh challenge instead of leaving
  // the user stuck with a stale one.
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setTopError(null)

      const errs = validate(state)
      if (Object.keys(errs).length > 0) {
        setErrors(errs)
        return
      }
      setErrors({})

      if (!turnstileToken) {
        toast.error('Please complete the security check.')
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch('/api/intake/participate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...state,
            turnstileToken,
          }),
        })

        if (res.status === 200) {
          successEmail.current = state.email
          successOrg.current = state.orgType as string
          toast.success('Request received - check your inbox.', { duration: 4000 })
          setSubmitted(true)
          return
        }

        // Error paths
        if (res.status === 403) {
          // S25: the server rejected the token (already-used, invalid
          // signature, or siteverify failure). Spent tokens can't re-verify,
          // so clear local state AND reset the widget so the user can solve
          // a fresh challenge without reloading the page.
          const msg = 'Security verification failed. Please complete the security check again.'
          setTopError(msg)
          setTurnstileToken(null)
          turnstileRef.current?.reset()
          toast.error(msg)
        } else if (res.status === 429) {
          const msg = 'Too many requests from this email address. Please wait 15 minutes before trying again.'
          setTopError(msg)
          toast.error(msg)
        } else if (res.status === 400) {
          const msg = 'Please check your entries and try again.'
          setTopError(msg)
          toast.error(msg)
        } else {
          const msg = 'Something went wrong on our end. Please try again in a moment.'
          setTopError(msg)
          toast.error(msg)
        }
      } catch {
        const msg = 'Connection error. Please check your internet and try again.'
        setTopError(msg)
        toast.error(msg)
      } finally {
        setSubmitting(false)
      }
    },
    [state, turnstileToken],
  )

  if (submitted) {
    return <ParticipateSuccess email={successEmail.current} orgType={successOrg.current} />
  }

  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? ''
  const canSubmit = !!turnstileToken && !submitting

  return (
    <Card className="px-6 py-8 sm:px-8">
      <form onSubmit={handleSubmit} aria-busy={submitting} className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-[var(--cl-on-surface)]">Request Access</h2>

        {topError ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {topError}
          </div>
        ) : null}

        {/* Section: About You */}
        <section className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-[var(--cl-on-surface)]">About You</h3>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              placeholder=""
              value={state.name}
              onChange={(e) => update('name', e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              maxLength={120}
              required
            />
            {errors.name ? <p id="name-error" className="text-sm text-destructive">{errors.name}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder=""
              value={state.email}
              onChange={(e) => update('email', e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              maxLength={254}
              required
            />
            {errors.email ? <p id="email-error" className="text-sm text-destructive">{errors.email}</p> : null}
          </div>
        </section>

        <Separator />

        {/* Section: Your Organization */}
        <section className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-[var(--cl-on-surface)]">Your Organization</h3>
          <div className="flex flex-col gap-2">
            <Label htmlFor="designation">Title / Designation</Label>
            <Input
              id="designation"
              placeholder=""
              value={state.designation}
              onChange={(e) => update('designation', e.target.value)}
              aria-invalid={!!errors.designation}
              aria-describedby={errors.designation ? 'designation-error' : undefined}
              maxLength={200}
              required
            />
            {errors.designation ? <p id="designation-error" className="text-sm text-destructive">{errors.designation}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="orgType">Organization type</Label>
            <Select value={state.orgType || null} onValueChange={(v) => update('orgType', (v ?? '') as OrgType | '')}>
              <SelectTrigger
                id="orgType"
                aria-invalid={!!errors.orgType}
                aria-describedby={errors.orgType ? 'orgType-error' : undefined}
              >
                <SelectValue placeholder="Select organization type" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.orgType ? (
              <p id="orgType-error" className="text-sm text-destructive">
                {errors.orgType}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="orgName">Organization name</Label>
            <Input
              id="orgName"
              placeholder=""
              value={state.orgName}
              onChange={(e) => update('orgName', e.target.value)}
              aria-invalid={!!errors.orgName}
              aria-describedby={errors.orgName ? 'orgName-error' : undefined}
              maxLength={200}
              required
            />
            {errors.orgName ? <p id="orgName-error" className="text-sm text-destructive">{errors.orgName}</p> : null}
          </div>
        </section>

        <Separator />

        {/* Section: Your Expertise */}
        <section className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-[var(--cl-on-surface)]">Your Expertise</h3>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expertise">Area of expertise / interest</Label>
            <Textarea
              id="expertise"
              rows={4}
              placeholder=""
              value={state.expertise}
              onChange={(e) => update('expertise', e.target.value)}
              aria-invalid={!!errors.expertise}
              aria-describedby={errors.expertise ? 'expertise-error' : undefined}
              maxLength={1000}
              required
            />
            {errors.expertise ? <p id="expertise-error" className="text-sm text-destructive">{errors.expertise}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="howHeard">How did you hear about this consultation? <span className="text-muted-foreground">(optional)</span></Label>
            <Select value={state.howHeard || null} onValueChange={(v) => update('howHeard', v ?? '')}>
              <SelectTrigger id="howHeard">
                <SelectValue placeholder="Select one (optional)" />
              </SelectTrigger>
              <SelectContent>
                {HOW_HEARD_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Turnstile */}
        <div
          role="region"
          aria-label="Security check"
          className="flex flex-col gap-2 rounded-md bg-[var(--cl-surface-container,#ebeef0)] px-4 py-4"
        >
          <span className="text-sm font-medium">Security check</span>
          {siteKey ? (
            <Turnstile
              ref={turnstileRef}
              siteKey={siteKey}
              options={{ theme: 'light', size: 'normal' }}
              onSuccess={(token: string) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => {
                setTurnstileToken(null)
                toast.error('Security check failed. Please refresh and try again.')
              }}
            />
          ) : (
            // S16: user-facing copy when the site key is missing (production
            // misconfiguration). The previous dev-facing copy + permanently
            // disabled button left the user stuck with no guidance; this
            // version tells them the service is temporarily unavailable
            // and how to get help.
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              Service temporarily unavailable. Please try again later, or
              contact us if the problem persists.
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
          title={!turnstileToken ? 'Please complete the security check' : undefined}
          className="h-12 w-full text-base font-semibold"
          style={{ backgroundColor: 'var(--cl-primary, #000a1e)', color: '#ffffff' }}
        >
          {submitting ? 'Submitting\u2026' : 'Request Access'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Your information is handled in accordance with our privacy policy and used only for consultation purposes.
        </p>
      </form>
    </Card>
  )
}
