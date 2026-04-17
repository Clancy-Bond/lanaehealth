/**
 * Migration runner for 014_headache_attacks.sql
 *
 * Usage: node src/lib/migrations/run-014-headache-attacks.mjs
 *
 * Creates the headache_attacks table plus two indexes. Safe to run multiple
 * times thanks to IF NOT EXISTS guards.
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
  const sqlPath = resolve(__dirname, '014_headache_attacks.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 014_headache_attacks.sql...')
    await client.query(sql)

    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'headache_attacks'
      ORDER BY ordinal_position;
    `)

    console.log(`\nheadache_attacks has ${res.rows.length} columns:`)
    for (const row of res.rows) {
      const nullable = row.is_nullable === 'YES' ? ' (nullable)' : ''
      console.log(`  - ${row.column_name}: ${row.data_type}${nullable}`)
    }

    const idxRes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'headache_attacks'
      ORDER BY indexname;
    `)

    console.log(`\nheadache_attacks has ${idxRes.rows.length} indexes:`)
    for (const row of idxRes.rows) {
      console.log(`  - ${row.indexname}`)
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
