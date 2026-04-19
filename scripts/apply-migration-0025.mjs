#!/usr/bin/env node
/**
 * Phase 26-01 - apply migration 0025_research_module via Neon HTTP driver.
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
  '0025_research_module.sql',
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

console.log(`Applying 0025 migration: ${statements.length} statements`)

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

// Sanity-check: every object exists.
const probes = [
  { sql: 'SELECT 1 FROM research_items LIMIT 1',                label: 'research_items' },
  { sql: 'SELECT 1 FROM research_item_section_links LIMIT 1',   label: 'research_item_section_links' },
  { sql: 'SELECT 1 FROM research_item_version_links LIMIT 1',   label: 'research_item_version_links' },
  { sql: 'SELECT 1 FROM research_item_feedback_links LIMIT 1',  label: 'research_item_feedback_links' },
  { sql: "SELECT nextval('research_item_id_seq') AS n",         label: 'research_item_id_seq' },
]
for (const p of probes) {
  const result = await sql.query(p.sql)
  console.log(`${p.label} probe ->`, result)
}

// Run the sequence twice more to confirm monotonic increment (RESEARCH-02 guard)
const n1 = await sql.query("SELECT nextval('research_item_id_seq') AS n")
const n2 = await sql.query("SELECT nextval('research_item_id_seq') AS n")
console.log(`Sequence monotonic check: ${JSON.stringify(n1)} -> ${JSON.stringify(n2)}`)

console.log('Migration 0025 applied cleanly.')
