/**
 * Import data corrections from Luminate Health lab PDF review
 *
 * 1. Add timeline event: Tryptase test ordered by Dr. Kuo (pending)
 * 2. Update health_profile to add Dr. Philip I Kuo as allergist provider
 * 3. Add Apr 20 appointment with Dr. Younoszai at AH Honolulu (from CCD encounters)
 *
 * Usage: cd /Users/clancybond/lanaehealth && node src/lib/migrations/import-data-corrections.mjs
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

async function main() {
  console.log('='.repeat(70));
  console.log('  DATA CORRECTIONS IMPORT');
  console.log('  Source: Luminate Health lab PDF review + CCD encounters');
  console.log('='.repeat(70));

  let changes = 0;

  // =============================================
  // 1. TRYPTASE TIMELINE EVENT
  // =============================================
  console.log('\n--- 1. Tryptase test ordered (pending) ---');

  const { data: existingTryptase } = await supabase
    .from('medical_timeline')
    .select('id, title')
    .or('title.ilike.%tryptase%,description.ilike.%tryptase%');

  if (existingTryptase && existingTryptase.length > 0) {
    console.log('  SKIP: Tryptase timeline event already exists');
    console.log('  Existing:', existingTryptase[0].title);
  } else {
    const { error } = await supabase.from('medical_timeline').insert({
      event_date: '2026-04-15',
      event_type: 'test',
      title: 'Tryptase test ordered by allergist Dr. Kuo (pending) - key MCAS diagnostic marker',
      description: [
        'Allergist Dr. Philip I Kuo ordered tryptase and complement (C3, C4, CH50) tests.',
        'Tryptase status: In-Progress (not yet resulted as of Apr 15).',
        'Tryptase is a key diagnostic marker for mast cell activation syndrome (MCAS).',
        'Complement tests (C3, C4, CH50) ordered to evaluate immune/autoimmune component.',
        'Also noted: Lymphocyte 44.1% flagged HIGH (ref 12.0-44.0 per DLS).',
        'Lab performed by Diagnostic Laboratory Services (DLS), Aiea, HI.',
      ].join(' '),
      significance: 'important',
      linked_data: {
        source: 'Luminate Health lab PDF',
        ordering_provider: 'Dr. Philip I Kuo',
        provider_specialty: 'Allergist',
        tests_ordered: ['Tryptase', 'C3 Complement', 'C4 Complement', 'CH50 Total Complement'],
        tryptase_status: 'In-Progress',
        clinical_significance: 'MCAS diagnostic marker',
        lab_facility: 'Diagnostic Laboratory Services (DLS)',
        notable_finding: 'Lymphocyte 44.1% flagged HIGH (ref 12.0-44.0)',
      },
    });

    if (error) {
      console.error('  ERROR:', error.message);
    } else {
      console.log('  INSERTED: Tryptase timeline event');
      changes++;
    }
  }

  // =============================================
  // 2. ADD DR. KUO TO HEALTH PROFILE
  // =============================================
  console.log('\n--- 2. Add Dr. Philip I Kuo as allergist provider ---');

  // Check if a providers/care_team section exists
  const { data: profileSections } = await supabase
    .from('health_profile')
    .select('section, content')
    .in('section', ['providers', 'care_team']);

  if (profileSections && profileSections.length > 0) {
    // Check if Kuo already in the existing section
    const section = profileSections[0];
    const contentStr = JSON.stringify(section.content || {}).toLowerCase();
    if (contentStr.includes('kuo')) {
      console.log('  SKIP: Dr. Kuo already in health_profile providers');
    } else {
      // Add Dr. Kuo to existing providers section
      const existing = section.content || {};
      const providers = Array.isArray(existing) ? existing : (existing.providers || []);
      providers.push({
        name: 'Dr. Philip I Kuo',
        specialty: 'Allergist/Immunologist',
        role: 'Ordered complement and tryptase testing for MCAS evaluation',
        first_seen: '2026-04',
      });

      const { error } = await supabase
        .from('health_profile')
        .update({ content: Array.isArray(existing) ? providers : { ...existing, providers } })
        .eq('section', section.section);

      if (error) {
        console.error('  ERROR updating providers:', error.message);
      } else {
        console.log('  UPDATED: Added Dr. Kuo to existing providers section');
        changes++;
      }
    }
  } else {
    // Create new providers section
    const { error } = await supabase.from('health_profile').insert({
      section: 'providers',
      content: {
        care_team: [
          {
            name: 'Mendykowski, FNP, Alice D',
            specialty: 'Primary Care',
            clinic: 'AH Kailua - Aulike',
          },
          {
            name: 'Amin, MD, Radhika',
            specialty: 'OB/GYN',
            clinic: 'AH Kailua',
          },
          {
            name: 'Kamireddy, MD, Adireddy',
            specialty: 'Internal Medicine',
            clinic: 'AH Kailua - Aulike',
          },
          {
            name: 'Younoszai, DO, Barak G',
            specialty: 'Cardiology',
            clinic: 'AH Honolulu - Central Medical',
          },
          {
            name: 'Dr. Philip I Kuo',
            specialty: 'Allergist/Immunologist',
            role: 'Ordered complement and tryptase testing for MCAS evaluation',
            first_seen: '2026-04',
          },
        ],
        ed_providers: [
          {
            name: 'Conklin, MD, Ryan C',
            specialty: 'Emergency Medicine',
            encounter_date: '2026-04-07',
            npi: '1104405117',
          },
          {
            name: 'LaBounty, DO, LaShell',
            specialty: 'Emergency Medicine',
            encounter_date: '2026-04-09',
          },
        ],
      },
    });

    if (error) {
      console.error('  ERROR creating providers section:', error.message);
    } else {
      console.log('  CREATED: New providers section in health_profile with full care team');
      changes++;
    }
  }

  // =============================================
  // 3. APR 20 APPOINTMENT WITH DR. YOUNOSZAI
  // =============================================
  console.log('\n--- 3. Apr 20 appointment with Dr. Younoszai at AH Honolulu ---');

  const { data: existingAppt } = await supabase
    .from('appointments')
    .select('id, date, doctor_name')
    .eq('date', '2026-04-20');

  if (existingAppt && existingAppt.length > 0) {
    console.log('  SKIP: Apr 20 appointment already exists');
    console.log('  Existing:', existingAppt[0].doctor_name);
  } else {
    const { error } = await supabase.from('appointments').insert({
      date: '2026-04-20',
      doctor_name: 'Younoszai, DO, Barak G',
      specialty: 'Cardiology',
      clinic: 'AH Honolulu - Central Medical, 321 Kuakini St Ste 201, Honolulu',
      reason: 'Clinic visit (from CCD encounters)',
      notes: 'Found in CCD encounter data. Cardiology follow-up at AH Honolulu location.',
    });

    if (error) {
      console.error('  ERROR:', error.message);
    } else {
      console.log('  INSERTED: Apr 20 cardiology appointment with Dr. Younoszai');
      changes++;
    }
  }

  // --- Summary ---
  console.log('\n' + '='.repeat(70));
  console.log(`  DATA CORRECTIONS COMPLETE: ${changes} change(s) applied`);
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
