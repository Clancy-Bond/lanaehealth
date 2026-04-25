/**
 * POST /api/auth/v2/logout
 *
 * Sign out the current Supabase Auth session. Idempotent.
 */
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
