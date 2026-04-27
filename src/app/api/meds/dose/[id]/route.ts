/**
 * DELETE /api/meds/dose/[id]
 *
 * Undo a dose log. Used by the home meds card's tap-to-uncheck flow
 * and the Undo toast that appears immediately after a tap.
 */
import { NextResponse } from 'next/server'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import { deleteDose } from '@/lib/meds/dose-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string | null = null
  try {
    const user = await requireUser()
    userId = user.id
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
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
