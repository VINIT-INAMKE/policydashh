#!/usr/bin/env node
/**
 * B13 - apply migration 0021_workshop_feedback_token_nonces via Neon HTTP driver.
 *
 * Renumbered from 0017 after the workshops agent claimed 0017 for the per-
 * workshop timezone column. Matches the pattern in apply-migration-0014.mjs.
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
  '0021_workshop_feedback_token_nonces.sql',
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

console.log(`Applying 0021 migration: ${statements.length} statements`)
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

// Probe: table should be selectable.
const probe = await sql.query('SELECT 1 FROM workshop_feedback_token_nonces LIMIT 1')
console.log('workshop_feedback_token_nonces probe ->', probe)

console.log('Migration 0021 applied cleanly.')
