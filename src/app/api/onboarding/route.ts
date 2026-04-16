/**
 * Onboarding API Route
 *
 * GET  /api/onboarding - Returns existing onboarding data (or null if none)
 * POST /api/onboarding - Creates or updates onboarding record
 *
 * Uses the user_onboarding table via service client.
 */

import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('user_onboarding')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ data })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      conditions?: string[]
      goals?: string[]
      active_sections?: string[]
      custom_trackables_created?: string[]
      other_condition?: string
    }

    if (!body.conditions || !body.goals || !body.active_sections) {
      return Response.json(
        { error: 'Missing required fields: conditions, goals, active_sections' },
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    // Check if an onboarding record already exists
    const { data: existing } = await supabase
      .from('user_onboarding')
      .select('id')
      .limit(1)
      .maybeSingle()

    const record = {
      conditions: body.conditions,
      goals: body.goals,
      active_sections: body.active_sections,
      custom_trackables_created: body.custom_trackables_created ?? [],
      other_condition: body.other_condition ?? null,
      completed_at: new Date().toISOString(),
    }

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('user_onboarding')
        .update(record)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      return Response.json({ data })
    }

    // Create new record
    const { data, error } = await supabase
      .from('user_onboarding')
      .insert(record)
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ data })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
