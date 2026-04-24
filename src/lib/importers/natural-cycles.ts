// Natural Cycles CSV parser
// Expected columns: Date, Temperature, Menstruation, Flow Quantity,
// Cervical Mucus Consistency, Cervical Mucus Quantity, Mood Flags,
// LH Test, Cycle Day, Cycle Number, Fertility Color, Ovulation Status, Data Flags

export interface NcRow {
  date: string
  temperature: number | null
  menstruation: string | null
  flow_quantity: string | null
  cervical_mucus_consistency: string | null
  cervical_mucus_quantity: string | null
  mood_flags: string | null
  lh_test: string | null
  cycle_day: number | null
  cycle_number: number | null
  fertility_color: string | null
  ovulation_status: string | null
  data_flags: string | null
}

export function parseNaturalCyclesCsv(csvText: string): NcRow[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  // Parse header row (handle possible BOM)
  const headerLine = lines[0].replace(/^\uFEFF/, '')
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())

  function findCol(keywords: string[]): number {
    return headers.findIndex((h) =>
      keywords.some((kw) => h.includes(kw))
    )
  }

  const dateIdx = findCol(['date'])
  const tempIdx = findCol(['temperature', 'temp'])
  const menIdx = findCol(['menstruation', 'period'])
  const flowIdx = findCol(['flow'])
  const cmcIdx = findCol(['mucus consistency', 'cm consistency', 'cervical mucus consistency'])
  const cmqIdx = findCol(['mucus quantity', 'cm quantity', 'cervical mucus quantity'])
  const moodIdx = findCol(['mood'])
  const lhIdx = findCol(['lh'])
  const cdIdx = findCol(['cycle day'])
  const cnIdx = findCol(['cycle number'])
  const fcIdx = findCol(['fertility', 'color'])
  const ovIdx = findCol(['ovulation'])
  const dfIdx = findCol(['flag', 'data flag'])

  if (dateIdx === -1) {
    throw new Error('Could not find a Date column in the CSV. Please check the file format.')
  }

  const rows: NcRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Simple CSV split (handles quoted fields with commas inside)
    const cols = splitCsvLine(line)

    const dateVal = cols[dateIdx]?.trim()
    if (!dateVal) continue

    // Normalize date to YYYY-MM-DD
    const normalizedDate = normalizeDate(dateVal)
    if (!normalizedDate) continue

    rows.push({
      date: normalizedDate,
      temperature: tempIdx >= 0 ? parseFloat(cols[tempIdx]) || null : null,
      menstruation: menIdx >= 0 ? cols[menIdx]?.trim() || null : null,
      flow_quantity: flowIdx >= 0 ? cols[flowIdx]?.trim() || null : null,
      cervical_mucus_consistency: cmcIdx >= 0 ? cols[cmcIdx]?.trim() || null : null,
      cervical_mucus_quantity: cmqIdx >= 0 ? cols[cmqIdx]?.trim() || null : null,
      mood_flags: moodIdx >= 0 ? cols[moodIdx]?.trim() || null : null,
      lh_test: lhIdx >= 0 ? cols[lhIdx]?.trim() || null : null,
      cycle_day: cdIdx >= 0 ? parseInt(cols[cdIdx]) || null : null,
      cycle_number: cnIdx >= 0 ? parseInt(cols[cnIdx]) || null : null,
      fertility_color: fcIdx >= 0 ? cols[fcIdx]?.trim() || null : null,
      ovulation_status: ovIdx >= 0 ? cols[ovIdx]?.trim() || null : null,
      data_flags: dfIdx >= 0 ? cols[dfIdx]?.trim() || null : null,
    })
  }

  return rows
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

/**
 * Set menstruation = 'MENSTRUATION' when flow_quantity indicates a real
 * menstrual flow but the source row left menstruation null. Idempotent and
 * non-destructive: any explicit menstruation value (including SPOTTING) is
 * preserved verbatim.
 *
 * Why this exists (2026-04-23 Phase 1 audit, Bug 2): Natural Cycles exports
 * after roughly 2026-03 stopped setting the menstruation tag for some
 * recorded periods, leaving flow_quantity (HEAVY/MEDIUM/LIGHT) populated
 * while menstruation = null. Any caller filtering on menstruation =
 * 'MENSTRUATION' silently lost those periods. Normalizing at the import
 * path keeps the database authoritative; the matching backfill UPDATE for
 * already-imported rows lives at
 * src/lib/migrations/029_normalize_nc_imported_menstruation.sql.
 *
 * Real-flow values come from the Natural Cycles export schema and use upper
 * case (HEAVY/MEDIUM/LIGHT). SPOTTING / NONE / UNCATEGORIZED are NOT real
 * menstrual flow and remain untagged.
 */
export function normalizeMenstruation(
  menstruation: string | null,
  flowQuantity: string | null,
): string | null {
  if (menstruation && menstruation.trim().length > 0) return menstruation
  if (!flowQuantity) return menstruation
  const normalized = flowQuantity.trim().toUpperCase()
  if (normalized === 'SPOTTING' || normalized === 'NONE' || normalized === 'UNCATEGORIZED') {
    return menstruation
  }
  return 'MENSTRUATION'
}

function normalizeDate(dateStr: string): string | null {
  // Try common formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return dateStr.slice(0, 10)

  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashMatch) {
    const [, a, b, year] = slashMatch
    // Assume MM/DD/YYYY for US-style
    return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
  }

  const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (dashMatch) {
    const [, a, b, year] = dashMatch
    return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
  }

  return null
}
