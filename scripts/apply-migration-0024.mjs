#!/usr/bin/env node
/**
 * P24 - apply migration 0024_notification_type_anchoring_failed.
 *
 * Extends the notification_type enum with 'anchoring_failed' so Cardano
 * anchor-failure notifications stop being mislabeled as cr_status_changed.
 * Postgres ALTER TYPE ADD VALUE must run outside a transaction; neon-http
 * executes each statement autonomously which satisfies that rule.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config as dotenvConfig } from 'dotenv'
import { neon } from '@neondatabase/serverless'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenvConfig({ path: path.join(__dirname, '..', '.env.local') })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(connectionString)
const migrationPath = path.join(
  __dirname,
  '..',
  'src',
  'db',
  'migrations',
  '0024_notification_type_anchoring_failed.sql',
)
const raw = readFileSync(migrationPath, 'utf8')

const statements = []
let current = ''
for (const line of raw.split('\n')) {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('--')) continue
  current += line + '\n'
  if (trimmed.endsWith(';')) {
    statements.push(current.trim())
    current = ''
  }
}

console.log(`Applying 0024 migration: ${statements.length} statements`)
for (const stmt of statements) {
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
  console.log(`  -> ${preview}${stmt.length > 80 ? '...' : ''}`)
  try {
    await sql.query(stmt)
  } catch (err) {
    console.error(`FAILED statement:\n${stmt}\n`)
    throw err
  }
}

console.log('Migration 0024 applied cleanly.')
