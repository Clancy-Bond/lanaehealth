/**
 * Import Lanae's personal health narrative into Supabase.
 *
 * Performs 7 operations:
 * 1. INSERT health_profile section: patient_narrative
 * 2. INSERT health_profile section: eds_indicators
 * 3. INSERT health_profile section: treatment_preferences
 * 4. UPDATE health_profile section: suspected_conditions (append to array)
 * 5. UPDATE health_profile section: menstrual_history (merge new keys)
 * 6. INSERT 3 active_problems rows (with duplicate check)
 * 7. INSERT 3 medical_timeline entries (with duplicate check)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
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
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const summary = [];
let errors = 0;

function log(msg) {
  console.log(msg);
  summary.push(msg);
}

function logError(msg) {
  console.error('ERROR: ' + msg);
  summary.push('ERROR: ' + msg);
  errors++;
}

// ─── 1. INSERT patient_narrative ─────────────────────────────────────────────
async function insertPatientNarrative() {
  log('\n--- Step 1: INSERT health_profile section: patient_narrative ---');

  const { data: existing } = await supabase
    .from('health_profile')
    .select('id')
    .eq('section', 'patient_narrative')
    .maybeSingle();

  if (existing) {
    log('  SKIPPED: patient_narrative already exists (id: ' + existing.id + ')');
    return;
  }

  const content = {
    gi_symptoms: "Stomach expansion with air during period flares and luteal phase. 5+ hours of pain unresponsive to painkillers. Only extreme hot water helps. Cannot eat or drink even tiny sips. Expansion also triggered by foods body doesn't tolerate - expands in seconds even with normal meals. Flight + period = uncomfortable abdominal air pressure. Pattern: 5+ years.",
    flare_symptoms: "Hot/cold flashes, energy drained, shaky, weak, unable to walk or do anything easily.",
    sensory_changes: "Heightened smell in past 2 years - can smell things husband cannot. Sensitive to bad smells.",
    skin_histamine: "2-3 years severe itchy acne. Needles of itchiness with NO visible marks (no rash, no redness) - face, arms, hands. Skin rash propensity for 6+ years. Contact reaction at juicery. Pigmentation spots on back/stomach (resolved with Accutane).",
    chronic_fatigue: "6+ years of bouts of exhaustion. Rarely had natural energy. A work shift = extreme exhaustion from standing. Neck/spine pain. Needed full-day rest to recover.",
    migraine_history: "Daily migraines for multiple years, especially during luteal phase. One year: migraine nearly every day, daily painkillers required. Severe migraines with aura (vision white-out) for 6-7 years. Started in middle school - some so bad caused vomiting for hours. Migraines continued into next day if severe.",
    sexual_health: "Cyclical dyspareunia: some months intercourse is fine and painless, other months ANY penetration causes burning/cutting pain at vaginal opening. Not a tensing problem - can fully relax. Feels dry inside despite normal discharge. Lube does not help during bad months. Occasional deep vaginal pain.",
    bladder_symptoms: "Urination issues for ~2 years. First UTI 2 years ago. Now: holding urine causes pulsing bladder pain that persists 2+ hours after emptying. Dehydration triggers UTI-like symptoms. Recent: abnormal urine flow, has to find the stream and push. Increasing frequency.",
    period_flu: "Every period: energy drained, super sweaty and hot.",
    dry_eyes: "Has dry eyes.",
    illness_resistance: "Rarely gets sick from common cold/illness.",
    temperature_dysregulation: "Always freezing growing up. Facial flushing starting in middle school through high school."
  };

  const { error } = await supabase
    .from('health_profile')
    .insert({ section: 'patient_narrative', content });

  if (error) {
    logError('Failed to insert patient_narrative: ' + error.message);
  } else {
    log('  INSERTED: patient_narrative (12 symptom categories)');
  }
}

// ─── 2. INSERT eds_indicators ────────────────────────────────────────────────
async function insertEdsIndicators() {
  log('\n--- Step 2: INSERT health_profile section: eds_indicators ---');

  const { data: existing } = await supabase
    .from('health_profile')
    .select('id')
    .eq('section', 'eds_indicators')
    .maybeSingle();

  if (existing) {
    log('  SKIPPED: eds_indicators already exists (id: ' + existing.id + ')');
    return;
  }

  const content = {
    hypermobility: [
      "Can sublux fingers from sockets",
      "Thumb bends to forearm",
      "Thumb folds into palm (hitchhiker thumb)",
      "Both arms go fully behind head",
      "Reaches every part of back with hands",
      "Scorpion pose (toes to head) lifelong",
      "Side split for at least 1 second lifelong",
      "W-sitting position with legs at sides",
      "Weaves legs together when sitting",
      "Prayer hands behind back easily",
      "Can partially dislocate shoulder with crunching",
      "Butterfly stretch with forward fold easily",
      "Middle splits in 2nd grade for 1-2 years",
      "Can pull own dresses on/off over head"
    ],
    clicking_popping: "Arms click/pop during exercises. Body pops and clicks with random movements.",
    childhood_signs: [
      "Heavy pencil pressure required as a kid",
      "Horrific leg growing pains (near writhing)",
      "Permanent stretch marks along spine from rapid growth at 13",
      "Always clumsy - bumping legs/hips into things",
      "Last in all sports, intense exercise intolerance",
      "Loved spinning for long periods at recess and on toys",
      "Neck sprained 2x as child (once from head circles, once waking from sleep)",
      "Head locked tilted for days both times"
    ],
    postural: "Standing normally feels extremely exhausting. Leans one leg forward to stand. Legs appeared to bend backwards when weight gained.",
    neck_issues: "Persistent neck discomfort needing to crack but relief does not last. This is how it sprained the first time (seeking relief).",
    head_pressure: "Gymnastics in 6th grade - head filled with pressure/pain when upside down.",
    tight_hamstrings: true,
    specialist_researched: "Dr. Sophia B. Hufnagel was researched as a potential EDS genetics specialist in Honolulu but no appointment has been made"
  };

  const { error } = await supabase
    .from('health_profile')
    .insert({ section: 'eds_indicators', content });

  if (error) {
    logError('Failed to insert eds_indicators: ' + error.message);
  } else {
    log('  INSERTED: eds_indicators (14 hypermobility signs, 8 childhood signs, 6 other fields)');
  }
}

// ─── 3. INSERT treatment_preferences ─────────────────────────────────────────
async function insertTreatmentPreferences() {
  log('\n--- Step 3: INSERT health_profile section: treatment_preferences ---');

  const { data: existing } = await supabase
    .from('health_profile')
    .select('id')
    .eq('section', 'treatment_preferences')
    .maybeSingle();

  if (existing) {
    log('  SKIPPED: treatment_preferences already exists (id: ' + existing.id + ')');
    return;
  }

  const content = {
    endometriosis_surgery: "Wants excision specialist only (not ablation). Must be careful about fertility. Do NOT touch fallopian tubes or ovaries. No IVF as first option. Prefers robotic excision specialist.",
    fertility: "Fertility preservation is critical priority."
  };

  const { error } = await supabase
    .from('health_profile')
    .insert({ section: 'treatment_preferences', content });

  if (error) {
    logError('Failed to insert treatment_preferences: ' + error.message);
  } else {
    log('  INSERTED: treatment_preferences (endometriosis_surgery, fertility)');
  }
}

// ─── 4. UPDATE suspected_conditions ──────────────────────────────────────────
async function updateSuspectedConditions() {
  log('\n--- Step 4: UPDATE health_profile section: suspected_conditions ---');

  const { data: row, error: fetchErr } = await supabase
    .from('health_profile')
    .select('id, content')
    .eq('section', 'suspected_conditions')
    .maybeSingle();

  if (fetchErr) {
    logError('Failed to fetch suspected_conditions: ' + fetchErr.message);
    return;
  }

  if (!row) {
    logError('suspected_conditions section not found in health_profile');
    return;
  }

  let arr = Array.isArray(row.content) ? [...row.content] : [];
  const existing = arr.map(s => s.toLowerCase());

  const toAdd = [
    {
      text: "Ehlers-Danlos Syndrome (EDS) - extensive self-reported hypermobility, childhood signs, clicking/popping joints, neck instability",
      keywords: ["ehlers", "eds"]
    },
    {
      text: "Dyspareunia (cyclical) - painful intercourse fluctuating monthly, burning/cutting pain, possible endo-related",
      keywords: ["dyspareunia"]
    },
    {
      text: "Interstitial cystitis / bladder dysfunction - pulsing bladder pain, UTI-like symptoms without infection, urinary flow changes x2 years",
      keywords: ["interstitial cystitis", "bladder dysfunction"]
    },
    {
      text: "Mast Cell Activation Syndrome (MCAS) - histamine-like itching without visible marks, food sensitivities, heightened smell, skin reactivity",
      keywords: ["mcas", "mast cell"]
    }
  ];

  let added = 0;
  for (const item of toAdd) {
    const alreadyHas = existing.some(e => item.keywords.some(kw => e.includes(kw)));
    if (alreadyHas) {
      log('  SKIPPED (already present): ' + item.keywords[0].toUpperCase());
    } else {
      arr.push(item.text);
      added++;
      log('  ADDED: ' + item.text.split(' - ')[0]);
    }
  }

  if (added > 0) {
    const { error: updateErr } = await supabase
      .from('health_profile')
      .update({ content: arr })
      .eq('id', row.id);

    if (updateErr) {
      logError('Failed to update suspected_conditions: ' + updateErr.message);
    } else {
      log('  UPDATED: suspected_conditions (' + added + ' new conditions added, ' + arr.length + ' total)');
    }
  } else {
    log('  NO CHANGES: all conditions already present');
  }
}

// ─── 5. UPDATE menstrual_history ─────────────────────────────────────────────
async function updateMenstrualHistory() {
  log('\n--- Step 5: UPDATE health_profile section: menstrual_history ---');

  const { data: row, error: fetchErr } = await supabase
    .from('health_profile')
    .select('id, content')
    .eq('section', 'menstrual_history')
    .maybeSingle();

  if (fetchErr) {
    logError('Failed to fetch menstrual_history: ' + fetchErr.message);
    return;
  }

  if (!row) {
    logError('menstrual_history section not found in health_profile');
    return;
  }

  const obj = typeof row.content === 'object' && row.content !== null ? { ...row.content } : {};

  const newKeys = {
    luteal_phase_symptoms: "Life-draining fatigue, longer sleep, emotional lability (easy crying), migraines, stomach air/expansion, feeling off",
    period_flu: "Every period: sweaty, hot, energy completely drained",
    endometriosis_symptoms: "Severe abdominal expansion during bad periods with pressure on anus/vagina, pain unresponsive to painkillers, 5+ hours duration, only extreme hot water helps"
  };

  let added = 0;
  for (const [key, value] of Object.entries(newKeys)) {
    if (obj[key]) {
      log('  SKIPPED (key exists): ' + key);
    } else {
      obj[key] = value;
      added++;
      log('  ADDED key: ' + key);
    }
  }

  if (added > 0) {
    const { error: updateErr } = await supabase
      .from('health_profile')
      .update({ content: obj })
      .eq('id', row.id);

    if (updateErr) {
      logError('Failed to update menstrual_history: ' + updateErr.message);
    } else {
      log('  UPDATED: menstrual_history (' + added + ' new keys added)');
    }
  } else {
    log('  NO CHANGES: all keys already present');
  }
}

// ─── 6. INSERT active_problems ───────────────────────────────────────────────
async function insertActiveProblems() {
  log('\n--- Step 6: INSERT active_problems rows ---');

  const { data: existingProblems, error: fetchErr } = await supabase
    .from('active_problems')
    .select('problem');

  if (fetchErr) {
    logError('Failed to fetch active_problems: ' + fetchErr.message);
    return;
  }

  const existingLower = (existingProblems || []).map(p => p.problem.toLowerCase());

  const problems = [
    {
      problem: "Migraines with aura",
      status: "active",
      onset_date: "2019-01-01",
      latest_data: "6-7 year history. Daily migraines for multiple years especially luteal phase. Severe migraines with visual aura (white-out) since middle school. Some caused vomiting. Started middle school age. One year had migraine nearly every day requiring daily painkillers.",
      keywords: ["migraine", "aura"]
    },
    {
      problem: "Dyspareunia (cyclical painful intercourse)",
      status: "investigating",
      onset_date: null,
      latest_data: "Cyclical pattern: some months fine, other months ANY penetration causes burning/cutting pain at vaginal opening. Can fully relax (not vaginismus). Feels dry inside despite normal discharge. Lube ineffective during bad months. Occasional deep vaginal pain.",
      keywords: ["dyspareunia", "painful intercourse"]
    },
    {
      problem: "Bladder dysfunction / urinary symptoms",
      status: "active",
      onset_date: "2024-01-01",
      latest_data: "First UTI ~2 years ago. Now: holding urine causes pulsing bladder pain persisting 2+ hours after emptying. Dehydration triggers UTI-like symptoms. Abnormal urine flow - has to find the stream and push. Increasing frequency.",
      keywords: ["bladder", "urinary"]
    }
  ];

  let inserted = 0;
  for (const prob of problems) {
    const isDuplicate = existingLower.some(e => prob.keywords.some(kw => e.includes(kw)));
    if (isDuplicate) {
      log('  SKIPPED (duplicate): ' + prob.problem);
      continue;
    }

    const { error: insertErr } = await supabase
      .from('active_problems')
      .insert({
        problem: prob.problem,
        status: prob.status,
        onset_date: prob.onset_date,
        latest_data: prob.latest_data
      });

    if (insertErr) {
      logError('Failed to insert problem "' + prob.problem + '": ' + insertErr.message);
    } else {
      inserted++;
      log('  INSERTED: ' + prob.problem + ' [' + prob.status + ']');
    }
  }

  log('  Total active_problems inserted: ' + inserted);
}

// ─── 7. INSERT medical_timeline entries ──────────────────────────────────────
async function insertMedicalTimeline() {
  log('\n--- Step 7: INSERT medical_timeline entries ---');

  // Check for existing symptom_onset entries on these dates
  const dates = ['2026-04-13', '2026-04-14', '2026-04-15'];

  const { data: existingEntries, error: fetchErr } = await supabase
    .from('medical_timeline')
    .select('event_date, title')
    .eq('event_type', 'symptom_onset')
    .in('event_date', dates);

  if (fetchErr) {
    logError('Failed to fetch medical_timeline: ' + fetchErr.message);
    return;
  }

  const existingDates = new Set((existingEntries || []).map(e => e.event_date));

  const entries = [
    {
      event_date: "2026-04-13",
      event_type: "symptom_onset",
      title: "Daily symptom log: Blacked out 4x, SOB, GI expansion",
      description: "Patient-reported: Blacked out 4 times after standing from laying/sitting. SOB throughout day needing fan 4x. Head pressure/pain especially morning with stabs when moving head sideways. Stomach expanded intensely after pesto + Haagen-Dazs ice cream (8pm-12am, looked pregnant). Neko Keneko Hojicha oat milk caused bubbly feeling. Zyrtec 8:30am, hydroxyzine 9:40pm. Morning hand itchiness.",
      significance: null,
      linked_data: null
    },
    {
      event_date: "2026-04-14",
      event_type: "symptom_onset",
      title: "Daily symptom log: Head pressure, air hunger, extreme fatigue",
      description: "Patient-reported: Head hurt with lots of pressure in morning. Elevating bed helped. Cooling down helped. Long air hunger episode needing fan. Extremely low energy - winded and exhausted from standing to use restroom and wash hands. Neck persistently uncomfortable.",
      significance: null,
      linked_data: null
    },
    {
      event_date: "2026-04-15",
      event_type: "symptom_onset",
      title: "Daily symptom log: SOB episode at 12:30",
      description: "Patient-reported: Shortness of breath around 12:30. Very long episode. Only helped by removing warm layers and putting cool pack on stomach. Head was hot with bonnet which may have worsened it. Woke up good but head was elevated during the night.",
      significance: null,
      linked_data: null
    }
  ];

  let inserted = 0;
  for (const entry of entries) {
    if (existingDates.has(entry.event_date)) {
      log('  SKIPPED (symptom_onset already exists on ' + entry.event_date + '): ' + entry.title);
      continue;
    }

    const { error: insertErr } = await supabase
      .from('medical_timeline')
      .insert(entry);

    if (insertErr) {
      logError('Failed to insert timeline entry for ' + entry.event_date + ': ' + insertErr.message);
    } else {
      inserted++;
      log('  INSERTED: [' + entry.event_date + '] ' + entry.title);
    }
  }

  log('  Total medical_timeline entries inserted: ' + inserted);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('========================================');
  console.log('  Health Narrative Import Script');
  console.log('  Target: ' + SUPABASE_URL);
  console.log('========================================\n');

  await insertPatientNarrative();
  await insertEdsIndicators();
  await insertTreatmentPreferences();
  await updateSuspectedConditions();
  await updateMenstrualHistory();
  await insertActiveProblems();
  await insertMedicalTimeline();

  console.log('\n========================================');
  console.log('  IMPORT SUMMARY');
  console.log('========================================');
  for (const line of summary) {
    console.log(line);
  }
  console.log('\n' + (errors === 0 ? 'All operations completed successfully.' : errors + ' error(s) encountered.'));
  console.log('========================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
