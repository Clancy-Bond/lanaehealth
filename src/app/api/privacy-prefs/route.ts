// ---------------------------------------------------------------------------
// GET + PATCH /api/privacy-prefs
//
// Reads and mutates the Wave 2e F10 privacy preferences row. Three
// independent boolean toggles, default-on (allow_claude_context,
// allow_correlation_analysis, retain_history_beyond_2y).
//
// Read (GET) is open: the single-patient app surfaces these in the UI
// before any mutation happens, and the values themselves are not
// sensitive (they describe policy, not patient data).
//
// Write (PATCH) is guarded by PRIVACY_ADMIN_TOKEN, matching the pattern
// used by /api/share/care-card and /api/export/full. This prevents a
// drive-by public POST from silently disabling context injection or
// correlations.
//
// CONFIGURATION:
//   PRIVACY_ADMIN_TOKEN   required for writes; writes are disabled if unset.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import {
  getPrivacyPrefs,
  updatePrivacyPrefs,
  type PrivacyPrefsUpdate,
} from '@/lib/api/privacy-prefs'

export const dynamic = 'force-dynamic'

function extractAdminToken(req: NextRequest): string | null {
  const header = req.headers.get('x-privacy-admin-token')
  if (header) return header
  const fromQuery = req.nextUrl.searchParams.get('token')
  if (fromQuery) return fromQuery
  return null
}

export async function GET() {
  try {
    const prefs = await getPrivacyPrefs()
    return NextResponse.json(prefs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'read failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const expected = process.env.PRIVACY_ADMIN_TOKEN
    if (!expected) {
      return NextResponse.json(
        {
          error:
            'PRIVACY_ADMIN_TOKEN is not configured on the server; privacy writes are disabled',
        },
        { status: 401 },
      )
    }
    const provided = extractAdminToken(req)
    if (!provided || provided !== expected) {
      return NextResponse.json(
        {
          error:
            'privacy pref update requires a matching admin token (header x-privacy-admin-token or ?token=)',
        },
        { status: 401 },
      )
    }

    const body = (await req.json().catch(() => ({}))) as PrivacyPrefsUpdate
    const allowed: (keyof PrivacyPrefsUpdate)[] = [
      'allow_claude_context',
      'allow_correlation_analysis',
      'retain_history_beyond_2y',
    ]
    const update: PrivacyPrefsUpdate = {}
    for (const key of allowed) {
      if (body[key] !== undefined) {
        update[key] = body[key]
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided' },
        { status: 400 },
      )
    }

    const updated = await updatePrivacyPrefs(update)
    return NextResponse.json(updated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'update failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
