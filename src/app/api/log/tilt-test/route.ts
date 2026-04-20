// POST /api/log/tilt-test
//
// Created this sweep (D-007 fix) so TiltTableTest no longer needs
// createServiceClient. Body is the full reading set from a guided
// tilt-table session; server upserts individual lab_results rows
// plus the max HR delta.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'
import { jsonError } from '@/lib/api/json-error'
import { zIsoDate } from '@/lib/api/zod-forms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ReadingSchema = z.object({
  minute: z.number().int().min(0).max(30),
  position: z.enum(['supine', 'standing']),
  heartRate: z.number().positive().nullable(),
  systolic: z.number().positive().nullable(),
  diastolic: z.number().positive().nullable(),
})

const BodySchema = z.object({
  date: zIsoDate,
  readings: z.array(ReadingSchema).min(1).max(20),
})

export async function POST(req: NextRequest) {
  const gate = requireAuth(req)
  if (!gate.ok) return gate.response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonError(400, 'bad_body')
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return jsonError(400, 'tilt_test_invalid', parsed.error)
  }
  const { date, readings } = parsed.data
  const sourceId = `tilt_test_${date}`
  const sb = createServiceClient()

  const rows: Array<Record<string, unknown>> = []
  for (const r of readings) {
    if (r.heartRate !== null) {
      rows.push({
        date,
        test_name: `Tilt Test HR (${r.position} ${r.minute}min)`,
        value: r.heartRate,
        unit: 'bpm',
        category: 'Vitals',
        flag: 'normal',
        source_document_id: sourceId,
      })
    }
    if (r.systolic !== null) {
      rows.push({
        date,
        test_name: `Tilt Test BP (${r.position} ${r.minute}min)`,
        value: r.systolic,
        unit: 'mmHg',
        category: 'Vitals',
        flag: 'normal',
        source_document_id: sourceId,
      })
    }
  }

  // Max HR delta between supine baseline and any standing reading.
  const supineHr = readings.find((r) => r.position === 'supine')?.heartRate
  const standingHrs = readings
    .filter((r) => r.position === 'standing' && r.heartRate !== null)
    .map((r) => r.heartRate as number)
  if (typeof supineHr === 'number' && standingHrs.length > 0) {
    const maxStanding = Math.max(...standingHrs)
    const delta = maxStanding - supineHr
    rows.push({
      date,
      test_name: 'Tilt Test Max HR Delta',
      value: delta,
      unit: 'bpm',
      category: 'Vitals',
      flag: delta >= 30 ? 'high' : 'normal',
      reference_range_low: 0,
      reference_range_high: 30,
      source_document_id: sourceId,
    })
  }

  if (rows.length > 0) {
    const { error } = await sb
      .from('lab_results')
      .upsert(rows, { onConflict: 'date,test_name' })
    if (error) return jsonError(500, 'tilt_test_upsert_failed', error.message)
  }

  return NextResponse.json({ ok: true, rows: rows.length }, { status: 200 })
}
