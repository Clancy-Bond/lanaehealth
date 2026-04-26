/**
 * SERVICE-ROLE INTENTIONAL: schema migration tool, not user-scoped.
 *
 * One-off admin route: applies migration 013 (orthostatic_tests table).
 *
 * Auth: requires the service role key as a Bearer token.
 * GET: probes whether the table exists (no auth needed).
 * POST: attempts to apply via exec_sql RPC, falls back to returning SQL.
 *
 * Why service-role: DDL (CREATE TABLE) is owner-only.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS orthostatic_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_date DATE NOT NULL,
  test_time TIME NOT NULL DEFAULT (now()::time),
  resting_hr_bpm INTEGER NOT NULL,
  resting_bp_systolic INTEGER,
  resting_bp_diastolic INTEGER,
  standing_hr_1min INTEGER,
  standing_hr_3min INTEGER,
  standing_hr_5min INTEGER,
  standing_hr_10min INTEGER,
  standing_bp_systolic_10min INTEGER,
  standing_bp_diastolic_10min INTEGER,
  peak_rise_bpm INTEGER GENERATED ALWAYS AS (
    GREATEST(
      COALESCE(standing_hr_1min, 0),
      COALESCE(standing_hr_3min, 0),
      COALESCE(standing_hr_5min, 0),
      COALESCE(standing_hr_10min, 0)
    ) - resting_hr_bpm
  ) STORED,
  symptoms_experienced TEXT,
  notes TEXT,
  hydration_ml INTEGER,
  caffeine_mg INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orthostatic_test_date
  ON orthostatic_tests (test_date DESC);
CREATE INDEX IF NOT EXISTS idx_orthostatic_peak_rise
  ON orthostatic_tests (peak_rise_bpm DESC);
`.trim()

export async function GET(req: Request) {
  const gate = requireAuth(req)
  if (!gate.ok) return gate.response
  const sb = createServiceClient()
  const probe = await sb.from('orthostatic_tests').select('id').limit(1)
  return NextResponse.json({ applied: !probe.error })
}

export async function POST(req: Request) {
  const gate = requireAuth(req)
  if (!gate.ok) return gate.response

  const sb = createServiceClient()
  const probe = await sb.from('orthostatic_tests').select('id').limit(1)
  if (!probe.error) {
    return NextResponse.json({ status: 'already_applied' })
  }

  const rpcResult = await sb.rpc('exec_sql', { sql: MIGRATION_SQL })
  if (!rpcResult.error) {
    const verify = await sb.from('orthostatic_tests').select('id').limit(1)
    return NextResponse.json({ status: 'applied_via_rpc', verified: !verify.error })
  }

  return NextResponse.json({
    status: 'manual_action_required',
    message:
      'No exec_sql RPC available. Paste the SQL below into the Supabase dashboard SQL editor and run it.',
    sql: MIGRATION_SQL,
    dashboardUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', 'https://supabase.com/dashboard/project/').split('.')[0]}/sql/new`,
  })
}
