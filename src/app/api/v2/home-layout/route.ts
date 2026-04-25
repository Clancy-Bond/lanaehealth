/**
 * /api/v2/home-layout
 *
 * GET  : returns the current user's saved home layout, or the
 *        default if none exists.
 * PUT  : upserts the user's saved layout. Body shape:
 *          { order: string[], hidden: string[] }
 *
 * Both endpoints require Supabase Auth. We never let one user
 * read or write another's layout: every query filters by the
 * authenticated user_id.
 */
import { NextResponse } from 'next/server'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import { getUserHomeLayout, setUserHomeLayout, type HomeLayout } from '@/lib/v2/home/layout-store'

export async function GET() {
  try {
    const user = await requireUser()
    const layout = await getUserHomeLayout(user.id)
    return NextResponse.json(layout)
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json()) as Partial<HomeLayout>
    const order = Array.isArray(body.order) ? body.order.filter((x) => typeof x === 'string') : null
    const hidden = Array.isArray(body.hidden) ? body.hidden.filter((x) => typeof x === 'string') : []
    if (!order) {
      return NextResponse.json({ error: 'order required' }, { status: 400 })
    }
    const ok = await setUserHomeLayout(user.id, {
      order,
      hidden,
      updated_at: new Date().toISOString(),
    })
    if (!ok) {
      return NextResponse.json({ error: 'save failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
