// ---------------------------------------------------------------------------
// POST /api/share/care-card
//
// Authenticated caller mints a new 7-day share token for the Care Card
// at /share/<token>. Returns the token, public URL, and expiry.
//
// Authentication: since this is a single-patient app with no user
// session layer, "authenticated" means the caller holds the
// SHARE_TOKEN_ADMIN_TOKEN env secret and passes it via either the
//   - x-share-admin-token header, or
//   - ?token=<secret> query parameter.
// This mirrors the CHAT_HARD_DELETE_TOKEN pattern already in use at
// /api/chat/history. Once the app grows a real auth layer this guard
// can be replaced with a user check.
//
// Configuration:
//   SHARE_TOKEN_ADMIN_TOKEN   required; disables mint if unset.
//   NEXT_PUBLIC_SITE_URL      optional base for the returned public URL
//                             (falls back to the request origin).
//
// The token string NEVER contains PII; it is opaque random bytes.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { createShareToken } from '@/lib/api/share-tokens'

export const dynamic = 'force-dynamic'

interface CreateBody {
  resourceType?: string
  resourceId?: string | null
  expiresInDays?: number
  oneTime?: boolean
}

function extractAdminToken(req: NextRequest): string | null {
  const header = req.headers.get('x-share-admin-token')
  if (header) return header
  const fromQuery = req.nextUrl.searchParams.get('token')
  if (fromQuery) return fromQuery
  return null
}

function buildPublicUrl(req: NextRequest, token: string): string {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL
  const base = (envBase && envBase.length > 0)
    ? envBase.replace(/\/$/, '')
    : req.nextUrl.origin
  return `${base}/share/${token}`
}

export async function POST(req: NextRequest) {
  try {
    const expected = process.env.SHARE_TOKEN_ADMIN_TOKEN
    if (!expected) {
      return NextResponse.json(
        {
          error:
            'SHARE_TOKEN_ADMIN_TOKEN is not configured on the server; share minting is disabled',
        },
        { status: 401 },
      )
    }

    const provided = extractAdminToken(req)
    if (!provided || provided !== expected) {
      return NextResponse.json(
        {
          error:
            'share token creation requires a matching admin token (header x-share-admin-token or ?token=)',
        },
        { status: 401 },
      )
    }

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
