/**
 * Migration runner for 023_lite_log_activities.sql (Wave 2e F2).
 *
 * Usage: node src/lib/migrations/run-023-lite-log-activities.mjs
 *
 * Seeds 28 POTS / endo / chronic illness toggles into custom_trackables.
 * Idempotent: re-running is a no-op thanks to ON CONFLICT DO NOTHING.
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
  const sqlPath = resolve(__dirname, '023_lite_log_activities.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 023_lite_log_activities.sql...')
    await client.query(sql)

    const res = await client.query(`
      SELECT name, category, icon, display_order
      FROM custom_trackables
      WHERE name IN (
        'Compression socks','Salt + electrolytes','Lying flat','Heat pad',
        'Hydration goal met','Protein-forward meal','Gentle movement',
        'Recumbent exercise','Cool shower','Paced rest','Grounding practice',
        'Social connection','Outdoor time','Early wind-down','Dizzy on standing',
        'Cramps','Brain fog','Heavy flow','Migraine / headache','Racing heart',
        'Standing > 1 hour','Skipped meal','Hot weather / hot bath',
        'Poor sleep night','Caffeine','Travel / car ride','Beta blocker taken',
        'PRN pain med'
      )
      ORDER BY display_order ASC;
    `)

    console.log(`\nSeeded ${res.rows.length} lite-log trackables:`)
    for (const row of res.rows) {
      console.log(`  [${row.category}] ${row.name} (icon=${row.icon}, order=${row.display_order})`)
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
