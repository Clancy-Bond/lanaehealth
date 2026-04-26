/**
 * Migration runner for 040_insurance_carrier_index.sql
 *
 * Usage:
 *   SUPABASE_DB_URL=postgres://... node src/lib/migrations/run-040-insurance-carrier-index.mjs
 *
 * Adds a partial index on health_profile so insurance carrier lookups
 * stay fast as the navigator expands. Pure additive, idempotent,
 * ZERO data loss.
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB_URL = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL
if (!DB_URL) {
  console.error('Set SUPABASE_DB_URL or DATABASE_URL to a postgres connection string.')
  process.exit(1)
}

async function main() {
  const sqlPath = resolve(__dirname, '040_insurance_carrier_index.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: DB_URL })

  try {
    console.log('Connecting...')
    await client.connect()

    console.log('Running 040_insurance_carrier_index.sql...')
    await client.query(sql)

    const res = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'health_profile'
      ORDER BY indexname;
    `)
    console.log('health_profile indexes:', res.rows)
    console.log('Done.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
