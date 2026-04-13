import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseNaturalCyclesCsv } from '@/lib/importers/natural-cycles'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const csvText = await file.text()
    const rows = parseNaturalCyclesCsv(csvText)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Upsert rows into nc_imported (date is unique)
    const upsertRows = rows.map((r) => ({
      ...r,
      imported_at: new Date().toISOString(),
    }))

    // Batch upsert in chunks of 500 to avoid payload limits
    const chunkSize = 500
    let totalUpserted = 0

    for (let i = 0; i < upsertRows.length; i += chunkSize) {
      const chunk = upsertRows.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('nc_imported')
        .upsert(chunk, { onConflict: 'date' })

      if (error) {
        return NextResponse.json(
          { error: `Import failed at row ${i}: ${error.message}`, imported_so_far: totalUpserted },
          { status: 500 }
        )
      }
      totalUpserted += chunk.length
    }

    // Sort dates for range
    const sortedDates = rows.map((r) => r.date).sort()

    return NextResponse.json({
      success: true,
      imported: totalUpserted,
      dateRange: {
        start: sortedDates[0],
        end: sortedDates[sortedDates.length - 1],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
