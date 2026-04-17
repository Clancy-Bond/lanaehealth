// ---------------------------------------------------------------------------
// share-tokens api helpers
//
// Thin wrapper around the `share_tokens` table (migration 019). Used by
// the Care Card + QR share feature (Wave 2d D6). Two surfaces:
//
//   - createShareToken(): authenticated caller mints a new token for a
//     given resource (e.g. 'care_card'). Default 7-day expiry.
//   - verifyShareToken(): unauthenticated viewer route looks up the
//     token, confirms it is unexpired and unrevoked, and (for
//     one-time tokens) marks it consumed.
//
// The token string itself is cryptographically random (crypto.randomBytes
// 32 bytes, base64url-encoded) and carries NO PII. It is an opaque key
// against the database row.
// ---------------------------------------------------------------------------

import { randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase'

// --- types -----------------------------------------------------------------

export type ShareResourceType = 'care_card'

export interface ShareTokenRow {
  token: string
  resource_type: string
  resource_id: string | null
  issued_at: string
  expires_at: string
  revoked_at: string | null
  one_time: boolean
  used_at: string | null
}

export interface CreateShareTokenInput {
  resourceType: ShareResourceType
  resourceId?: string | null
  /** Days until expiry. Defaults to 7. */
  expiresInDays?: number
  /** One-time tokens are invalidated after first successful view. */
  oneTime?: boolean
}

export interface CreateShareTokenResult {
  token: string
  expiresAt: string
}

/** Result of verifying a token. Either valid+row, or a reason string. */
export type VerifyShareTokenResult =
  | { ok: true; row: ShareTokenRow }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'consumed' }

// --- helpers ---------------------------------------------------------------

const DEFAULT_EXPIRY_DAYS = 7
const MIN_TOKEN_BYTES = 32

/**
 * Generate a cryptographically random, URL-safe token string.
 *
 * Uses Node's crypto.randomBytes (CSPRNG). 32 bytes of entropy encoded
 * to base64url yields a ~43-character string with no padding, suitable
 * for path segments without any escaping.
 *
 * Exported for tests; production code should prefer createShareToken().
 */
export function generateTokenString(byteLength = MIN_TOKEN_BYTES): string {
  if (byteLength < MIN_TOKEN_BYTES) {
    throw new Error(
      `Share token byteLength must be at least ${MIN_TOKEN_BYTES}; got ${byteLength}`,
    )
  }
  const buf = randomBytes(byteLength)
  // Node 16+ supports 'base64url' directly.
  return buf.toString('base64url')
}

// --- create ---------------------------------------------------------------

/**
 * Mint a new share token for a resource.
 *
 * IMPORTANT: This function is only safe to call from an authenticated
 * server context (e.g. POST /api/share/care-card, guarded by the app's
 * admin/auth layer). It trusts the caller entirely.
 */
export async function createShareToken(
  input: CreateShareTokenInput,
): Promise<CreateShareTokenResult> {
  const days = input.expiresInDays ?? DEFAULT_EXPIRY_DAYS
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    throw new Error(
      `expiresInDays must be a finite positive number <= 365; got ${days}`,
    )
  }

  const token = generateTokenString()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const supabase = createServiceClient()
  const { error } = await supabase.from('share_tokens').insert({
    token,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    one_time: !!input.oneTime,
  })

  if (error) {
    throw new Error(`Failed to create share token: ${error.message}`)
  }

  return { token, expiresAt: expiresAt.toISOString() }
}

// --- verify ---------------------------------------------------------------

/**
 * Look up a token and confirm it can be used for a read.
 *
 * Returns either { ok: true, row } or { ok: false, reason }. Callers
 * should translate the reason into an HTTP status:
 *   - not_found: 404
 *   - expired:   410 Gone
 *   - revoked:   410 Gone
 *   - consumed:  410 Gone (one-time token already used)
 *
 * For one_time tokens, this function also updates used_at on success.
 * For normal tokens, read is idempotent.
 */
export async function verifyShareToken(
  token: string,
  expectedResourceType?: ShareResourceType,
): Promise<VerifyShareTokenResult> {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'not_found' }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('share_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    // Treat query errors as not_found rather than surfacing internals.
    return { ok: false, reason: 'not_found' }
  }
  if (!data) return { ok: false, reason: 'not_found' }

  const row = data as ShareTokenRow

  if (expectedResourceType && row.resource_type !== expectedResourceType) {
    return { ok: false, reason: 'not_found' }
  }

  if (row.revoked_at) return { ok: false, reason: 'revoked' }

  const now = Date.now()
  if (new Date(row.expires_at).getTime() <= now) {
    return { ok: false, reason: 'expired' }
  }

  if (row.one_time && row.used_at) {
    return { ok: false, reason: 'consumed' }
  }

  if (row.one_time && !row.used_at) {
    // Best-effort consumption. If the update fails we still serve the
    // page once; the next view will see used_at set.
    await supabase
      .from('share_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)
  }

  return { ok: true, row }
}

// --- revoke ---------------------------------------------------------------

/**
 * Manual revoke. Sets revoked_at to now; future verify() calls return
 * { ok: false, reason: 'revoked' }. Intended for admin/cleanup use.
 */
export async function revokeShareToken(token: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('share_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)

  if (error) {
    throw new Error(`Failed to revoke share token: ${error.message}`)
  }
}
