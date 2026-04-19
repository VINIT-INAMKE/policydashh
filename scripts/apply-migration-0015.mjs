#!/usr/bin/env node
/**
 * Phase 23 - apply migration 0015_cardano_anchoring via Neon HTTP driver.
 *
 * Mirrors apply-migration-0014.mjs. Hand-written DDL applied via sql.query(stmt)
 * so meta/_journal.json drift never blocks us.
 *
 * Splits on ";" at statement boundaries, preserves DO $$ ... END $$; as a
 * single atomic statement, strips empty / comment-only chunks.
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
  '0015_cardano_anchoring.sql',
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

console.log(`Applying 0015 migration: ${statements.length} statements`)

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

// Probe: both target tables now have tx_hash + anchored_at columns.
for (const table of ['milestones', 'document_versions']) {
  const probe = await sql.query(`SELECT tx_hash, anchored_at FROM ${table} LIMIT 1`)
  console.log(`${table} anchor columns probe ->`, probe)
}

console.log('Migration 0015 applied cleanly.')
