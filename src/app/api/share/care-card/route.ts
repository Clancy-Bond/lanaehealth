// ---------------------------------------------------------------------------
// POST /api/share/care-card
//
// Authenticated caller mints a new 7-day share token for the Care Card
// at /share/<token>. Returns the token, public URL, and expiry.
//
// Authentication: requireAuth() - `Authorization: Bearer <APP_AUTH_TOKEN>`
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
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

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
  const audit = auditMetaFromRequest(req)
  const gate = requireAuth(req)
  if (!gate.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/share/care-card',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return gate.response
  }

  // Token minting is cheap but a compromised session + automation
  // could burn many tokens. 10 per hour is plenty for a single patient.
  const limit = checkRateLimit({
    scope: 'share:mint',
    max: 10,
    windowMs: 60 * 60 * 1000,
    key: clientIdFromRequest(req),
  })
  if (!limit.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/share/care-card',
      actor: `via:${gate.via}`,
      outcome: 'deny',
      status: 429,
      reason: 'rate-limit',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json(
      { error: 'Too many share token requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    )
  }

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

    await recordAuditEvent({
      endpoint: 'POST /api/share/care-card',
      actor: `via:${gate.via}`,
      outcome: 'allow',
      status: 200,
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: {
        resource_type: 'care_card',
        resource_id: body.resourceId ?? null,
        one_time: !!body.oneTime,
        expires_at: result.expiresAt,
      },
    })

    return NextResponse.json({
      token: result.token,
      expiresAt: result.expiresAt,
      url: buildPublicUrl(req, result.token),
    })
  } catch (err) {
    console.error('[share/care-card] failed:', err)
    await recordAuditEvent({
      endpoint: 'POST /api/share/care-card',
      actor: `via:${gate.via}`,
      outcome: 'error',
      status: 500,
      reason: 'generation',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json({ error: 'share token creation failed' }, { status: 500 })
  }
}
