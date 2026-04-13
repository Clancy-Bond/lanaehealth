import { generatePermanentCore } from '@/lib/context/permanent-core'

export async function GET() {
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
