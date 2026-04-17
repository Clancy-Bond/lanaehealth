/**
 * Migration runner for 017_user_nutrient_targets.sql
 *
 * Creates the user_nutrient_targets table and seeds default RDAs for the
 * 25 priority nutrients defined in src/lib/nutrition/nutrients-list.ts.
 *
 * Usage: node src/lib/migrations/run-017-user-nutrient-targets.mjs
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

// Priority nutrients + RDA defaults (NIH ODS, adult female 19-30).
// Must stay in sync with src/lib/nutrition/nutrients-list.ts.
const SEED_NUTRIENTS = [
  { nutrient: 'protein',        amount: 46,   unit: 'g',   citation: 'NIH ODS DRI, adult female 19-30' },
  { nutrient: 'carbs',          amount: 130,  unit: 'g',   citation: 'IOM 2005 DRI, adult minimum' },
  { nutrient: 'fat',            amount: 65,   unit: 'g',   citation: 'USDA 2020-2025 Dietary Guidelines, 20-35% of 2000 kcal' },
  { nutrient: 'fiber',          amount: 25,   unit: 'g',   citation: 'USDA 2020-2025 Dietary Guidelines, adult female' },
  { nutrient: 'iron',           amount: 18,   unit: 'mg',  citation: 'NIH ODS Iron RDA, adult female 19-50' },
  { nutrient: 'vitamin_d',      amount: 600,  unit: 'IU',  citation: 'NIH ODS Vitamin D RDA, adult 19-70' },
  { nutrient: 'vitamin_b12',    amount: 2.4,  unit: 'mcg', citation: 'NIH ODS B12 RDA, adult' },
  { nutrient: 'folate',         amount: 400,  unit: 'mcg', citation: 'NIH ODS Folate RDA, adult' },
  { nutrient: 'calcium',        amount: 1000, unit: 'mg',  citation: 'NIH ODS Calcium RDA, adult female 19-50' },
  { nutrient: 'magnesium',      amount: 310,  unit: 'mg',  citation: 'NIH ODS Magnesium RDA, adult female 19-30' },
  { nutrient: 'selenium',       amount: 55,   unit: 'mcg', citation: 'NIH ODS Selenium RDA, adult' },
  { nutrient: 'zinc',           amount: 8,    unit: 'mg',  citation: 'NIH ODS Zinc RDA, adult female' },
  { nutrient: 'vitamin_c',      amount: 75,   unit: 'mg',  citation: 'NIH ODS Vitamin C RDA, adult female' },
  { nutrient: 'vitamin_a',      amount: 700,  unit: 'mcg', citation: 'NIH ODS Vitamin A RDA (RAE), adult female' },
  { nutrient: 'vitamin_e',      amount: 15,   unit: 'mg',  citation: 'NIH ODS Vitamin E RDA, adult' },
  { nutrient: 'vitamin_k',      amount: 90,   unit: 'mcg', citation: 'NIH ODS Vitamin K AI, adult female' },
  { nutrient: 'omega_3',        amount: 1.1,  unit: 'g',   citation: 'NIH ODS Omega-3 AI (ALA), adult female' },
  { nutrient: 'potassium',      amount: 2600, unit: 'mg',  citation: 'NIH ODS Potassium AI, adult female' },
  { nutrient: 'sodium',         amount: 1500, unit: 'mg',  citation: 'NIH ODS Sodium AI, adult' },
  { nutrient: 'copper',         amount: 900,  unit: 'mcg', citation: 'NIH ODS Copper RDA, adult' },
  { nutrient: 'manganese',      amount: 1.8,  unit: 'mg',  citation: 'NIH ODS Manganese AI, adult female' },
  { nutrient: 'iodine',         amount: 150,  unit: 'mcg', citation: 'NIH ODS Iodine RDA, adult' },
  { nutrient: 'choline',        amount: 425,  unit: 'mg',  citation: 'NIH ODS Choline AI, adult female' },
  { nutrient: 'chromium',       amount: 25,   unit: 'mcg', citation: 'NIH ODS Chromium AI, adult female 19-50' },
  { nutrient: 'molybdenum',     amount: 45,   unit: 'mcg', citation: 'NIH ODS Molybdenum RDA, adult' },
]

async function main() {
  const sqlPath = resolve(__dirname, '017_user_nutrient_targets.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const client = new pg.Client({ connectionString: PG_CONNECTION })

  try {
    console.log('Connecting to Supabase...')
    await client.connect()

    console.log('Running 017_user_nutrient_targets.sql...')
    await client.query(sql)

    const colRes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_nutrient_targets'
      ORDER BY ordinal_position;
    `)
    console.log(`\nuser_nutrient_targets has ${colRes.rows.length} columns:`)
    for (const row of colRes.rows) {
      console.log(`  - ${row.column_name}: ${row.data_type}`)
    }

    // Seed RDAs for patient 'lanae' if not already present.
    // Idempotent: ON CONFLICT DO NOTHING preserves any user overrides
    // or preset rows already written.
    console.log('\nSeeding 25 priority nutrients with RDA defaults...')
    let inserted = 0
    for (const n of SEED_NUTRIENTS) {
      const res = await client.query(
        `INSERT INTO user_nutrient_targets
           (patient_id, nutrient, target_amount, target_unit, source, rationale, citation, active)
         VALUES ('lanae', $1, $2, $3, 'rda', $4, $5, TRUE)
         ON CONFLICT (patient_id, nutrient) DO NOTHING
         RETURNING id;`,
        [
          n.nutrient,
          n.amount,
          n.unit,
          `Default RDA for adult female 19-30 per NIH ODS fact sheet.`,
          n.citation,
        ],
      )
      if (res.rowCount && res.rowCount > 0) inserted += 1
    }
    console.log(`Inserted ${inserted} new RDA rows (${SEED_NUTRIENTS.length - inserted} already existed).`)

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS total FROM user_nutrient_targets WHERE patient_id = 'lanae';`,
    )
    console.log(`\nTotal nutrient targets for lanae: ${countRes.rows[0].total}`)

    console.log('\nMigration complete.')
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
