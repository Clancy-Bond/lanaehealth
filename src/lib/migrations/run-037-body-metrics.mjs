/**
 * Migration runner for 037_body_metrics_expansion.sql
 *
 * Usage: node src/lib/migrations/run-037-body-metrics.mjs
 *
 * Inserts body_metrics_log section on health_profile if missing.
 * Pure additive, idempotent, ZERO data loss.
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
  const sqlPath = resolve(__dirname, '037_body_metrics_expansion.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 037_body_metrics_expansion.sql...')
    await client.query(sql)

    const res = await client.query(`
      SELECT section, jsonb_typeof(content) as content_type
      FROM health_profile
      WHERE section = 'body_metrics_log';
    `)

    console.log(`\nbody_metrics_log row count: ${res.rows.length}`)
    for (const row of res.rows) {
      console.log(`  - ${row.section}: ${row.content_type}`)
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
