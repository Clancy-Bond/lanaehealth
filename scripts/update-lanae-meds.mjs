/**
 * One-off: replace Lanae's health_profile.medications with the actual
 * list she gave on 2026-04-27.
 *
 * Schema we are settling on:
 *   {
 *     scheduled: [
 *       { slug, name, slots: ['morning'|'midday'|'night'], dose_text? }
 *     ],
 *     as_needed: [
 *       { slug, name, indication, default_dose_text? }
 *     ]
 *   }
 *
 * The home meds card reads scheduled[] for the always-visible checklist
 * and as_needed[] for the collapsed PRN section. dose-log.ts writes
 * med_doses rows keyed by the same slug.
 *
 * Safe to re-run: it overwrites the row.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8').split('\n').reduce((m, l) => {
  const i = l.indexOf('=')
  if (i > 0 && !l.startsWith('#')) m[l.slice(0, i).trim()] = l.slice(i + 1).trim()
  return m
}, {})

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const meds = {
  scheduled: [
    {
      slug: 'zyrtec',
      name: 'Zyrtec',
      slots: ['morning', 'night'],
      indication: 'antihistamine',
    },
    {
      slug: 'l-glutamine',
      name: 'L-Glutamine',
      slots: ['morning'],
      indication: 'gut / POTS support',
    },
    {
      slug: 'wixela',
      name: 'Wixela',
      slots: ['morning', 'night'],
      indication: 'asthma maintenance inhaler',
    },
    {
      slug: 'antihistamine-nasal-spray',
      name: 'Antihistamine nasal spray',
      slots: ['morning', 'night'],
      indication: 'antihistamine',
    },
  ],
  as_needed: [
    {
      slug: 'hydroxyzine',
      name: 'Hydroxyzine',
      indication: 'MCAS flare rescue',
    },
    {
      slug: 'tylenol',
      name: 'Tylenol',
      indication: 'headache / pain',
      default_dose_text: '500 mg',
    },
  ],
}

const { error } = await sb.from('health_profile').upsert(
  {
    section: 'medications',
    content: meds,
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'section' },
)

if (error) {
  console.error('upsert err:', error)
  process.exit(1)
}

const { data: confirm } = await sb
  .from('health_profile')
  .select('content')
  .eq('section', 'medications')
  .single()
console.log('After update:')
console.log(JSON.stringify(confirm.content, null, 2))
