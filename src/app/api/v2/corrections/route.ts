/**
 * /api/v2/corrections
 *
 * POST: record a user correction.
 * GET ?tableName=...&rowId=...: read back the correction history for a
 *   specific row.
 *
 * Both endpoints require an authenticated Supabase Auth session. The
 * authenticated user's id is the only id that ever lands in the row's
 * user_id column - the client cannot impersonate.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import {
  recordCorrection,
  type RecordCorrectionInput,
} from '@/lib/v2/corrections/record-correction'
import { getCorrectionsForRow } from '@/lib/v2/corrections/correction-history'
import {
  CORRECTABLE_TABLES,
  type CorrectableTable,
  type CorrectionSource,
} from '@/lib/v2/corrections/types'

const SOURCE_VALUES = ['v2_cycle', 'v2_log', 'v2_sleep', 'v2_calories', 'v2_other'] as const

// Allow string, number, boolean, or null for the corrected/original
// values. We accept whatever the editable cell can render. The
// recordCorrection helper formats them into a sentence the AI quotes.
const ScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const PostBodySchema = z.object({
  tableName: z.enum(CORRECTABLE_TABLES as [CorrectableTable, ...CorrectableTable[]]),
  rowId: z.string().min(1),
  fieldName: z.string().min(1),
  originalValue: ScalarSchema,
  correctedValue: ScalarSchema,
  reason: z.string().min(1).max(2000),
  source: z.enum(SOURCE_VALUES as unknown as [CorrectionSource, ...CorrectionSource[]]),
})

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const json = await request.json().catch(() => null)
    if (!json || typeof json !== 'object') {
      return NextResponse.json({ error: 'invalid body' }, { status: 400 })
    }
    const parsed = PostBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    // Forward to recordCorrection. The user id comes ONLY from the
    // authenticated session; the client cannot influence it.
    const input: RecordCorrectionInput = {
      ...parsed.data,
      userId: user.id,
    }

    const result = await recordCorrection(input)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    const msg = err instanceof Error ? err.message : 'internal'
    // Validation errors thrown by recordCorrection produce 400; opaque
    // failures produce 500. The /correctable allowlist/ message is a
    // hint that the request was malformed.
    if (/required|allowlist/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const url = new URL(request.url)
    const tableName = url.searchParams.get('tableName')
    const rowId = url.searchParams.get('rowId')
    if (!tableName || !rowId) {
      return NextResponse.json(
        { error: 'tableName and rowId are required query params' },
        { status: 400 },
      )
    }
    if (!(CORRECTABLE_TABLES as string[]).includes(tableName)) {
      return NextResponse.json(
        { error: `tableName "${tableName}" is not in the correctable allowlist` },
        { status: 400 },
      )
    }
    const corrections = await getCorrectionsForRow({
      tableName: tableName as CorrectableTable,
      rowId,
      userId: user.id,
    })
    return NextResponse.json({ corrections })
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    const msg = err instanceof Error ? err.message : 'internal'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
