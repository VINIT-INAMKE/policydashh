/**
 * Public workshop detail page — `/workshops/[id]`
 *
 * Stakeholder-facing permalink. Mirrors the content of the admin detail page
 * but excludes PII, admin tooling, and internal-only sections.
 *
 * Sections rendered (in order):
 *   1. "Manage this workshop" banner — only for workshop:manage roles
 *   2. Header — title, description, date/tz, status badge, meeting source badge
 *   3. Spots-left badge — only for upcoming/in_progress
 *   4. Register form or "You're registered" state
 *   5. Meeting URL — only for registered viewers or workshop:manage
 *   6. Linked policy sections
 *   7. Approved artifacts (grouped by type)
 *   8. Workshop summary (approved summary artifact text, if present)
 *
 * Auth: anonymous users see header + spots + register form only.
 * Registered stakeholders additionally see the meeting URL and registered state.
 * Admins/moderators see all of the above plus the "Manage" banner.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Calendar, Clock, Globe, ExternalLink, Video, Link2, FileText } from 'lucide-react'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import {
  getPublicWorkshopById,
  isViewerRegistered,
  type PublicWorkshopDetail,
} from '@/src/server/queries/workshops-public'
import { can } from '@/src/lib/permissions'
import { formatWorkshopTime } from '@/src/lib/format-workshop-time'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RegisterForm } from '@/app/workshops/_components/register-form'
import { SpotsLeftBadge } from '@/app/workshops/_components/spots-left-badge'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const workshop = await getPublicWorkshopById(id)
  if (!workshop) return { title: 'Workshop not found' }
  return {
    title: `${workshop.title} | Civilization Lab`,
    description: workshop.description ?? undefined,
  }
}

export default async function PublicWorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Fetch workshop data first — notFound() early if missing
  const workshop = await getPublicWorkshopById(id)
  if (!workshop) notFound()

  // Auth — auth() returns { userId: null } for anonymous; no throw
  const { userId: clerkUserId } = await auth()

  // Map Clerk userId → internal users row (needed for registration check)
  let viewerUser: { id: string; role: string; name: string | null; email: string | null } | null = null
  if (clerkUserId) {
    const row = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
      columns: { id: true, role: true, name: true, email: true },
    })
    viewerUser = row ?? null
  }

  const canManage = viewerUser
    ? can(viewerUser.role as Parameters<typeof can>[0], 'workshop:manage')
    : false

  // C5: compute email hash for the defensive emailHash fallback in
  // isViewerRegistered — catches registrations made before the user row
  // existed in our DB (userId=null on the registration row).
  const viewerEmailHash = viewerUser?.email
    ? createHash('sha256').update(viewerUser.email.toLowerCase().trim()).digest('hex')
    : undefined

  const isRegistered = viewerUser
    ? await isViewerRegistered(id, viewerUser.id, viewerEmailHash)
    : false

  const showMeetingUrl = isRegistered || canManage

  const formattedDate = formatWorkshopTime(workshop.scheduledAt, workshop.timezone)

  // Group non-summary artifacts by type for the approved artifacts section
  const artifactsByType = workshop.artifacts.reduce<
    Record<string, PublicWorkshopDetail['artifacts']>
  >((acc, a) => {
    const key = a.artifactType
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const ARTIFACT_TYPE_LABELS: Record<string, string> = {
    promo: 'Promo Materials',
    recording: 'Recordings',
    transcript: 'Transcripts',
    attendance: 'Attendance',
    other: 'Other',
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">

        {/* ── Manage banner (admins/moderators only) ── */}
        {canManage && <ManageBanner workshopId={workshop.id} />}

        {/* ── Header ── */}
        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={workshop.status} />
            <MeetingSourceBadge provisionedBy={workshop.meetingProvisionedBy} />
          </div>

          <h1
            className="mb-2 text-[28px] font-semibold leading-[1.2] text-[var(--cl-on-surface)]"
            style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
          >
            {workshop.title}
          </h1>

          {workshop.description && (
            <p className="mb-4 text-base leading-relaxed text-muted-foreground">
              {workshop.description}
            </p>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {formattedDate}
            </span>
            {workshop.durationMinutes && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {workshop.durationMinutes} minutes
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              {workshop.timezone}
            </span>
          </div>
        </header>

        <Separator className="mb-8" />

        {/* ── Spots-left badge ── */}
        {(workshop.status === 'upcoming' || workshop.status === 'in_progress') && (
          <div className="mb-6">
            <SpotsLeftBadge
              maxSeats={workshop.maxSeats}
              registeredCount={workshop.registeredCount}
            />
          </div>
        )}

        {/* ── Registration area ── */}
        {workshop.status === 'upcoming' && (
          <div className="mb-8">
            {isRegistered ? (
              <RegisteredState />
            ) : (
              <RegisterForm
                workshopId={workshop.id}
                workshopTitle={workshop.title}
                disabled={
                  workshop.maxSeats !== null &&
                  workshop.registeredCount >= workshop.maxSeats
                }
                prefillName={viewerUser?.name}
                prefillEmail={viewerUser?.email}
              />
            )}
          </div>
        )}

        {/* For in_progress / completed / archived — show registered state only */}
        {workshop.status !== 'upcoming' && isRegistered && (
          <div className="mb-8">
            <RegisteredState />
          </div>
        )}

        {/* ── Meeting URL (registered + manage only) ── */}
        {showMeetingUrl && (
          <div className="mb-8">
            <MeetingUrlPanel meetingUrl={workshop.meetingUrl} />
          </div>
        )}

        {/* ── Linked policy sections ── */}
        {workshop.sections.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Linked Policy Sections
            </h2>
            <div className="space-y-1">
              {workshop.sections.map((section) => (
                <Link
                  key={section.sectionId}
                  href={`/policies/${section.documentId}`}
                  className="flex flex-col rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <span className="text-sm font-medium hover:underline">
                    {section.sectionTitle}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {section.documentTitle}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Approved artifacts ── */}
        {Object.keys(artifactsByType).length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Materials
            </h2>
            <div className="space-y-6">
              {Object.entries(artifactsByType).map(([type, items]) => (
                <div key={type}>
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                    {ARTIFACT_TYPE_LABELS[type] ?? type}
                  </h3>
                  <div className="space-y-1">
                    {items.map((artifact) => (
                      <ArtifactRow key={artifact.id} artifact={artifact} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Workshop summary ── */}
        {workshop.summary && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Workshop Summary
            </h2>
            <Card>
              <CardContent className="pt-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {workshop.summary}
                </p>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Local sub-components (all Server Components — no 'use client' needed)
// ---------------------------------------------------------------------------

function ManageBanner({ workshopId }: { workshopId: string }) {
  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        You have manage access to this workshop.
      </p>
      <Button variant="outline" size="sm" render={<Link href={`/workshop-manage/${workshopId}`} />}>
        Manage this workshop →
      </Button>
    </div>
  )
}

function StatusBadge({ status }: { status: PublicWorkshopDetail['status'] }) {
  const map: Record<PublicWorkshopDetail['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    upcoming:    { label: 'Upcoming',    variant: 'secondary' },
    in_progress: { label: 'Live now',    variant: 'default' },
    completed:   { label: 'Completed',   variant: 'outline' },
    archived:    { label: 'Archived',    variant: 'outline' },
  }
  const { label, variant } = map[status]
  return (
    <Badge variant={variant}>
      {label}
    </Badge>
  )
}

function MeetingSourceBadge({
  provisionedBy,
}: {
  provisionedBy: 'google_meet' | 'manual'
}) {
  return (
    <Badge variant={provisionedBy === 'google_meet' ? 'default' : 'secondary'}>
      {provisionedBy === 'google_meet' ? 'Google Meet' : 'Custom link'}
    </Badge>
  )
}

function RegisteredState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm font-medium text-emerald-800">You&apos;re registered</p>
      </div>
      <p className="text-xs text-emerald-900/80">
        Need to cancel? Use the link in your confirmation email.
      </p>
    </div>
  )
}

function MeetingUrlPanel({ meetingUrl }: { meetingUrl: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4" aria-hidden="true" />
          Join Link
        </CardTitle>
      </CardHeader>
      <CardContent>
        <a
          href={meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline decoration-dotted hover:decoration-solid"
        >
          {meetingUrl}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
      </CardContent>
    </Card>
  )
}

function ArtifactRow({
  artifact,
}: {
  artifact: PublicWorkshopDetail['artifacts'][number]
}) {
  const Icon = artifact.downloadUrl?.startsWith('http') ? Link2 : FileText

  if (artifact.downloadUrl) {
    return (
      <a
        href={artifact.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium hover:underline">{artifact.title}</span>
        <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </a>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="font-medium">{artifact.title}</span>
    </div>
  )
}
