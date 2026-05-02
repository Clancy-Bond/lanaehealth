/**
 * Medication Adherence API
 * GET /api/medications/adherence?medication=Iron+Supplement&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns PDC adherence report or PRN usage analysis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { calculatePDC, analyzePrnUsage } from '@/lib/api/medication-adherence'
import { requireUser } from '@/lib/api/require-user'
import { safeErrorResponse } from '@/lib/api/safe-error'

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  const medication = req.nextUrl.searchParams.get('medication')
  const isPrn = req.nextUrl.searchParams.get('prn') === 'true'
  const endDate = req.nextUrl.searchParams.get('end') ?? new Date().toISOString().slice(0, 10)
  const startDate = req.nextUrl.searchParams.get('start') ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  if (!medication) {
    return NextResponse.json({ error: 'medication parameter required' }, { status: 400 })
  }

  if (isPrn) {
    const report = await analyzePrnUsage(medication, startDate, endDate)
    return NextResponse.json(report)
  }

  const report = await calculatePDC(medication, startDate, endDate)
  return NextResponse.json(report)
}
