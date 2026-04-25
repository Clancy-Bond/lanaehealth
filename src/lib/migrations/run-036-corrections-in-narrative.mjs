/**
 * Migration runner for 036_corrections_in_narrative.sql
 *
 * Usage: node src/lib/migrations/run-036-corrections-in-narrative.mjs
 *
 * Adds kind, metadata (jsonb), created_at columns + supporting indexes
 * to medical_narrative so the data-correction UI can write structured
 * user_correction rows without losing the existing free-form section
 * content. Pure additive.
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
  const sqlPath = resolve(__dirname, '036_corrections_in_narrative.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 036_corrections_in_narrative.sql...')
    await client.query(sql)

    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'medical_narrative'
      ORDER BY ordinal_position;
    `)

    console.log(`\nmedical_narrative has ${res.rows.length} columns:`)
    for (const row of res.rows) {
      console.log(`  - ${row.column_name}: ${row.data_type}`)
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
