/**
 * Backfill runner: link Lanae's existing PHI rows to her
 * Supabase auth.users id.
 *
 * Prerequisites:
 *   1. 035_user_id_phi_tables.sql has been applied
 *   2. Lanae has signed up via /v2/signup with her email
 *
 * Usage:
 *   LANAE_EMAIL=lanae@lanaehealth.dev \
 *   node src/lib/migrations/run-035-backfill-lanae.mjs
 *
 * Idempotent: only fills rows where user_id IS NULL.
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

const LANAE_EMAIL = process.env.LANAE_EMAIL ?? 'lanae@lanaehealth.dev'

async function main() {
  const sqlPath = resolve(__dirname, '035_backfill_lanae_user_id.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log(`Connecting to Supabase (owner email: ${LANAE_EMAIL})...`)
    await client.connect()

    await client.query(`SELECT set_config('lanae.email', $1, false)`, [LANAE_EMAIL])

    console.log('Running 035_backfill_lanae_user_id.sql...')
    await client.query(sql)

    console.log('\nBackfill complete.')
  } catch (err) {
    console.error('Backfill error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
