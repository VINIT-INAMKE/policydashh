#!/usr/bin/env node
/**
 * Phase 22-01 - apply migration 0014_milestones_hashing via Neon HTTP driver.
 *
 * Phase 14/16 Pattern 2 - hand-written DDL applied via sql.query(stmt), not
 * drizzle-kit push, so journal drift on meta/_journal.json never stops us.
 *
 * Splits the file on ";\n" at statement boundaries, strips block comments, and
 * ignores any empty / comment-only chunks. DO $$ ... $$ blocks are preserved as
 * single atomic statements because they contain no bare semicolons on their own
 * lines in our migration file.
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
  '0014_milestones_hashing.sql',
)
const raw = readFileSync(migrationPath, 'utf8')

// Split on "END $$;" for DO blocks and ";" for simple statements, preserving
// DO $$ ... END $$; as a single chunk.
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

console.log(`Applying 0014 migration: ${statements.length} statements`)

for (const stmt of statements) {
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
  console.log(`  -> ${preview}${stmt.length > 80 ? '...' : ''}`)
  try {
    // Neon HTTP driver: sql.query(string) form for raw DDL (Pattern 2).
    await sql.query(stmt)
  } catch (err) {
    console.error(`FAILED statement:\n${stmt}\n`)
    throw err
  }
}

// Sanity-check: SELECT 1 FROM milestones LIMIT 1 should not throw.
const check = await sql.query('SELECT 1 FROM milestones LIMIT 1')
console.log('milestones probe ->', check)

// Also probe that each of the 4 target tables now have a milestone_id column.
for (const table of ['document_versions', 'workshops', 'feedback', 'evidence_artifacts']) {
  const probe = await sql.query(`SELECT milestone_id FROM ${table} LIMIT 1`)
  console.log(`${table}.milestone_id probe ->`, probe)
}

console.log('Migration 0014 applied cleanly.')
