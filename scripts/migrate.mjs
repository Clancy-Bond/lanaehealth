#!/usr/bin/env node
/**
 * Canonical migration runner for LanaeHealth.
 *
 * Reads every *.sql file in src/lib/migrations/ in alphanumeric order and
 * applies each in a transaction. Idempotent: a schema_migrations table
 * tracks which files have been applied, and already-applied files are
 * skipped on subsequent runs.
 *
 * Connection: process.env.SUPABASE_DB_URL or process.env.DATABASE_URL.
 *
 * Usage:
 *   SUPABASE_DB_URL=postgres://... node scripts/migrate.mjs
 *   # or
 *   DATABASE_URL=postgres://... npm run db:migrate
 *
 * Exit codes:
 *   0 -- success (all files applied or already applied)
 *   1 -- failure (missing env, read error, or SQL error that is not
 *        "already applied" style)
 */

import pg from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Error codes that indicate "object already exists" -- treat as
// already-applied rather than failure. See Postgres error codes:
//   23505 unique_violation   (duplicate row on migration_history insert)
//   42P07 duplicate_table    (CREATE TABLE without IF NOT EXISTS)
//   42701 duplicate_column   (ADD COLUMN without IF NOT EXISTS)
//   42710 duplicate_object   (CREATE INDEX, extension, etc.)
//   42P06 duplicate_schema
//   42723 duplicate_function
const ALREADY_EXISTS_CODES = new Set([
  '23505',
  '42P07',
  '42701',
  '42710',
  '42P06',
  '42723',
])

/**
 * Return a sorted list of migration filenames (basenames only) found in
 * the given directory. Only *.sql files are included. Sorted with locale
 * "en" + numeric:true so 002 < 010 < 013 naturally.
 */
export function listMigrationFiles(dir) {
  const entries = readdirSync(dir)
  return entries
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

/**
 * Ensure the schema_migrations tracking table exists. Safe to call every
 * run; uses IF NOT EXISTS.
 */
export async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

/**
 * Return a Set of migration names that are already recorded as applied.
 */
export async function fetchAppliedMigrations(client) {
  const res = await client.query('SELECT name FROM schema_migrations')
  return new Set(res.rows.map((r) => r.name))
}

/**
 * Apply a single migration file inside a transaction. If the SQL body
 * fails with an "already exists" style error, we treat it as a soft
 * success (the object is there) and still record the name in
 * schema_migrations so subsequent runs skip cleanly.
 *
 * Returns one of: 'applied' | 'already-present'
 * Throws on any other failure.
 */
export async function applyMigration(client, name, sql) {
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(
      'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    )
    await client.query('COMMIT')
    return 'applied'
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err && ALREADY_EXISTS_CODES.has(err.code)) {
      // Objects already exist from a prior run that did not record the
      // migration. Record it now (outside the failed transaction) so we
      // stop retrying on every future run.
      await client
        .query(
          'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
          [name]
        )
        .catch(() => {})
      return 'already-present'
    }
    throw err
  }
}

/**
 * Core orchestration. Exported so the test harness can pass a mock
 * pg.Client and a fixture directory.
 */
export async function runMigrations({ client, migrationsDir, log = console.log }) {
  await ensureMigrationsTable(client)
  const applied = await fetchAppliedMigrations(client)
  const files = listMigrationFiles(migrationsDir)

  const summary = { applied: [], skipped: [], alreadyPresent: [] }

  for (const name of files) {
    if (applied.has(name)) {
      log(`[SKIP]    ${name} (already applied)`)
      summary.skipped.push(name)
      continue
    }

    const sql = readFileSync(join(migrationsDir, name), 'utf-8')
    const outcome = await applyMigration(client, name, sql)
    if (outcome === 'applied') {
      log(`[APPLIED] ${name}`)
      summary.applied.push(name)
    } else {
      log(`[PRESENT] ${name} (objects already exist; recorded)`)
      summary.alreadyPresent.push(name)
    }
  }

  return summary
}

/**
 * CLI entry point. Wired behind the import.meta.url guard so importing
 * this module from a test does not trigger a live DB connection.
 */
async function main() {
  const connectionString =
    process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
  if (!connectionString) {
    console.error(
      'error: SUPABASE_DB_URL or DATABASE_URL must be set in the environment.'
    )
    process.exit(1)
  }

  const migrationsDir = resolve(__dirname, '..', 'src', 'lib', 'migrations')
  console.log(`Migrating from ${migrationsDir}\n`)

  const client = new pg.Client({ connectionString })
  try {
    await client.connect()
    const summary = await runMigrations({ client, migrationsDir })
    console.log(
      `\nDone. ${summary.applied.length} applied, ` +
        `${summary.alreadyPresent.length} already-present, ` +
        `${summary.skipped.length} skipped.`
    )
    process.exit(0)
  } catch (err) {
    console.error(`\nMigration failed: ${err.message}`)
    if (err.code) console.error(`Postgres code: ${err.code}`)
    process.exit(1)
  } finally {
    await client.end().catch(() => {})
  }
}

// Only run main() when invoked as a script, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
