/**
 * Server-side helpers for WebAuthn / passkeys.
 *
 * We use @simplewebauthn/server for the actual challenge generation
 * and assertion verification. This module wraps it with project-
 * specific concerns:
 *
 *   - Reading the relying party (RP) ID and origin from env so the
 *     same code works on localhost, preview deploys, and production.
 *   - Persisting challenges in passkey_challenges keyed by user_id
 *     (registration) or session_id (authentication).
 *   - Persisting credentials in passkey_credentials.
 *
 * Routes use this module via createServiceClient() since the user is
 * anonymous at the moment of authentication. RLS policies still
 * lock down anon and force authenticated reads to scope by user_id.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface PasskeyEnv {
  rpName: string
  rpID: string
  origin: string
}

/**
 * Resolve the relying party ID and expected origin from env.
 *
 * NEXT_PUBLIC_APP_URL is the app's canonical origin (e.g.
 * https://lanaehealth.vercel.app). We strip the protocol to get
 * the RP ID. In dev we accept localhost.
 */
export function readPasskeyEnv(overrideUrl?: string): PasskeyEnv {
  const raw = overrideUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3005'
  const u = new URL(raw)
  return {
    rpName: 'LanaeHealth',
    rpID: u.hostname,
    origin: `${u.protocol}//${u.host}`,
  }
}

let _serviceClient: SupabaseClient | null = null

/**
 * Service-role client for passkey routes. WebAuthn auth happens
 * before the user has a Supabase session, so the route uses the
 * service role to read the credential and to create the session
 * via admin API. RLS still forces every authenticated read to
 * scope by user_id; service-role bypass is used only here.
 */
export function getPasskeyServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set for passkey verification',
    )
  }
  _serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _serviceClient
}

export interface RegistrationOptionsResult {
  options: PublicKeyCredentialCreationOptionsJSON
  challengeId: string
}

/**
 * Build the WebAuthn registration options for an authenticated
 * user. Excludes credentials they have already registered so the
 * browser does not let them double-register the same authenticator.
 *
 * Persists the challenge so verifyRegistration() can compare.
 */
export async function buildRegistrationOptions(args: {
  userId: string
  userEmail: string | null
  env?: PasskeyEnv
  client?: SupabaseClient
}): Promise<RegistrationOptionsResult> {
  const env = args.env ?? readPasskeyEnv()
  const client = args.client ?? getPasskeyServiceClient()

  const { data: existing } = await client
    .from('passkey_credentials')
    .select('credential_id, transports')
    .eq('user_id', args.userId)

  const excludeCredentials = (existing ?? []).map((row) => ({
    id: row.credential_id as string,
    transports:
      Array.isArray(row.transports) && row.transports.length > 0
        ? (row.transports as AuthenticatorTransportFuture[])
        : undefined,
  }))

  // Encode the user id as bytes for the WebAuthn user handle.
  const userIDBytes = new TextEncoder().encode(args.userId)

  const options = await generateRegistrationOptions({
    rpName: env.rpName,
    rpID: env.rpID,
    userName: args.userEmail ?? args.userId,
    userID: userIDBytes,
    userDisplayName: args.userEmail ?? 'LanaeHealth user',
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      requireResidentKey: false,
    },
  })

  const { data: challengeRow, error } = await client
    .from('passkey_challenges')
    .insert({
      user_id: args.userId,
      session_id: null,
      kind: 'register',
      challenge: options.challenge,
    })
    .select('id')
    .single()
  if (error || !challengeRow) {
    throw new Error(`could not store challenge: ${error?.message ?? 'no row returned'}`)
  }

  return { options, challengeId: challengeRow.id as string }
}

export interface VerifyRegistrationResult {
  ok: boolean
  credentialId?: string
  error?: string
}

/**
 * Verify the browser's registration response and persist the new
 * credential. Returns the credential id on success.
 */
export async function verifyAndStoreRegistration(args: {
  userId: string
  challengeId: string
  response: RegistrationResponseJSON
  deviceName: string
  env?: PasskeyEnv
  client?: SupabaseClient
}): Promise<VerifyRegistrationResult> {
  const env = args.env ?? readPasskeyEnv()
  const client = args.client ?? getPasskeyServiceClient()

  const { data: challengeRow } = await client
    .from('passkey_challenges')
    .select('id, user_id, kind, challenge, expires_at')
    .eq('id', args.challengeId)
    .single()
  if (!challengeRow) return { ok: false, error: 'challenge expired or not found' }
  if (challengeRow.kind !== 'register') return { ok: false, error: 'wrong challenge type' }
  if (challengeRow.user_id !== args.userId) return { ok: false, error: 'challenge does not belong to user' }
  if (new Date(challengeRow.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: 'challenge expired' }
  }

  let verification: VerifiedRegistrationResponse
  try {
    verification = await verifyRegistrationResponse({
      response: args.response,
      expectedChallenge: challengeRow.challenge as string,
      expectedOrigin: env.origin,
      expectedRPID: env.rpID,
      requireUserVerification: false,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'verification failed' }
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: 'verification failed' }
  }

  const info = verification.registrationInfo
  const credential = info.credential

  // Insert the credential. credential.id is already base64url. publicKey is
  // a Uint8Array; we store it as base64.
  const publicKeyB64 = bytesToBase64(credential.publicKey)

  const { error } = await client.from('passkey_credentials').insert({
    user_id: args.userId,
    credential_id: credential.id,
    public_key: publicKeyB64,
    counter: credential.counter,
    transports: Array.isArray(credential.transports) ? credential.transports : [],
    device_name: args.deviceName.trim() || 'Passkey',
    backup_eligible: info.credentialBackedUp,
    backup_state: info.credentialBackedUp,
  })
  if (error) {
    return { ok: false, error: `could not store credential: ${error.message}` }
  }

  await client.from('passkey_challenges').delete().eq('id', args.challengeId)

  return { ok: true, credentialId: credential.id }
}

export interface AuthenticationOptionsResult {
  options: PublicKeyCredentialRequestOptionsJSON
  challengeId: string
}

/**
 * Build authentication options. We do not require allowCredentials so
 * the browser shows the OS picker for any registered passkey on this
 * RP ID.
 */
export async function buildAuthenticationOptions(args: {
  sessionId: string
  env?: PasskeyEnv
  client?: SupabaseClient
}): Promise<AuthenticationOptionsResult> {
  const env = args.env ?? readPasskeyEnv()
  const client = args.client ?? getPasskeyServiceClient()

  const options = await generateAuthenticationOptions({
    rpID: env.rpID,
    userVerification: 'preferred',
    allowCredentials: [],
  })

  const { data: row, error } = await client
    .from('passkey_challenges')
    .insert({
      user_id: null,
      session_id: args.sessionId,
      kind: 'authenticate',
      challenge: options.challenge,
    })
    .select('id')
    .single()
  if (error || !row) {
    throw new Error(`could not store challenge: ${error?.message ?? 'no row returned'}`)
  }
  return { options, challengeId: row.id as string }
}

export interface VerifyAuthenticationResult {
  ok: boolean
  userId?: string
  email?: string
  error?: string
}

/**
 * Verify the browser's authentication response. Looks up the
 * credential by the assertion's credentialId, verifies, and on
 * success returns the user id so the caller can mint a Supabase
 * session.
 */
export async function verifyAuthentication(args: {
  sessionId: string
  challengeId: string
  response: AuthenticationResponseJSON
  env?: PasskeyEnv
  client?: SupabaseClient
}): Promise<VerifyAuthenticationResult> {
  const env = args.env ?? readPasskeyEnv()
  const client = args.client ?? getPasskeyServiceClient()

  const { data: challengeRow } = await client
    .from('passkey_challenges')
    .select('id, session_id, kind, challenge, expires_at')
    .eq('id', args.challengeId)
    .single()
  if (!challengeRow) return { ok: false, error: 'challenge expired or not found' }
  if (challengeRow.kind !== 'authenticate') return { ok: false, error: 'wrong challenge type' }
  if (challengeRow.session_id !== args.sessionId) return { ok: false, error: 'session mismatch' }
  if (new Date(challengeRow.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: 'challenge expired' }
  }

  const { data: credRow } = await client
    .from('passkey_credentials')
    .select('id, user_id, credential_id, public_key, counter, transports')
    .eq('credential_id', args.response.id)
    .single()
  if (!credRow) return { ok: false, error: 'no credential matches this device' }

  let verification: VerifiedAuthenticationResponse
  try {
    verification = await verifyAuthenticationResponse({
      response: args.response,
      expectedChallenge: challengeRow.challenge as string,
      expectedOrigin: env.origin,
      expectedRPID: env.rpID,
      credential: {
        id: credRow.credential_id as string,
        publicKey: base64ToBytes(credRow.public_key as string) as Uint8Array<ArrayBuffer>,
        counter: Number(credRow.counter ?? 0),
        transports: Array.isArray(credRow.transports)
          ? (credRow.transports as AuthenticatorTransportFuture[])
          : undefined,
      },
      requireUserVerification: false,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'verification failed' }
  }
  if (!verification.verified) {
    return { ok: false, error: 'verification failed' }
  }

  await client
    .from('passkey_credentials')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', credRow.id)

  await client.from('passkey_challenges').delete().eq('id', args.challengeId)

  // Look up the user's email so callers can build a session for them.
  let email: string | undefined
  try {
    const { data: userResp } = await client.auth.admin.getUserById(credRow.user_id as string)
    email = userResp?.user?.email ?? undefined
  } catch {
    // Non-fatal: callers can still mint the session by user id.
  }

  return { ok: true, userId: credRow.user_id as string, email }
}

/**
 * Encode a byte array as base64. Used to persist the credential
 * public key without depending on Buffer in edge runtimes.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  if (typeof btoa === 'function') return btoa(s)
  return Buffer.from(bytes).toString('base64')
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const s = atob(b64)
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  }
  const buf = Buffer.from(b64, 'base64')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}
