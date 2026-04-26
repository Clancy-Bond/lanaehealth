/**
 * Apple Health zip / xml parser
 *
 * Apple Health's "Export All Health Data" produces a .zip whose root
 * contains apple_health_export/export.xml plus a few sidecar files
 * (electrocardiograms, workout-routes). For our purposes we only
 * need export.xml. This file knows how to:
 *
 *   - Detect whether an upload is a raw export.xml or the zip wrapper
 *     and pull the xml text out of the zip.
 *   - Run the XML through the existing record-by-record parser at
 *     src/lib/importers/apple-health.ts.
 *   - Build a "preview" object the upload UI uses to summarise the
 *     export before the user clicks Confirm.
 *
 * The previous implementation only supported raw XML uploads, which
 * forced people to unzip on macOS or iOS first. Native iOS doesn't
 * even surface that step nicely. Accepting the zip directly is the
 * step that turns Apple Health into a real onboarding option.
 */
import JSZip from 'jszip'
import {
  parseAppleHealthXml,
  type ParsedHealthData,
} from '@/lib/importers/apple-health'

// Apple Health zips can ship with the xml file in slightly different
// places depending on iOS version. Newer exports use
// apple_health_export/export.xml; some older ones drop the xml at the
// root. We accept both.
const KNOWN_XML_ENTRY_NAMES = [
  'apple_health_export/export.xml',
  'export.xml',
]

const HEALTH_DATA_HINT = '<HealthData'
const RECORD_HINT = '<Record'

/**
 * Counts surfaced in the upload UI before the user confirms. This is
 * intentionally a small subset of what the parser tracks — we want
 * the user to recognise their data, not to read a full schema dump.
 */
export interface ApplePreview {
  recordCount: number
  daysProcessed: number
  dateRange: { start: string; end: string }
  sources: string[]
  counts: {
    sleepHours: number
    workouts: number
    weightEntries: number
    heartRateSamples: number
    bpReadings: number
    stepDays: number
    cycleDays: number
    nutritionDays: number
  }
}

export class AppleHealthParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppleHealthParseError'
  }
}

/**
 * Pulls the export.xml string out of either a raw xml buffer or a
 * zip buffer. Throws AppleHealthParseError with a friendly message
 * the API route can pass straight back to the user.
 */
export async function extractExportXml(
  bytes: ArrayBuffer | Uint8Array,
  filenameHint?: string,
): Promise<string> {
  const buf =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const looksLikeZip = isZipMagic(buf) || filenameHint?.toLowerCase().endsWith('.zip')

  if (!looksLikeZip) {
    const text = new TextDecoder('utf-8').decode(buf)
    if (!text.includes(HEALTH_DATA_HINT) && !text.includes(RECORD_HINT)) {
      throw new AppleHealthParseError(
        'This does not look like an Apple Health export. Upload the export.zip from the Health app.',
      )
    }
    return text
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buf)
  } catch (err) {
    throw new AppleHealthParseError(
      `Could not open the zip file. ${err instanceof Error ? err.message : ''}`.trim(),
    )
  }

  let xmlEntry: JSZip.JSZipObject | null = null
  for (const name of KNOWN_XML_ENTRY_NAMES) {
    const candidate = zip.file(name)
    if (candidate) {
      xmlEntry = candidate
      break
    }
  }
  if (!xmlEntry) {
    // Last-resort: any file that ends in /export.xml.
    const all = Object.keys(zip.files)
    const fallback = all.find((n) => n.toLowerCase().endsWith('export.xml'))
    if (fallback) xmlEntry = zip.file(fallback)
  }

  if (!xmlEntry) {
    throw new AppleHealthParseError(
      'export.xml was not found in the zip. Make sure you used Health > Export All Health Data.',
    )
  }

  const xmlText = await xmlEntry.async('string')
  if (!xmlText.includes(HEALTH_DATA_HINT) && !xmlText.includes(RECORD_HINT)) {
    throw new AppleHealthParseError(
      'The export.xml inside the zip is empty or unreadable.',
    )
  }
  return xmlText
}

/**
 * Builds the preview the upload UI shows. This walks the parsed
 * daily summaries once and counts the categories the user actually
 * cares about: did we see your sleep, your weight, your workouts,
 * your blood pressure cuff readings.
 */
export function summarizeForPreview(parsed: ParsedHealthData): ApplePreview {
  const counts = {
    sleepHours: 0,
    workouts: 0,
    weightEntries: 0,
    heartRateSamples: 0,
    bpReadings: 0,
    stepDays: 0,
    cycleDays: 0,
    nutritionDays: 0,
  }

  for (const summary of parsed.dailySummaries.values()) {
    if (summary.sleepHours && summary.sleepHours > 0) counts.sleepHours += 1
    if (summary.weight !== null) counts.weightEntries += 1
    if (summary.heartRateAvg !== null) counts.heartRateSamples += 1
    if (summary.bpSystolic !== null || summary.bpDiastolic !== null) counts.bpReadings += 1
    if (summary.steps !== null) counts.stepDays += 1
    if (
      summary.menstrualFlow ||
      summary.basalTemp !== null ||
      summary.cervicalMucus ||
      summary.ovulationTest
    ) {
      counts.cycleDays += 1
    }
    if (
      summary.calories !== null ||
      summary.protein !== null ||
      summary.fat !== null ||
      summary.carbs !== null
    ) {
      counts.nutritionDays += 1
    }
  }

  // Workouts arrive as <Workout> elements rather than <Record> rows;
  // the legacy parser does not yet count them. We approximate from
  // active-energy days, which lights up whenever Apple Watch / Strava
  // / Peloton wrote a workout. A second pass against the raw xml
  // would be more precise but we already burned a full pass parsing.
  for (const summary of parsed.dailySummaries.values()) {
    if (summary.activeEnergy && summary.activeEnergy > 50) counts.workouts += 1
  }

  return {
    recordCount: parsed.recordCount,
    daysProcessed: parsed.dailySummaries.size,
    dateRange: parsed.dateRange,
    sources: parsed.sources,
    counts,
  }
}

/**
 * One-call helper for the preview endpoint: zip / xml -> preview.
 */
export async function parseAppleHealthExport(
  bytes: ArrayBuffer | Uint8Array,
  filenameHint?: string,
): Promise<{ parsed: ParsedHealthData; preview: ApplePreview }> {
  const xmlText = await extractExportXml(bytes, filenameHint)
  const parsed = parseAppleHealthXml(xmlText)
  const preview = summarizeForPreview(parsed)
  return { parsed, preview }
}

function isZipMagic(buf: Uint8Array): boolean {
  // PK\x03\x04 (local file header) or PK\x05\x06 (empty zip) or
  // PK\x07\x08 (split zip). We only need the first two bytes.
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b
}

export { parseAppleHealthXml } from '@/lib/importers/apple-health'
export type { ParsedHealthData, DailySummary } from '@/lib/importers/apple-health'
