/**
 * /api/v2/cycle/messages/[id]
 *
 * PATCH: dismiss the message (sets dismissed = true).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import { dismissMessage } from '@/lib/cycle/messages-store'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as { dismissed?: boolean }
    if (body.dismissed !== true) {
      return NextResponse.json({ error: 'only dismissal supported' }, { status: 400 })
    }
    const ok = await dismissMessage(user.id, id)
    if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
