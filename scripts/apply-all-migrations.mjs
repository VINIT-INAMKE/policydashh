#!/usr/bin/env node
/**
 * One-shot: apply every src/db/migrations/NNNN_*.sql in order.
 *
 * Reuses the Phase 14/16 Pattern 2 DO-$$-aware splitter from the
 * apply-migration-NNNN.mjs scripts so DO $$ ... END $$; blocks survive.
 * Skips files matching ALREADY_APPLIED if the env opts in.
 *
 * Usage:
 *   node scripts/apply-all-migrations.mjs
 *   node scripts/apply-all-migrations.mjs --from 0011   # resume from a specific file
 */

import { readFileSync, readdirSync } from 'node:fs'
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

const fromArgIdx = process.argv.indexOf('--from')
const fromPrefix = fromArgIdx > -1 ? process.argv[fromArgIdx + 1] : null

const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations')
const files = readdirSync(migrationsDir)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort()

const filesToRun = fromPrefix
  ? files.filter((f) => f.localeCompare(`${fromPrefix}_`) >= 0)
  : files

console.log(`Applying ${filesToRun.length} migration(s) from ${migrationsDir}`)
if (fromPrefix) console.log(`  (resuming from ${fromPrefix})`)

const sql = neon(connectionString)

function splitStatements(raw) {
  // Generic dollar-quote-aware splitter. Tracks whether we are inside a
  // $$ ... $$ block (DO blocks AND function bodies use this). Statements
  // are only terminated by `;` when we are NOT inside a dollar block.
  const statements = []
  let current = ''
  let inDollarBlock = false
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    // Skip pure comment / blank lines unless we're inside a dollar block
    // (function bodies may contain blank lines and SQL-style comments).
    if (!inDollarBlock && (trimmed === '' || trimmed.startsWith('--'))) {
      continue
    }
    current += line + '\n'

    // Toggle dollar-block state for every $$ on this line.
    const dollarMatches = line.match(/\$\$/g)
    if (dollarMatches) {
      for (let i = 0; i < dollarMatches.length; i++) inDollarBlock = !inDollarBlock
    }

    // Statement boundary: line ends with `;` AND we are NOT in a dollar block.
    if (!inDollarBlock && trimmed.endsWith(';')) {
      statements.push(current.trim())
      current = ''
    }
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

let totalStmts = 0
let totalErrs = 0

for (const file of filesToRun) {
  const filePath = path.join(migrationsDir, file)
  const raw = readFileSync(filePath, 'utf8')
  const statements = splitStatements(raw)
  console.log(`\n=== ${file} (${statements.length} statements) ===`)

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 100)
    try {
      await sql.query(stmt)
      totalStmts++
    } catch (err) {
      totalErrs++
      console.error(`  FAILED: ${preview}${stmt.length > 100 ? '...' : ''}`)
      console.error(`  ERROR : ${err.message ?? err}`)
      throw err
    }
  }
  console.log(`  OK  ${file}`)
}

console.log(`\nDone. ${totalStmts} statements applied, ${totalErrs} errors.`)
