/**
 * Migration runner for 025_privacy_prefs.sql
 *
 * Creates the privacy_prefs table used by the Wave 2e F10 privacy
 * settings panel + full ZIP export. Safe, additive, idempotent. Zero
 * existing rows are touched.
 *
 * Usage: node src/lib/migrations/run-025-privacy-prefs.mjs
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '../../../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1)
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const DB_PASSWORD = env.SUPABASE_SERVICE_ROLE_KEY
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')
const PG_CONNECTION = `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

async function main() {
  const sqlPath = resolve(__dirname, '025_privacy_prefs.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 025_privacy_prefs.sql...')
    await client.query(sql)

    // Verify the table exists with expected columns.
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'privacy_prefs'
      ORDER BY ordinal_position;
    `)

    console.log(`\nprivacy_prefs columns (expecting 5):`)
    for (const row of res.rows) {
      console.log(
        `  - ${row.column_name}: ${row.data_type}`
        + ` (nullable=${row.is_nullable}, default=${row.column_default ?? 'NULL'})`
      )
    }

    if (res.rows.length !== 5) {
      throw new Error(
        `Expected 5 columns on privacy_prefs, found ${res.rows.length}.`
      )
    }

    // Verify the default 'lanae' row exists.
    const seedRes = await client.query(
      `SELECT patient_id, allow_claude_context, allow_correlation_analysis,
              retain_history_beyond_2y
         FROM privacy_prefs
         WHERE patient_id = 'lanae'`
    )
    if (seedRes.rows.length !== 1) {
      throw new Error(
        `Expected 1 seeded row for 'lanae', found ${seedRes.rows.length}.`
      )
    }
    console.log(`\nSeeded row for 'lanae':`, seedRes.rows[0])

    console.log('\nMigration complete. Zero existing rows mutated.')
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
