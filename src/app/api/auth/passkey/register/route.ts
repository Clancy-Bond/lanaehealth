/**
 * POST /api/auth/passkey/register
 *
 * Two-phase registration. The user must already be signed in.
 *
 *   phase=options          -> server returns WebAuthn registration options
 *                              the browser passes to startRegistration()
 *   phase=verify+attestation -> server verifies the attestation, persists
 *                                the credential, returns ok
 */
import { NextResponse } from 'next/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'
import {
  buildRegistrationOptions,
  verifyAndStoreRegistration,
} from '@/lib/auth/passkey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RegisterBody {
  phase?: unknown
  challengeId?: unknown
  deviceName?: unknown
  attestation?: unknown
}

export async function POST(req: Request) {
  let body: RegisterBody
  try {
    body = (await req.json()) as RegisterBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const supabase = await getSupabaseServerClient()
  const { data: userResp } = await supabase.auth.getUser()
  const user = userResp?.user
  if (!user) {
    return NextResponse.json(
      { error: 'You need to be signed in to add a passkey.' },
      { status: 401 },
    )
  }

  if (body.phase === 'options') {
    try {
      const result = await buildRegistrationOptions({
        userId: user.id,
        userEmail: user.email ?? null,
      })
      return NextResponse.json({ ok: true, options: result.options, challengeId: result.challengeId })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'could not build options' },
        { status: 500 },
      )
    }
  }

  if (body.phase === 'verify') {
    if (typeof body.challengeId !== 'string' || !body.attestation) {
      return NextResponse.json({ error: 'challengeId and attestation required' }, { status: 400 })
    }
    const deviceName =
      typeof body.deviceName === 'string' && body.deviceName.trim().length > 0
        ? body.deviceName.trim()
        : 'Passkey'

    const result = await verifyAndStoreRegistration({
      userId: user.id,
      challengeId: body.challengeId,
      response: body.attestation as RegistrationResponseJSON,
      deviceName,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'verification failed' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, credentialId: result.credentialId })
  }

  return NextResponse.json({ error: 'unknown phase' }, { status: 400 })
}
