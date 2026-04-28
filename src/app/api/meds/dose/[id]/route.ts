/**
 * DELETE /api/meds/dose/[id]
 *
 * Undo a dose log. Used by the home meds card's tap-to-uncheck flow
 * and the Undo toast that appears immediately after a tap.
 */
import { NextResponse } from 'next/server'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { deleteDose } from '@/lib/meds/dose-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string | null = null
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json(
        { ok: false, error: 'unauthenticated (no session and OWNER_USER_ID unset)' },
        { status: 401 },
      )
    }
    return NextResponse.json({ ok: false, error: 'auth check failed' }, { status: 500 })
  }

  const { id } = await params
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
  }

  const result = await deleteDose({ userId, id })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? 'delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
