/**
 * Today's Medication Doses API
 * GET /api/medications/today
 *
 * Returns medication doses taken today from medical_timeline.
 * Used by MedTimeline component to build onset/peak/duration curves.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await sb
    .from('medical_timeline')
    .select('date, title, description')
    .eq('event_type', 'medication_change')
    .eq('date', today)
    .ilike('title', '%taken%')
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ doses: [], error: error.message })
  }

  // Parse events into { name, dose, takenAt: "HH:MM" }
  type Dose = { name: string; dose: string | null; takenAt: string }
  const doses: Dose[] = []

  for (const event of data ?? []) {
    const title = (event.title as string) ?? ''
    const desc = (event.description as string) ?? ''

    // Extract name: "Tylenol 500mg taken" or "Iron Supplement taken"
    const nameMatch = title.match(/^(.+?)\s+(?:\d+\s*(?:mg|mcg|g|ml|IU|iu))?\s*(?:taken|logged)/i)
    let name = nameMatch?.[1]?.trim() ?? title.replace(/\s+taken.*$/i, '').trim()

    // Extract dose from title
    const doseMatch = title.match(/(\d+\s*(?:mg|mcg|g|ml|IU|iu))/i)
    const dose = doseMatch?.[1]?.trim() ?? null

    // If name contains dose, separate them
    if (dose && name.includes(dose)) {
      name = name.replace(dose, '').trim()
    }

    // Extract time from description: "Logged at 8:32:15 AM"
    const timeMatch = desc.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i)
    let takenAt = '08:00'
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10)
      const minutes = timeMatch[2]
      const meridiem = timeMatch[3]?.toUpperCase()
      if (meridiem === 'PM' && hours < 12) hours += 12
      if (meridiem === 'AM' && hours === 12) hours = 0
      takenAt = `${String(hours).padStart(2, '0')}:${minutes}`
    }

    if (name) {
      doses.push({ name, dose, takenAt })
    }
  }

  return NextResponse.json({ doses })
}
