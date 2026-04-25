/**
 * GET    /api/auth/v2/account  -- return current user info
 * DELETE /api/auth/v2/account  -- delete current user + their PHI
 *
 * The DELETE path uses the service role to call admin.deleteUser
 * (RLS would block normal users from doing this themselves).
 * Before deleting the auth row we cascade-delete any rows
 * tagged with their user_id across the PHI tables.
 *
 * NOTE: full RLS enforcement is a separate PR. For now the
 * cascade is best-effort and uses the service role.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-user'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PHI_TABLES_WITH_USER_ID: readonly string[] = [
  'daily_logs',
  'pain_points',
  'symptoms',
  'cycle_entries',
  'food_entries',
  'oura_daily',
  'lab_results',
  'appointments',
  'documents',
  'chat_messages',
  'analysis_runs',
  'analysis_findings',
  'medical_identifiers',
  'health_profile',
  'medical_narrative',
  'medical_timeline',
  'active_problems',
  'imaging_studies',
  'correlation_results',
  'health_embeddings',
  'context_summaries',
  'session_handoffs',
]

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
  })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const service = createServiceClient()

  // Cascade-delete PHI rows tagged with this user_id. Errors are
  // collected, not fatal; some tables may not yet have any rows
  // for this user, which is fine.
  const errors: { table: string; message: string }[] = []
  for (const table of PHI_TABLES_WITH_USER_ID) {
    const { error } = await service.from(table).delete().eq('user_id', user.id)
    if (error) {
      // Skip tables where the user_id column has not been added
      // yet (will surface as a 42703 undefined_column).
      const msg = error.message ?? ''
      if (!msg.toLowerCase().includes('user_id')) {
        errors.push({ table, message: msg })
      }
    }
  }

  // Finally remove the auth row.
  const { error: delErr } = await service.auth.admin.deleteUser(user.id)
  if (delErr) {
    return NextResponse.json(
      { error: `failed to delete auth user: ${delErr.message}`, partial: errors },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, dataCleanupErrors: errors })
}
