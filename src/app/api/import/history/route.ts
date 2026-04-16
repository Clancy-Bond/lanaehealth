/**
 * Import History API
 * GET /api/import/history
 *
 * Returns recent import records from the import_history table.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('import_history')
    .select('*')
    .order('imported_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ records: [], error: error.message })
  }

  return NextResponse.json({ records: data ?? [] })
}
