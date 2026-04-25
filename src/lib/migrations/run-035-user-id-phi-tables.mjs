/**
 * Migration runner for 035_user_id_phi_tables.sql
 *
 * Adds user_id columns to PHI tables. Idempotent. Run once per env:
 *
 *   node src/lib/migrations/run-035-user-id-phi-tables.mjs
 *
 * After Lanae signs up via /v2/signup, run the backfill script:
 *   LANAE_EMAIL=lanae@lanaehealth.dev \
 *   node src/lib/migrations/run-035-backfill-lanae.mjs
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
  const sqlPath = resolve(__dirname, '035_user_id_phi_tables.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 035_user_id_phi_tables.sql...')
    await client.query(sql)

    const verify = await client.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id'
      ORDER BY table_name;
    `)

    console.log(`\nTables with user_id column: ${verify.rows.length}`)
    for (const row of verify.rows) {
      console.log(`  - ${row.table_name}`)
    }

    console.log('\nMigration complete.')
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
