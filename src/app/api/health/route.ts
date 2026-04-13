import { createServiceClient } from '@/lib/supabase'

export async function GET() {
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
