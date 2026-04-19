import { generatePermanentCore } from '@/lib/context/permanent-core'
import { requireAuth } from '@/lib/auth/require-user'

export async function GET(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  try {
    const core = await generatePermanentCore()

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
