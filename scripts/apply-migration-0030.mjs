#!/usr/bin/env node
/**
 * Apply migration 0030: workshop_registrations partial unique +
 * workshops.completion_pipeline_sent_at. Pattern matches apply-migration-0029.mjs.
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
  '0030_booking_robustness.sql',
)
const raw = readFileSync(migrationPath, 'utf8')

const stmts = raw
  .split(/;\s*\n/)
  .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, ''))
  .map((s) => s.replace(/^(?:[ \t]*--[^\n]*\n)+/, ''))
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

for (const stmt of stmts) {
  const preview = stmt.slice(0, 80).replace(/\s+/g, ' ')
  console.log(`→ ${preview}${stmt.length > 80 ? '…' : ''}`)
  await sql.query(stmt)
}

console.log('✔ 0030_booking_robustness applied')
