#!/usr/bin/env node
/**
 * Apply scripts/post-drizzle-push-gaps.sql against DATABASE_URL.
 * Use AFTER `npx drizzle-kit push` on a fresh DB to fill in DDL drizzle skips.
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
const raw = readFileSync(path.join(__dirname, 'post-drizzle-push-gaps.sql'), 'utf8')

function splitStatements(raw) {
  const statements = []
  let current = ''
  let inDollar = false
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!inDollar && (trimmed === '' || trimmed.startsWith('--'))) continue
    current += line + '\n'
    const matches = line.match(/\$\$/g)
    if (matches) {
      for (let i = 0; i < matches.length; i++) inDollar = !inDollar
    }
    if (!inDollar && trimmed.endsWith(';')) {
      statements.push(current.trim())
      current = ''
    }
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

const statements = splitStatements(raw)
console.log(`Applying ${statements.length} statements`)

for (const stmt of statements) {
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 100)
  try {
    await sql.query(stmt)
    console.log(`  OK   ${preview}`)
  } catch (err) {
    console.error(`  FAIL ${preview}`)
    console.error(`  ERR  ${err.message ?? err}`)
    process.exit(1)
  }
}

console.log('\nDone.')
