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

// Look at what distinguishes actual vs predicted periods - imported_at dates
let r = await sb.from('nc_imported').select('date, menstruation, flow_quantity, cycle_day, cycle_number, imported_at, fertility_color, ovulation_status').gte('date', '2026-02-25').lte('date', '2026-04-30').order('date', { ascending: true });
console.log('nc_imported Feb 25 - Apr 30:');
console.log('date | menstruation | flow | cd | cn | fc | ov | imported_at');
for (const row of r.data || []) {
  console.log(`  ${row.date} | ${row.menstruation ?? 'null'} | ${row.flow_quantity ?? 'null'} | cd=${row.cycle_day} | cn=${row.cycle_number} | ${row.fertility_color ?? '-'} | ${row.ovulation_status ?? '-'} | imp=${row.imported_at?.slice(0,10)}`);
}

// Check if there are any other period-like records anywhere else
r = await sb.from('daily_logs').select('date, cycle_phase, notes, flare_day').gte('date', '2026-02-27').lte('date', '2026-04-18').or('notes.ilike.%period%,notes.ilike.%bleeding%,notes.ilike.%menstru%,cycle_phase.eq.menstrual').order('date', { ascending: true });
console.log('\ndaily_logs matching period/bleeding/menstrual Feb 27 - Apr 18:');
for (const row of r.data || []) console.log(' ', row.date, 'phase=' + row.cycle_phase, 'flare=' + row.flare_day, 'notes:', row.notes?.slice(0, 100));
