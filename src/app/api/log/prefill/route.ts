import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { assemblePrefill } from '@/lib/log/prefill'
import { requireUser } from '@/lib/api/require-user'
import { safeErrorResponse } from '@/lib/api/safe-error'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  const dateParam = req.nextUrl.searchParams.get('date')
  const date = dateParam ?? format(new Date(), 'yyyy-MM-dd')
  try {
    const prefill = await assemblePrefill(date)
    return NextResponse.json(prefill)
  } catch (err) {
    return safeErrorResponse(err, 'prefill_failed')
  }
}
