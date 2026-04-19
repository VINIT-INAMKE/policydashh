#!/usr/bin/env node
/**
 * Phase 24 - apply migration 0016_engagement_tracking via Neon HTTP driver.
 *
 * Mirrors apply-migration-0014.mjs / apply-migration-0015.mjs. Hand-written
 * DDL applied via sql.query(stmt) so meta/_journal.json drift never blocks us.
 *
 * Splits on ";" at statement boundaries. No DO $$ blocks in this migration.
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
  '0016_engagement_tracking.sql',
)
const raw = readFileSync(migrationPath, 'utf8')

const statements = []
let current = ''
let inDoBlock = false
for (const line of raw.split('\n')) {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('--')) {
    if (inDoBlock) current += line + '\n'
    continue
  }
  if (trimmed.startsWith('DO $$')) {
    inDoBlock = true
    current += line + '\n'
    continue
  }
  if (inDoBlock) {
    current += line + '\n'
    if (trimmed.endsWith('END $$;')) {
      statements.push(current.trim())
      current = ''
      inDoBlock = false
    }
    continue
  }
  current += line + '\n'
  if (trimmed.endsWith(';')) {
    statements.push(current.trim())
    current = ''
  }
}

console.log(`Applying 0016 migration: ${statements.length} statements`)

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

// Probe: users table now has last_activity_at column.
const probe = await sql.query('SELECT last_activity_at FROM users LIMIT 1')
console.log('users.last_activity_at probe ->', probe)

console.log('Migration 0016 applied cleanly.')
