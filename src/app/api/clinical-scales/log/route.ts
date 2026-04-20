/**
 * POST /api/clinical-scales/log
 *
 * Upsert clinical_scale_responses by composite key (log_id, scale_type).
 * Payload shape:
 *   { log_id, scale_type: 'PHQ-9' | 'GAD-7', date: YYYY-MM-DD,
 *     responses: number[], total_score: number, severity: string }
 *
 * Server does not re-compute total_score/severity. The client has
 * the canonical scoring in src/lib/clinical-scales.ts; mirroring it
 * server-side would duplicate the table. Validation here is shape
 * only; a future hardening pass can re-score and reject drift.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import type { ClinicalScaleType, ScaleSeverity } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SCALE_TYPES: readonly ClinicalScaleType[] = ['PHQ-9', 'GAD-7', 'HIT-6', 'MIDAS', 'PROMIS-Pain', 'PROMIS-Fatigue']
const SEVERITIES: readonly ScaleSeverity[] = [
  'minimal',
  'mild',
  'moderate',
  'moderately_severe',
  'severe',
  'grade_1',
  'grade_2',
  'grade_3',
  'grade_4',
]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface ScalePayload {
  log_id: string
  scale_type: ClinicalScaleType
  date: string
  responses: number[]
  total_score: number
  severity: ScaleSeverity
}

function parsePayload(raw: Record<string, unknown>): { ok: true; payload: ScalePayload } | { ok: false; error: string } {
  const logId = typeof raw.log_id === 'string' ? raw.log_id.trim() : ''
  if (!logId) return { ok: false, error: 'log_id is required.' }

  const scaleType = raw.scale_type
  if (typeof scaleType !== 'string' || !SCALE_TYPES.includes(scaleType as ClinicalScaleType)) {
    return { ok: false, error: `scale_type must be one of: ${SCALE_TYPES.join(', ')}.` }
  }

  const date = typeof raw.date === 'string' && DATE_RE.test(raw.date) ? raw.date : null
  if (!date) return { ok: false, error: 'date must be YYYY-MM-DD.' }

  if (!Array.isArray(raw.responses)) return { ok: false, error: 'responses must be an array.' }
  const responses = raw.responses.map((n) => Number(n))
  if (!responses.every((n) => Number.isInteger(n) && n >= 0 && n <= 3)) {
    return { ok: false, error: 'Each response must be an integer 0-3.' }
  }

  const totalScore = Number(raw.total_score)
  if (!Number.isInteger(totalScore) || totalScore < 0) {
    return { ok: false, error: 'total_score must be a non-negative integer.' }
  }

  const severity = raw.severity
  if (typeof severity !== 'string' || !SEVERITIES.includes(severity as ScaleSeverity)) {
    return { ok: false, error: 'severity is not a recognized value.' }
  }

  return {
    ok: true,
    payload: {
      log_id: logId,
      scale_type: scaleType as ClinicalScaleType,
      date,
      responses,
      total_score: totalScore,
      severity: severity as ScaleSeverity,
    },
  }
}

export async function POST(req: NextRequest) {
  let raw: Record<string, unknown> = {}
  try {
    raw = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = parsePayload(raw)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('clinical_scale_responses')
    .upsert(parsed.payload, { onConflict: 'log_id,scale_type' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, entry: data }, { status: 200 })
}
