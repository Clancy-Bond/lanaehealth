/**
 * Migration runner for 039_recipes_table.sql
 *
 * Usage:
 *   SUPABASE_DB_URL=postgres://... node src/lib/migrations/run-039-recipes.mjs
 *
 * Creates user_recipes table. Pure additive, idempotent, ZERO data loss.
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
  const sqlPath = resolve(__dirname, '039_recipes_table.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: DB_URL })

  try {
    console.log('Connecting...')
    await client.connect()

    console.log('Running 039_recipes_table.sql...')
    await client.query(sql)

    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_recipes'
      ORDER BY ordinal_position;
    `)
    console.log('user_recipes columns:', res.rows)
    console.log('Done.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
