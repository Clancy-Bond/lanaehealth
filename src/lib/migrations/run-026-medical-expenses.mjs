/**
 * Migration runner for 026_medical_expenses.sql.
 *
 * Creates the medical_expenses table and optionally seeds known 2026
 * subscriptions + doctor visits so the /expenses page has real data
 * from day one.
 *
 * Usage:
 *   node src/lib/migrations/run-026-medical-expenses.mjs          # migrate only
 *   node src/lib/migrations/run-026-medical-expenses.mjs --seed   # also seed starter rows
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

const shouldSeed = process.argv.includes('--seed')

// LEARNING MODE CONTRIBUTION POINT (SEED DATA)
// --------------------------------------------
// These are my best-guess starter rows based on what's in CLAUDE.md
// (Oura Ring connected, supplements list in health_profile, appointments
// in 2026). Tune amounts to match actual charges; delete rows that
// aren't real; add rows that are missing. Run with --seed to insert.
const SEED_ROWS = [
  {
    service_date: '2026-01-15',
    provider_or_vendor: 'Oura Ring Inc.',
    description: 'Oura membership annual renewal',
    amount_cents: 7999,
    category: 'subscription',
    plan_year: 2026,
    notes: 'Health tracker subscription. FSA eligibility case-by-case; check plan.',
  },
  {
    service_date: '2026-04-13',
    provider_or_vendor: 'Primary Care Provider',
    description: 'PCP visit copay',
    amount_cents: 5000,
    category: 'office_visit',
    plan_year: 2026,
  },
  {
    service_date: '2026-02-19',
    provider_or_vendor: 'Labcorp / myAH',
    description: '52-panel comprehensive labs',
    amount_cents: 28500,
    category: 'lab_imaging',
    plan_year: 2026,
    notes: 'Ferritin, CBC, lipid panel, hs-CRP, vitamin D, TSH, etc.',
  },
  {
    service_date: '2026-04-08',
    provider_or_vendor: 'Imaging Center',
    description: 'CT Head without contrast',
    amount_cents: 48000,
    category: 'lab_imaging',
    plan_year: 2026,
  },
  {
    service_date: '2026-04-07',
    provider_or_vendor: 'Imaging Center',
    description: 'Chest X-ray PA + lateral',
    amount_cents: 12500,
    category: 'lab_imaging',
    plan_year: 2026,
  },
  {
    service_date: '2026-03-01',
    provider_or_vendor: 'MegaFood',
    description: 'Blood Builder iron supplement (90-day)',
    amount_cents: 3999,
    category: 'supplement',
    plan_year: 2026,
    letter_of_medical_necessity: true,
    notes: 'Requires LMN from PCP; iron deficiency documented in labs.',
  },
  {
    service_date: '2026-03-10',
    provider_or_vendor: 'Thorne',
    description: 'Vitamin D3, K2, daily electrolytes',
    amount_cents: 8499,
    category: 'supplement',
    plan_year: 2026,
    letter_of_medical_necessity: true,
    notes: 'Requires LMN; vitamin D deficiency and orthostatic intolerance.',
  },
]

async function main() {
  const sqlPath = resolve(__dirname, '026_medical_expenses.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 026_medical_expenses.sql...')
    await client.query(sql)

    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'medical_expenses'
      ORDER BY ordinal_position;
    `)

    console.log(`\nmedical_expenses has ${cols.rows.length} columns:`)
    for (const row of cols.rows) {
      console.log(`  - ${row.column_name}: ${row.data_type}`)
    }

    if (shouldSeed) {
      console.log(`\nSeeding ${SEED_ROWS.length} starter rows...`)
      // Only seed if the table is empty, to avoid duplicate inserts on re-run
      const countRes = await client.query('SELECT COUNT(*) AS n FROM medical_expenses')
      const existing = Number(countRes.rows[0].n)
      if (existing > 0) {
        console.log(`  Skipped: table already has ${existing} rows.`)
      } else {
        for (const row of SEED_ROWS) {
          await client.query(
            `INSERT INTO medical_expenses
              (service_date, provider_or_vendor, description, amount_cents,
               category, plan_year, notes, letter_of_medical_necessity)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              row.service_date,
              row.provider_or_vendor,
              row.description,
              row.amount_cents,
              row.category,
              row.plan_year,
              row.notes ?? null,
              row.letter_of_medical_necessity ?? false,
            ],
          )
          console.log(`  + ${row.service_date} ${row.description}`)
        }
      }
    } else {
      console.log('\n(Run with --seed to insert Lanae starter rows.)')
    }

    console.log('\nMigration complete.')
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
