'use client'

/**
 * WorkshopFeedbackForm - client island for the `/participate` feedback mode
 * (Phase 20, WS-15). Rendered by the server component in page.tsx only after
 * `verifyFeedbackToken` has already validated the JWT server-side. We still
 * pass the raw `token` back to `/api/intake/workshop-feedback` so the route
 * handler re-verifies independently - never trust the client.
 *
 * Visual contract: 20-UI-SPEC.md Surface B §"Feedback Form Card Anatomy".
 * Base-ui Select adapter pattern (Phase 19 canonical): `value={v || null}`
 * paired with `onValueChange={(v) => setV(v ?? '')}` to bridge empty-string
 * form state to base-ui's `string | null` required type.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { StarRating } from './star-rating'

export interface WorkshopFeedbackFormSection {
  id: string
  title: string
}

interface WorkshopFeedbackFormProps {
  workshopId: string
  token: string
  sections: WorkshopFeedbackFormSection[]
}

const MAX_COMMENT = 4000

export function WorkshopFeedbackForm({ workshopId, token, sections }: WorkshopFeedbackFormProps) {
  const [rating, setRating] = useState<number>(0)
  const [comment, setComment] = useState<string>('')
  const [sectionId, setSectionId] = useState<string>('')
  // E7: attendee-controlled anonymity; default to anonymous because most
  // post-workshop feedback is informal and attendees don't expect their
  // name attached without explicit consent.
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [topError, setTopError] = useState<string | null>(null)
  // S24: permanently latch the submit button off after a non-transient
  // failure so a second click doesn't burn the per-token rate limit or
  // succeed while the first duplicate is still mid-flight.
  const [fatalError, setFatalError] = useState(false)
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [commentError, setCommentError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setTopError(null)
      setRatingError(null)
      setCommentError(null)

      // Local validation
      let bad = false
      if (rating < 1 || rating > 5) {
        setRatingError('Please select a rating.')
        bad = true
      }
      const trimmed = comment.trim()
      if (trimmed.length === 0) {
        setCommentError('Please share your feedback before submitting.')
        bad = true
      } else if (trimmed.length > MAX_COMMENT) {
        setCommentError(`Please keep your feedback under ${MAX_COMMENT} characters.`)
        bad = true
      }
      if (bad) return

      setSubmitting(true)
      try {
        const res = await fetch('/api/intake/workshop-feedback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workshopId,
            token,
            rating,
            comment: trimmed,
            sectionId: sectionId || undefined,
            isAnonymous,
          }),
        })

        if (res.status === 200) {
          toast.success('Feedback submitted - thank you.', { duration: 4000 })
          setSubmitted(true)
          return
        }

        if (res.status === 401) {
          // S24: expired/replayed token — permanently disable submit so the
          // user cannot re-fire and burn the per-token rate limit further.
          const msg = 'This link has expired. Please contact the workshop organizer.'
          setTopError(msg)
          setFatalError(true)
          toast.error(msg)
        } else if (res.status === 409) {
          // S3: attendee has a valid JWT but no Clerk-linked users row yet.
          // Tell them to accept their invite first, then come back.
          const msg =
            'Please complete sign-up via your invitation email first, then return to this link and resubmit your feedback.'
          setTopError(msg)
          setFatalError(true)
          toast.error(msg)
        } else if (res.status === 400) {
          const msg = 'Please check your entries and try again.'
          setTopError(msg)
          toast.error(msg)
        } else if (res.status === 429) {
          const msg = 'Too many attempts. Please wait a moment and try again.'
          setTopError(msg)
          toast.error(msg)
        } else {
          // S24: non-transient server failure → permanently disable submit
          // so a second click doesn't burn the nonce under a re-attempted
          // success path.
          const msg = 'Something went wrong on our end. Please reload the page and try again.'
          setTopError(msg)
          setFatalError(true)
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
    [workshopId, token, rating, comment, sectionId, isAnonymous],
  )

  if (submitted) {
    return <FeedbackSubmittedCard />
  }

  const charCount = comment.length

  return (
    <Card className="px-6 py-8 sm:px-8">
      <form onSubmit={handleSubmit} aria-busy={submitting} className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-[var(--cl-on-surface)]">
          Workshop Feedback
        </h2>

        {topError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {topError}
          </div>
        ) : null}

        {/* Rating */}
        <section className="flex flex-col gap-3">
          <Label>How would you rate this workshop?</Label>
          <StarRating value={rating} onChange={setRating} disabled={submitting} />
          {ratingError ? (
            <p className="text-sm text-destructive">{ratingError}</p>
          ) : null}
        </section>

        <Separator />

        {/* Comment */}
        <section className="flex flex-col gap-3">
          <Label htmlFor="comment">
            Your feedback <span className="text-muted-foreground">(required)</span>
          </Label>
          <Textarea
            id="comment"
            rows={6}
            maxLength={MAX_COMMENT}
            placeholder="Share what you found valuable, what could be improved, or any specific policy insights..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            aria-invalid={!!commentError}
            aria-describedby={commentError ? 'comment-error' : 'comment-count'}
            required
          />
          <p
            id="comment-count"
            className="text-right text-xs text-muted-foreground"
            aria-live="polite"
          >
            {charCount}/{MAX_COMMENT}
          </p>
          {commentError ? (
            <p id="comment-error" className="text-sm text-destructive">
              {commentError}
            </p>
          ) : null}
        </section>

        {sections.length > 0 ? (
          <>
            <Separator />
            {/* Section selector */}
            <section className="flex flex-col gap-3">
              <Label htmlFor="sectionId">
                Which policy section does this relate to?{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={sectionId || null}
                onValueChange={(v) => setSectionId(v ?? '')}
              >
                <SelectTrigger id="sectionId">
                  <SelectValue placeholder="Select a section (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          </>
        ) : null}

        <Separator />

        {/* E7: Attendee-controlled anonymity */}
        <section className="flex flex-col gap-3">
          <Label id="wf-attribution-label">Attribution</Label>
          <RadioGroup
            value={isAnonymous ? 'anonymous' : 'named'}
            onValueChange={(v: string) => setIsAnonymous(v === 'anonymous')}
            aria-labelledby="wf-attribution-label"
          >
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/30">
              <RadioGroupItem value="anonymous" className="mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-snug">Anonymous</span>
                <span className="text-[12px] font-normal leading-[1.4] text-muted-foreground">
                  Your identity will not appear on this feedback.
                </span>
              </div>
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/30">
              <RadioGroupItem value="named" className="mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-snug">Attributed</span>
                <span className="text-[12px] font-normal leading-[1.4] text-muted-foreground">
                  Your email (from the invite link) will be associated with this feedback.
                </span>
              </div>
            </label>
          </RadioGroup>
        </section>

        <Button
          type="submit"
          disabled={submitting || fatalError}
          aria-disabled={submitting || fatalError}
          title={
            fatalError
              ? 'Please reload the page to try again.'
              : undefined
          }
          className="h-12 w-full text-base font-semibold"
          style={{ backgroundColor: 'var(--cl-primary, #000a1e)', color: '#ffffff' }}
        >
          {submitting ? 'Submitting…' : 'Submit Feedback'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Your feedback is submitted under your workshop registration and linked to this consultation.
        </p>
      </form>
    </Card>
  )
}

/**
 * S19: success card rendered as its own component so the heading can take
 * focus on mount. Screen-reader and keyboard users land directly on the
 * confirmation message rather than having to hunt for it, and the focused
 * heading also triggers the SR name+role announcement reliably across
 * browsers (some readers skip `aria-live` content mounted at page load).
 */
function FeedbackSubmittedCard() {
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  return (
    <Card
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-4 px-6 py-12 text-center"
    >
      <CheckCircle2
        className="h-12 w-12"
        style={{ color: 'var(--cl-tertiary-fixed-dim, #66dd8b)' }}
        aria-hidden="true"
      />
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold text-[var(--cl-on-surface)] outline-none"
      >
        Feedback submitted.
      </h2>
      <p className="max-w-md text-base leading-relaxed text-muted-foreground">
        Thank you for sharing your insights. Your feedback is now part of the policy consultation record.
      </p>
    </Card>
  )
}
