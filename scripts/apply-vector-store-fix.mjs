// Apply the search_health_text() fix via the existing exec_sql RPC.
//
// Root cause recap: search_health_text() used
//   exp(- EXTRACT(EPOCH FROM (CURRENT_DATE - he.content_date)) / (86400.0 * 365.0))
// which throws at runtime because `CURRENT_DATE - date` is an integer
// (days) and Postgres has no EXTRACT(EPOCH FROM integer) overload.
//
// Fix: drop EXTRACT, cast the integer days to float, divide by 365.
//
// We call supabase.rpc('exec_sql', ...), which is the same escape hatch
// src/app/api/admin/apply-migration-011 uses for schema mutations.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs
    .readFileSync(path.resolve(here, '..', '.env.local'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
CREATE OR REPLACE FUNCTION search_health_text(
  query_text TEXT,
  match_count INT DEFAULT 10,
  filter_date_start DATE DEFAULT NULL,
  filter_date_end DATE DEFAULT NULL,
  filter_type VARCHAR DEFAULT NULL,
  filter_phase VARCHAR DEFAULT NULL,
  filter_min_pain INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content_id VARCHAR,
  content_type VARCHAR,
  content_date DATE,
  narrative TEXT,
  cycle_phase VARCHAR,
  pain_level INT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $func$
DECLARE
  plain_q tsquery;
  or_q_text text;
  tsq tsquery;
BEGIN
  plain_q := plainto_tsquery('english', query_text);
  or_q_text := replace(plain_q::text, ' & ', ' | ');

  IF or_q_text = '' OR or_q_text IS NULL THEN
    RETURN;
  END IF;

  tsq := or_q_text::tsquery;

  RETURN QUERY
  SELECT
    he.id,
    he.content_id,
    he.content_type,
    he.content_date,
    he.narrative,
    he.cycle_phase,
    he.pain_level,
    (ts_rank_cd(he.narrative_tsv, tsq) *
      exp(- ((CURRENT_DATE - he.content_date)::float / 365.0))
    )::FLOAT AS relevance
  FROM health_embeddings he
  WHERE
    he.narrative_tsv @@ tsq
    AND (filter_date_start IS NULL OR he.content_date >= filter_date_start)
    AND (filter_date_end IS NULL OR he.content_date <= filter_date_end)
    AND (filter_type IS NULL OR he.content_type = filter_type)
    AND (filter_phase IS NULL OR he.cycle_phase = filter_phase)
    AND (filter_min_pain IS NULL OR he.pain_level >= filter_min_pain)
  ORDER BY
    ts_rank_cd(he.narrative_tsv, tsq) *
      exp(- ((CURRENT_DATE - he.content_date)::float / 365.0))
    DESC
  LIMIT match_count;
END;
$func$;
`;

const { error: ddlErr } = await supabase.rpc('exec_sql', { sql });
if (ddlErr) {
  console.error('exec_sql failed:', ddlErr.message);
  console.error('\nFallback: paste the SQL below into Supabase Studio -> SQL Editor -> Run.');
  console.error('URL: https://supabase.com/dashboard/project/' + env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').replace('.supabase.co', '') + '/sql/new');
  console.error('\n--- SQL ---');
  console.error(sql);
  console.error('--- end SQL ---');
  process.exit(1);
}
console.log('search_health_text() replaced via exec_sql.');

// Smoke: call the fixed function and confirm no runtime error.
const { data: smoke, error: smokeErr } = await supabase.rpc('search_health_text', {
  query_text: 'headache pain sleep',
  match_count: 3,
});
if (smokeErr) {
  console.error('Smoke call failed:', smokeErr.message);
  process.exit(1);
}
console.log(`Smoke call returned ${smoke?.length ?? 0} row(s) -- no runtime error.`);
