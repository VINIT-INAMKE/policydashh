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

/**
 * H8: extract the caller's best-guess IP from a Fetch Headers object.
 * Prefers the first hop in `x-forwarded-for` (proxy chain, left-most is
 * the original client), falls back to `x-real-ip`. Postgres `inet` accepts
 * IPv4/IPv6 literals; if we hand it a malformed value the insert will
 * throw, so we return null on empty/whitespace input to keep the audit
 * write resilient. Callers can still override ipAddress explicitly.
 */
export function ipFromHeaders(headers: Headers | undefined | null): string | null {
  if (!headers) return null
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = headers.get('x-real-ip')
  if (real) {
    const trimmed = real.trim()
    if (trimmed) return trimmed
  }
  return null
}
