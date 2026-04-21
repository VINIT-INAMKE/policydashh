#!/usr/bin/env node
/**
 * Workshop meetings redesign (2026-04-21) - apply migration 0026 via Neon
 * HTTP driver. Pattern identical to apply-migration-0025.mjs.
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
  '0026_workshop_root_booking.sql',
)
const raw = readFileSync(migrationPath, 'utf8')

const stmts = raw
  .split(/;\s*\n/)
  .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').trim())
  .filter((s) => s.length > 0 && !/^--/.test(s))

for (const stmt of stmts) {
  const preview = stmt.slice(0, 80).replace(/\s+/g, ' ')
  console.log(`→ ${preview}${stmt.length > 80 ? '…' : ''}`)
  await sql.query(stmt)
}

console.log('✔ 0026_workshop_root_booking applied')
