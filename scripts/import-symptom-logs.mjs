/**
 * Import 3-day symptom log data into Supabase
 * - medical_timeline: Apr 11 + Apr 12 symptom_onset entries
 * - health_profile: new food_triggers section
 * - health_profile: update medications (add Pepcid)
 * - health_profile: update patient_narrative (add food triggers + med response keys)
 * - active_problems: update Itching row with dermographism info
 *
 * Usage: node scripts/import-symptom-logs.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1)
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const summary = {
  inserted: [],
  skipped: [],
  updated: [],
  errors: [],
}

// ── 1. medical_timeline - Apr 11 symptom log ────────────────────────

async function insertTimelineApr11() {
  const label = 'medical_timeline Apr 11 symptom_onset'

  // Check for duplicate
  const { data: existing, error: checkErr } = await supabase
    .from('medical_timeline')
    .select('id')
    .eq('event_date', '2026-04-11')
    .eq('event_type', 'symptom_onset')

  if (checkErr) {
    summary.errors.push(`${label}: check failed - ${checkErr.message}`)
    return
  }

  if (existing && existing.length > 0) {
    summary.skipped.push(`${label}: already exists (id: ${existing[0].id})`)
    return
  }

  const { error: insertErr } = await supabase
    .from('medical_timeline')
    .insert({
      event_date: '2026-04-11',
      event_type: 'symptom_onset',
      title: 'Detailed symptom day: 2 food reactions, hydroxyzine protocol proven',
      description: 'Morning: woke with low-grade activation (muscle tenseness, small palpitations, fight-or-flight without anxiety). Zyrtec + matcha + morning rounds = fine for 2-3 hrs. ~1:30 PM: Ate egg roll + garlic green beans, flared within 2 MIN. HR 50-65 baseline to 60-80. Took hydroxyzine at 5 min mark, felt "a bajillion times better" in 10 min. All symptoms resolved including POTS-like symptoms. KEY: hydroxyzine also resolved POTS symptoms, not just histamine. ~5 PM: napped, felt heart while lying flat. ~8 PM: left hand itchy without visible hives (subcutaneous histamine / dermographism). ~9:45 PM: ate homemade ramen + wagyu dumplings, nose clogged and dizzy within 4 min. Blowing nose worsened dizziness (valsalva). 10:09 PM: 2nd hydroxyzine. 10:15: squirmy feeling, 10:19: squirmy gone, 10:21: nose clearing. Used medical ice pack face mask. Morning hand itchiness pattern noted.',
      significance: 'important',
    })

  if (insertErr) {
    summary.errors.push(`${label}: insert failed - ${insertErr.message}`)
  } else {
    summary.inserted.push(label)
  }
}

// ── 2. medical_timeline - Apr 12 symptom log ────────────────────────

async function insertTimelineApr12() {
  const label = 'medical_timeline Apr 12 symptom_onset'

  const { data: existing, error: checkErr } = await supabase
    .from('medical_timeline')
    .select('id')
    .eq('event_date', '2026-04-12')
    .eq('event_type', 'symptom_onset')

  if (checkErr) {
    summary.errors.push(`${label}: check failed - ${checkErr.message}`)
    return
  }

  if (existing && existing.length > 0) {
    summary.skipped.push(`${label}: already exists (id: ${existing[0].id})`)
    return
  }

  const { error: insertErr } = await supabase
    .from('medical_timeline')
    .insert({
      event_date: '2026-04-12',
      event_type: 'symptom_onset',
      title: 'Shower/POTS episode + 3 food reactions, Pepcid added to protocol',
      description: 'Woke 11:36 AM feeling good. Oura: +0.9F elevated temp. ~2 PM: shower triggered severe POTS - dizzy, tired, squirmy, air hungry. DISCOVERED heating pad was secretly on her legs causing vasodilation. Removed heat, ice on legs, fan on. Resolved WITHOUT hydroxyzine by 2:50 PM (NOT histamine - was heat/POTS). ~6:10 PM: 9g mates crackers caused immediate bloating. ~6:22 PM: margherita pizza caused reaction in 1 MIN (nose congestion, breathing hard, heart). 6:26 PM: stomach acid feeling (H2 response). 6:30 PM: FIRST Pepcid dose - KEY: needs H2 blockade alongside H1. Pepcid worked. ~7:50 PM: chocolate chip ice cream caused mild sternal aching at 8:09 (costochondritis - aggravated by pressure, hEDS related, lasted seconds). Protocols established: shower <5 min cool water, no heating pad during episodes, cold room + warm blankets, Pepcid for stomach acid.',
      significance: 'important',
    })

  if (insertErr) {
    summary.errors.push(`${label}: insert failed - ${insertErr.message}`)
  } else {
    summary.inserted.push(label)
  }
}

// ── 3. health_profile - food_triggers (new section) ─────────────────

async function insertFoodTriggers() {
  const label = 'health_profile food_triggers'

  const { data: existing, error: checkErr } = await supabase
    .from('health_profile')
    .select('section')
    .eq('section', 'food_triggers')

  if (checkErr) {
    summary.errors.push(`${label}: check failed - ${checkErr.message}`)
    return
  }

  if (existing && existing.length > 0) {
    summary.skipped.push(`${label}: section already exists`)
    return
  }

  const content = {
    confirmed_triggers: [
      { food: 'Garlic', type: 'histamine liberator', reaction_time: '2 minutes', date_confirmed: '2026-04-11' },
      { food: 'Egg rolls (soy sauce, cabbage, processed)', type: 'high histamine', reaction_time: '2 minutes', date_confirmed: '2026-04-11' },
      { food: 'Ramen broth (long-simmered)', type: 'very high histamine', reaction_time: '4 minutes', date_confirmed: '2026-04-11' },
      { food: 'Wagyu beef dumplings', type: 'processed/aged meat', reaction_time: '4 minutes', date_confirmed: '2026-04-11' },
      { food: 'Tomato sauce (pizza)', type: 'very high histamine + H2 trigger', reaction_time: '1 minute', date_confirmed: '2026-04-12' },
      { food: 'Mates crackers (yeast/malt)', type: 'histamine liberator', reaction_time: 'immediate', date_confirmed: '2026-04-12' },
      { food: 'Chocolate', type: 'histamine + liberator + theobromine', reaction_time: '19 minutes (mild)', date_confirmed: '2026-04-12' },
    ],
    safe_foods_observed: ['matcha', 'buttered morning rounds', 'plain bagel with chicken/cheese/spices', 'plain vanilla ice cream', 'bread and butter'],
    notes: 'Pattern: reactions occur within 1-5 minutes of eating trigger foods. Faster reaction = more severe trigger. Doctor (allergist) said food should not be restricted during diagnostic window, but these triggers are documented for reference.',
  }

  const { error: insertErr } = await supabase
    .from('health_profile')
    .insert({
      section: 'food_triggers',
      content: JSON.stringify(content),
      updated_at: new Date().toISOString(),
    })

  if (insertErr) {
    summary.errors.push(`${label}: insert failed - ${insertErr.message}`)
  } else {
    summary.inserted.push(label)
  }
}

// ── 4. health_profile - update medications (add Pepcid) ─────────────

async function updateMedications() {
  const label = 'health_profile medications (add Pepcid)'

  const { data: existing, error: fetchErr } = await supabase
    .from('health_profile')
    .select('content')
    .eq('section', 'medications')
    .single()

  if (fetchErr) {
    summary.errors.push(`${label}: fetch failed - ${fetchErr.message}`)
    return
  }

  let content = typeof existing.content === 'string' ? JSON.parse(existing.content) : existing.content

  // Check if Pepcid/Famotidine already in as_needed
  if (!content.as_needed) content.as_needed = []
  const alreadyExists = content.as_needed.some(
    (m) => m.name && m.name.toLowerCase().includes('famotidine')
  )

  if (alreadyExists) {
    summary.skipped.push(`${label}: Famotidine already present in as_needed`)
    return
  }

  content.as_needed.push({
    name: 'Famotidine (Pepcid)',
    dose: '20mg oral tablet',
    started: '2026-04-12',
    indication: 'H2 blocker for stomach acid during histamine flares. First used for tomato-triggered acid. Needed alongside H1 blockers (Zyrtec/hydroxyzine) for complete histamine coverage.',
  })

  const { error: updateErr } = await supabase
    .from('health_profile')
    .update({
      content: JSON.stringify(content),
      updated_at: new Date().toISOString(),
    })
    .eq('section', 'medications')

  if (updateErr) {
    summary.errors.push(`${label}: update failed - ${updateErr.message}`)
  } else {
    summary.updated.push(label)
  }
}

// ── 5. health_profile - update patient_narrative ────────────────────

async function updatePatientNarrative() {
  const label = 'health_profile patient_narrative (add food triggers + med response)'

  const { data: existing, error: fetchErr } = await supabase
    .from('health_profile')
    .select('content')
    .eq('section', 'patient_narrative')
    .single()

  if (fetchErr) {
    summary.errors.push(`${label}: fetch failed - ${fetchErr.message}`)
    return
  }

  let content = typeof existing.content === 'string' ? JSON.parse(existing.content) : existing.content

  // Check if already added
  if (content.food_triggers_identified && content.medication_response_pattern) {
    summary.skipped.push(`${label}: keys already present`)
    return
  }

  content.food_triggers_identified = '7 confirmed food triggers with exact reaction times documented Apr 11-12. Garlic (2 min), egg rolls (2 min), ramen broth (4 min), wagyu dumplings (4 min), tomato sauce (1 min), mates crackers (immediate), chocolate (19 min mild). Safe foods: matcha, buttered rolls, plain bagel, vanilla ice cream.'

  content.medication_response_pattern = 'Hydroxyzine resolves all symptoms including POTS-like symptoms in 10 minutes when caught early (vs 60+ min when caught late). POTS symptoms resolving with antihistamine = histamine-mediated dysautonomia, not pure POTS. Pepcid (H2 blocker) needed for stomach acid component that H1 blockers cannot address. Ice pack face mask is effective non-medication tool.'

  const { error: updateErr } = await supabase
    .from('health_profile')
    .update({
      content: JSON.stringify(content),
      updated_at: new Date().toISOString(),
    })
    .eq('section', 'patient_narrative')

  if (updateErr) {
    summary.errors.push(`${label}: update failed - ${updateErr.message}`)
  } else {
    summary.updated.push(label)
  }
}

// ── 6. active_problems - update Itching row ─────────────────────────

async function updateItchingProblem() {
  const label = 'active_problems Itching (add dermographism info)'

  const { data: rows, error: fetchErr } = await supabase
    .from('active_problems')
    .select('id, problem, latest_data')
    .ilike('problem', '%Itching%')

  if (fetchErr) {
    summary.errors.push(`${label}: fetch failed - ${fetchErr.message}`)
    return
  }

  if (!rows || rows.length === 0) {
    summary.errors.push(`${label}: no row found matching 'Itching'`)
    return
  }

  const row = rows[0]
  const appendText = ' Left hand subcutaneous histamine activity without visible hives documented Apr 11. Dermographism suspected. Morning hand itchiness pattern. Hand is where she typically gets hives but activation occurs before visible welts appear.'

  // Check if already appended
  if (row.latest_data && row.latest_data.includes('Dermographism suspected')) {
    summary.skipped.push(`${label}: dermographism info already present`)
    return
  }

  const newLatestData = (row.latest_data || '') + appendText

  const { error: updateErr } = await supabase
    .from('active_problems')
    .update({
      latest_data: newLatestData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (updateErr) {
    summary.errors.push(`${label}: update failed - ${updateErr.message}`)
  } else {
    summary.updated.push(`${label} (row: "${row.problem}")`)
  }
}

// ── Run all ─────────────────────────────────────────────────────────

async function main() {
  console.log('Starting symptom log import...\n')

  await insertTimelineApr11()
  await insertTimelineApr12()
  await insertFoodTriggers()
  await updateMedications()
  await updatePatientNarrative()
  await updateItchingProblem()

  console.log('=== IMPORT SUMMARY ===\n')

  if (summary.inserted.length > 0) {
    console.log(`INSERTED (${summary.inserted.length}):`)
    summary.inserted.forEach((s) => console.log(`  + ${s}`))
  }

  if (summary.updated.length > 0) {
    console.log(`\nUPDATED (${summary.updated.length}):`)
    summary.updated.forEach((s) => console.log(`  ~ ${s}`))
  }

  if (summary.skipped.length > 0) {
    console.log(`\nSKIPPED (duplicates) (${summary.skipped.length}):`)
    summary.skipped.forEach((s) => console.log(`  - ${s}`))
  }

  if (summary.errors.length > 0) {
    console.log(`\nERRORS (${summary.errors.length}):`)
    summary.errors.forEach((s) => console.log(`  ! ${s}`))
  }

  const total = summary.inserted.length + summary.updated.length + summary.skipped.length + summary.errors.length
  console.log(`\nTotal operations: ${total}`)
  console.log(`  Inserted: ${summary.inserted.length}`)
  console.log(`  Updated: ${summary.updated.length}`)
  console.log(`  Skipped: ${summary.skipped.length}`)
  console.log(`  Errors: ${summary.errors.length}`)

  if (summary.errors.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
