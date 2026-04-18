/**
 * Migration runner for 018_symptom_conditions.sql
 *
 * Creates the symptom_conditions junction table (Wave 2d, brief D5).
 * Safe, additive, idempotent. Zero existing rows in `symptoms` or
 * `active_problems` are touched.
 *
 * Usage: node src/lib/migrations/run-018-symptom-conditions.mjs
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
  const sqlPath = resolve(__dirname, '018_symptom_conditions.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    // Safety: verify parent tables exist before we create the junction.
    const parents = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('symptoms', 'active_problems')
      ORDER BY table_name;
    `)
    const parentNames = parents.rows.map(r => r.table_name)
    if (!parentNames.includes('symptoms') || !parentNames.includes('active_problems')) {
      throw new Error(
        `Missing parent table. Found: ${parentNames.join(', ') || '(none)'}. `
        + `Both 'symptoms' and 'active_problems' are required.`
      )
    }

    console.log('Running 018_symptom_conditions.sql...')
    await client.query(sql)

    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'symptom_conditions'
      ORDER BY ordinal_position;
    `)

    console.log(`\nsymptom_conditions columns (expecting 5):`)
    for (const row of cols.rows) {
      console.log(
        `  - ${row.column_name}: ${row.data_type}`
        + ` (nullable=${row.is_nullable}, default=${row.column_default ?? 'NULL'})`
      )
    }

    if (cols.rows.length !== 5) {
      throw new Error(
        `Expected 5 columns on symptom_conditions, found ${cols.rows.length}.`
      )
    }

    const idx = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'symptom_conditions'
      ORDER BY indexname;
    `)
    console.log(`\nsymptom_conditions indexes:`)
    for (const row of idx.rows) {
      console.log(`  - ${row.indexname}`)
    }

    // Confirm zero rows mutated in parents by reporting their counts.
    const counts = await client.query(`
      SELECT 'symptoms' AS t, COUNT(*)::int AS n FROM symptoms
      UNION ALL
      SELECT 'active_problems' AS t, COUNT(*)::int AS n FROM active_problems;
    `)
    console.log('\nParent table row counts (unchanged by this migration):')
    for (const row of counts.rows) {
      console.log(`  - ${row.t}: ${row.n}`)
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
