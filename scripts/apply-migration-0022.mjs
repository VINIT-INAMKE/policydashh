#!/usr/bin/env node
/**
 * P1 (URGENT) - apply migration 0022_audit_events_partitions_extend.
 *
 * Creates monthly audit_events partitions from 2026_06 through 2027_12.
 * Audit blackout risk was 6 weeks out as of 2026-04-19; this migration
 * must be applied before 2026-06-01 or every writeAuditLog call throws
 * "no partition of relation audit_events found for row".
 *
 * Includes a CREATE OR REPLACE FUNCTION (multi-line DO-style PL/pgSQL
 * body) so the splitter handles $$ blocks.
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
  '0022_audit_events_partitions_extend.sql',
)
const raw = readFileSync(migrationPath, 'utf8')

// Splitter: like 0016 but tolerant of $$...$$ blocks used by CREATE OR
// REPLACE FUNCTION. A statement ends at a trailing ';' OUTSIDE a $$ block.
const statements = []
let current = ''
let inDollarBlock = false
for (const line of raw.split('\n')) {
  const trimmed = line.trim()
  if (!inDollarBlock && (trimmed === '' || trimmed.startsWith('--'))) {
    continue
  }
  // Track whether we cross a $$ boundary this line.
  const dollarMatches = line.match(/\$\$/g)
  if (dollarMatches) {
    for (let i = 0; i < dollarMatches.length; i++) {
      inDollarBlock = !inDollarBlock
    }
  }
  current += line + '\n'
  if (!inDollarBlock && trimmed.endsWith(';')) {
    statements.push(current.trim())
    current = ''
  }
}

console.log(`Applying 0022 migration: ${statements.length} statements`)
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

// Probe: count audit_events partitions so the operator sees coverage.
const probe = await sql.query(
  `SELECT relname FROM pg_class
   WHERE relname LIKE 'audit_events_20%'
   ORDER BY relname`,
)
console.log('audit_events partitions ->', probe)

console.log('Migration 0022 applied cleanly.')
