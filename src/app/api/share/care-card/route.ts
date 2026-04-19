// ---------------------------------------------------------------------------
// POST /api/share/care-card
//
// Authenticated caller mints a new 7-day share token for the Care Card
// at /share/<token>. Returns the token, public URL, and expiry.
//
// Authentication: requireAuth() — `Authorization: Bearer <APP_AUTH_TOKEN>`
// header or the session cookie set by POST /api/auth/login. The
// previous SHARE_TOKEN_ADMIN_TOKEN + header/query pattern was retired
// this sweep (D-001 + cross-track D → B).
//
// Configuration:
//   APP_AUTH_TOKEN       required (Track A auth primitive).
//   NEXT_PUBLIC_SITE_URL optional base for the returned public URL
//                        (falls back to the request origin).
//
// The token string NEVER contains PII; it is opaque random bytes.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { createShareToken } from '@/lib/api/share-tokens'
import { requireAuth } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

interface CreateBody {
  resourceType?: string
  resourceId?: string | null
  expiresInDays?: number
  oneTime?: boolean
}

function buildPublicUrl(req: NextRequest, token: string): string {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL
  const base = (envBase && envBase.length > 0)
    ? envBase.replace(/\/$/, '')
    : req.nextUrl.origin
  return `${base}/share/${token}`
}

export async function POST(req: NextRequest) {
  const gate = requireAuth(req)
  if (!gate.ok) return gate.response

  try {
    const body = (await req.json().catch(() => ({}))) as CreateBody

    // Only 'care_card' is currently a valid resource type. Reject anything
    // else explicitly so a malformed call surfaces a clear 400.
    const resourceType = body.resourceType ?? 'care_card'
    if (resourceType !== 'care_card') {
      return NextResponse.json(
        { error: `Unsupported resourceType: ${resourceType}` },
        { status: 400 },
      )
    }

    const result = await createShareToken({
      resourceType: 'care_card',
      resourceId: body.resourceId ?? null,
      expiresInDays: typeof body.expiresInDays === 'number'
        ? body.expiresInDays
        : undefined,
      oneTime: !!body.oneTime,
    })

    return NextResponse.json({
      token: result.token,
      expiresAt: result.expiresAt,
      url: buildPublicUrl(req, result.token),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'share token creation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
