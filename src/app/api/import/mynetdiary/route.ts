import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseMyNetDiaryCsv, MndRow, MndMacros } from '@/lib/importers/mynetdiary'
import { detectTriggers } from '@/lib/food-triggers'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import {
  enforceActualSize,
  enforceDeclaredSize,
  DEFAULT_UPLOAD_LIMIT_BYTES,
  rateLimit,
  clientKey,
} from '@/lib/upload-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const IMPORT_LIMITER = rateLimit({ windowMs: 60_000, max: 5 })

interface GroupedEntry {
  date: string
  meal_type: string
  food_names: string[]
  total_calories: number
  macros: MndMacros
  raw_lines: string[]
}

function sumMacros(existing: MndMacros, incoming: MndMacros): MndMacros {
  return {
    fat: addNullable(existing.fat, incoming.fat),
    carbs: addNullable(existing.carbs, incoming.carbs),
    protein: addNullable(existing.protein, incoming.protein),
    fiber: addNullable(existing.fiber, incoming.fiber),
    sugar: addNullable(existing.sugar, incoming.sugar),
    sodium: addNullable(existing.sodium, incoming.sodium),
  }
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null
  return (a ?? 0) + (b ?? 0)
}

export async function POST(request: NextRequest) {
  const sizeDeny = enforceDeclaredSize(request, DEFAULT_UPLOAD_LIMIT_BYTES)
  if (sizeDeny) return sizeDeny
  if (!IMPORT_LIMITER.consume(clientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  // Resolve user_id so MND food entries land under THIS user.
  let userId: string
  try {
    const r = await resolveUserId()
    userId = r.userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (file.size > DEFAULT_UPLOAD_LIMIT_BYTES) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
    }

    const csvText = await file.text()
    const actualDeny = enforceActualSize(Buffer.byteLength(csvText, 'utf8'), DEFAULT_UPLOAD_LIMIT_BYTES)
    if (actualDeny) return actualDeny
    const rows = parseMyNetDiaryCsv(csvText)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    // Group rows by date + meal_type
    const groupKey = (r: MndRow) => `${r.date}|${r.meal_type}`
    const grouped = new Map<string, GroupedEntry>()

    for (const row of rows) {
      const key = groupKey(row)
      const existing = grouped.get(key)

      if (existing) {
        existing.food_names.push(row.food_items)
        existing.total_calories += row.calories ?? 0
        existing.macros = sumMacros(existing.macros, row.macros)
        existing.raw_lines.push(row.raw_line)
      } else {
        grouped.set(key, {
          date: row.date,
          meal_type: row.meal_type,
          food_names: [row.food_items],
          total_calories: row.calories ?? 0,
          macros: { ...row.macros },
          raw_lines: [row.raw_line],
        })
      }
    }

    const supabase = createServiceClient()

    // Collect all unique dates and ensure daily_logs exist
    const uniqueDates = [...new Set(rows.map((r) => r.date))].sort()
    const logIdByDate = new Map<string, string>()

    // Fetch existing daily_logs for these dates (this user only)
    const { data: existingLogs, error: logsErr } = await supabase
      .from('daily_logs')
      .select('id, date')
      .eq('user_id', userId)
      .in('date', uniqueDates)

    if (logsErr) {
      return NextResponse.json(
        { error: `Failed to query daily_logs: ${logsErr.message}` },
        { status: 500 }
      )
    }

    for (const log of existingLogs ?? []) {
      logIdByDate.set(log.date, log.id)
    }

    // Create missing daily_logs (stamped with this user_id).
    const missingDates = uniqueDates.filter((d) => !logIdByDate.has(d))
    if (missingDates.length > 0) {
      const { data: newLogs, error: createErr } = await supabase
        .from('daily_logs')
        .insert(missingDates.map((d) => ({ user_id: userId, date: d })))
        .select('id, date')

      if (createErr) {
        return NextResponse.json(
          { error: `Failed to create daily_logs: ${createErr.message}` },
          { status: 500 }
        )
      }

      for (const log of newLogs ?? []) {
        logIdByDate.set(log.date, log.id)
      }
    }

    // Build food_entries upsert rows (each stamped with this user_id).
    const upsertRows = [...grouped.values()].map((entry) => {
      const foodItemsText = entry.food_names.join(', ')
      const triggers = detectTriggers(foodItemsText)
      const flaggedTriggers = triggers.map((t) => t.category)

      return {
        user_id: userId,
        log_id: logIdByDate.get(entry.date)!,
        meal_type: entry.meal_type,
        food_items: foodItemsText,
        calories: entry.total_calories || null,
        macros: entry.macros,
        flagged_triggers: flaggedTriggers,
        logged_at: new Date().toISOString(),
      }
    })

    // Batch insert in chunks of 500
    const chunkSize = 500
    let totalUpserted = 0

    for (let i = 0; i < upsertRows.length; i += chunkSize) {
      const chunk = upsertRows.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('food_entries')
        .insert(chunk)

      if (error) {
        return NextResponse.json(
          {
            error: `Import failed at batch ${Math.floor(i / chunkSize) + 1}: ${error.message}`,
            imported_so_far: totalUpserted,
          },
          { status: 500 }
        )
      }
      totalUpserted += chunk.length
    }

    return NextResponse.json({
      success: true,
      imported: totalUpserted,
      totalFoodRowsParsed: rows.length,
      dateRange: {
        start: uniqueDates[0],
        end: uniqueDates[uniqueDates.length - 1],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
