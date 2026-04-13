/**
 * Migration + Seed Script for Context Engine Tables
 *
 * Uses `pg` for DDL (CREATE TABLE) via direct PostgreSQL connection,
 * and `@supabase/supabase-js` for DML (INSERT/UPSERT) via PostgREST.
 *
 * Usage: node src/lib/migrations/run-migration.mjs
 */

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Load env from .env.local ---
const envPath = resolve(__dirname, '../../../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_KEY in .env.local');
  process.exit(1);
}

// Extract project ref from URL: https://dmvzonbqbkfptkfrsfuz.supabase.co
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Supabase direct Postgres connection string (via pooler)
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const PG_CONNECTION = `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ============================================================
// STEP 1: Create tables via direct PostgreSQL connection
// ============================================================
async function runMigration() {
  console.log('\n=== STEP 1: Running SQL Migration via direct Postgres ===\n');

  const sqlPath = resolve(__dirname, '001-context-engine.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  const client = new pg.Client({ connectionString: PG_CONNECTION });

  try {
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('Connected!');

    // Execute the entire SQL file as one transaction
    console.log('Executing migration SQL...');
    await client.query(sql);
    console.log('Migration SQL executed successfully!');

    // Verify tables were created
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'context_summaries', 'session_handoffs', 'health_profile',
          'medical_narrative', 'medical_timeline', 'active_problems',
          'imaging_studies', 'correlation_results'
        )
      ORDER BY table_name;
    `);

    console.log(`\nVerified ${res.rows.length} tables created:`);
    for (const row of res.rows) {
      console.log(`  - ${row.table_name}`);
    }

    return res.rows.length === 8;
  } catch (err) {
    console.error('Migration error:', err.message);
    return false;
  } finally {
    await client.end();
  }
}

// ============================================================
// STEP 2: Seed data using Supabase client (PostgREST)
// ============================================================
async function seedData() {
  console.log('\n=== STEP 2: Seeding Data ===\n');

  // --- 2a: Seed health_profile ---
  console.log('Seeding health_profile...');

  const healthProfileRows = [
    {
      section: 'personal',
      content: {
        full_name: 'Lanae A. Bond',
        age: 24,
        sex: 'Female',
        height_cm: 170,
        height_in: 66.9,
        weight_kg: 67.3,
        weight_lbs: 148.37,
        bmi: 23.29,
        blood_type: 'A+',
        location: 'Kailua, Hawaii',
        insurance: 'Self-pay (no insurance)',
        marital_status: 'Married'
      },
      updated_by: 'migration'
    },
    {
      section: 'confirmed_diagnoses',
      content: [
        'Iron deficiency without anemia (ferritin as low as 10 ng/mL)',
        'Vitamin D deficiency (25-OH Vitamin D: 15-28 ng/mL)',
        'Telogen effluvium (hair shedding) from Accutane/deficit/low iron/low D',
        'Acne (treated with Accutane)',
        'Syncope - true fainting Jan 8, 2026',
        'Presyncope/near-syncope - multiple episodes; 5 in one hour at worst',
        'Borderline hyperlipidemia (LDL ~130, HDL 41)',
        'Elevated hs-CRP (3.2-5 mg/L - low-grade systemic inflammation)',
        'Mildly prolonged PT (15.3 sec, INR 1.2)'
      ],
      updated_by: 'migration'
    },
    {
      section: 'suspected_conditions',
      content: [
        'Endometriosis - suspected; painful heavy clotty periods; no formal diagnosis',
        'Orthostatic intolerance / POTS-like presentation',
        'PPPD (Persistent Postural-Perceptual Dizziness)',
        'Vestibular migraines',
        'Ocular migraines (reported history)'
      ],
      updated_by: 'migration'
    },
    {
      section: 'medications',
      content: {
        completed: [
          {
            name: 'Isotretinoin (Accutane)',
            dose: '80mg -> 40mg daily',
            dates: 'June 2025 - Feb 9, 2026',
            duration: '8 months'
          }
        ],
        as_needed: [
          { name: 'Miralax (PEG 3350)', use: 'Constipation' },
          { name: 'Midol', use: 'Menstrual cramps (contains 60mg caffeine)' },
          { name: 'Tylenol', use: 'Headaches and cramps' },
          { name: 'Ibuprofen', use: 'Occasional; careful due to reflux risk' },
          { name: 'Topical muscle relaxer', use: 'Significant back pain' }
        ]
      },
      updated_by: 'migration'
    },
    {
      section: 'supplements',
      content: [
        { name: 'Iron (MegaFood Blood Builder)', dose: '130mg elemental iron', schedule: 'Every other day, empty stomach, 2-3hr from matcha' },
        { name: 'Vitamin D3', dose: '3,000-6,000 IU/day', schedule: 'With fattiest meal' },
        { name: 'Vitamin K2 (Thorne)', dose: '1 capsule daily', schedule: 'With fatty meal' },
        { name: 'Vitamin B12', dose: '1000 mcg daily', schedule: 'Can take with iron' },
        { name: 'Omega-3 fish oil', dose: '2 capsules daily', schedule: 'With fatty meal' },
        { name: 'SEED synbiotic (probiotic)', dose: 'Daily', schedule: 'With fatty meal' },
        { name: 'Thorne Daily Electrolytes', dose: '1-2 packets/day', schedule: 'In water' },
        { name: 'Turmeric', dose: 'Not specified', schedule: '4+ hours from iron' }
      ],
      updated_by: 'migration'
    },
    {
      section: 'allergies',
      content: [],
      updated_by: 'migration'
    },
    {
      section: 'family_history',
      content: [
        'Great-grandmother: died at 38 from heart attack',
        'Other great-grandmother: heart surgery at 67',
        'Grandfather: first heart attack at 45, second at 46, quadruple bypass, stents every 6-7 years, second open-heart at 66',
        'Grandfather: prostate cancer at 63, now in bones',
        'Alcoholism on maternal grandmother side'
      ],
      updated_by: 'migration'
    },
    {
      section: 'menstrual_history',
      content: {
        period_duration_days: 5,
        flow: 'Heavy; changing pads every ~1hr 25min on worst day',
        clots: 'Increasing in frequency and size',
        pain: 'Historically very severe; suspected endometriosis',
        pad_changes_heavy_day: '4-5',
        iron_loss_per_cycle: '30-40+ mg estimated',
        hormonal_bc: 'Explicitly refuses hormonal birth control',
        fertility: 'Wants to preserve future fertility'
      },
      updated_by: 'migration'
    },
    {
      section: 'cardiovascular_events',
      content: [
        { date: '2026-01-08', event: 'True syncope - stood from couch, walked to kitchen, collapsed to knees' },
        { date: 'ongoing', event: 'Presyncope - vision goes black on standing; 1-2/day minimum' },
        { date: 'worst_episode', event: '5 near-blackouts in one hour' },
        { date: 'ongoing', event: 'Palpitations - heart pounding on position changes and stairs' },
        { date: 'late_feb_2026', event: 'Ground dropping sensation while standing/walking' },
        { date: 'one_episode', event: 'True spinning vertigo while sitting on couch' }
      ],
      updated_by: 'migration'
    }
  ];

  // Use upsert to handle re-runs safely
  const { data: hpData, error: hpError } = await supabase
    .from('health_profile')
    .upsert(healthProfileRows, { onConflict: 'section' });

  if (hpError) {
    console.error('  Error seeding health_profile:', hpError.message);
    return false;
  }
  console.log(`  Seeded ${healthProfileRows.length} health_profile sections`);

  // --- 2b: Seed active_problems ---
  console.log('Seeding active_problems...');

  const activeProblemsRows = [
    {
      problem: 'Chronic dizziness',
      status: 'active',
      onset_date: '2025-12-01',
      latest_data: 'Daily episodes of lightheadedness, ground-dropping sensation. CT Head 4/8/2026 showed no acute intracranial pathology.',
      linked_diagnoses: ['PPPD', 'Vestibular migraines', 'Orthostatic intolerance'],
      linked_symptoms: ['presyncope', 'vertigo', 'ground dropping sensation'],
      notes: 'Multifactorial - likely iron deficiency + possible vestibular component + orthostatic intolerance'
    },
    {
      problem: 'Left frontal headaches',
      status: 'active',
      onset_date: '2026-01-01',
      latest_data: 'CT Head showed mucosal thickening in bilateral maxillary sinuses and ethmoid air cells consistent with chronic sinus disease. Brain tissue at foramen magnum noted.',
      linked_diagnoses: ['Chronic sinus disease', 'Vestibular migraines'],
      linked_symptoms: ['left frontal pain', 'sinus pressure'],
      notes: 'Sinus disease may contribute; vestibular migraine also under consideration'
    },
    {
      problem: 'Tachycardia',
      status: 'investigating',
      onset_date: '2025-12-01',
      latest_data: 'Palpitations on position changes and stairs. EKG 12/31/2025 showed normal sinus rhythm, HR 58 bpm (bradycardia at rest). Chest X-ray clear.',
      linked_diagnoses: ['Orthostatic intolerance / POTS-like presentation'],
      linked_symptoms: ['palpitations', 'racing heart on standing'],
      notes: 'Cardiology referral made; cardiologist said should have seen hematology first'
    },
    {
      problem: 'Iron deficiency not responding to supplementation',
      status: 'active',
      onset_date: '2025-12-11',
      latest_data: 'Ferritin trajectory: 10 (12/11) -> 32.5 (12/31) -> 19.5 (2/19). Despite 130mg elemental iron every other day. Heavy menstrual bleeding is the suspected iron sink.',
      linked_diagnoses: ['Iron deficiency without anemia', 'Suspected endometriosis'],
      linked_symptoms: ['fatigue', 'hair loss', 'dizziness'],
      notes: 'Oral iron initially responded well but ferritin declined again. Menstrual blood loss estimated 30-40+ mg iron per cycle.'
    },
    {
      problem: 'Heavy menstrual bleeding with clots',
      status: 'investigating',
      onset_date: '2025-06-01',
      latest_data: '5-day periods, changing pads every ~1hr 25min on worst day. Clots increasing in frequency and size. Patient refuses hormonal BC.',
      linked_diagnoses: ['Suspected endometriosis'],
      linked_symptoms: ['heavy flow', 'clots', 'severe cramps', 'iron depletion'],
      notes: 'No formal endometriosis diagnosis. Patient wants to preserve future fertility.'
    },
    {
      problem: 'Presyncope episodes',
      status: 'active',
      onset_date: '2026-01-08',
      latest_data: 'True syncope event 1/8/2026. Ongoing presyncope 1-2x daily minimum. Worst episode: 5 near-blackouts in one hour. Vision goes black on standing.',
      linked_diagnoses: ['Syncope', 'Presyncope/near-syncope', 'Orthostatic intolerance'],
      linked_symptoms: ['vision blackout on standing', 'near-fainting', 'collapse'],
      notes: 'Likely multifactorial: iron deficiency + orthostatic intolerance + possible POTS'
    }
  ];

  // Delete existing then insert (active_problems has no unique constraint for upsert)
  await supabase.from('active_problems').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error: apError } = await supabase
    .from('active_problems')
    .insert(activeProblemsRows);

  if (apError) {
    console.error('  Error seeding active_problems:', apError.message);
    return false;
  }
  console.log(`  Seeded ${activeProblemsRows.length} active_problems`);

  // --- 2c: Seed medical_timeline ---
  console.log('Seeding medical_timeline...');

  const timelineRows = [
    {
      event_date: '2025-06-01',
      event_type: 'medication_change',
      title: 'Started Isotretinoin (Accutane) 80mg',
      description: 'Began 8-month course of Accutane for acne treatment. Dose later reduced to 40mg. Associated with hair shedding (telogen effluvium) and contributed to nutrient depletion.',
      significance: 'important',
      linked_data: { medication: 'Isotretinoin', dose: '80mg -> 40mg', duration: '8 months' }
    },
    {
      event_date: '2025-12-11',
      event_type: 'test',
      title: 'Ferritin 10 ng/mL (critically low)',
      description: 'First comprehensive labs revealed severely depleted iron stores. Also: Hemoglobin 12.6, LDL 130, HDL 41, hs-CRP 3.2, Vitamin D 28, TSH 1.88.',
      significance: 'critical',
      linked_data: {
        ferritin: 10, hemoglobin: 12.6, ldl: 130, hdl: 41,
        hs_crp: 3.2, vitamin_d: 28, tsh: 1.88, hba1c: 5.3
      }
    },
    {
      event_date: '2025-12-31',
      event_type: 'test',
      title: 'Ferritin 32.5 ng/mL (improving)',
      description: 'After 2.5 weeks of oral iron supplementation (MegaFood Blood Builder 130mg), ferritin showed strong response. EKG: normal sinus rhythm, HR 58 bpm. PT mildly prolonged at 15.3 sec.',
      significance: 'important',
      linked_data: {
        ferritin: 32.5, hemoglobin: 13.0, hematocrit: 41.1,
        glucose: 93, pt: 15.3, inr: 1.2, ekg: 'Normal sinus rhythm, HR 58 bpm'
      }
    },
    {
      event_date: '2026-01-08',
      event_type: 'symptom_onset',
      title: 'Syncope event',
      description: 'True fainting episode - stood from couch, walked to kitchen, collapsed to knees. Led to ongoing presyncope episodes (vision blacking out on standing, 1-2x daily).',
      significance: 'critical',
      linked_data: { type: 'true_syncope', trigger: 'positional', worst_episode: '5 near-blackouts in one hour' }
    },
    {
      event_date: '2026-02-09',
      event_type: 'medication_change',
      title: 'Completed Isotretinoin course',
      description: 'Finished 8-month Accutane treatment. Side effects included hair shedding (telogen effluvium), potential nutrient depletion, and dry skin.',
      significance: 'important',
      linked_data: { medication: 'Isotretinoin', action: 'completed', total_duration: '8 months' }
    },
    {
      event_date: '2026-02-19',
      event_type: 'test',
      title: 'Comprehensive labs (52 tests) - ferritin 19.5 declining',
      description: 'After 9 weeks of oral iron, ferritin dropped from 32.5 to 19.5. Heavy menstrual bleeding outpacing supplementation. BP 114/79, Pulse 73. Hemoglobin 12.6, WBC 7.46, Platelets 231.',
      significance: 'critical',
      linked_data: {
        ferritin: 19.5, hemoglobin: 12.6, hematocrit: 38.7,
        wbc: 7.46, rbc: 4.36, platelets: 231,
        bp: '114/79', pulse: 73, temp: 98.7
      }
    },
    {
      event_date: '2026-04-08',
      event_type: 'imaging',
      title: 'CT Head + Chest X-ray: sinus disease, mild scoliosis',
      description: 'CT Head: no acute intracranial pathology. Mucosal thickening in bilateral maxillary sinuses and ethmoid air cells (chronic sinus disease). Brain tissue at foramen magnum. Chest X-ray: clear lungs, mild thoracic dextroscoliosis.',
      significance: 'important',
      linked_data: {
        ct_head: 'No acute pathology, chronic sinus disease, brain tissue at foramen magnum',
        chest_xr: 'Clear lungs, mild thoracic dextroscoliosis'
      }
    }
  ];

  // Clear and re-insert for idempotency
  await supabase.from('medical_timeline').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error: tlError } = await supabase
    .from('medical_timeline')
    .insert(timelineRows);

  if (tlError) {
    console.error('  Error seeding medical_timeline:', tlError.message);
    return false;
  }
  console.log(`  Seeded ${timelineRows.length} medical_timeline events`);

  // --- 2d: Seed imaging_studies ---
  console.log('Seeding imaging_studies...');

  const imagingRows = [
    {
      study_date: '2026-04-08',
      modality: 'CT',
      body_part: 'Head',
      indication: 'Chronic dizziness, left frontal headaches, presyncope episodes',
      findings_summary: 'No acute intracranial pathology. Mucosal thickening in bilateral maxillary sinuses and ethmoid air cells consistent with chronic sinus disease. Brain tissue identified at the level of the foramen magnum.',
      report_text: 'CT HEAD WITHOUT CONTRAST: No acute intracranial pathology. Paranasal sinuses demonstrate mucosal thickening in bilateral maxillary sinuses and ethmoid air cells, consistent with chronic sinusitis/sinus disease. The cerebellar tonsils and brain tissue are noted at the level of the foramen magnum.'
    },
    {
      study_date: '2026-04-07',
      modality: 'XR',
      body_part: 'Chest',
      indication: 'Tachycardia evaluation, palpitations on position changes',
      findings_summary: 'Clear lungs bilaterally. No acute cardiopulmonary process. Mild thoracic dextroscoliosis noted incidentally.',
      report_text: 'CHEST X-RAY PA AND LATERAL: Lungs are clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax. Cardiac silhouette is normal in size. Mediastinal contours are unremarkable. Mild thoracic dextroscoliosis.'
    }
  ];

  // Clear and re-insert
  await supabase.from('imaging_studies').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error: imgError } = await supabase
    .from('imaging_studies')
    .insert(imagingRows);

  if (imgError) {
    console.error('  Error seeding imaging_studies:', imgError.message);
    return false;
  }
  console.log(`  Seeded ${imagingRows.length} imaging_studies`);

  return true;
}

// ============================================================
// STEP 3: Verify
// ============================================================
async function verify() {
  console.log('\n=== STEP 3: Verifying ===\n');

  const tables = [
    'context_summaries',
    'session_handoffs',
    'health_profile',
    'medical_narrative',
    'medical_timeline',
    'active_problems',
    'imaging_studies',
    'correlation_results'
  ];

  let allOk = true;
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`  ${table}: ERROR - ${error.message}`);
      allOk = false;
    } else {
      console.log(`  ${table}: ${count} rows`);
    }
  }

  // Also show sample data from seeded tables
  console.log('\n--- Sample health_profile sections ---');
  const { data: hpSample } = await supabase.from('health_profile').select('section, updated_by');
  if (hpSample) {
    for (const row of hpSample) {
      console.log(`  ${row.section} (updated_by: ${row.updated_by})`);
    }
  }

  console.log('\n--- Active problems ---');
  const { data: apSample } = await supabase.from('active_problems').select('problem, status');
  if (apSample) {
    for (const row of apSample) {
      console.log(`  [${row.status}] ${row.problem}`);
    }
  }

  console.log('\n--- Timeline events ---');
  const { data: tlSample } = await supabase.from('medical_timeline').select('event_date, title, significance').order('event_date');
  if (tlSample) {
    for (const row of tlSample) {
      console.log(`  ${row.event_date} [${row.significance}] ${row.title}`);
    }
  }

  console.log('\n--- Imaging studies ---');
  const { data: imgSample } = await supabase.from('imaging_studies').select('study_date, modality, body_part');
  if (imgSample) {
    for (const row of imgSample) {
      console.log(`  ${row.study_date} ${row.modality} ${row.body_part}`);
    }
  }

  return allOk;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('========================================');
  console.log('Context Engine Migration + Seed');
  console.log('========================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Project Ref: ${projectRef}`);

  const migrationOk = await runMigration();

  if (!migrationOk) {
    console.error('\nMigration failed! Cannot proceed with seeding.');
    process.exit(1);
  }

  const seedOk = await seedData();

  if (!seedOk) {
    console.error('\nSeed had errors. Check output above.');
    process.exit(1);
  }

  console.log('\nSeed completed successfully!');

  const verifyOk = await verify();

  console.log('\n========================================');
  console.log(verifyOk ? 'Migration + Seed COMPLETE' : 'Migration + Seed completed with warnings');
  console.log('========================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
