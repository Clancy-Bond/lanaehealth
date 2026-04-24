import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseNaturalCyclesCsv, normalizeMenstruation } from '@/lib/importers/natural-cycles'
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

export async function POST(request: NextRequest) {
  const sizeDeny = enforceDeclaredSize(request, DEFAULT_UPLOAD_LIMIT_BYTES)
  if (sizeDeny) return sizeDeny
  if (!IMPORT_LIMITER.consume(clientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
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
    const rows = parseNaturalCyclesCsv(csvText)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Upsert rows into nc_imported (date is unique).
    //
    // Normalization (2026-04-23): NC exports after roughly 2026-03 stopped
    // setting the menstruation string for some recorded periods, leaving
    // flow_quantity (HEAVY/MEDIUM/LIGHT) populated while menstruation = null.
    // Any caller that filters menstruation = 'MENSTRUATION' silently lost
    // those periods. Backfill at the import path so the database is the
    // source of truth: when flow_quantity indicates a real flow (not
    // spotting / none / uncategorized) AND the source row did not already
    // set an explicit menstruation tag, we tag the row MENSTRUATION. We
    // never overwrite an existing menstruation value, so user-confirmed
    // SPOTTING and friends survive untouched.
    const upsertRows = rows.map((r) => ({
      ...r,
      menstruation: normalizeMenstruation(r.menstruation, r.flow_quantity),
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
