/**
 * /api/v2/cycle/tutorial
 *
 * GET   : current tutorial progress.
 * PATCH : update cycle tour progress (lastStep, completed, dismissed).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import {
  getTutorialProgress,
  updateCycleTour,
  type CycleTourState,
} from '@/lib/cycle/tutorial-store'

export async function GET() {
  try {
    const user = await requireUser()
    const progress = await getTutorialProgress(user.id)
    return NextResponse.json(progress)
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = (await request.json()) as Partial<CycleTourState>
    const patch: Partial<CycleTourState> = {}
    if (typeof body.lastStep === 'number') patch.lastStep = Math.max(0, Math.floor(body.lastStep))
    if (typeof body.completed === 'boolean') patch.completed = body.completed
    if (typeof body.dismissed === 'boolean') patch.dismissed = body.dismissed
    if (body.completed === true) patch.finishedAt = new Date().toISOString()
    if (body.dismissed === false && body.lastStep === 0) {
      patch.completed = false
      patch.finishedAt = null
      patch.startedAt = new Date().toISOString()
    }
    const ok = await updateCycleTour(user.id, patch)
    if (!ok) return NextResponse.json({ error: 'save failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
