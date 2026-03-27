import { type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { zipSync } from 'fflate'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { can } from '@/src/lib/permissions'
import { ACTIONS } from '@/src/lib/constants'
import { writeAuditLog } from '@/src/lib/audit'
import { buildEvidencePack } from '@/src/server/services/evidence-pack.service'
import type { Role } from '@/src/lib/constants'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  // Auth check
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  if (!user) {
    return new Response('User not found', { status: 401 })
  }

  // Permission check
  if (!can(user.role as Role, 'evidence:export')) {
    return new Response('Forbidden', { status: 403 })
  }

  // Parse documentId
  const documentId = request.nextUrl.searchParams.get('documentId')
  if (!documentId) {
    return new Response('documentId is required', { status: 400 })
  }

  // Build evidence pack artifacts
  const files = await buildEvidencePack(documentId)

  // Generate ZIP
  const zipped = zipSync(files, { level: 6 })

  // Write audit log (fire-and-forget to avoid crashing export on log failure)
  writeAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: ACTIONS.EVIDENCE_PACK_EXPORT,
    entityType: 'document',
    entityId: documentId,
    payload: { format: 'zip' },
  }).catch(console.error)

  return new Response(zipped as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="evidence-pack-${documentId}.zip"`,
    },
  })
}
