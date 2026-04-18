import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const since = '2025-12-20';

// cycle_entries
let r = await sb.from('cycle_entries').select('*').gte('date', since).order('date', { ascending: false }).limit(30);
if (r.error) console.log('cycle_entries ERROR:', r.error.message);
else {
  console.log('cycle_entries recent (top 30):');
  console.log('  total:', r.data.length);
  console.log('  with menstruation truthy:');
  for (const row of r.data.filter(x => x.menstruation)) console.log('    ', row.date, JSON.stringify({ m: row.menstruation }));
  console.log('  all recent 5:', JSON.stringify(r.data.slice(0, 5), null, 2));
}

// nc_imported
r = await sb.from('nc_imported').select('*').gte('date', since).order('date', { ascending: false }).limit(30);
if (r.error) console.log('\nnc_imported ERROR:', r.error.message);
else {
  console.log('\nnc_imported recent (top 30):');
  console.log('  total:', r.data.length);
  const values = new Set(r.data.map(x => x.menstruation).filter(Boolean));
  console.log('  distinct menstruation values:', [...values]);
  for (const row of r.data.filter(x => x.menstruation === 'MENSTRUATION')) console.log('    MENSTRUATION ', row.date);
  console.log('  all recent 3:', JSON.stringify(r.data.slice(0, 3), null, 2));
}
