/**
 * Migration runner for 022_prn_dose_events.sql
 *
 * Creates the prn_dose_events table used by the Wave 2e PRN post-dose
 * efficacy polling feature (Brief F7). Safe, additive, idempotent. Zero
 * existing rows are touched.
 *
 * Usage: node src/lib/migrations/run-022-prn-dose-events.mjs
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
  const sqlPath = resolve(__dirname, '022_prn_dose_events.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 022_prn_dose_events.sql...')
    await client.query(sql)

    // Verify the table exists with expected columns.
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prn_dose_events'
      ORDER BY ordinal_position;
    `)

    console.log(`\nprn_dose_events columns (expecting 11):`)
    for (const row of res.rows) {
      console.log(
        `  - ${row.column_name}: ${row.data_type}`
        + ` (nullable=${row.is_nullable}, default=${row.column_default ?? 'NULL'})`
      )
    }

    if (res.rows.length !== 11) {
      throw new Error(
        `Expected 11 columns on prn_dose_events, found ${res.rows.length}.`
      )
    }

    // Verify the CHECK constraint on poll_response exists.
    const checkRes = await client.query(`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'prn_dose_events'::regclass
        AND contype = 'c';
    `)
    console.log(`\nprn_dose_events check constraints:`)
    for (const row of checkRes.rows) {
      console.log(`  - ${row.definition}`)
    }

    // Verify indexes present.
    const idxRes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'prn_dose_events'
      ORDER BY indexname;
    `)
    console.log(`\nprn_dose_events indexes (expecting 4, incl. primary key):`)
    for (const row of idxRes.rows) {
      console.log(`  - ${row.indexname}`)
    }

    console.log('\nMigration complete. Zero existing rows mutated.')
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
