import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { assemblePrefill } from '@/lib/log/prefill'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date')
  const date = dateParam ?? format(new Date(), 'yyyy-MM-dd')
  try {
    const prefill = await assemblePrefill(date)
    return NextResponse.json(prefill)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'prefill failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
