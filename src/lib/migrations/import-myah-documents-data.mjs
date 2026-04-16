/**
 * Import data from myAH portal documents (Lab Requisitions, Discharge Instructions,
 * Between Visit CCDs, IM Office Visit Note, ED Depart Summary)
 *
 * New data points identified:
 * 1. Menorrhagia (N92.0) - formal diagnosis from Lab Requisitions
 * 2. Appointment enrichment - addresses, phone numbers, types
 * 3. MRI Brain WO Contrast - pending order from 04/07/26
 * 4. Insurance correction - HMSA Quest + Self Pay (not just Self-pay)
 * 5. Medical identifiers - MRN, AHMRN, CID from CCDs
 * 6. Williams FNP Kelli C - lab ordering provider
 * 7. Pharmacy - Longs Drug Store #9825
 * 8. ICD codes for existing problems
 *
 * Usage: cd /Users/clancybond/lanaehealth && node src/lib/migrations/import-myah-documents-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Load env ---
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

const summary = {
  active_problems: { updated: 0, added: 0 },
  appointments: { updated: 0 },
  imaging_studies: { added: 0 },
  health_profile: { updated: 0 },
  medical_timeline: { added: 0 },
  medical_identifiers: { added: 0 },
};

async function run() {
  console.log('=== myAH Documents Data Import ===\n');

  // ============================
  // 1. Add Menorrhagia (N92.0) to active problems
  // ============================
  console.log('1. Checking for Menorrhagia in active_problems...');
  const { data: existingMenorrhagia } = await supabase
    .from('active_problems')
    .select('id, problem')
    .ilike('problem', '%menorrhagia%');

  if (!existingMenorrhagia?.length) {
    // Check if "Heavy menstrual bleeding" exists - update it with ICD code
    const { data: hmbProblem } = await supabase
      .from('active_problems')
      .select('id, problem')
      .ilike('problem', '%heavy menstrual%');

    if (hmbProblem?.length) {
      // Update existing problem to include formal ICD code
      const { error } = await supabase
        .from('active_problems')
        .update({
          problem: 'Menorrhagia / Heavy menstrual bleeding with clots',
          latest_data: 'Formal diagnosis: Menorrhagia with regular cycle (ICD-10: N92.0). Confirmed via Lab Requisitions document from Adventist Health. Ordering provider: Williams, FNP, Kelli C. CBC and Ferritin orders on 02/05/26 list N92.0 as associated diagnosis alongside iron deficiency anemia (D50.9).',
        })
        .eq('id', hmbProblem[0].id);
      if (!error) {
        console.log('   Updated "Heavy menstrual bleeding" with Menorrhagia (N92.0)');
        summary.active_problems.updated++;
      } else {
        console.log('   Error updating:', error.message);
      }
    } else {
      // Insert as new problem
      const { error } = await supabase
        .from('active_problems')
        .insert({
          problem: 'Menorrhagia with regular cycle (N92.0)',
          status: 'active',
          onset_date: '2025-06-01',
          latest_data: 'Formal diagnosis from Lab Requisitions. ICD-10: N92.0. Listed alongside iron deficiency anemia (D50.9) on lab orders by Williams, FNP, Kelli C.',
        });
      if (!error) {
        console.log('   Added Menorrhagia (N92.0) as new active problem');
        summary.active_problems.added++;
      }
    }
  } else {
    console.log('   Menorrhagia already exists, skipping');
  }

  // ============================
  // 2. Enrich appointments with addresses and phone numbers
  // ============================
  console.log('\n2. Enriching appointments with addresses/phones...');

  const appointmentEnrichments = [
    {
      date: '2026-04-30',
      specialty: 'OB/GYN',
      notes: 'Address: 642 Ulukahiki St, Kailua, HI 96734-4400 | Phone: (808) 263-5022 | Location: OBGYNUluk-CS (AH Kailua - Ulukahiki) | Type: WH New Patient | Description: Consult - Endometriosis evaluation',
    },
    {
      date: '2026-06-05',
      specialty: 'Internal Medicine',
      notes: 'Address: 30 Aulike St Ste 300, Kailua, HI 96734-2751 | Phone: (808) 263-5015 | Location: PrmCreKailAul-CS (AH Kailua - Aulike) | Type: IM Follow Up | Description: ReCheck',
    },
    {
      date: '2026-08-17',
      specialty: 'Cardiology',
      notes: 'Address: 642 Ulukahiki St, Kailua, HI 96734-4400 | Phone: (808) 263-5022 | Location: Spcity103Uluk-CS (AH Kailua - Ulukahiki) | Type: CD Follow Up | Description: Follow Up',
    },
    {
      date: '2026-04-13',
      specialty: 'Primary Care',
      notes: 'Address: 30 Aulike St Ste 300, Kailua, HI 96734-2751 | Phone: (808) 263-5015 | Location: PrmCreKailAul-CS (AH Kailua - Aulike) | Type: FP Follow Up | IM Office Visit Note by Alice Mendykowski, FNP | Post-ED follow up visit',
    },
  ];

  for (const enrich of appointmentEnrichments) {
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, notes')
      .eq('date', enrich.date)
      .ilike('specialty', `%${enrich.specialty.split('/').pop()}%`)
      .limit(1);

    if (existing?.length && !existing[0].notes) {
      const { error } = await supabase
        .from('appointments')
        .update({ notes: enrich.notes })
        .eq('id', existing[0].id);
      if (!error) {
        console.log(`   Updated ${enrich.date} ${enrich.specialty} with address/phone`);
        summary.appointments.updated++;
      }
    } else if (existing?.length) {
      console.log(`   ${enrich.date} ${enrich.specialty} already has notes, skipping`);
    }
  }

  // ============================
  // 3. Add MRI Brain as pending imaging study
  // ============================
  console.log('\n3. Checking for pending MRI Brain imaging study...');
  const { data: existingMri } = await supabase
    .from('imaging_studies')
    .select('id')
    .eq('modality', 'MRI')
    .ilike('body_part', '%Brain%');

  if (!existingMri?.length) {
    const { error } = await supabase
      .from('imaging_studies')
      .insert({
        study_date: '2027-04-09',
        modality: 'MRI',
        body_part: 'Brain',
        indication: 'Chronic dizziness (R42). Patient not claustrophobic, no pacemaker, no aneurysm clips.',
        findings_summary: null,
        ordering_provider: 'Kamireddy, MD, Adireddy',
        facility: 'Adventist Health Castle',
        status: 'ordered',
        report_text: 'MRI Brain WO Contrast (CPT: 70551). Ordered 04/07/26. Scheduled for 04/09/2027 at Radiology-CS.',
      });
    if (!error) {
      console.log('   Added MRI Brain (pending) imaging study');
      summary.imaging_studies.added++;
    } else {
      console.log('   Error:', error.message);
    }
  } else {
    console.log('   MRI Brain already exists, skipping');
  }

  // ============================
  // 4. Update health profile - insurance, pharmacy, providers
  // ============================
  console.log('\n4. Updating health profile...');

  // 4a. Fix insurance in personal section
  const { data: personalData } = await supabase
    .from('health_profile')
    .select('id, content')
    .eq('section', 'personal')
    .single();

  if (personalData) {
    const content = personalData.content;
    if (content.insurance === 'Self-pay (no insurance)' || content.insurance?.includes('Self-pay')) {
      content.insurance = 'HMSA Quest (primary) + Self Pay';
      content.pharmacy = 'Longs Drug Store #9825';
      const { error } = await supabase
        .from('health_profile')
        .update({ content })
        .eq('id', personalData.id);
      if (!error) {
        console.log('   Updated insurance to HMSA Quest + Self Pay, added pharmacy');
        summary.health_profile.updated++;
      }
    } else {
      console.log('   Insurance already updated');
    }
  }

  // 4b. Add Williams FNP Kelli C to providers
  const { data: provData } = await supabase
    .from('health_profile')
    .select('id, content')
    .eq('section', 'providers')
    .single();

  if (provData) {
    const content = provData.content;
    const hasWilliams = content.care_team?.some(p => p.name?.includes('Williams'));
    if (!hasWilliams) {
      if (!content.care_team) content.care_team = [];
      content.care_team.push({
        name: 'Williams, FNP, Kelli C',
        clinic: 'AH Hospital Laboratory',
        specialty: 'Family Practice / Lab Orders',
        notes: 'Ordered CBC, Ferritin, B12, Vit D, Iron labs on 02/05/26 and 02/24/26. Dx: IDA (D50.9), Menorrhagia (N92.0), Fe deficiency (D50.9)',
      });
      const { error } = await supabase
        .from('health_profile')
        .update({ content })
        .eq('id', provData.id);
      if (!error) {
        console.log('   Added Williams, FNP, Kelli C to providers');
        summary.health_profile.updated++;
      }
    } else {
      console.log('   Williams FNP already in providers');
    }
  }

  // ============================
  // 5. Add medical identifiers from CCDs
  // ============================
  console.log('\n5. Adding medical identifiers...');

  const identifiers = [
    { id_type: 'MRN', id_value: '361279', issuer: 'Adventist Health Castle (45 MRN)' },
    { id_type: 'AHMRN', id_value: '12289139', issuer: 'Adventist Health Medical Record Number' },
    { id_type: 'CID', id_value: '53331948', issuer: 'Cerner Identity' },
  ];

  for (const ident of identifiers) {
    const { data: existing } = await supabase
      .from('medical_identifiers')
      .select('id')
      .eq('id_type', ident.id_type)
      .eq('id_value', ident.id_value);

    if (!existing?.length) {
      const { error } = await supabase
        .from('medical_identifiers')
        .insert(ident);
      if (!error) {
        console.log(`   Added ${ident.id_type}: ${ident.id_value}`);
        summary.medical_identifiers.added++;
      } else {
        console.log(`   Error adding ${ident.id_type}:`, error.message);
      }
    } else {
      console.log(`   ${ident.id_type} already exists`);
    }
  }

  // ============================
  // 6. Add timeline event for IM Office Visit Note
  // ============================
  console.log('\n6. Checking for IM Office Visit timeline event...');
  const { data: existingImNote } = await supabase
    .from('medical_timeline')
    .select('id')
    .eq('event_date', '2026-04-13')
    .ilike('title', '%IM Office Visit%');

  if (!existingImNote?.length) {
    // Already exists from prior import, skip
    console.log('   IM Office Visit timeline event already exists or checking...');
    const { data: apr13Events } = await supabase
      .from('medical_timeline')
      .select('title')
      .eq('event_date', '2026-04-13');
    const hasImNote = apr13Events?.some(e => e.title?.includes('Office Visit') || e.title?.includes('Mendykowski'));
    if (!hasImNote) {
      const { error } = await supabase
        .from('medical_timeline')
        .insert({
          event_date: '2026-04-13',
          event_type: 'appointment',
          title: 'IM Office Visit Note - Post-ED Follow Up',
          description: 'Internal Medicine Office Visit Note by Alice Mendykowski, FNP at PrmCreKailAul-CS (AH Kailua - Aulike). Post-ED follow up. New medications ordered: cetirizine 10mg daily, hydroxyzine 10mg bedtime. Lab requisitions issued for follow-up CBC, Ferritin, B12, Vitamin D, Iron. Formal diagnoses documented: IDA (D50.9), Menorrhagia (N92.0), Dizziness (R42). CT Brain and MRI Brain orders by Dr. Kamireddy.',
          provider: 'Mendykowski, FNP, Alice D',
        });
      if (!error) {
        console.log('   Added IM Office Visit Note timeline event');
        summary.medical_timeline.added++;
      }
    } else {
      console.log('   IM Office Visit already in timeline');
    }
  }

  // ============================
  // Summary
  // ============================
  console.log('\n=== IMPORT SUMMARY ===');
  console.log('Active problems:', summary.active_problems);
  console.log('Appointments:', summary.appointments);
  console.log('Imaging studies:', summary.imaging_studies);
  console.log('Health profile:', summary.health_profile);
  console.log('Medical timeline:', summary.medical_timeline);
  console.log('Medical identifiers:', summary.medical_identifiers);
  console.log('\nDone!');
}

run().catch(console.error);
