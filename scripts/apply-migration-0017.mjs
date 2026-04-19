#!/usr/bin/env node
/**
 * P17 - apply migration 0017_workshop_timezone via Neon HTTP driver.
 *
 * Adds workshops.timezone column (F9). Splits statements on ";" boundaries;
 * no DO $$ blocks in this migration.
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
  '0017_workshop_timezone.sql',
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

console.log(`Applying 0017 migration: ${statements.length} statements`)
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

// Probe: workshops.timezone is now readable.
const probe = await sql.query('SELECT timezone FROM workshops LIMIT 1')
console.log('workshops.timezone probe ->', probe)

console.log('Migration 0017 applied cleanly.')
