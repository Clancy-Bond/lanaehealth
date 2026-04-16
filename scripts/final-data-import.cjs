const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      envVars[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const results = {
  timeline: [],
  labs: [],
  healthProfile: [],
  errors: []
};

// ============================================================
// 1. MEDICAL TIMELINE: Dec 11 Labs event (upsert)
// ============================================================
async function upsertDec11Timeline() {
  console.log('\n--- 1. Medical Timeline: Dec 11 2025 Quest Labs ---');

  const dec11Data = {
    event_date: '2025-12-11',
    event_type: 'test',
    title: 'Quest Diagnostics self-ordered labs in Texas - Ferritin 10 (critical)',
    description: 'Self-ordered labs via Quest Diagnostics/MyQuest in McKinney TX, ordered through PWN Health (Dr. Abraham Andrew). Ferritin 10 LOW (ref 16-154) - critically low, triggering iron supplementation. hs-CRP 3.2 HIGH (elevated inflammation, cardiovascular risk). Vitamin D 28 LOW (insufficiency). HDL 41 LOW, LDL 130 HIGH, Non-HDL 150 HIGH (lipid abnormalities). PT 15.3 HIGH (coagulation concern with heavy bleeding). TSH 1.88 (normal at this time - later rose to 5.1 by Apr 9). HbA1c 5.3 (no diabetes). Blood type A+. Full hormone panel normal (FSH 6.5, LH 3.5, Estradiol 76, Progesterone 0.5, Testosterone 17, DHEA 836, Prolactin 7.3). Thyroid antibodies (TPO) negative at 1. Zinc 83 normal. Folate 10.5 normal. B12 398 normal.'
  };

  const { data: existing, error: fetchErr } = await supabase
    .from('medical_timeline')
    .select('id, title, description')
    .eq('event_date', '2025-12-11')
    .limit(1);

  if (fetchErr) {
    console.error('  Error checking Dec 11 timeline:', fetchErr.message);
    results.errors.push('Dec 11 timeline check: ' + fetchErr.message);
    return;
  }

  if (existing && existing.length > 0) {
    const { error: updateErr } = await supabase
      .from('medical_timeline')
      .update({
        title: dec11Data.title,
        description: dec11Data.description,
        event_type: dec11Data.event_type
      })
      .eq('id', existing[0].id);

    if (updateErr) {
      console.error('  Error updating Dec 11 timeline:', updateErr.message);
      results.errors.push('Dec 11 timeline update: ' + updateErr.message);
    } else {
      console.log('  UPDATED existing Dec 11 timeline event (id=' + existing[0].id + ')');
      results.timeline.push('Updated Dec 11 Quest Labs event');
    }
  } else {
    const { error: insertErr } = await supabase
      .from('medical_timeline')
      .insert(dec11Data);

    if (insertErr) {
      console.error('  Error inserting Dec 11 timeline:', insertErr.message);
      results.errors.push('Dec 11 timeline insert: ' + insertErr.message);
    } else {
      console.log('  INSERTED new Dec 11 timeline event');
      results.timeline.push('Inserted Dec 11 Quest Labs event');
    }
  }
}

// ============================================================
// 2. MEDICAL TIMELINE: Feb 27 Iron Infusion (upsert)
// ============================================================
async function upsertFeb27Timeline() {
  console.log('\n--- 2. Medical Timeline: Feb 27 2026 Iron Infusion ---');

  const feb27Data = {
    event_date: '2026-02-27',
    event_type: 'medication_change',
    title: 'Iron infusion at Oncology/Infusion Center',
    description: 'Iron IV infusion administered at AH Kailua Oncology/Infusion Center. Intake by Barbie McCumber, RN. Vitals at infusion: HR 100 bpm (tachycardic at rest), BP 117/77, T 98.1F. Chief complaint: iron. Referenced in both ED physician notes. Patient had improvement in syncopal episodes after infusion but continued dizziness/vertigo/palpitations.'
  };

  const { data: existing, error: fetchErr } = await supabase
    .from('medical_timeline')
    .select('id, title, description')
    .eq('event_date', '2026-02-27')
    .limit(1);

  if (fetchErr) {
    console.error('  Error checking Feb 27 timeline:', fetchErr.message);
    results.errors.push('Feb 27 timeline check: ' + fetchErr.message);
    return;
  }

  if (existing && existing.length > 0) {
    const { error: updateErr } = await supabase
      .from('medical_timeline')
      .update({
        title: feb27Data.title,
        description: feb27Data.description,
        event_type: feb27Data.event_type
      })
      .eq('id', existing[0].id);

    if (updateErr) {
      console.error('  Error updating Feb 27 timeline:', updateErr.message);
      results.errors.push('Feb 27 timeline update: ' + updateErr.message);
    } else {
      console.log('  UPDATED existing Feb 27 timeline event (id=' + existing[0].id + ')');
      results.timeline.push('Updated Feb 27 Iron Infusion event');
    }
  } else {
    const { error: insertErr } = await supabase
      .from('medical_timeline')
      .insert(feb27Data);

    if (insertErr) {
      console.error('  Error inserting Feb 27 timeline:', insertErr.message);
      results.errors.push('Feb 27 timeline insert: ' + insertErr.message);
    } else {
      console.log('  INSERTED new Feb 27 timeline event');
      results.timeline.push('Inserted Feb 27 Iron Infusion event');
    }
  }
}

// ============================================================
// 3. LAB RESULTS: Dec 11 2025 labs (duplicate-checked by date+test_name)
// ============================================================
async function importDec11Labs() {
  console.log('\n--- 3. Lab Results: Dec 11 2025 Quest Labs ---');

  const dec11Labs = [
    { test_name: 'hs-CRP', value: 3.2, category: 'Inflammation', flag: 'high' },
    { test_name: 'Vitamin D 25', value: 28, category: 'Vitamins', flag: 'low' },
    { test_name: 'Cholesterol Total', value: 191, category: 'Lipids', flag: null },
    { test_name: 'HDL Cholesterol', value: 41, category: 'Lipids', flag: 'low' },
    { test_name: 'LDL Cholesterol', value: 130, category: 'Lipids', flag: 'high' },
    { test_name: 'Triglycerides', value: 101, category: 'Lipids', flag: null },
    { test_name: 'Non HDL Cholesterol', value: 150, category: 'Lipids', flag: 'high' },
    { test_name: 'HbA1c', value: 5.3, category: 'Metabolic', flag: null },
    { test_name: 'Zinc', value: 83, category: 'Minerals', flag: null },
    { test_name: 'Iron Total', value: 61, category: 'Iron Studies', flag: null },
    { test_name: 'Magnesium', value: 2.2, category: 'Minerals', flag: null },
    { test_name: 'Vitamin B12', value: 398, category: 'Vitamins', flag: null },
    { test_name: 'Folate Serum', value: 10.5, category: 'Vitamins', flag: null },
    { test_name: 'FSH', value: 6.5, category: 'Hormones', flag: null },
    { test_name: 'LH', value: 3.5, category: 'Hormones', flag: null },
    { test_name: 'Estradiol', value: 76, category: 'Hormones', flag: null },
    { test_name: 'TSH', value: 1.88, category: 'Thyroid', flag: null },
    { test_name: 'T4 Free', value: 1.3, category: 'Thyroid', flag: null },
    { test_name: 'T3 Free', value: 3.3, category: 'Thyroid', flag: null },
    { test_name: 'TPO Antibodies', value: 1, category: 'Thyroid', flag: null },
    { test_name: 'Progesterone', value: 0.5, category: 'Hormones', flag: null },
    { test_name: 'Prolactin', value: 7.3, category: 'Hormones', flag: null },
    { test_name: 'Testosterone Total', value: 17, category: 'Hormones', flag: null },
    { test_name: 'DHEA Unconjugated', value: 836, category: 'Hormones', flag: null },
    { test_name: 'PT', value: 15.3, category: 'Coagulation', flag: 'high' },
    { test_name: 'INR', value: 1.2, category: 'Coagulation', flag: null },
    { test_name: 'PTT', value: 28.3, category: 'Coagulation', flag: null }
  ];

  const { data: existingLabs, error: fetchErr } = await supabase
    .from('lab_results')
    .select('test_name')
    .eq('date', '2025-12-11');

  if (fetchErr) {
    console.error('  Error fetching existing Dec 11 labs:', fetchErr.message);
    results.errors.push('Dec 11 labs fetch: ' + fetchErr.message);
    return;
  }

  const existingNames = new Set((existingLabs || []).map(l => l.test_name));
  console.log('  Existing Dec 11 labs: ' + existingNames.size + ' tests');
  if (existingNames.size > 0) {
    console.log('  Names: ' + [...existingNames].join(', '));
  }

  const toInsert = dec11Labs.filter(l => !existingNames.has(l.test_name));
  const skipped = dec11Labs.filter(l => existingNames.has(l.test_name));

  if (skipped.length > 0) {
    console.log('  Skipping ' + skipped.length + ' already-present: ' + skipped.map(l => l.test_name).join(', '));
  }

  if (toInsert.length === 0) {
    console.log('  All Dec 11 labs already present. Nothing to insert.');
    results.labs.push('Dec 11: 0 new (all 27 already present)');
    return;
  }

  const rows = toInsert.map(l => ({
    date: '2025-12-11',
    category: l.category,
    test_name: l.test_name,
    value: l.value,
    unit: null,
    reference_range_low: null,
    reference_range_high: null,
    flag: l.flag,
    source_document_id: null
  }));

  const { error: insertErr } = await supabase
    .from('lab_results')
    .insert(rows);

  if (insertErr) {
    console.error('  Error inserting Dec 11 labs:', insertErr.message);
    results.errors.push('Dec 11 labs insert: ' + insertErr.message);
  } else {
    console.log('  INSERTED ' + toInsert.length + ' new Dec 11 lab results: ' + toInsert.map(l => l.test_name).join(', '));
    results.labs.push('Dec 11: ' + toInsert.length + ' new labs inserted');
  }
}

// ============================================================
// 4. LAB RESULTS: Dec 31 2025 PT/INR/PTT
// ============================================================
async function importDec31Labs() {
  console.log('\n--- 4. Lab Results: Dec 31 2025 PT/INR/PTT ---');

  const dec31Labs = [
    { test_name: 'PT', value: 15.3, category: 'Coagulation', flag: 'high' },
    { test_name: 'INR', value: 1.2, category: 'Coagulation', flag: null },
    { test_name: 'PTT', value: 28.3, category: 'Coagulation', flag: null }
  ];

  const { data: existingLabs, error: fetchErr } = await supabase
    .from('lab_results')
    .select('test_name')
    .eq('date', '2025-12-31');

  if (fetchErr) {
    console.error('  Error fetching existing Dec 31 labs:', fetchErr.message);
    results.errors.push('Dec 31 labs fetch: ' + fetchErr.message);
    return;
  }

  const existingNames = new Set((existingLabs || []).map(l => l.test_name));
  console.log('  Existing Dec 31 labs: ' + existingNames.size + ' tests');

  const toInsert = dec31Labs.filter(l => !existingNames.has(l.test_name));
  const skipped = dec31Labs.filter(l => existingNames.has(l.test_name));

  if (skipped.length > 0) {
    console.log('  Skipping ' + skipped.length + ' already-present: ' + skipped.map(l => l.test_name).join(', '));
  }

  if (toInsert.length === 0) {
    console.log('  All Dec 31 labs already present.');
    results.labs.push('Dec 31: 0 new (all already present)');
    return;
  }

  const rows = toInsert.map(l => ({
    date: '2025-12-31',
    category: l.category,
    test_name: l.test_name,
    value: l.value,
    unit: null,
    reference_range_low: null,
    reference_range_high: null,
    flag: l.flag,
    source_document_id: null
  }));

  const { error: insertErr } = await supabase
    .from('lab_results')
    .insert(rows);

  if (insertErr) {
    console.error('  Error inserting Dec 31 labs:', insertErr.message);
    results.errors.push('Dec 31 labs insert: ' + insertErr.message);
  } else {
    console.log('  INSERTED ' + toInsert.length + ' new Dec 31 labs: ' + toInsert.map(l => l.test_name).join(', '));
    results.labs.push('Dec 31: ' + toInsert.length + ' new labs inserted');
  }
}

// ============================================================
// 5. HEALTH PROFILE: Add POTS/Autonomic dysfunction
// ============================================================
async function updateHealthProfilePOTS() {
  console.log('\n--- 5. Health Profile: Add POTS/Autonomic dysfunction ---');

  const { data: profile, error: fetchErr } = await supabase
    .from('health_profile')
    .select('id, data')
    .eq('section', 'confirmed_diagnoses')
    .limit(1);

  if (fetchErr) {
    console.error('  Error fetching health_profile:', fetchErr.message);
    results.errors.push('health_profile fetch: ' + fetchErr.message);
    return;
  }

  if (!profile || profile.length === 0) {
    console.log('  No confirmed_diagnoses section found. Creating one.');
    const { error: insertErr } = await supabase
      .from('health_profile')
      .insert({
        section: 'confirmed_diagnoses',
        data: { diagnoses: ['POTS/Autonomic dysfunction - suspected'] }
      });

    if (insertErr) {
      console.error('  Error creating confirmed_diagnoses:', insertErr.message);
      results.errors.push('health_profile create: ' + insertErr.message);
    } else {
      console.log('  CREATED confirmed_diagnoses with POTS entry');
      results.healthProfile.push('Created confirmed_diagnoses with POTS');
    }
    return;
  }

  const row = profile[0];
  const data = row.data || {};
  const potsEntry = 'POTS/Autonomic dysfunction - suspected';

  const dataStr = JSON.stringify(data).toLowerCase();
  if (dataStr.includes('pots') || dataStr.includes('autonomic dysfunction')) {
    console.log('  POTS/Autonomic dysfunction already present. Skipping.');
    console.log('  Current data:', JSON.stringify(data).substring(0, 200));
    results.healthProfile.push('POTS already present - skipped');
    return;
  }

  let updatedData;
  if (Array.isArray(data.diagnoses)) {
    updatedData = { ...data, diagnoses: [...data.diagnoses, potsEntry] };
  } else if (Array.isArray(data.items)) {
    updatedData = { ...data, items: [...data.items, potsEntry] };
  } else if (Array.isArray(data)) {
    updatedData = [...data, potsEntry];
  } else {
    updatedData = { ...data, diagnoses: [...(data.diagnoses || []), potsEntry] };
  }

  const { error: updateErr } = await supabase
    .from('health_profile')
    .update({ data: updatedData })
    .eq('id', row.id);

  if (updateErr) {
    console.error('  Error updating health_profile:', updateErr.message);
    results.errors.push('health_profile update: ' + updateErr.message);
  } else {
    console.log('  UPDATED confirmed_diagnoses - added POTS/Autonomic dysfunction');
    results.healthProfile.push('Added POTS/Autonomic dysfunction to confirmed_diagnoses');
  }
}

// ============================================================
// 6. MEDICAL TIMELINE: Update Apr 7 ED Visit
// ============================================================
async function updateApr7EDVisit() {
  console.log('\n--- 6. Medical Timeline: Apr 7 2026 ED Visit ---');

  const fullDescription = 'ED visit at Adventist Health Castle, Kailua HI. Presented with acute vertigo, dizziness, near-syncope, palpitations, nausea. Triage vitals: HR 106 standing (48 resting = +58 delta, consistent with POTS), BP 127/85. Dr. Conklin (ED physician) evaluation: noted 2-month history of intermittent vertigo/dizziness/palpitations/near-syncope. Recent iron infusion Feb 27 with initial improvement then recurrence. Standing pulse 106 (tachycardic). Neuro exam intact. CT Head without contrast: normal, no acute intracranial abnormality. Chest X-ray PA/Lateral: normal heart size, clear lungs, no acute cardiopulmonary disease. Labs drawn: CBC, CMP, TSH, Magnesium. Assessment: Vertigo/dizziness with orthostatic tachycardia. Differential included POTS, vestibular migraine, residual iron deficiency effects. Discharge with outpatient cardiology and neurology referrals. Dr. Conklin noted presentation "consistent with possible autonomic dysfunction/POTS." Williams FNP had documented "R/O POTS" from first visit.';

  const { data: existing, error: fetchErr } = await supabase
    .from('medical_timeline')
    .select('id, title, description')
    .eq('event_date', '2026-04-07');

  if (fetchErr) {
    console.error('  Error fetching Apr 7 timeline:', fetchErr.message);
    results.errors.push('Apr 7 timeline fetch: ' + fetchErr.message);
    return;
  }

  if (!existing || existing.length === 0) {
    console.log('  No Apr 7 event found. Inserting new one.');
    const { error: insertErr } = await supabase
      .from('medical_timeline')
      .insert({
        event_date: '2026-04-07',
        event_type: 'hospitalization',
        title: 'ED visit - Adventist Health Castle (vertigo, near-syncope, POTS workup)',
        description: fullDescription
      });

    if (insertErr) {
      console.error('  Error inserting Apr 7 timeline:', insertErr.message);
      results.errors.push('Apr 7 timeline insert: ' + insertErr.message);
    } else {
      console.log('  INSERTED new Apr 7 ED visit event');
      results.timeline.push('Inserted Apr 7 ED visit event');
    }
    return;
  }

  const row = existing[0];
  console.log('  Found existing Apr 7 event: "' + row.title + '" (' + (row.description?.length || 0) + ' chars)');

  if (row.description && row.description.length >= fullDescription.length) {
    console.log('  Already has full description. Skipping.');
    results.timeline.push('Apr 7 ED visit: already full - skipped');
    return;
  }

  const { error: updateErr } = await supabase
    .from('medical_timeline')
    .update({ description: fullDescription })
    .eq('id', row.id);

  if (updateErr) {
    console.error('  Error updating Apr 7 timeline:', updateErr.message);
    results.errors.push('Apr 7 timeline update: ' + updateErr.message);
  } else {
    console.log('  UPDATED Apr 7 ED visit (' + (row.description?.length || 0) + ' -> ' + fullDescription.length + ' chars)');
    results.timeline.push('Updated Apr 7 ED visit with full clinical findings');
  }
}

// ============================================================
// RUN ALL
// ============================================================
async function main() {
  console.log('=== FINAL COMPREHENSIVE DATA IMPORT ===');
  console.log('Supabase URL: ' + supabaseUrl);
  console.log('Timestamp: ' + new Date().toISOString());

  await upsertDec11Timeline();
  await upsertFeb27Timeline();
  await importDec11Labs();
  await importDec31Labs();
  await updateHealthProfilePOTS();
  await updateApr7EDVisit();

  console.log('\n========================================');
  console.log('=== IMPORT SUMMARY ===');
  console.log('========================================');
  console.log('\nTimeline events: ' + (results.timeline.length > 0 ? results.timeline.join('; ') : 'none'));
  console.log('Lab results: ' + (results.labs.length > 0 ? results.labs.join('; ') : 'none'));
  console.log('Health profile: ' + (results.healthProfile.length > 0 ? results.healthProfile.join('; ') : 'none'));
  console.log('Errors: ' + (results.errors.length > 0 ? results.errors.join('; ') : 'NONE'));
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
