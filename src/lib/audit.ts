import { db } from '@/src/db'
import { auditEvents } from '@/src/db/schema/audit'
import type { Action } from './constants'

interface AuditLogParams {
  actorId: string
  actorRole: string
  action: Action | string
  entityType: string
  entityId: string
  payload?: Record<string, unknown>
  ipAddress?: string | null
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  await db.insert(auditEvents).values({
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    payload: params.payload ?? {},
    ipAddress: params.ipAddress ?? null,
  })
}
