// POST /api/log/vitals-snapshot
//
// Created this sweep (D-007 fix) so VitalsCard no longer needs
// createServiceClient. Body is a batch of positional vital
// readings; server upserts lab_results rows.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'
import { jsonError } from '@/lib/api/json-error'
import { zIsoDate } from '@/lib/api/zod-forms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ReadingSchema = z.object({
  position: z.enum(['supine', 'seated', 'standing']),
  heartRate: z.number().positive().nullable(),
  systolic: z.number().positive().nullable(),
  diastolic: z.number().positive().nullable(),
})

const BodySchema = z.object({
  date: zIsoDate,
  readings: z.array(ReadingSchema).min(1).max(10),
})

function bpFlag(value: number, bounds: { high: number; low: number }): 'high' | 'low' | 'normal' {
  if (value >= bounds.high) return 'high'
  if (value < bounds.low) return 'low'
  return 'normal'
}

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
    return jsonError(400, 'vitals_snapshot_invalid', parsed.error)
  }
  const { date, readings } = parsed.data
  const sourceId = `manual_vitals_${date}`
  const sb = createServiceClient()

  const rows: Array<Record<string, unknown>> = []
  for (const r of readings) {
    if (r.heartRate !== null) {
      rows.push({
        date,
        test_name: `Heart Rate (${r.position})`,
        value: r.heartRate,
        unit: 'bpm',
        category: 'Vitals',
        flag: 'normal',
        source_document_id: sourceId,
      })
    }
    if (r.systolic !== null && r.diastolic !== null) {
      rows.push({
        date,
        test_name: `BP Systolic (${r.position})`,
        value: r.systolic,
        unit: 'mmHg',
        category: 'Vitals',
        flag: bpFlag(r.systolic, { high: 140, low: 90 }),
        reference_range_low: 90,
        reference_range_high: 120,
        source_document_id: sourceId,
      })
      rows.push({
        date,
        test_name: `BP Diastolic (${r.position})`,
        value: r.diastolic,
        unit: 'mmHg',
        category: 'Vitals',
        flag: bpFlag(r.diastolic, { high: 90, low: 60 }),
        reference_range_low: 60,
        reference_range_high: 80,
        source_document_id: sourceId,
      })
    }
  }

  // HR delta between supine and standing, when both are present.
  const supineHr = readings.find((r) => r.position === 'supine')?.heartRate
  const standingHr = readings.find((r) => r.position === 'standing')?.heartRate
  if (typeof supineHr === 'number' && typeof standingHr === 'number') {
    const delta = standingHr - supineHr
    rows.push({
      date,
      test_name: 'Orthostatic HR Delta',
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
    if (error) return jsonError(500, 'vitals_upsert_failed', error.message)
  }

  return NextResponse.json({ ok: true, rows: rows.length }, { status: 200 })
}
