// ---------------------------------------------------------------------------
// POST /api/prn-doses/record
//
// Client-safe write surface for the Wave 2e F7 PRN post-dose efficacy
// polling feature. Inserts a row into `prn_dose_events` and schedules a
// follow-up poll (default +90 min, overridable per med via the library
// helper in src/lib/api/prn-doses.ts).
//
// Body:
//   {
//     medicationName: string            // required, trimmed, non-empty
//     doseAmount?:   number | null
//     doseUnit?:     string | null
//     doseTime?:     string | null      // ISO8601; defaults to server now()
//     reason?:       string | null
//     pollDelayMinutes?: number | null  // 0 or less disables polling
//   }
//
// Returns the inserted row on success. Does NOT send a push; that is the
// cron's job (see /api/push/prn-poll).
//
// Voice rule enforced upstream: the eventual notification body is always
// "Did [med] help?" never "Did you take [med]?".
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server'
import { recordPrnDose } from '@/lib/api/prn-doses'
import { requireUser } from '@/lib/api/require-user'
import { safeErrorMessage, safeErrorResponse } from '@/lib/api/safe-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RecordBody {
  medicationName?: unknown
  doseAmount?: unknown
  doseUnit?: unknown
  doseTime?: unknown
  reason?: unknown
  pollDelayMinutes?: unknown
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export async function POST(req: Request) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  let body: RecordBody
  try {
    body = (await req.json()) as RecordBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (typeof body.medicationName !== 'string' || body.medicationName.trim().length === 0) {
    return NextResponse.json(
      { error: 'medicationName is required' },
      { status: 400 },
    )
  }

  // pollDelayMinutes: accept number, numeric string, or null.
  // Anything else is a validation error so callers catch typos.
  let pollDelayMinutes: number | null | undefined
  if (body.pollDelayMinutes === undefined) {
    pollDelayMinutes = undefined
  } else if (body.pollDelayMinutes === null) {
    pollDelayMinutes = null
  } else {
    const parsed = asNumberOrNull(body.pollDelayMinutes)
    if (parsed === null) {
      return NextResponse.json(
        { error: 'pollDelayMinutes must be a finite number or null' },
        { status: 400 },
      )
    }
    pollDelayMinutes = parsed
  }

  try {
    const row = await recordPrnDose({
      medicationName: body.medicationName,
      doseAmount: asNumberOrNull(body.doseAmount),
      doseUnit: asStringOrNull(body.doseUnit),
      doseTime: asStringOrNull(body.doseTime),
      reason: asStringOrNull(body.reason),
      pollDelayMinutes,
    })
    return NextResponse.json({ ok: true, row })
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : ''
    const isValidation =
      /medicationName|doseTime|pollDelayMinutes/i.test(rawMsg)
      && !/Failed to record PRN dose/.test(rawMsg)
    if (isValidation) {
      return NextResponse.json(
        { error: safeErrorMessage(err, 'invalid_input') },
        { status: 400 },
      )
    }
    return safeErrorResponse(err, 'failed_to_record_prn_dose')
  }
}
