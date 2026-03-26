import { pgTable, uuid, text, timestamp, boolean, customType } from 'drizzle-orm/pg-core'
import { policySections } from './documents'

// Custom BYTEA type for storing binary Y.Doc state
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
  toDriver(val: Uint8Array): Buffer {
    return Buffer.from(val)
  },
  fromDriver(val: Buffer): Uint8Array {
    return new Uint8Array(val)
  },
})

// Y.Doc binary snapshots for real-time collaboration persistence
export const ydocSnapshots = pgTable('ydoc_snapshots', {
  sectionId: uuid('section_id')
    .primaryKey()
    .references(() => policySections.id, { onDelete: 'cascade' }),
  ydocBinary: bytea('ydoc_binary').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Comment threads anchored to inline text selections
export const commentThreads = pgTable('comment_threads', {
  id:        uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id')
    .notNull()
    .references(() => policySections.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').notNull().unique(), // matches data-comment-id in Tiptap mark
  authorId:  text('author_id').notNull(),            // Clerk userId
  body:      text('body').notNull(),
  resolved:  boolean('resolved').notNull().default(false),
  orphaned:  boolean('orphaned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Replies within a comment thread
export const commentReplies = pgTable('comment_replies', {
  id:       uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => commentThreads.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull(), // Clerk userId
  body:     text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
