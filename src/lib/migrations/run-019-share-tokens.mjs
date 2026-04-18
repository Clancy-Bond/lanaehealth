/**
 * Migration runner for 019_share_tokens.sql
 *
 * Creates the share_tokens table used by the Wave 2d Care Card + QR
 * share feature (Brief D6). Safe, additive, idempotent. Zero existing
 * rows are touched.
 *
 * Usage: node src/lib/migrations/run-019-share-tokens.mjs
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
  const sqlPath = resolve(__dirname, '019_share_tokens.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 019_share_tokens.sql...')
    await client.query(sql)

    // Verify the table exists with expected columns.
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'share_tokens'
      ORDER BY ordinal_position;
    `)

    console.log(`\nshare_tokens columns (expecting 8):`)
    for (const row of res.rows) {
      console.log(
        `  - ${row.column_name}: ${row.data_type}`
        + ` (nullable=${row.is_nullable}, default=${row.column_default ?? 'NULL'})`
      )
    }

    if (res.rows.length !== 8) {
      throw new Error(
        `Expected 8 columns on share_tokens, found ${res.rows.length}.`
      )
    }

    // Verify the two indexes are present.
    const idxRes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'share_tokens'
      ORDER BY indexname;
    `)
    console.log(`\nshare_tokens indexes:`)
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
