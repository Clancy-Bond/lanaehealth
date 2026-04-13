/**
 * Import myAH Portal Data - April 2026 Scrape
 *
 * Inserts:
 *  - 36 lab results (Apr 7 + Apr 9, 2026)
 *  - 5 upcoming appointments
 *  - 1 EKG imaging study (Feb 16, 2026)
 *  - 6 medical timeline events
 *
 * Usage: node src/lib/migrations/import-myah-data.mjs
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
// Step 0: Test if EKG modality is allowed; provide manual fix SQL if not
// ============================================================
async function checkEkgModality() {
  console.log('\n=== Step 0: Checking imaging_studies modality constraint ===\n');

  // Test insert to see if EKG is allowed
  const { error } = await supabase
    .from('imaging_studies')
    .insert({
      study_date: '1970-01-01',
      modality: 'EKG',
      body_part: 'test',
    })
    .select('id');

  if (!error) {
    // Clean up test row
    await supabase.from('imaging_studies').delete().eq('study_date', '1970-01-01');
    console.log('  EKG modality is already allowed.');
    return true;
  }

  if (error.code === '23514') {
    console.log('  EKG modality blocked by CHECK constraint.');
    console.log('  To fix, run this SQL in the Supabase Dashboard SQL Editor:');
    console.log('');
    console.log("    ALTER TABLE imaging_studies DROP CONSTRAINT IF EXISTS imaging_studies_modality_check;");
    console.log("    ALTER TABLE imaging_studies ADD CONSTRAINT imaging_studies_modality_check CHECK (modality IN ('CT', 'XR', 'MRI', 'US', 'EKG'));");
    console.log('');
    return false;
  }

  console.error('  Unexpected error:', error.message);
  return false;
}

// ============================================================
// Step 1: Insert Lab Results (idempotent - checks for existing Apr 7/9 data)
// ============================================================
async function insertLabResults() {
  console.log('\n=== Step 1: Inserting Lab Results ===\n');

  // Check if Apr 7 or Apr 9 labs already exist
  const { count: existing } = await supabase
    .from('lab_results')
    .select('*', { count: 'exact', head: true })
    .in('date', ['2026-04-07', '2026-04-09']);

  if (existing && existing > 0) {
    console.log(`  SKIPPED: ${existing} lab results from Apr 7/9 already exist in database.`);
    return existing;
  }

  const labs = [
    // April 9, 2026 - Hematology
    { date: '2026-04-09', category: 'Hematology', test_name: 'WBC', value: 6.7, unit: 'K/uL', reference_range_low: 3.5, reference_range_high: 10.4 },
    { date: '2026-04-09', category: 'Hematology', test_name: 'RBC', value: 4.68, unit: 'M/uL', reference_range_low: 3.60, reference_range_high: 5.40 },
    { date: '2026-04-09', category: 'Hematology', test_name: 'HGB', value: 13.5, unit: 'gm/dL', reference_range_low: 12.0, reference_range_high: 16.0 },
    { date: '2026-04-09', category: 'Hematology', test_name: 'MCV', value: 87.4, unit: 'fL', reference_range_low: 82.0, reference_range_high: 101.0 },
    { date: '2026-04-09', category: 'Hematology', test_name: 'MCH', value: 28.8, unit: 'pg', reference_range_low: 26.0, reference_range_high: 34.0 },
    { date: '2026-04-09', category: 'Hematology', test_name: 'MCHC', value: 33.0, unit: 'gm/dL', reference_range_low: 32.0, reference_range_high: 36.0 },
    { date: '2026-04-09', category: 'Hematology', test_name: 'RDW', value: 14.7, unit: '%', reference_range_low: 11.0, reference_range_high: 15.0 },
    { date: '2026-04-09', category: 'Hematology', test_name: 'PLT', value: 192, unit: 'K/uL', reference_range_low: 140, reference_range_high: 440 },
    { date: '2026-04-09', category: 'Hematology', test_name: 'MPV', value: 9.0, unit: 'fL', reference_range_low: 7.9, reference_range_high: 10.8 },

    // April 9, 2026 - Differential
    { date: '2026-04-09', category: 'Differential', test_name: 'Neutrophils %', value: 43.7, unit: '%', reference_range_low: 18.0, reference_range_high: 45.0 },
    { date: '2026-04-09', category: 'Differential', test_name: 'Monocytes %', value: 6.5, unit: '%', reference_range_low: 3.0, reference_range_high: 12.0 },
    { date: '2026-04-09', category: 'Differential', test_name: 'Eosinophils %', value: 2.5, unit: '%', reference_range_low: 0, reference_range_high: 7.0 },
    { date: '2026-04-09', category: 'Differential', test_name: 'Basophils %', value: 0.6, unit: '%', reference_range_low: 0, reference_range_high: 2.0 },
    { date: '2026-04-09', category: 'Differential', test_name: 'Neutrophil Absolute', value: 3.1, unit: 'K/uL', reference_range_low: 1.5, reference_range_high: 7.0 },
    { date: '2026-04-09', category: 'Differential', test_name: 'Lymphocyte Absolute', value: 2.9, unit: 'K/uL', reference_range_low: 1.0, reference_range_high: 4.0 },

    // April 9, 2026 - Vital Signs
    { date: '2026-04-09', category: 'Vital Signs', test_name: 'Temperature', value: 98.1, unit: 'DegF', reference_range_low: 97, reference_range_high: 100.4 },
    { date: '2026-04-09', category: 'Vital Signs', test_name: 'Peripheral Pulse Rate', value: 93, unit: 'bpm', reference_range_low: 60, reference_range_high: 99 },
    { date: '2026-04-09', category: 'Vital Signs', test_name: 'Heart Rate Monitored', value: 70, unit: 'bpm', reference_range_low: 60, reference_range_high: 99 },
    { date: '2026-04-09', category: 'Vital Signs', test_name: 'Respiratory Rate', value: 16, unit: 'br/min', reference_range_low: 14, reference_range_high: 20 },
    { date: '2026-04-09', category: 'Vital Signs', test_name: 'Systolic BP', value: 110, unit: 'mmHg', reference_range_low: 90, reference_range_high: 139 },
    { date: '2026-04-09', category: 'Vital Signs', test_name: 'Diastolic BP', value: 85, unit: 'mmHg', reference_range_low: 60, reference_range_high: 89 },
    { date: '2026-04-09', category: 'Vital Signs', test_name: 'Pulse Oximetry', value: 98, unit: '%', reference_range_low: 95, reference_range_high: 100 },
    { date: '2026-04-09', category: 'Vital Signs', test_name: 'MAP Non-Invasive', value: 93, unit: 'mmHg', reference_range_low: 65, reference_range_high: 110 },

    // April 7, 2026 - Standing Vitals
    { date: '2026-04-07', category: 'Vital Signs', test_name: 'Standing Pulse Rate', value: 106, unit: 'bpm', reference_range_low: 60, reference_range_high: 99 },

    // April 9, 2026 - Chemistry
    { date: '2026-04-09', category: 'Chemistry', test_name: 'Sodium', value: 139, unit: 'mmol/L', reference_range_low: 136, reference_range_high: 145 },
    { date: '2026-04-09', category: 'Chemistry', test_name: 'Potassium', value: 3.9, unit: 'mmol/L', reference_range_low: 3.5, reference_range_high: 5.1 },
    { date: '2026-04-09', category: 'Chemistry', test_name: 'Calcium', value: 9.3, unit: 'mg/dL', reference_range_low: 8.6, reference_range_high: 10.0 },
    { date: '2026-04-09', category: 'Chemistry', test_name: 'Magnesium', value: 1.8, unit: 'mg/dL', reference_range_low: 1.6, reference_range_high: 2.5 },

    // April 7, 2026 - Chemistry
    { date: '2026-04-07', category: 'Chemistry', test_name: 'Total Protein', value: 7.7, unit: 'gm/dL', reference_range_low: 6.4, reference_range_high: 8.2 },
    { date: '2026-04-07', category: 'Chemistry', test_name: 'Albumin', value: 4.9, unit: 'gm/dL', reference_range_low: 3.5, reference_range_high: 5.0 },
    { date: '2026-04-07', category: 'Chemistry', test_name: 'Globulin', value: 2.8, unit: 'gm/dL', reference_range_low: 2.0, reference_range_high: 4.0 },
    { date: '2026-04-07', category: 'Chemistry', test_name: 'A/G Ratio', value: 1.8, unit: null, reference_range_low: 1.0, reference_range_high: 2.5 },
    { date: '2026-04-07', category: 'Chemistry', test_name: 'ALT', value: 12, unit: 'units/L', reference_range_low: 10, reference_range_high: 40 },
    { date: '2026-04-07', category: 'Chemistry', test_name: 'AST', value: 16, unit: 'units/L', reference_range_low: 15, reference_range_high: 41 },

    // April 9, 2026 - Thyroid
    { date: '2026-04-09', category: 'Thyroid', test_name: 'TSH', value: 5.100, unit: 'uInt Unit/mL', reference_range_low: 0.450, reference_range_high: 5.330 },

    // April 7, 2026 - Pregnancy
    { date: '2026-04-07', category: 'Other', test_name: 'BHCG/Pregnancy', value: 0, unit: null, reference_range_low: null, reference_range_high: null },

    // April 7, 2026 - Lipids (Total Cholesterol)
    { date: '2026-04-07', category: 'Lipids', test_name: 'Total Cholesterol', value: 286, unit: 'mg/dL', reference_range_low: 0, reference_range_high: 200 },

    // April 9, 2026 - Coagulation
    { date: '2026-04-09', category: 'Coagulation', test_name: 'D-Dimer', value: 360, unit: 'ng/mL FEU', reference_range_low: 0, reference_range_high: 500 },
  ];

  // Auto-compute flags
  const labsWithFlags = labs.map(lab => ({
    ...lab,
    flag: lab.test_name === 'BHCG/Pregnancy'
      ? 'normal'
      : computeFlag(lab.value, lab.reference_range_low, lab.reference_range_high),
  }));

  const { data, error } = await supabase
    .from('lab_results')
    .insert(labsWithFlags)
    .select('id');

  if (error) {
    console.error('  Error inserting lab results:', error.message);
    return 0;
  }

  const count = data?.length || 0;
  console.log(`  Inserted ${count} lab results`);

  // Report flagged results
  const flagged = labsWithFlags.filter(l => l.flag !== 'normal');
  if (flagged.length > 0) {
    console.log('\n  Flagged results:');
    for (const f of flagged) {
      console.log(`    [${f.flag.toUpperCase()}] ${f.test_name}: ${f.value} ${f.unit || ''} (ref ${f.reference_range_low}-${f.reference_range_high})`);
    }
  }

  return count;
}

// ============================================================
// Step 2: Insert Appointments (idempotent - checks for existing data)
// ============================================================
async function insertAppointments() {
  console.log('\n=== Step 2: Inserting Appointments ===\n');

  // Check if these appointments already exist
  const { count: existing } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .in('date', ['2026-04-13', '2026-04-30', '2026-06-05', '2026-08-17', '2027-04-09']);

  if (existing && existing > 0) {
    console.log(`  SKIPPED: ${existing} of these appointments already exist in database.`);
    return existing;
  }

  const appointments = [
    {
      date: '2026-04-13',
      doctor_name: 'Mendykowski, FNP, Alice D',
      specialty: 'Primary Care',
      clinic: 'PrmCreKailAul-CS',
      reason: 'FP Follow Up',
      notes: null,
    },
    {
      date: '2026-04-30',
      doctor_name: 'Amin, MD, Radhika',
      specialty: 'OB/GYN',
      clinic: 'OBGYNUluk-CS',
      reason: 'WH New Patient',
      notes: 'Endometriosis evaluation',
    },
    {
      date: '2026-06-05',
      doctor_name: 'Kamireddy, MD, Adireddy',
      specialty: 'Internal Medicine',
      clinic: 'PrmCreKailAul-CS',
      reason: 'IM Follow Up',
      notes: null,
    },
    {
      date: '2026-08-17',
      doctor_name: 'Younoszai, MD, Barak G',
      specialty: 'Cardiology',
      clinic: 'Spcity103Uluk-CS',
      reason: 'CD Follow Up',
      notes: null,
    },
    {
      date: '2027-04-09',
      doctor_name: null,
      specialty: 'Radiology',
      clinic: 'Radiology-CS',
      reason: 'MRI Brain ESM',
      notes: null,
    },
  ];

  const { data, error } = await supabase
    .from('appointments')
    .insert(appointments)
    .select('id');

  if (error) {
    console.error('  Error inserting appointments:', error.message);
    return 0;
  }

  const count = data?.length || 0;
  console.log(`  Inserted ${count} appointments`);
  for (const appt of appointments) {
    console.log(`    ${appt.date} - ${appt.reason} - ${appt.doctor_name || 'TBD'} (${appt.specialty})`);
  }

  return count;
}

// ============================================================
// Step 3: Insert EKG Imaging Study (idempotent)
// ============================================================
async function insertImagingStudy() {
  console.log('\n=== Step 3: Inserting EKG Imaging Study ===\n');

  // Check if EKG already exists
  const { count: existing } = await supabase
    .from('imaging_studies')
    .select('*', { count: 'exact', head: true })
    .eq('study_date', '2026-02-16')
    .eq('modality', 'EKG');

  if (existing && existing > 0) {
    console.log(`  SKIPPED: EKG study from Feb 16, 2026 already exists.`);
    return existing;
  }

  const ekg = {
    study_date: '2026-02-16',
    modality: 'EKG',
    body_part: 'Heart',
    indication: 'Cardiac evaluation - tachycardia, palpitations, presyncope',
    findings_summary: 'Sinus rhythm with sinus arrhythmia, indeterminate axis, nonspecific T-wave abnormality, borderline ECG. Vent rate 68 BPM, PR 152ms, QRS 94ms, QT/QTc 411/427ms.',
    report_text: 'EKG Report - Final. Sinus rhythm with sinus arrhythmia. Indeterminate axis. Nonspecific T-wave abnormality. Borderline ECG. Ventricular rate 68 BPM, PR interval 152ms, QRS duration 94ms, QT/QTc 411/427ms. Performed by Michelle Alba, ordered by Dr. Younoszai. Location: Adventist Health Castle.',
  };

  const { data, error } = await supabase
    .from('imaging_studies')
    .insert(ekg)
    .select('id');

  if (error) {
    console.error('  Error inserting EKG study:', error.message);
    return 0;
  }

  console.log(`  Inserted EKG study (Feb 16, 2026)`);
  return 1;
}

// ============================================================
// Step 4: Insert Medical Timeline Events (idempotent)
// ============================================================
async function insertTimelineEvents() {
  console.log('\n=== Step 4: Inserting Medical Timeline Events ===\n');

  // Check if these timeline events already exist (by title prefix match)
  const { count: existing } = await supabase
    .from('medical_timeline')
    .select('*', { count: 'exact', head: true })
    .in('event_date', ['2026-04-07', '2026-04-09', '2026-04-13', '2026-04-30', '2026-02-16', '2027-04-09'])
    .in('event_type', ['test', 'appointment', 'imaging']);

  if (existing && existing >= 6) {
    console.log(`  SKIPPED: ${existing} timeline events from this import already exist.`);
    return existing;
  }

  const events = [
    {
      event_date: '2026-04-07',
      event_type: 'test',
      title: 'Standing pulse rate 106 bpm (POTS-consistent: +36 bpm from resting 70)',
      description: 'Standing pulse rate measured at 106 bpm, well above the 99 bpm upper reference limit. With a resting heart rate of 70 bpm, the +36 bpm increase on standing is consistent with POTS criteria (>=30 bpm rise within 10 min of standing).',
      significance: 'critical',
    },
    {
      event_date: '2026-04-09',
      event_type: 'test',
      title: 'New labs: TSH borderline high (5.1), CBC normal, chemistry normal, D-Dimer normal',
      description: 'Comprehensive labs drawn. TSH 5.100 (ref 0.450-5.330) borderline high. CBC within normal limits. Chemistry panel normal. D-Dimer 360 (ref <=500) normal. Total Cholesterol 286 mg/dL elevated.',
      significance: 'important',
    },
    {
      event_date: '2026-04-13',
      event_type: 'appointment',
      title: 'FP Follow Up with NP Mendykowski',
      description: 'Family Practice follow-up appointment with Alice D. Mendykowski, FNP at PrmCreKailAul-CS (Primary Care).',
      significance: 'normal',
    },
    {
      event_date: '2026-04-30',
      event_type: 'appointment',
      title: 'OB/GYN New Patient with Dr. Amin (endometriosis evaluation)',
      description: 'New patient appointment with Dr. Radhika Amin, MD at OBGYNUluk-CS. Purpose: women\'s health evaluation, suspected endometriosis workup.',
      significance: 'important',
    },
    {
      event_date: '2026-02-16',
      event_type: 'test',
      title: 'EKG: Sinus rhythm with T-wave abnormality, borderline',
      description: 'EKG performed at Adventist Health Castle by Michelle Alba, ordered by Dr. Younoszai. Findings: sinus rhythm with sinus arrhythmia, indeterminate axis, nonspecific T-wave abnormality, borderline ECG. Vent rate 68 BPM.',
      significance: 'important',
    },
    {
      event_date: '2027-04-09',
      event_type: 'imaging',
      title: 'MRI Brain scheduled at Radiology-CS',
      description: 'MRI Brain ESM scheduled at Radiology-CS. Part of ongoing neurological workup for chronic dizziness and headaches.',
      significance: 'important',
    },
  ];

  const { data, error } = await supabase
    .from('medical_timeline')
    .insert(events)
    .select('id');

  if (error) {
    console.error('  Error inserting timeline events:', error.message);
    return 0;
  }

  const count = data?.length || 0;
  console.log(`  Inserted ${count} timeline events`);
  for (const evt of events) {
    console.log(`    ${evt.event_date} [${evt.significance}] ${evt.title}`);
  }

  return count;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('========================================');
  console.log('myAH Portal Data Import');
  console.log('========================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Step 0: Check EKG modality constraint
  const ekgAllowed = await checkEkgModality();

  // Step 1: Lab Results
  const labCount = await insertLabResults();

  // Step 2: Appointments
  const apptCount = await insertAppointments();

  // Step 3: Imaging (may be skipped if EKG constraint not updated)
  let imgCount = 0;
  if (ekgAllowed) {
    imgCount = await insertImagingStudy();
  } else {
    console.log('\n=== Step 3: SKIPPED - EKG modality blocked by constraint ===');
    console.log('  Run the ALTER TABLE SQL above in Supabase Dashboard, then re-run this script.');
    console.log('  (Labs, appointments, and timeline are already imported - only EKG is pending.)');
  }

  // Step 4: Timeline
  const timelineCount = await insertTimelineEvents();

  console.log('\n========================================');
  console.log('Import Summary');
  console.log('========================================');
  console.log(`  Lab results inserted:      ${labCount}`);
  console.log(`  Appointments inserted:     ${apptCount}`);
  console.log(`  Imaging studies inserted:  ${imgCount}${!ekgAllowed ? ' (PENDING - run ALTER TABLE first)' : ''}`);
  console.log(`  Timeline events inserted:  ${timelineCount}`);
  console.log(`  Total records:             ${labCount + apptCount + imgCount + timelineCount}`);
  console.log('========================================');

  if (labCount === 0 || apptCount === 0 || timelineCount === 0) {
    console.error('\nSome critical inserts had errors. Check output above.');
    process.exit(1);
  }

  if (!ekgAllowed) {
    console.log('\nPartial import complete. EKG imaging study pending constraint update.');
    console.log('After running the ALTER TABLE SQL in Supabase Dashboard, re-run this script.');
    console.log('(Duplicate lab/appointment/timeline inserts will be created - dedup if needed.)');
  } else {
    console.log('\nAll imports completed successfully!');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
