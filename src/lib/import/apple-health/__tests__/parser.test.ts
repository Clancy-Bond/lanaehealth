/**
 * Unit tests for the Apple Health parser layer.
 *
 * Covers the zip / xml extractor (the new layer) and the preview
 * builder. The underlying record-by-record xml parser at
 * src/lib/importers/apple-health.ts is exercised indirectly here
 * and has its own existing coverage in the legacy importer.
 */
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import {
  extractExportXml,
  parseAppleHealthExport,
  summarizeForPreview,
  AppleHealthParseError,
  parseAppleHealthXml,
} from '@/lib/import/apple-health/parser'

const MINIMAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" startDate="2026-04-20 08:00:00 +0000" endDate="2026-04-20 09:00:00 +0000" value="1200"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Withings" startDate="2026-04-21 06:00:00 +0000" endDate="2026-04-21 06:00:00 +0000" value="62.5"/>
  <Record type="HKCategoryTypeIdentifierMenstrualFlow" sourceName="Health" startDate="2026-04-22 08:00:00 +0000" endDate="2026-04-22 08:00:00 +0000" value="3"/>
  <Record type="HKQuantityTypeIdentifierBloodPressureSystolic" sourceName="OMRON" startDate="2026-04-22 19:00:00 +0000" endDate="2026-04-22 19:00:00 +0000" value="118"/>
  <Record type="HKQuantityTypeIdentifierBloodPressureDiastolic" sourceName="OMRON" startDate="2026-04-22 19:00:00 +0000" endDate="2026-04-22 19:00:00 +0000" value="76"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-22 03:00:00 +0000" endDate="2026-04-22 11:00:00 +0000" value="2"/>
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="Strava" startDate="2026-04-22 17:00:00 +0000" endDate="2026-04-22 18:00:00 +0000" value="450"/>
  <Record type="HKQuantityTypeIdentifierDietaryEnergyConsumed" sourceName="MyFitnessPal" startDate="2026-04-22 12:00:00 +0000" endDate="2026-04-22 12:00:00 +0000" value="1850"/>
</HealthData>`

async function buildZip(entries: Record<string, string>): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip()
  for (const [name, body] of Object.entries(entries)) {
    zip.file(name, body)
  }
  const out = await zip.generateAsync({ type: 'uint8array' })
  // Force-copy into a plain ArrayBuffer so the resulting view's buffer
  // type is ArrayBuffer (not ArrayBufferLike, which TS treats as
  // possibly-SharedArrayBuffer). This matches the parser's signature.
  const copy = new Uint8Array(out.length)
  copy.set(out)
  return copy as Uint8Array<ArrayBuffer>
}

describe('extractExportXml', () => {
  it('returns raw xml as-is when given an xml buffer', async () => {
    const buf = new TextEncoder().encode(MINIMAL_XML)
    const text = await extractExportXml(buf, 'export.xml')
    expect(text).toContain('<HealthData')
    expect(text).toContain('HKQuantityTypeIdentifierStepCount')
  })

  it('extracts xml from a zip with apple_health_export/export.xml', async () => {
    const zipBytes = await buildZip({
      'apple_health_export/export.xml': MINIMAL_XML,
      'apple_health_export/electrocardiograms/foo.csv': 'irrelevant',
    })
    const text = await extractExportXml(zipBytes, 'export.zip')
    expect(text).toContain('<HealthData')
  })

  it('extracts xml from a zip that puts export.xml at the root', async () => {
    const zipBytes = await buildZip({ 'export.xml': MINIMAL_XML })
    const text = await extractExportXml(zipBytes)
    expect(text).toContain('<HealthData')
  })

  it('throws AppleHealthParseError for non-Apple-Health text', async () => {
    const buf = new TextEncoder().encode('hello world, not health data')
    await expect(extractExportXml(buf, 'notes.xml')).rejects.toThrow(AppleHealthParseError)
  })

  it('throws AppleHealthParseError for a zip with no export.xml inside', async () => {
    const zipBytes = await buildZip({ 'random.txt': 'something else' })
    await expect(extractExportXml(zipBytes, 'random.zip')).rejects.toThrow(
      AppleHealthParseError,
    )
  })

  it('throws AppleHealthParseError if the inner xml is empty', async () => {
    const zipBytes = await buildZip({ 'apple_health_export/export.xml': '' })
    await expect(extractExportXml(zipBytes, 'export.zip')).rejects.toThrow(
      AppleHealthParseError,
    )
  })
})

describe('parseAppleHealthXml + summarizeForPreview', () => {
  it('produces a non-empty preview from the minimal xml fixture', () => {
    const parsed = parseAppleHealthXml(MINIMAL_XML)
    const preview = summarizeForPreview(parsed)
    expect(preview.recordCount).toBe(8)
    expect(preview.daysProcessed).toBeGreaterThan(0)
    expect(preview.dateRange.start).toMatch(/^2026-04-/)
    expect(preview.dateRange.end).toMatch(/^2026-04-/)
    expect(preview.sources).toEqual(
      expect.arrayContaining(['iPhone', 'Withings', 'OMRON', 'Apple Watch']),
    )
  })

  it('counts cycle days, weight entries, BP readings, and step days', () => {
    const parsed = parseAppleHealthXml(MINIMAL_XML)
    const preview = summarizeForPreview(parsed)
    expect(preview.counts.cycleDays).toBeGreaterThanOrEqual(1)
    expect(preview.counts.weightEntries).toBe(1)
    expect(preview.counts.bpReadings).toBe(1)
    expect(preview.counts.stepDays).toBe(1)
    expect(preview.counts.nutritionDays).toBeGreaterThanOrEqual(1)
  })

  it('handles xml with zero <Record> rows without crashing', () => {
    const empty = '<?xml version="1.0"?><HealthData></HealthData>'
    const parsed = parseAppleHealthXml(empty)
    const preview = summarizeForPreview(parsed)
    expect(preview.recordCount).toBe(0)
    expect(preview.daysProcessed).toBe(0)
  })
})

describe('parseAppleHealthExport', () => {
  it('round-trips a zip end-to-end into a parsed + preview pair', async () => {
    const zipBytes = await buildZip({ 'apple_health_export/export.xml': MINIMAL_XML })
    const result = await parseAppleHealthExport(zipBytes, 'export.zip')
    expect(result.parsed.recordCount).toBe(8)
    expect(result.preview.recordCount).toBe(8)
    expect(result.preview.counts.weightEntries).toBe(1)
  })
})
