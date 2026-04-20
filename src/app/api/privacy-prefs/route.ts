// GET + PATCH /api/privacy-prefs
// Reads and mutates the Wave 2e F10 privacy preferences row. Three
// independent boolean toggles, default-on (allow_claude_context,
// allow_correlation_analysis, retain_history_beyond_2y).
// Both verbs require auth (security sweep 2026-04-19, Track A).

import { NextRequest, NextResponse } from 'next/server'
import {
  getPrivacyPrefs,
  updatePrivacyPrefs,
  type PrivacyPrefsUpdate,
} from '@/lib/api/privacy-prefs'
import { requireAuth } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = requireAuth(req)
  if (!gate.ok) return gate.response

  try {
    const prefs = await getPrivacyPrefs()
    return NextResponse.json(prefs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'read failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const gate = requireAuth(req)
  if (!gate.ok) return gate.response

  try {
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
