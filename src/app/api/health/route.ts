import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  try {
    const supabase = createServiceClient()

    const [dailyLogsResult, ouraDailyResult] = await Promise.all([
      supabase.from('daily_logs').select('*', { count: 'exact', head: true }),
      supabase.from('oura_daily').select('*', { count: 'exact', head: true }),
    ])

    if (dailyLogsResult.error) throw dailyLogsResult.error
    if (ouraDailyResult.error) throw ouraDailyResult.error

    return Response.json({
      status: 'connected',
      daily_logs: dailyLogsResult.count,
      oura_daily: ouraDailyResult.count,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}
