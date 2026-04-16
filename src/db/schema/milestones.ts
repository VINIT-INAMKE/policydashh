import { pgTable, pgEnum, uuid, text, timestamp, jsonb, integer, check, unique } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { policyDocuments } from './documents'
import { users } from './users'

// Phase 22: Milestone entity + SHA256 hashing foundation.
// - D-01 per-policy milestone scope (documentId NOT NULL FK)
// - D-04 required slot counts stored as JSONB
// - D-04a state machine: defining → ready → anchoring → anchored
// - D-05 create-then-curate UX (admin assigns entities via nullable FK)
// - Phase 23 will read contentHash + manifest from this row to build the
//   Cardano tx metadata (CIP-10 label 674) - keep the table Inngest-safe.

export type MilestoneStatus = 'defining' | 'ready' | 'anchoring' | 'anchored'

export type RequiredSlots = {
  versions?: number
  workshops?: number
  feedback?: number
  evidence?: number
}

export type ManifestEntry = {
  entityType: 'version' | 'workshop' | 'feedback' | 'evidence'
  entityId: string
  contentHash: string
}

export const milestoneStatusEnum = pgEnum('milestone_status', [
  'defining',
  'ready',
  'anchoring',
  'anchored',
])

export const milestones = pgTable('milestones', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  documentId:            uuid('document_id').notNull().references(() => policyDocuments.id),
  title:                 text('title').notNull(),
  description:           text('description'),
  status:                milestoneStatusEnum('status').notNull().default('defining'),
  requiredSlots:         jsonb('required_slots').$type<RequiredSlots>().notNull().default({}),
  contentHash:           text('content_hash'),
  manifest:              jsonb('manifest').$type<ManifestEntry[] | null>(),
  canonicalJsonBytesLen: integer('canonical_json_bytes_len'),
  createdBy:             uuid('created_by').notNull().references(() => users.id),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  txHash:                text('tx_hash'),
  anchoredAt:            timestamp('anchored_at', { withTimezone: true }),
}, (t) => [
  check(
    'chk_content_hash_format',
    sql`${t.contentHash} IS NULL OR ${t.contentHash} ~ '^[0-9a-f]{64}$'`,
  ),
  unique('milestones_tx_hash_unique').on(t.txHash),
])
