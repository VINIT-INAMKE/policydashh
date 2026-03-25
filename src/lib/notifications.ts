import { db } from '@/src/db'
import { notifications } from '@/src/db/schema/notifications'

type NotificationType = 'feedback_status_changed' | 'version_published' | 'section_assigned' | 'cr_status_changed'

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  entityType?: string
  entityId?: string
  linkHref?: string
}

/**
 * Insert a notification row. Called fire-and-forget from mutations:
 *   createNotification({...}).catch(console.error)
 *
 * NEVER await this inside a transaction boundary.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await db.insert(notifications).values({
    userId:     input.userId,
    type:       input.type,
    title:      input.title,
    body:       input.body ?? null,
    entityType: input.entityType ?? null,
    entityId:   input.entityId ?? null,
    linkHref:   input.linkHref ?? null,
  })
}
