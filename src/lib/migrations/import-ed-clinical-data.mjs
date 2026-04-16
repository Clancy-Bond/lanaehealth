/**
 * Import ED clinical data (Apr 7 + Apr 9 physician notes, iron infusion,
 * Apr 3 IM visit, and new providers)
 *
 * Checks for duplicates before inserting; updates existing records where appropriate.
 *
 * Usage: cd /Users/clancybond/lanaehealth && node src/lib/migrations/import-ed-clinical-data.mjs
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
  medical_timeline: { updated: 0, added: 0, skipped: 0 },
  health_profile: { providers_added: 0, providers_skipped: 0 },
};

async function run() {
  console.log('=== ED Clinical Data Import ===\n');

  // ============================
  // 1. Apr 07 ED Visit - Update existing hospitalization with full physician note
  // ============================
  console.log('--- 1. Apr 07 ED Visit (Dr. Conklin) ---');

  const apr7Description = [
    'ED Visit #1 with Dr. Ryan C. Conklin, MD (Emergency Medicine) at Adventist Health Castle.',
    'CC: Chest pain + bilateral arm pain. Walk-in presentation.',
    'History: IDA status post iron infusion 3-4 weeks prior. Reports histamine-like reactions to certain foods.',
    'POTS suspicion documented by ED physician.',
    '',
    'Triage vitals: HR 112, BP 127/104, RR 24, SpO2 normal.',
    'Orthostatic vitals: supine HR 91, sitting HR 101, standing HR 106.',
    'Physician note: "consistent with possible autonomic dysfunction/POTS".',
    '',
    'EKG: NSR at 125 bpm on triage, improved to 60 bpm after IV fluids.',
    'Chest X-ray: Normal cardiomediastinal silhouette, no acute cardiopulmonary abnormality.',
    'Mild dextroscoliosis noted (read by Mario Grosso, radiologist).',
    '',
    'Differential: POTS syndrome, dehydration.',
    'Labs: Hypokalemia K 3.3 (low), elevated Calcium 10.2.',
    'Treatment: IV fluids, Tylenol, Toradol (ketorolac), Meclizine, oral potassium.',
    '',
    'Dx: Palpitations R00.2, improved with treatment.',
    'Disposition: Discharged home in stable condition.',
  ].join('\n');

  const { data: apr7Events } = await supabase
    .from('medical_timeline')
    .select('id, title, description')
    .eq('event_date', '2026-04-07')
    .eq('event_type', 'hospitalization');

  if (apr7Events && apr7Events.length > 0) {
    // Find the main ED Visit #1 entry (not the depart summary)
    const target = apr7Events.find(e => e.title.includes('ED Visit #1')) || apr7Events[0];
    const { error } = await supabase
      .from('medical_timeline')
      .update({
        title: 'ED Visit #1 - Dr. Ryan Conklin - POTS-consistent orthostatic vitals',
        description: apr7Description,
      })
      .eq('id', target.id);

    if (error) {
      console.error('  ERROR updating Apr 7 event:', error.message);
    } else {
      console.log('  UPDATED existing Apr 7 hospitalization (id: ' + target.id + ')');
      summary.medical_timeline.updated++;
    }
  } else {
    // No existing event found - insert new
    const { error } = await supabase.from('medical_timeline').insert({
      event_date: '2026-04-07',
      event_type: 'hospitalization',
      title: 'ED Visit #1 - Dr. Ryan Conklin - POTS-consistent orthostatic vitals',
      description: apr7Description,
      significance: 'important',
    });

    if (error) {
      console.error('  ERROR inserting Apr 7 event:', error.message);
    } else {
      console.log('  INSERTED new Apr 7 hospitalization event');
      summary.medical_timeline.added++;
    }
  }

  // ============================
  // 2. Apr 09 ED Visit - Update existing hospitalization with full physician note
  // ============================
  console.log('\n--- 2. Apr 09 ED Visit (Dr. LaBounty) ---');

  const apr9Description = [
    'ED Visit #2 with Dr. LaShell LaBounty, DO (Emergency Medicine) at Adventist Health Castle.',
    'CC: Allergic reaction with throat tightness, palpitations, and SOB starting at 1830.',
    'Took 75 mg Benadryl (diphenhydramine) before arrival.',
    'Throat pressure developed after eating dinner.',
    'Started Allegra (fexofenadine) + Pepcid (famotidine) 2 days prior.',
    '',
    'References Dr. Kamireddy Apr 3 IM note: MCAS concern documented,',
    'Zio patch ordered for cardiac monitoring, MRI Brain ordered,',
    'neurology referral recommended.',
    '',
    'Vitals: HR 93, BP 141/93 (elevated/hypertensive on triage).',
    'EKG: Sinus rhythm at 96 bpm, borderline, unchanged from 4/7 study.',
    '',
    'Labs: Normal CBC, normal CMP, D-Dimer 360 (normal).',
    'TSH 5.100 (borderline high, ref 0.450-5.330).',
    'Chloride 109 (high).',
    '',
    'Differential: Allergic reaction, vocal cord dysfunction, arrhythmia.',
    'Physician assessment: Anaphylaxis unlikely.',
    '',
    'Dx: Palpitations R00.2 + Throat tightness R09.89.',
    'Disposition: Discharged home.',
  ].join('\n');

  const { data: apr9Events } = await supabase
    .from('medical_timeline')
    .select('id, title, description')
    .eq('event_date', '2026-04-09')
    .eq('event_type', 'hospitalization');

  if (apr9Events && apr9Events.length > 0) {
    // Find the main ED Visit #2 entry (not the depart summary)
    const target = apr9Events.find(e => e.title.includes('ED Visit #2')) || apr9Events[0];
    const { error } = await supabase
      .from('medical_timeline')
      .update({
        title: 'ED Visit #2 - Dr. LaShell LaBounty - Allergic reaction workup',
        description: apr9Description,
      })
      .eq('id', target.id);

    if (error) {
      console.error('  ERROR updating Apr 9 event:', error.message);
    } else {
      console.log('  UPDATED existing Apr 9 hospitalization (id: ' + target.id + ')');
      summary.medical_timeline.updated++;
    }
  } else {
    const { error } = await supabase.from('medical_timeline').insert({
      event_date: '2026-04-09',
      event_type: 'hospitalization',
      title: 'ED Visit #2 - Dr. LaShell LaBounty - Allergic reaction workup',
      description: apr9Description,
      significance: 'important',
    });

    if (error) {
      console.error('  ERROR inserting Apr 9 event:', error.message);
    } else {
      console.log('  INSERTED new Apr 9 hospitalization event');
      summary.medical_timeline.added++;
    }
  }

  // ============================
  // 3. Iron infusion event (~Feb 15, 2026)
  // ============================
  console.log('\n--- 3. Iron infusion event (~Feb 15) ---');

  // Check for existing iron infusion events anywhere in Jan-Mar 2026
  const { data: ironEvents } = await supabase
    .from('medical_timeline')
    .select('id, event_date, title')
    .gte('event_date', '2026-01-01')
    .lte('event_date', '2026-03-31')
    .ilike('title', '%iron%infusion%');

  if (ironEvents && ironEvents.length > 0) {
    console.log('  SKIPPED - iron infusion event already exists:');
    ironEvents.forEach(e => console.log('    ' + e.event_date + ' | ' + e.title));
    summary.medical_timeline.skipped++;
  } else {
    const { error } = await supabase.from('medical_timeline').insert({
      event_date: '2026-02-15',
      event_type: 'medication_change',
      title: 'Iron infusion administered',
      description: [
        'Iron IV infusion. Referenced in both ED physician notes',
        '(Apr 7 by Dr. Conklin, Apr 9 by Dr. LaBounty).',
        'Patient had improvement in syncopal episodes after infusion',
        'but continued dizziness/vertigo.',
        'Approximate date: described as "3-4 weeks before Apr 7".',
      ].join(' '),
      significance: 'important',
    });

    if (error) {
      console.error('  ERROR inserting iron infusion:', error.message);
    } else {
      console.log('  INSERTED iron infusion event (2026-02-15)');
      summary.medical_timeline.added++;
    }
  }

  // ============================
  // 4. Apr 03 IM Visit with Dr. Kamireddy
  // ============================
  console.log('\n--- 4. Apr 03 IM Visit (Dr. Kamireddy) ---');

  const { data: apr3Events } = await supabase
    .from('medical_timeline')
    .select('id, title')
    .eq('event_date', '2026-04-03')
    .eq('event_type', 'appointment');

  const apr3Exists = apr3Events && apr3Events.some(e =>
    e.title.toLowerCase().includes('kamireddy') || e.title.toLowerCase().includes('im visit')
  );

  if (apr3Exists) {
    console.log('  SKIPPED - Apr 3 IM visit already exists');
    summary.medical_timeline.skipped++;
  } else {
    const apr3Description = [
      'Internal Medicine visit with Kamireddy, MD.',
      'Assessment:',
      '1) Dizziness R42 - features consistent with central origin,',
      '   ordered MRI Brain, recommended neurology referral.',
      '2) Palpitations R00.2 - ordered Holter/Zio patch monitoring.',
      '3) Pruritus L29.9 - skin hypersensitivity with symptoms concerning',
      '   for MAST CELL ACTIVATION SYNDROME, referred to allergy.',
      '4) Dysmenorrhea N94.6 - advised gynecology,',
      '   looking for endometriosis specialist.',
    ].join('\n');

    const { error } = await supabase.from('medical_timeline').insert({
      event_date: '2026-04-03',
      event_type: 'appointment',
      title: 'IM Visit with Dr. Kamireddy - MCAS concern, MRI + Zio ordered',
      description: apr3Description,
      significance: 'important',
    });

    if (error) {
      console.error('  ERROR inserting Apr 3 event:', error.message);
    } else {
      console.log('  INSERTED Apr 3 IM visit event');
      summary.medical_timeline.added++;
    }
  }

  // ============================
  // 5. Add providers to health_profile care_team
  // ============================
  console.log('\n--- 5. Add providers to care_team ---');

  const newProviders = [
    {
      name: 'Conklin, MD, Ryan C',
      specialty: 'Emergency Medicine',
      notes: 'ED physician Apr 7 visit. Documented POTS-consistent orthostatic vitals.',
    },
    {
      name: 'LaBounty, DO, LaShell',
      specialty: 'Emergency Medicine',
      notes: 'ED physician Apr 9 visit. Discussed vocal cord dysfunction differential.',
    },
    {
      name: 'Grosso, Mario',
      specialty: 'Radiology',
      notes: 'Signed chest X-ray report Apr 7.',
    },
  ];

  const { data: providerRows, error: provErr } = await supabase
    .from('health_profile')
    .select('id, content')
    .eq('section', 'providers')
    .single();

  if (provErr) {
    console.error('  ERROR fetching providers:', provErr.message);
  } else {
    const content = providerRows.content;
    const careTeam = content.care_team || [];

    for (const newProv of newProviders) {
      // Check if provider already exists in care_team (by last name match)
      const lastName = newProv.name.split(',')[0].toLowerCase().trim();
      const exists = careTeam.some(p => p.name.toLowerCase().includes(lastName));

      if (exists) {
        console.log('  SKIPPED (already in care_team): ' + newProv.name);
        summary.health_profile.providers_skipped++;
      } else {
        careTeam.push(newProv);
        console.log('  ADDED to care_team: ' + newProv.name);
        summary.health_profile.providers_added++;
      }
    }

    // Write back the updated content
    if (summary.health_profile.providers_added > 0) {
      content.care_team = careTeam;
      const { error: updateErr } = await supabase
        .from('health_profile')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', providerRows.id);

      if (updateErr) {
        console.error('  ERROR updating providers:', updateErr.message);
      } else {
        console.log('  Providers section updated successfully');
      }
    }
  }

  // ============================
  // Summary
  // ============================
  console.log('\n=== Import Summary ===');
  console.log('medical_timeline:');
  console.log('  Updated: ' + summary.medical_timeline.updated);
  console.log('  Added:   ' + summary.medical_timeline.added);
  console.log('  Skipped: ' + summary.medical_timeline.skipped);
  console.log('health_profile providers:');
  console.log('  Added:   ' + summary.health_profile.providers_added);
  console.log('  Skipped: ' + summary.health_profile.providers_skipped);
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
