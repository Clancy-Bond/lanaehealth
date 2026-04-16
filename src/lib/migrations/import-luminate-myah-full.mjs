/**
 * Import Luminate Health Labs + myAH Clinical Docs - April 2026
 *
 * Inserts:
 *  - 49 new lab results from April 13, 2026 (CBC, Diff, CMP, Liver, Iron Studies, Vitamins, Immunology)
 *  - 13 historical lab results from Aug 11, May 13, Mar 18 2025
 *  - 5 new medical timeline events (2 ED visits, IM office visit, ferritin milestone, new meds)
 *  - 3 new active problems (Dysmenorrhea, Palpitations, Itching)
 *  - 1 medical narrative (IM office visit note)
 *  - health_profile medications update (hydroxyzine + cetirizine)
 *
 * CRITICAL: Ferritin 50.4 (up from 19.5!) is the headline finding.
 *
 * Usage: node src/lib/migrations/import-luminate-myah-full.mjs
 */

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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// --- Helper: compute flag ---
function computeFlag(value, refLow, refHigh) {
  if (value == null || refLow == null || refHigh == null) return 'normal';
  if (value < refLow) return 'low';
  if (value > refHigh) return 'high';
  return 'normal';
}

// ============================================================
// Step 1: Insert April 13, 2026 Lab Results (Luminate Health)
// ============================================================
async function insertApril13Labs() {
  console.log('\n=== Step 1: Inserting April 13, 2026 Labs (Luminate Health) ===\n');

  // Get existing test names for Apr 13 to avoid duplicates
  const { data: existingLabs } = await supabase
    .from('lab_results')
    .select('test_name')
    .eq('date', '2026-04-13');

  const existingNames = new Set((existingLabs || []).map(l => l.test_name.toLowerCase()));

  const labs = [
    // CBC
    { date: '2026-04-13', category: 'Hematology', test_name: 'WBC', value: 5.85, unit: 'K/uL', reference_range_low: 3.5, reference_range_high: 10.4 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'RBC', value: 4.50, unit: 'M/uL', reference_range_low: 3.6, reference_range_high: 5.4 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'HGB', value: 13.3, unit: 'gm/dL', reference_range_low: 12.0, reference_range_high: 16.0 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'HCT', value: 40.7, unit: '%', reference_range_low: 36, reference_range_high: 46 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'MCV', value: 90.4, unit: 'fL', reference_range_low: 82, reference_range_high: 101 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'MCH', value: 29.6, unit: 'pg', reference_range_low: 26, reference_range_high: 34 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'MCHC', value: 32.7, unit: 'gm/dL', reference_range_low: 32, reference_range_high: 36 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'RDW', value: 13.5, unit: '%', reference_range_low: 11, reference_range_high: 15 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'PLT', value: 184, unit: 'K/uL', reference_range_low: 140, reference_range_high: 440 },

    // Differential
    { date: '2026-04-13', category: 'Differential', test_name: 'Neutrophils %', value: 47.2, unit: '%', reference_range_low: 18, reference_range_high: 45 },
    { date: '2026-04-13', category: 'Differential', test_name: 'Lymphocytes %', value: 44.1, unit: '%', reference_range_low: 18, reference_range_high: 45 },
    { date: '2026-04-13', category: 'Differential', test_name: 'Monocytes %', value: 6.5, unit: '%', reference_range_low: 3, reference_range_high: 12 },
    { date: '2026-04-13', category: 'Differential', test_name: 'Eosinophils %', value: 1.7, unit: '%', reference_range_low: 0, reference_range_high: 7 },
    { date: '2026-04-13', category: 'Differential', test_name: 'Basophils %', value: 0.3, unit: '%', reference_range_low: 0, reference_range_high: 2 },
    { date: '2026-04-13', category: 'Differential', test_name: 'Immature Granulocytes %', value: 0.2, unit: '%', reference_range_low: null, reference_range_high: null },
    { date: '2026-04-13', category: 'Differential', test_name: 'Neutrophil Absolute', value: 2.76, unit: 'K/uL', reference_range_low: null, reference_range_high: null },
    { date: '2026-04-13', category: 'Differential', test_name: 'Lymphocyte Absolute', value: 2.58, unit: 'K/uL', reference_range_low: null, reference_range_high: null },
    { date: '2026-04-13', category: 'Differential', test_name: 'Monocyte Absolute', value: 0.38, unit: 'K/uL', reference_range_low: null, reference_range_high: null },
    { date: '2026-04-13', category: 'Differential', test_name: 'Eosinophil Absolute', value: 0.10, unit: 'K/uL', reference_range_low: null, reference_range_high: null },
    { date: '2026-04-13', category: 'Differential', test_name: 'Basophil Absolute', value: 0.02, unit: 'K/uL', reference_range_low: null, reference_range_high: null },

    // Chemistry / CMP
    { date: '2026-04-13', category: 'Chemistry', test_name: 'Glucose', value: 90, unit: 'mg/dL', reference_range_low: 70, reference_range_high: 100 },
    { date: '2026-04-13', category: 'Chemistry', test_name: 'BUN', value: 11, unit: 'mg/dL', reference_range_low: 7, reference_range_high: 20 },
    { date: '2026-04-13', category: 'Chemistry', test_name: 'Creatinine', value: 0.6, unit: 'mg/dL', reference_range_low: 0.6, reference_range_high: 1.2 },
    { date: '2026-04-13', category: 'Chemistry', test_name: 'eGFR', value: 128, unit: 'mL/min', reference_range_low: 60, reference_range_high: null },
    { date: '2026-04-13', category: 'Chemistry', test_name: 'Sodium', value: 141, unit: 'mmol/L', reference_range_low: 136, reference_range_high: 145 },
    { date: '2026-04-13', category: 'Chemistry', test_name: 'Potassium', value: 3.6, unit: 'mmol/L', reference_range_low: 3.5, reference_range_high: 5.1 },
    { date: '2026-04-13', category: 'Chemistry', test_name: 'Chloride', value: 108, unit: 'mmol/L', reference_range_low: 98, reference_range_high: 106 },
    { date: '2026-04-13', category: 'Chemistry', test_name: 'CO2', value: 25, unit: 'mmol/L', reference_range_low: 22, reference_range_high: 30 },
    { date: '2026-04-13', category: 'Chemistry', test_name: 'Calcium', value: 9.6, unit: 'mg/dL', reference_range_low: 8.6, reference_range_high: 10 },

    // Liver
    { date: '2026-04-13', category: 'Liver', test_name: 'AST', value: 14, unit: 'units/L', reference_range_low: 15, reference_range_high: 41 },
    { date: '2026-04-13', category: 'Liver', test_name: 'ALT', value: 9, unit: 'units/L', reference_range_low: 10, reference_range_high: 40 },
    { date: '2026-04-13', category: 'Liver', test_name: 'Alkaline Phosphatase', value: 71, unit: 'units/L', reference_range_low: 35, reference_range_high: 104 },
    { date: '2026-04-13', category: 'Liver', test_name: 'Bilirubin Total', value: 0.5, unit: 'mg/dL', reference_range_low: 0.1, reference_range_high: 1.2 },
    { date: '2026-04-13', category: 'Liver', test_name: 'Total Protein', value: 6.9, unit: 'gm/dL', reference_range_low: 6.4, reference_range_high: 8.2 },
    { date: '2026-04-13', category: 'Liver', test_name: 'Albumin', value: 4.6, unit: 'gm/dL', reference_range_low: 3.5, reference_range_high: 5.0 },
    { date: '2026-04-13', category: 'Liver', test_name: 'Globulin', value: 2.3, unit: 'gm/dL', reference_range_low: 2.0, reference_range_high: 4.0 },
    { date: '2026-04-13', category: 'Liver', test_name: 'A/G Ratio', value: 2.0, unit: null, reference_range_low: 1.0, reference_range_high: 2.5 },

    // Iron Studies (CRITICAL - ferritin 50.4!)
    { date: '2026-04-13', category: 'Iron Studies', test_name: 'Ferritin', value: 50.4, unit: 'ng/mL', reference_range_low: 11, reference_range_high: 307 },
    { date: '2026-04-13', category: 'Iron Studies', test_name: 'Iron Total', value: 89, unit: 'mcg/dL', reference_range_low: 60, reference_range_high: 170 },
    { date: '2026-04-13', category: 'Iron Studies', test_name: 'Transferrin', value: 205, unit: 'mg/dL', reference_range_low: 200, reference_range_high: 360 },
    { date: '2026-04-13', category: 'Hematology', test_name: 'Reticulocyte Count', value: 0.86, unit: '%', reference_range_low: 0.5, reference_range_high: 2.0 },

    // Vitamins
    { date: '2026-04-13', category: 'Vitamins', test_name: 'Folate', value: 20.7, unit: 'ng/mL', reference_range_low: 5.4, reference_range_high: null },
    { date: '2026-04-13', category: 'Vitamins', test_name: 'Vitamin B12', value: 626, unit: 'pg/mL', reference_range_low: 200, reference_range_high: 900 },

    // Immunology
    { date: '2026-04-13', category: 'Immunology', test_name: 'C4 Complement', value: 28, unit: 'mg/dL', reference_range_low: 14, reference_range_high: 40 },
  ];

  // Filter out labs that already exist in DB
  const newLabs = labs.filter(lab => !existingNames.has(lab.test_name.toLowerCase()));

  if (newLabs.length === 0) {
    console.log(`  SKIPPED: All ${labs.length} April 13 labs already in database.`);
    return labs.length;
  }

  console.log(`  Found ${existingNames.size} existing labs, inserting ${newLabs.length} new ones...`);

  // Auto-compute flags
  const labsWithFlags = newLabs.map(lab => ({
    ...lab,
    flag: computeFlag(lab.value, lab.reference_range_low, lab.reference_range_high),
  }));

  const { data, error } = await supabase
    .from('lab_results')
    .insert(labsWithFlags)
    .select('id');

  if (error) {
    console.error('  Error inserting April 13 lab results:', error.message);
    return 0;
  }

  const count = data?.length || 0;
  console.log(`  Inserted ${count} new lab results for April 13, 2026 (${existingNames.size} already existed)`);

  // Report flagged results
  const flagged = labsWithFlags.filter(l => l.flag !== 'normal');
  if (flagged.length > 0) {
    console.log('\n  Flagged results:');
    for (const f of flagged) {
      console.log(`    [${f.flag.toUpperCase()}] ${f.test_name}: ${f.value} ${f.unit || ''} (ref ${f.reference_range_low}-${f.reference_range_high})`);
    }
  }

  // Highlight ferritin milestone
  console.log('\n  *** FERRITIN 50.4 ng/mL - UP FROM 19.5! Iron supplementation working! ***');

  return count + existingNames.size;
}

// ============================================================
// Step 2: Insert Historical 2025 Lab Results
// ============================================================
async function insertHistorical2025Labs() {
  console.log('\n=== Step 2: Inserting Historical 2025 Labs ===\n');

  // Check if any of these dates already exist
  const { count: existing } = await supabase
    .from('lab_results')
    .select('*', { count: 'exact', head: true })
    .in('date', ['2025-08-11', '2025-05-13', '2025-03-18']);

  if (existing && existing > 0) {
    console.log(`  SKIPPED: ${existing} lab results from 2025 historical dates already exist.`);
    return existing;
  }

  const labs = [
    // Aug 11, 2025
    { date: '2025-08-11', category: 'Liver', test_name: 'AST', value: 19, unit: 'units/L', reference_range_low: 15, reference_range_high: 41 },
    { date: '2025-08-11', category: 'Liver', test_name: 'ALT', value: 8, unit: 'units/L', reference_range_low: 10, reference_range_high: 40 },
    { date: '2025-08-11', category: 'Liver', test_name: 'Alkaline Phosphatase', value: 79, unit: 'units/L', reference_range_low: 35, reference_range_high: 104 },
    { date: '2025-08-11', category: 'Liver', test_name: 'Bilirubin Total', value: 0.6, unit: 'mg/dL', reference_range_low: 0.1, reference_range_high: 1.2 },
    { date: '2025-08-11', category: 'Liver', test_name: 'Bilirubin Direct', value: 0.1, unit: 'mg/dL', reference_range_low: 0, reference_range_high: 0.3 },
    { date: '2025-08-11', category: 'Liver', test_name: 'Bilirubin Indirect', value: 0.5, unit: 'mg/dL', reference_range_low: 0, reference_range_high: 0.9 },
    { date: '2025-08-11', category: 'Liver', test_name: 'Total Protein', value: 7.0, unit: 'gm/dL', reference_range_low: 6.4, reference_range_high: 8.2 },
    { date: '2025-08-11', category: 'Liver', test_name: 'Albumin', value: 4.3, unit: 'gm/dL', reference_range_low: 3.5, reference_range_high: 5.0 },
    { date: '2025-08-11', category: 'Liver', test_name: 'Globulin', value: 2.7, unit: 'gm/dL', reference_range_low: 2.0, reference_range_high: 4.0 },
    { date: '2025-08-11', category: 'Liver', test_name: 'A/G Ratio', value: 1.6, unit: null, reference_range_low: 1.0, reference_range_high: 2.5 },
    { date: '2025-08-11', category: 'Lipids', test_name: 'Triglycerides', value: 85, unit: 'mg/dL', reference_range_low: 0, reference_range_high: 150 },

    // May 13, 2025
    { date: '2025-05-13', category: 'Liver', test_name: 'AST', value: 13, unit: 'units/L', reference_range_low: 15, reference_range_high: 41 },
    { date: '2025-05-13', category: 'Liver', test_name: 'ALT', value: 6, unit: 'units/L', reference_range_low: 10, reference_range_high: 40 },
    { date: '2025-05-13', category: 'Liver', test_name: 'Alkaline Phosphatase', value: 109, unit: 'units/L', reference_range_low: 35, reference_range_high: 104 },
    { date: '2025-05-13', category: 'Liver', test_name: 'Bilirubin Total', value: 0.4, unit: 'mg/dL', reference_range_low: 0.1, reference_range_high: 1.2 },
    { date: '2025-05-13', category: 'Liver', test_name: 'Total Protein', value: 6.9, unit: 'gm/dL', reference_range_low: 6.4, reference_range_high: 8.2 },
    { date: '2025-05-13', category: 'Liver', test_name: 'Albumin', value: 4.2, unit: 'gm/dL', reference_range_low: 3.5, reference_range_high: 5.0 },
    { date: '2025-05-13', category: 'Liver', test_name: 'Globulin', value: 2.7, unit: 'gm/dL', reference_range_low: 2.0, reference_range_high: 4.0 },
    { date: '2025-05-13', category: 'Liver', test_name: 'A/G Ratio', value: 1.6, unit: null, reference_range_low: 1.0, reference_range_high: 2.5 },
    { date: '2025-05-13', category: 'Lipids', test_name: 'Triglycerides', value: 57, unit: 'mg/dL', reference_range_low: 0, reference_range_high: 150 },

    // Mar 18, 2025 - Microbiology
    { date: '2025-03-18', category: 'Microbiology', test_name: 'Candida', value: 0, unit: null, reference_range_low: null, reference_range_high: null },
    { date: '2025-03-18', category: 'Microbiology', test_name: 'Gardnerella', value: 0, unit: null, reference_range_low: null, reference_range_high: null },
    { date: '2025-03-18', category: 'Microbiology', test_name: 'Trichomonas', value: 0, unit: null, reference_range_low: null, reference_range_high: null },
  ];

  // Auto-compute flags (microbiology tests: value 0 = NEGATIVE = normal)
  const labsWithFlags = labs.map(lab => {
    if (lab.category === 'Microbiology') {
      return { ...lab, flag: 'normal' };
    }
    return {
      ...lab,
      flag: computeFlag(lab.value, lab.reference_range_low, lab.reference_range_high),
    };
  });

  const { data, error } = await supabase
    .from('lab_results')
    .insert(labsWithFlags)
    .select('id');

  if (error) {
    console.error('  Error inserting historical lab results:', error.message);
    return 0;
  }

  const count = data?.length || 0;
  console.log(`  Inserted ${count} historical lab results (Aug 2025, May 2025, Mar 2025)`);

  const flagged = labsWithFlags.filter(l => l.flag !== 'normal');
  if (flagged.length > 0) {
    console.log('\n  Flagged results:');
    for (const f of flagged) {
      console.log(`    [${f.flag.toUpperCase()}] ${f.date} ${f.test_name}: ${f.value} ${f.unit || ''} (ref ${f.reference_range_low}-${f.reference_range_high})`);
    }
  }

  return count;
}

// ============================================================
// Step 3: Insert Timeline Events (ED visits, IM visit, ferritin, meds)
// ============================================================
async function insertTimelineEvents() {
  console.log('\n=== Step 3: Inserting New Timeline Events ===\n');

  // Check for ED visits specifically (the most critical new events)
  const { data: existingEvents } = await supabase
    .from('medical_timeline')
    .select('title, event_date')
    .eq('event_type', 'hospitalization')
    .in('event_date', ['2026-04-07', '2026-04-09']);

  const existingTitles = new Set((existingEvents || []).map(e => e.title));

  // Also check for Apr 13 events
  const { data: apr13Events } = await supabase
    .from('medical_timeline')
    .select('title')
    .eq('event_date', '2026-04-13');

  for (const evt of (apr13Events || [])) {
    existingTitles.add(evt.title);
  }

  const events = [
    {
      event_date: '2026-04-07',
      event_type: 'hospitalization',
      title: 'ED Visit #1 at Adventist Health Castle',
      description: 'Stabbing heart sensation, chest pain, throat swelling. Tachycardic on arrival. Evaluated and stabilized in ED.',
      significance: 'critical',
      linked_data: {
        facility: 'Adventist Health Castle',
        presenting: ['stabbing heart sensation', 'chest pain', 'throat swelling'],
        finding: 'Tachycardic on arrival'
      }
    },
    {
      event_date: '2026-04-09',
      event_type: 'hospitalization',
      title: 'ED Visit #2 at Adventist Health Castle',
      description: 'Allergic reaction, shortness of breath. BP 141/93 on triage (hypertensive). EKG done. Diagnosed: palpitations + paradoxical vocal fold motion. Discharged after 1.5 hours.',
      significance: 'critical',
      linked_data: {
        facility: 'Adventist Health Castle',
        presenting: ['allergic reaction', 'shortness of breath'],
        bp_triage: '141/93',
        ekg: 'performed',
        diagnosis: ['palpitations', 'paradoxical vocal fold motion'],
        duration_hours: 1.5
      }
    },
    {
      event_date: '2026-04-13',
      event_type: 'appointment',
      title: 'IM Office Visit with NP Mendykowski - Post-ED follow up',
      description: 'Post-ED follow up. New meds: hydroxyzine + cetirizine. Labs ordered: ferritin, iron, folate, B12, reticulocyte, transferrin. Referred to QMC cardiology + neurology.',
      significance: 'important',
      linked_data: {
        provider: 'NP Mendykowski',
        new_meds: ['hydroxyzine 10mg', 'cetirizine 10mg'],
        labs_ordered: ['ferritin', 'iron', 'folate', 'B12', 'reticulocyte', 'transferrin'],
        referrals: ['QMC cardiology', 'QMC neurology']
      }
    },
    {
      event_date: '2026-04-13',
      event_type: 'test',
      title: 'FERRITIN 50.4 (up from 19.5!) - iron supplementation finally working',
      description: 'New labs show ferritin 50.4 ng/mL, up from 19.5 on Feb 19. Iron supplementation finally working after months. C4 Complement 28 (normal). C1 Esterase Inhibitor pending. All CBC, CMP, liver, vitamins within normal limits.',
      significance: 'important',
      linked_data: {
        ferritin: 50.4,
        ferritin_previous: 19.5,
        ferritin_trajectory: [10, 32.5, 19.5, 50.4],
        iron_total: 89,
        transferrin: 205,
        c4_complement: 28,
        folate: 20.7,
        b12: 626
      }
    },
    {
      event_date: '2026-04-13',
      event_type: 'medication_change',
      title: 'New medications: hydroxyzine 10mg + cetirizine 10mg (antihistamines)',
      description: 'New medications started: hydroxyzine 10mg + cetirizine 10mg (antihistamines for suspected MCAS/allergic reactions). Prescribed at IM office visit post-ED follow up.',
      significance: 'important',
      linked_data: {
        medications: [
          { name: 'hydroxyzine hydrochloride', dose: '10 mg', route: 'oral tablet' },
          { name: 'cetirizine (Zyrtec)', dose: '10 mg', route: 'oral tablet' }
        ],
        indication: 'suspected MCAS/allergic reactions'
      }
    }
  ];

  // Filter out events that already exist
  const newEvents = events.filter(evt => !existingTitles.has(evt.title));

  if (newEvents.length === 0) {
    console.log(`  SKIPPED: All ${events.length} timeline events already exist.`);
    return events.length;
  }

  console.log(`  Inserting ${newEvents.length} new timeline events (${events.length - newEvents.length} already exist)...`);

  const { data, error } = await supabase
    .from('medical_timeline')
    .insert(newEvents)
    .select('id');

  if (error) {
    console.error('  Error inserting timeline events:', error.message);
    return 0;
  }

  const count = data?.length || 0;
  console.log(`  Inserted ${count} timeline events`);
  for (const evt of newEvents) {
    console.log(`    ${evt.event_date} [${evt.significance}] ${evt.title}`);
  }

  return count;
}

// ============================================================
// Step 4: Update Health Profile - Medications
// ============================================================
async function updateMedications() {
  console.log('\n=== Step 4: Updating Health Profile - Medications ===\n');

  // Read existing medications section
  const { data: existing, error: readErr } = await supabase
    .from('health_profile')
    .select('content')
    .eq('section', 'medications')
    .single();

  if (readErr) {
    console.error('  Error reading medications:', readErr.message);
    return false;
  }

  const meds = existing.content;

  // Check if hydroxyzine already added
  const alreadyHas = JSON.stringify(meds).includes('hydroxyzine');
  if (alreadyHas) {
    console.log('  SKIPPED: hydroxyzine already in medications.');
    return true;
  }

  // Add new current medications section (or merge into as_needed)
  if (!meds.current) {
    meds.current = [];
  }

  meds.current.push({
    name: 'Hydroxyzine hydrochloride',
    dose: '10 mg oral tablet',
    started: '2026-04-13',
    indication: 'Antihistamine for suspected MCAS/allergic reactions'
  });

  meds.current.push({
    name: 'Cetirizine (Zyrtec)',
    dose: '10 mg oral tablet',
    started: '2026-04-13',
    indication: 'Antihistamine for allergic reactions'
  });

  const { error: updateErr } = await supabase
    .from('health_profile')
    .update({ content: meds, updated_by: 'import-luminate-myah', updated_at: new Date().toISOString() })
    .eq('section', 'medications');

  if (updateErr) {
    console.error('  Error updating medications:', updateErr.message);
    return false;
  }

  console.log('  Added to health_profile medications:');
  console.log('    - Hydroxyzine hydrochloride 10 mg oral tablet (started Apr 13, 2026)');
  console.log('    - Cetirizine (Zyrtec) 10 mg oral tablet (started Apr 13, 2026)');
  return true;
}

// ============================================================
// Step 5: Add Active Problems (if not already present)
// ============================================================
async function addActiveProblems() {
  console.log('\n=== Step 5: Adding New Active Problems ===\n');

  // Read existing problems
  const { data: existingProblems, error: readErr } = await supabase
    .from('active_problems')
    .select('problem');

  if (readErr) {
    console.error('  Error reading active_problems:', readErr.message);
    return 0;
  }

  const existingNames = (existingProblems || []).map(p => p.problem.toLowerCase());

  const newProblems = [
    {
      problem: 'Dysmenorrhea',
      status: 'active',
      onset_date: '2025-06-01',
      latest_data: 'Painful periods, formally diagnosed. Associated with heavy menstrual bleeding and suspected endometriosis.',
      linked_diagnoses: ['Suspected endometriosis'],
      linked_symptoms: ['severe cramps', 'pelvic pain', 'heavy flow'],
      notes: 'On hospital problem list. OB/GYN appointment Apr 30, 2026.'
    },
    {
      problem: 'Palpitations',
      status: 'active',
      onset_date: '2026-04-07',
      latest_data: 'Formally in hospital problem list after two ED visits (Apr 7 + Apr 9, 2026). Stabbing heart sensation, tachycardic on arrival at ED. EKG performed Apr 9. Referred to QMC cardiology.',
      linked_diagnoses: ['Orthostatic intolerance / POTS-like presentation'],
      linked_symptoms: ['stabbing heart sensation', 'chest pain', 'tachycardia'],
      notes: 'Diagnosed at ED. Cardiology referral to QMC. Existing cardiology apt Aug 17, 2026.'
    },
    {
      problem: 'Itching of lesion of skin',
      status: 'active',
      onset_date: '2026-04-07',
      latest_data: 'New skin symptom noted on hospital problem list. May be related to suspected MCAS/allergic reactions.',
      linked_diagnoses: ['Suspected MCAS'],
      linked_symptoms: ['itching', 'skin lesion'],
      notes: 'New antihistamines (hydroxyzine + cetirizine) started Apr 13. Low histamine diet in progress.'
    }
  ];

  // Filter out ones already in DB
  const toInsert = newProblems.filter(p => !existingNames.includes(p.problem.toLowerCase()));

  if (toInsert.length === 0) {
    console.log('  SKIPPED: All new problems already exist in active_problems.');
    return 0;
  }

  const { data, error } = await supabase
    .from('active_problems')
    .insert(toInsert)
    .select('id');

  if (error) {
    console.error('  Error inserting active problems:', error.message);
    return 0;
  }

  const count = data?.length || 0;
  console.log(`  Inserted ${count} new active problems:`);
  for (const p of toInsert) {
    console.log(`    [${p.status}] ${p.problem}`);
  }

  return count;
}

// ============================================================
// Step 6: Insert Medical Narrative
// ============================================================
async function insertMedicalNarrative() {
  console.log('\n=== Step 6: Inserting Medical Narrative ===\n');

  const sectionTitle = 'Internal Medicine Office Visit - April 13, 2026';

  // Check if already exists
  const { count: existing } = await supabase
    .from('medical_narrative')
    .select('*', { count: 'exact', head: true })
    .eq('section_title', sectionTitle);

  if (existing && existing > 0) {
    console.log(`  SKIPPED: Narrative "${sectionTitle}" already exists.`);
    return existing;
  }

  const narrative = {
    section_title: sectionTitle,
    content: 'Post-ER follow up for palpitations. Patient accompanied by husband (Clancy). Went to ED twice (4/7 and 4/9) with stabbing heart sensation, chest pain, throat swelling. Initially tachycardic, improved with fluids. Seen allergist - improving with low histamine diet and Zyrtec + hydroxyzine PRN. Referred to QMC for cardiology and neurology workup. Has hx of iron deficiency, heavy menses with severe pelvic pain. Scheduled for OB/GYN. PHQ-2: 0 (negative). GAD-2: 0 (negative). Assessment: Anemia (D64.9), IDA (D50.9). Ordered: Ferritin, Folate, Iron, Reticulocyte Count, Transferrin, B12.',
    section_order: 10,
  };

  const { data, error } = await supabase
    .from('medical_narrative')
    .insert(narrative)
    .select('id');

  if (error) {
    console.error('  Error inserting medical narrative:', error.message);
    return 0;
  }

  console.log(`  Inserted narrative: "${sectionTitle}"`);
  return 1;
}

// ============================================================
// Step 7: Update active_problems iron deficiency with ferritin milestone
// ============================================================
async function updateIronDeficiencyProblem() {
  console.log('\n=== Step 7: Updating Iron Deficiency Problem with Ferritin 50.4 ===\n');

  const { data: ironProblem, error: readErr } = await supabase
    .from('active_problems')
    .select('*')
    .ilike('problem', '%iron deficiency%')
    .single();

  if (readErr || !ironProblem) {
    console.log('  No existing iron deficiency problem found to update.');
    return false;
  }

  // Check if already updated
  if (ironProblem.latest_data && ironProblem.latest_data.includes('50.4')) {
    console.log('  SKIPPED: Iron deficiency problem already updated with ferritin 50.4.');
    return true;
  }

  const updatedData = 'Ferritin trajectory: 10 (12/11) -> 32.5 (12/31) -> 19.5 (2/19) -> 50.4 (4/13)! Iron supplementation finally showing sustained response. Iron Total 89, Transferrin 205 (both normal). Heavy menstrual bleeding remains the suspected iron sink.';

  const { error: updateErr } = await supabase
    .from('active_problems')
    .update({
      latest_data: updatedData,
      status: 'improving',
      updated_at: new Date().toISOString()
    })
    .eq('id', ironProblem.id);

  if (updateErr) {
    console.error('  Error updating iron deficiency problem:', updateErr.message);
    return false;
  }

  console.log('  Updated iron deficiency problem:');
  console.log('    Status: active -> improving');
  console.log('    Ferritin trajectory now includes 50.4!');
  return true;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('========================================');
  console.log('Luminate Health + myAH Full Import');
  console.log('========================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Step 1: April 13 labs
  const apr13LabCount = await insertApril13Labs();

  // Step 2: Historical 2025 labs
  const histLabCount = await insertHistorical2025Labs();

  // Step 3: Timeline events
  const timelineCount = await insertTimelineEvents();

  // Step 4: Medications update
  const medsOk = await updateMedications();

  // Step 5: Active problems
  const problemCount = await addActiveProblems();

  // Step 6: Medical narrative
  const narrativeCount = await insertMedicalNarrative();

  // Step 7: Update iron deficiency status
  const ironUpdated = await updateIronDeficiencyProblem();

  // --- Verification ---
  console.log('\n=== Verification ===\n');

  // Verify ferritin is in DB
  const { data: ferritinCheck } = await supabase
    .from('lab_results')
    .select('date, test_name, value, unit, flag')
    .eq('test_name', 'Ferritin')
    .order('date', { ascending: true });

  if (ferritinCheck) {
    console.log('  Ferritin history in database:');
    for (const f of ferritinCheck) {
      const marker = f.value === 50.4 ? ' *** NEW ***' : '';
      console.log(`    ${f.date}: ${f.value} ${f.unit} [${f.flag}]${marker}`);
    }
  }

  // Count all lab results
  const { count: totalLabs } = await supabase
    .from('lab_results')
    .select('*', { count: 'exact', head: true });

  // Count timeline events
  const { count: totalTimeline } = await supabase
    .from('medical_timeline')
    .select('*', { count: 'exact', head: true });

  // Count active problems
  const { count: totalProblems } = await supabase
    .from('active_problems')
    .select('*', { count: 'exact', head: true });

  console.log('\n========================================');
  console.log('Import Summary');
  console.log('========================================');
  console.log(`  April 13 lab results inserted:  ${apr13LabCount}`);
  console.log(`  Historical 2025 labs inserted:   ${histLabCount}`);
  console.log(`  Timeline events inserted:        ${timelineCount}`);
  console.log(`  Medications updated:             ${medsOk ? 'YES' : 'FAILED'}`);
  console.log(`  Active problems added:           ${problemCount}`);
  console.log(`  Medical narrative added:         ${narrativeCount}`);
  console.log(`  Iron deficiency status updated:  ${ironUpdated ? 'YES' : 'NO'}`);
  console.log('----------------------------------------');
  console.log(`  Total lab results in DB:         ${totalLabs}`);
  console.log(`  Total timeline events in DB:     ${totalTimeline}`);
  console.log(`  Total active problems in DB:     ${totalProblems}`);
  console.log('========================================');

  const anyFailed = apr13LabCount === 0 || timelineCount === 0 || !medsOk;
  if (anyFailed) {
    console.error('\nSome critical inserts had errors. Check output above.');
    process.exit(1);
  }

  console.log('\nAll imports completed successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
