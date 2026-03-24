import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import type { Role } from '@/src/lib/constants'
import { ROLE_VALUES } from '@/src/lib/constants'

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

  if (event.type === 'user.created') {
    const { id, phone_numbers, email_addresses, first_name, last_name, public_metadata } = event.data

    // Extract role from publicMetadata (set by admin invite), default to stakeholder
    const metadataRole = public_metadata?.role
    const role: Role = (metadataRole && ROLE_VALUES.includes(metadataRole as Role))
      ? (metadataRole as Role)
      : 'stakeholder'

    const phone = phone_numbers?.[0]?.phone_number ?? null
    const email = email_addresses?.[0]?.email_address ?? null
    const name = [first_name, last_name].filter(Boolean).join(' ') || null

    await db.insert(users).values({
      clerkId: id,
      phone,
      email,
      name,
      role,
      orgType: null, // Set by user on first profile completion
    })
  }

  return Response.json({ success: true })
}
