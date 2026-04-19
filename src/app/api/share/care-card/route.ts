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
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

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
  const audit = auditMetaFromRequest(req)

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
      await recordAuditEvent({
        endpoint: 'POST /api/share/care-card',
        actor: audit.ip ?? 'unauthenticated',
        outcome: 'deny',
        status: 401,
        reason: 'auth',
        ip: audit.ip,
        userAgent: audit.userAgent,
      })
      return NextResponse.json(
        {
          error:
            'share token creation requires a matching admin token (header x-share-admin-token or ?token=)',
        },
        { status: 401 },
      )
    }

    // Token minting is cheap but a compromised admin secret + automation
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
        actor: 'admin-token',
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
      actor: 'admin-token',
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
      actor: 'admin-token',
      outcome: 'error',
      status: 500,
      reason: 'generation',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json({ error: 'share token creation failed' }, { status: 500 })
  }
}
