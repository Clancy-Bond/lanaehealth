/**
 * Generic OAuth 2.0 Flow Manager
 *
 * Shared OAuth utilities used by all connectors.
 * Handles: PKCE code challenge generation, state management,
 * token exchange helpers, and refresh logic.
 */

import { createHash, randomBytes } from 'crypto'

// ── PKCE (Proof Key for Code Exchange) ─────────────────────────────

/**
 * Generate a PKCE code verifier and challenge pair.
 * Used for public clients that can't safely store a client secret.
 */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // 43-128 character random string
  const codeVerifier = randomBytes(32)
    .toString('base64url')
    .slice(0, 64)

  // S256 hash of the verifier
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  return { codeVerifier, codeChallenge }
}

// ── State Management ───────────────────────────────────────────────

/**
 * Generate a secure random state parameter for CSRF protection.
 * Includes integration ID for routing on callback.
 */
export function generateOAuthState(integrationId: string): string {
  const nonce = randomBytes(16).toString('hex')
  return `${integrationId}_${nonce}`
}

/**
 * Parse state parameter to extract integration ID.
 */
export function parseOAuthState(state: string): { integrationId: string; nonce: string } | null {
  const parts = state.split('_')
  if (parts.length < 2) return null
  return {
    integrationId: parts[0],
    nonce: parts.slice(1).join('_'),
  }
}

// ── Token Exchange Helper ──────────────────────────────────────────

interface TokenExchangeParams {
  tokenUrl: string
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
  codeVerifier?: string          // For PKCE flows
  grantType?: string
  extraParams?: Record<string, string>
  useBasicAuth?: boolean         // Send credentials in Authorization header vs body
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  [key: string]: unknown
}

/**
 * Generic token exchange -- works with most OAuth 2.0 providers.
 */
export async function exchangeAuthCode(params: TokenExchangeParams): Promise<TokenResponse> {
  const body: Record<string, string> = {
    grant_type: params.grantType ?? 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
  }

  if (params.codeVerifier) {
    body.code_verifier = params.codeVerifier
  }

  if (!params.useBasicAuth) {
    body.client_id = params.clientId
    body.client_secret = params.clientSecret
  }

  if (params.extraParams) {
    Object.assign(body, params.extraParams)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if (params.useBasicAuth) {
    headers.Authorization = `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`
  }

  const res = await fetch(params.tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Generic token refresh.
 */
export async function refreshAccessToken(params: {
  tokenUrl: string
  clientId: string
  clientSecret: string
  refreshToken: string
  useBasicAuth?: boolean
}): Promise<TokenResponse> {
  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
  }

  if (!params.useBasicAuth) {
    body.client_id = params.clientId
    body.client_secret = params.clientSecret
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if (params.useBasicAuth) {
    headers.Authorization = `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`
  }

  const res = await fetch(params.tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body),
  })

  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status})`)
  }

  return res.json()
}
