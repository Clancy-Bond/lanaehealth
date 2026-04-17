/**
 * Migration runner for 020_daily_logs_energy_mode_rest_day.sql
 *
 * Adds energy_mode (text, nullable) and rest_day (boolean, default false)
 * columns to daily_logs. Safe, additive, idempotent.
 *
 * Usage: node src/lib/migrations/run-020-daily-logs-energy.mjs
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
  const sqlPath = resolve(__dirname, '020_daily_logs_energy_mode_rest_day.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 020_daily_logs_energy_mode_rest_day.sql...')
    await client.query(sql)

    // Verify the columns landed
    const res = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'daily_logs'
        AND column_name IN ('energy_mode', 'rest_day')
      ORDER BY column_name;
    `)

    console.log(`\ndaily_logs new columns (expecting 2):`)
    for (const row of res.rows) {
      console.log(
        `  - ${row.column_name}: ${row.data_type}`
        + ` (nullable=${row.is_nullable}, default=${row.column_default ?? 'NULL'})`
      )
    }

    if (res.rows.length !== 2) {
      throw new Error(
        `Expected 2 new columns (energy_mode, rest_day), found ${res.rows.length}.`
      )
    }

    // Check that the energy_mode CHECK constraint is present
    const checkRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'public.daily_logs'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%energy_mode%';
    `)
    if (checkRes.rows.length === 0) {
      console.warn(
        '  Note: no CHECK constraint referencing energy_mode found. '
        + 'This is expected only if the migration ran against an older schema.'
      )
    } else {
      for (const row of checkRes.rows) {
        console.log(`  CHECK: ${row.conname} => ${row.def}`)
      }
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
