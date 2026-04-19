import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { workshopRegistrations } from '@/src/db/schema/workshops'
import type { Role } from '@/src/lib/constants'
import { ACTIONS, ROLE_VALUES } from '@/src/lib/constants'
import { writeAuditLog } from '@/src/lib/audit'

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
    }
    // `user.deleted` payloads only include `id` + `deleted: true`. Everything
    // else is optional, so we type it loosely.
    deleted?: boolean
  }
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

    const phone = phone_numbers?.[0]?.phone_number ?? null
    const email = email_addresses?.[0]?.email_address ?? null
    const name = [first_name, last_name].filter(Boolean).join(' ') || null

    // B8: capture the prior role so we can audit role deltas from user.updated.
    const prior = await db.query.users.findFirst({
      where: eq(users.clerkId, id),
      columns: { id: true, role: true },
    })

    // Upsert: insert if new, update if exists (handles both events + missed webhooks)
    const [upserted] = await db.insert(users).values({
      clerkId: id,
      phone,
      email,
      name,
      role,
      orgType: null,
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
        updatedAt: new Date(),
      },
    }).returning({ id: users.id })

    const newUserId = upserted?.id ?? null

    // B8: emit an audit event when the role actually changed. We intentionally
    // only log role deltas (not every profile tick) to keep the audit log
    // signal-to-noise high.
    if (newUserId && metadataRoleIsValid && prior && prior.role !== role) {
      writeAuditLog({
        actorId: newUserId,
        actorRole: role,
        action: ACTIONS.USER_ROLE_ASSIGN,
        entityType: 'user',
        entityId: newUserId,
        payload: {
          before: { role: prior.role },
          after: { role },
          source: 'clerk_webhook',
          clerkEvent: event.type,
        },
      }).catch((err) => {
        console.error('[clerk-webhook] audit log failed', err)
      })
    }

    // Phase 20 (WS-10, D-11): backfill workshop_registrations.userId for any
    // pre-existing rows matching this email - happens when cal.com booked the
    // workshop before the Clerk invite round-trip completed. Fire-and-forget;
    // must never block the webhook ack.
    if (email && newUserId) {
      await db.update(workshopRegistrations)
        .set({ userId: newUserId })
        .where(and(
          eq(workshopRegistrations.email, email),
          isNull(workshopRegistrations.userId),
        ))
        .catch((err) => {
          console.error('[clerk-webhook] workshopRegistrations userId backfill failed', err)
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
