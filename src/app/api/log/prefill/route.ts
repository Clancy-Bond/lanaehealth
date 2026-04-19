import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { assemblePrefill } from '@/lib/log/prefill'
import { jsonError } from '@/lib/api/json-error'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date')
  const date = dateParam ?? format(new Date(), 'yyyy-MM-dd')
  // Reject anything that does not look like YYYY-MM-DD so callers cannot
  // coerce the prefill helper into reading arbitrary strings.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError(400, 'bad_date', undefined, 'date must be YYYY-MM-DD.')
  }
  try {
    const prefill = await assemblePrefill(date)
    return NextResponse.json(prefill)
  } catch (err) {
    return jsonError(500, 'prefill_failed', err, 'Prefill failed.')
  }
}
