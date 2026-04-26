/**
 * POST /api/calories/recipes/log-serving
 *
 * Insert N servings of a saved recipe into food_entries on a target
 * day + meal. Per-serving nutrition multiplied by servings.
 *
 * Body: {
 *   recipeId: string,
 *   servings?: number  (default 1),
 *   targetMeal?: 'breakfast' | 'lunch' | 'dinner' | 'snack' (default 'snack'),
 *   targetDate?: 'YYYY-MM-DD' (default today)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { findSavedRecipe } from '@/lib/api/recipes'
import { findRecipe as findCustomRecipe } from '@/lib/calories/recipes'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  let body: Record<string, unknown> = {}
  const ct = req.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/json')) {
      body = (await req.json()) as Record<string, unknown>
    } else {
      const fd = await req.formData()
      for (const [k, v] of fd.entries()) {
        body[k] = typeof v === 'string' ? v : v.name
      }
    }
  } catch {
    return NextResponse.json({ error: 'Bad body.' }, { status: 400 })
  }

  const recipeId = String(body.recipeId ?? '').trim()
  if (!recipeId) {
    return NextResponse.json({ error: 'recipeId required.' }, { status: 400 })
  }

  const rawServings = Number(body.servings ?? 1)
  const servings = Number.isFinite(rawServings) && rawServings > 0 ? rawServings : 1

  const rawMeal = String(body.targetMeal ?? 'snack').toLowerCase()
  const meal = VALID_MEALS.has(rawMeal) ? rawMeal : 'snack'

  const rawDate = String(body.targetDate ?? '')
  const targetDate = DATE_RE.test(rawDate) ? rawDate : format(new Date(), 'yyyy-MM-dd')

  let name: string
  let calories: number
  let macros: Record<string, number>

  const saved = await findSavedRecipe(recipeId)
  if (saved) {
    name = saved.name
    calories = saved.caloriesPerServing
    macros = {
      protein: saved.nutritionPerServing.protein,
      carbs: saved.nutritionPerServing.carbs,
      fat: saved.nutritionPerServing.fat,
      ...(saved.nutritionPerServing.fiber !== undefined ? { fiber: saved.nutritionPerServing.fiber } : {}),
      ...(saved.nutritionPerServing.sugar !== undefined ? { sugar: saved.nutritionPerServing.sugar } : {}),
      ...(saved.nutritionPerServing.sodium !== undefined ? { sodium: saved.nutritionPerServing.sodium } : {}),
    }
  } else {
    const legacy = await findCustomRecipe(recipeId)
    if (!legacy) {
      return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 })
    }
    name = legacy.name
    calories = legacy.perServing.calories
    macros = legacy.perServing.macros as Record<string, number>
  }

  const sb = createServiceClient()

  // daily_logs and food_entries are legacy single-tenant tables (no
  // user_id column). Look up by date alone; the caller has already
  // been authenticated above.
  void userId
  const { data: existing } = await sb
    .from('daily_logs')
    .select('id')
    .eq('date', targetDate)
    .maybeSingle()
  let logId = (existing as { id: string } | null)?.id ?? null
  if (!logId) {
    const { data: inserted, error } = await sb
      .from('daily_logs')
      .insert({ date: targetDate })
      .select('id')
      .single()
    if (error || !inserted) {
      return NextResponse.json(
        { error: `Could not create daily_log: ${error?.message ?? 'no row'}` },
        { status: 500 },
      )
    }
    logId = (inserted as { id: string }).id
  }

  const scale = servings
  const scaledMacros: Record<string, number> = {}
  for (const [k, v] of Object.entries(macros)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      scaledMacros[k] = Number((v * scale).toFixed(2))
    }
  }

  const row = {
    log_id: logId,
    meal_type: meal,
    food_items: servings === 1 ? name : `${name} (x ${servings})`,
    calories: Math.round(calories * scale),
    macros: scaledMacros,
    flagged_triggers: [] as string[],
  }

  const { error: insErr } = await sb.from('food_entries').insert(row)
  if (insErr) {
    return NextResponse.json(
      { error: `Could not log: ${insErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { ok: true, targetDate, targetMeal: meal, servings },
    { status: 200 },
  )
}
