import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const table = url.searchParams.get('table')
  if (!table) return NextResponse.json({ error: 'table param required' }, { status: 400 })

  const sb = createServiceClient()
  const { data, error, count } = await sb
    .from(table)
    .select('*', { count: 'exact' })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count, sample: data })
}
