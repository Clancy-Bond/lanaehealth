/**
 * Run migration 011: Endometriosis Mode columns
 *
 * Adds nullable columns to cycle_entries for endo-specific tracking.
 * Safe to re-run (uses IF NOT EXISTS).
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

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('Missing env variables')
  process.exit(1)
}

const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')
const PG_CONNECTION = `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

async function main() {
  console.log('Running migration 011: Endometriosis Mode\n')

  const sqlPath = resolve(__dirname, '011_endometriosis_mode.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  const client = new pg.Client({ connectionString: PG_CONNECTION })
  try {
    await client.connect()
    console.log('Connected to Supabase Postgres')

    await client.query(sql)
    console.log('Migration executed successfully')

    // Verify new columns exist
    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cycle_entries'
        AND column_name IN (
          'bowel_symptoms', 'bladder_symptoms', 'dyspareunia',
          'dyspareunia_intensity', 'clots_present', 'clot_size',
          'clot_count', 'endo_notes'
        )
      ORDER BY column_name;
    `)

    console.log('\nVerified new columns:')
    for (const row of res.rows) {
      console.log(`  ${row.column_name}: ${row.data_type}`)
    }

    console.log(`\n${res.rows.length}/8 endo columns present`)
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
