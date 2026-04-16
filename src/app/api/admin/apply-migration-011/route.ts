/**
 * One-off admin route: applies migration 011 (endometriosis mode columns).
 *
 * Auth: requires the service role key as a Bearer token in the header.
 * Strategy: uses pg-meta-style calls through the service client. If the
 * direct SQL can't execute via PostgREST, returns the SQL text for the
 * user to paste into the Supabase dashboard SQL editor manually.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET: probe whether the migration columns exist. No auth required so the
// client can conditionally render the endo UI.
export async function GET() {
  const supabase = createServiceClient()
  const probe = await supabase
    .from('cycle_entries')
    .select('bowel_symptoms')
    .limit(1)
  return NextResponse.json({ applied: !probe.error })
}

const MIGRATION_SQL = `
ALTER TABLE cycle_entries
  ADD COLUMN IF NOT EXISTS bowel_symptoms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bladder_symptoms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dyspareunia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dyspareunia_intensity smallint CHECK (dyspareunia_intensity IS NULL OR (dyspareunia_intensity BETWEEN 0 AND 10)),
  ADD COLUMN IF NOT EXISTS clots_present boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS clot_size text CHECK (clot_size IS NULL OR clot_size IN ('small', 'medium', 'large', 'very_large')),
  ADD COLUMN IF NOT EXISTS clot_count smallint,
  ADD COLUMN IF NOT EXISTS endo_notes text;

CREATE INDEX IF NOT EXISTS idx_cycle_entries_clots
  ON cycle_entries (date, clots_present)
  WHERE clots_present = true;
`.trim()

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey || token !== serviceKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Probe: try selecting the first new column. If it works, migration is
  // already applied.
  const probe = await supabase
    .from('cycle_entries')
    .select('bowel_symptoms')
    .limit(1)

  if (!probe.error) {
    return NextResponse.json({
      status: 'already_applied',
      message: 'Migration 011 columns already exist in cycle_entries.',
    })
  }

  // Try applying via the exec_sql RPC if it exists (Supabase users sometimes
  // add it as a helper). This will return { error: 'function does not exist' }
  // if not defined.
  const rpcResult = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL })

  if (!rpcResult.error) {
    // Verify
    const verify = await supabase.from('cycle_entries').select('bowel_symptoms').limit(1)
    return NextResponse.json({
      status: 'applied_via_rpc',
      verified: !verify.error,
    })
  }

  // Fallback: return the SQL so the operator can paste into the Supabase
  // dashboard. There is no supported PostgREST path for arbitrary DDL.
  return NextResponse.json({
    status: 'manual_action_required',
    message:
      'No exec_sql RPC available. Paste the SQL below into the Supabase dashboard SQL editor and run it.',
    sql: MIGRATION_SQL,
    dashboardUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', 'https://supabase.com/dashboard/project/').split('.')[0]}/sql/new`,
  })
}
