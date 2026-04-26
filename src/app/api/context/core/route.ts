import { generatePermanentCore } from '@/lib/context/permanent-core'
import { requireAuth } from '@/lib/auth/require-user'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'

export async function GET(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  let userId: string
  try {
    const r = await resolveUserId()
    userId = r.userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return Response.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return Response.json({ error: 'auth check failed' }, { status: 500 })
  }

  try {
    const core = await generatePermanentCore(userId)

    return Response.json({
      core,
      tokenEstimate: Math.round(core.length / 4),
      charCount: core.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { error: message },
      { status: 500 }
    )
  }
}
