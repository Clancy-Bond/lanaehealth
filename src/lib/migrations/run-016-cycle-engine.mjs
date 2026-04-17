/**
 * Migration runner for 016_cycle_engine_state.sql
 *
 * Usage: node src/lib/migrations/run-016-cycle-engine.mjs
 *
 * Creates cycle_engine_state for the multi-signal cycle intelligence engine.
 * Write-forward-only semantics (new row per recompute, never mutate past rows).
 * See 016_cycle_engine_state.sql for rationale and references.
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
  const sqlPath = resolve(__dirname, '016_cycle_engine_state.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 016_cycle_engine_state.sql...')
    await client.query(sql)

    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cycle_engine_state'
      ORDER BY ordinal_position;
    `)

    console.log(`\ncycle_engine_state has ${res.rows.length} columns:`)
    for (const row of res.rows) {
      const nullable = row.is_nullable === 'YES' ? '' : ' NOT NULL'
      console.log(`  - ${row.column_name}: ${row.data_type}${nullable}`)
    }

    const idx = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'cycle_engine_state'
      ORDER BY indexname;
    `)
    console.log(`\nIndexes (${idx.rows.length}):`)
    for (const row of idx.rows) console.log(`  - ${row.indexname}`)

    console.log('\nMigration complete.')
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
