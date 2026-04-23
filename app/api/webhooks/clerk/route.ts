import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import type { Role } from '@/src/lib/constants'
import { ACTIONS, ROLE_VALUES, ORG_TYPE_VALUES } from '@/src/lib/constants'
import { writeAuditLog } from '@/src/lib/audit'
import { sendUserUpserted } from '@/src/inngest/events'

interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    phone_numbers?: Array<{ phone_number: string }>
    email_addresses?: Array<{ email_address: string }>
    first_name?: string | null
    last_name?: string | null
    public_metadata?: {
      role?: string
      // Option C profile enrichment: /participate stashes these on the Clerk
      // invitation so this webhook can hydrate the users row once the invitee
      // accepts. See src/inngest/functions/participate-intake.ts for the
      // write site and src/db/migrations/0028 for the columns.
      orgType?: string
      orgName?: string
      expertise?: string
      howHeard?: string
      designation?: string
    }
    // `user.deleted` payloads only include `id` + `deleted: true`. Everything
    // else is optional, so we type it loosely.
    deleted?: boolean
  }
}

// Coerce a free-text field to either a trimmed non-empty string or null.
// publicMetadata preserves empty strings as empty strings; we normalise so a
// user who hits the participate form with whitespace-only designation doesn't
// end up with a row that shows an empty string instead of "Not set yet".
function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    throw new Error('CLERK_WEBHOOK_SECRET is not set')
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(WEBHOOK_SECRET)

  let event: ClerkWebhookEvent
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent
  } catch {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const { id, phone_numbers, email_addresses, first_name, last_name, public_metadata } = event.data

    const metadataRole = public_metadata?.role
    // B8: only coerce to a valid enum value; otherwise fall back to stakeholder
    // on create and preserve the existing role on update (no override).
    const metadataRoleIsValid = !!metadataRole && ROLE_VALUES.includes(metadataRole as Role)
    const role: Role = metadataRoleIsValid ? (metadataRole as Role) : 'stakeholder'

    // Option C hydration (migration 0028): read the profile fields that the
    // participate flow stashes on publicMetadata and fold them into the upsert.
    // orgType is enum-validated like role; designation/orgName/expertise/howHeard
    // are free text and only normalised (trim + empty→null).
    const metadataOrgType = public_metadata?.orgType
    const metadataOrgTypeIsValid =
      !!metadataOrgType && (ORG_TYPE_VALUES as readonly string[]).includes(metadataOrgType)
    const orgTypeFromMetadata = metadataOrgTypeIsValid
      ? (metadataOrgType as (typeof ORG_TYPE_VALUES)[number])
      : null
    const designation = textOrNull(public_metadata?.designation)
    const orgName = textOrNull(public_metadata?.orgName)
    const expertise = textOrNull(public_metadata?.expertise)
    const howHeard = textOrNull(public_metadata?.howHeard)

    const phone = phone_numbers?.[0]?.phone_number ?? null
    const email = email_addresses?.[0]?.email_address ?? null
    const name = [first_name, last_name].filter(Boolean).join(' ') || null

    // P2: capture the prior role BEFORE the upsert so we can decide whether
    // the downstream Inngest function should emit a role-delta audit event.
    // The SELECT + UPSERT pair is the critical path for Clerk's Svix retry
    // window, so we keep them inline; the heavier work (audit write + bulk
    // workshop_registrations backfill) moves to Inngest so the webhook
    // returns 200 fast regardless of DB pressure.
    const prior = await db.query.users.findFirst({
      where: eq(users.clerkId, id),
      columns: { id: true, role: true },
    })

    const [upserted] = await db.insert(users).values({
      clerkId: id,
      phone,
      email,
      name,
      role,
      orgType: orgTypeFromMetadata,
      designation,
      orgName,
      expertise,
      howHeard,
    }).onConflictDoUpdate({
      target: users.clerkId,
      set: {
        phone,
        email,
        name,
        // B8: only overwrite role when the webhook actually carries a valid
        // enum value. A webhook without publicMetadata.role (or a malformed
        // one) must not silently demote the user back to stakeholder.
        ...(metadataRoleIsValid ? { role } : {}),
        // Option C: same guard semantics for profile fields — only overwrite
        // when the metadata actually carries a value. A self-edit via
        // /profile that doesn't touch these fields shouldn't get clobbered
        // by a stray Clerk profile sync that carries no publicMetadata.
        ...(metadataOrgTypeIsValid ? { orgType: orgTypeFromMetadata } : {}),
        ...(designation !== null ? { designation } : {}),
        ...(orgName !== null ? { orgName } : {}),
        ...(expertise !== null ? { expertise } : {}),
        ...(howHeard !== null ? { howHeard } : {}),
        updatedAt: new Date(),
      },
    }).returning({ id: users.id })

    const newUserId = upserted?.id ?? null

    // P2: fan-out the audit write + workshop_registrations backfill onto
    // Inngest. `roleDelta` is null unless the role really changed AND the
    // webhook carried a valid enum value (same guard as before); the
    // Inngest function tolerates a null delta so it can still run the
    // backfill on pure profile updates.
    if (newUserId) {
      const roleDelta =
        metadataRoleIsValid && prior && prior.role !== role
          ? { priorRole: prior.role as string, newRole: role as string }
          : null

      await sendUserUpserted({
        userId: newUserId,
        clerkEvent: event.type,
        email,
        roleDelta,
      }).catch((err) => {
        // Non-fatal: if Inngest is down we still return 200 to Clerk so Svix
        // doesn't retry the whole webhook. Worst case: audit write + backfill
        // are skipped for this event, which is the same failure mode the
        // prior .catch() blocks guarded.
        console.error('[clerk-webhook] sendUserUpserted failed', err)
      })
    }
  }

  // B9: on `user.deleted`, anonymize the users row so the email is freed for
  // re-invite. FK references are preserved by keeping the UUID primary key
  // intact; sensitive fields (email/name/phone) are wiped and clerkId is
  // rewritten to a deleted-sentinel so the unique index still holds.
  if (event.type === 'user.deleted') {
    const clerkId = event.data.id
    if (!clerkId) {
      return Response.json({ success: true })
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true, email: true, role: true },
    })

    if (existing) {
      const deletedAt = new Date()
      // Sentinel clerk_id keeps the UNIQUE constraint happy while marking the
      // row as detached from any Clerk account.
      const deletedClerkId = `deleted:${clerkId}:${deletedAt.getTime()}`

      await db.update(users)
        .set({
          deletedAt,
          email: null,
          phone: null,
          name: null,
          clerkId: deletedClerkId,
          updatedAt: deletedAt,
        })
        .where(eq(users.id, existing.id))
        .catch((err) => {
          console.error('[clerk-webhook] soft-delete user failed', err)
        })

      writeAuditLog({
        actorId: existing.id,
        actorRole: existing.role,
        action: ACTIONS.USER_UPDATE,
        entityType: 'user',
        entityId: existing.id,
        payload: {
          source: 'clerk_webhook',
          clerkEvent: 'user.deleted',
          anonymized: true,
          priorEmail: existing.email ?? null,
        },
      }).catch((err) => {
        console.error('[clerk-webhook] audit log failed', err)
      })
    }
  }

  return Response.json({ success: true })
}
