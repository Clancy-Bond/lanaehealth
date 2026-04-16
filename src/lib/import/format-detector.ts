/**
 * Universal Import Engine -- Format Detection
 *
 * Detects file format from content, MIME type, and extension.
 * Uses a layered approach: extension -> MIME -> content sniffing -> known patterns.
 */

import type { DetectedFormat, FormatDetectionResult } from './types'

// ── Extension Mapping ──────────────────────────────────────────────

const EXTENSION_MAP: Record<string, DetectedFormat[]> = {
  '.json': ['fhir-bundle', 'fhir-resource', 'json-flo', 'json-clue', 'json-generic'],
  '.xml':  ['ccda-xml', 'apple-health-xml', 'xml-generic'],
  '.csv':  ['csv-mynetdiary', 'csv-natural-cycles', 'csv-cronometer', 'csv-mfp', 'csv-bearable', 'csv-daylio', 'csv-generic'],
  '.pdf':  ['pdf-medical'],
  '.txt':  ['text-plain'],
  '.fit':  ['fit-garmin'],
  '.tcx':  ['tcx-workout'],
  '.gpx':  ['gpx-route'],
  '.png':  ['image-medical'],
  '.jpg':  ['image-medical'],
  '.jpeg': ['image-medical'],
  '.webp': ['image-medical'],
  '.gif':  ['image-medical'],
  '.heic': ['image-medical'],
}

// ── Content Sniffers ───────────────────────────────────────────────

function sniffJson(content: string): { format: DetectedFormat; confidence: number; hints: string[] } {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { format: 'json-generic', confidence: 0, hints: [] }
  }

  try {
    const parsed = JSON.parse(trimmed)
    const obj = Array.isArray(parsed) ? parsed[0] : parsed

    // FHIR Bundle detection
    if (obj?.resourceType === 'Bundle' && obj?.entry) {
      return { format: 'fhir-bundle', confidence: 0.95, hints: ['FHIR Bundle with resourceType and entry array'] }
    }

    // Single FHIR resource
    if (obj?.resourceType && typeof obj.resourceType === 'string') {
      const knownResources = [
        'Patient', 'Observation', 'Condition', 'MedicationRequest',
        'DiagnosticReport', 'AllergyIntolerance', 'Immunization',
        'Procedure', 'Encounter', 'MedicationStatement',
      ]
      if (knownResources.includes(obj.resourceType)) {
        return { format: 'fhir-resource', confidence: 0.9, hints: [`FHIR ${obj.resourceType} resource`] }
      }
    }

    // Flo export detection
    if (obj?.cycles || obj?.period_data || (obj?.user && obj?.menstruation)) {
      return { format: 'json-flo', confidence: 0.8, hints: ['Flo period tracker export structure'] }
    }

    // Clue export detection
    if (obj?.tracking_data || obj?.cycle_history || (obj?.data && obj?.cycle_phases)) {
      return { format: 'json-clue', confidence: 0.8, hints: ['Clue period tracker export structure'] }
    }

    return { format: 'json-generic', confidence: 0.5, hints: ['Valid JSON, unknown schema'] }
  } catch {
    return { format: 'json-generic', confidence: 0.1, hints: ['Content starts with { or [ but failed JSON parse'] }
  }
}

function sniffXml(content: string): { format: DetectedFormat; confidence: number; hints: string[] } {
  const upper = content.slice(0, 2000).toUpperCase()

  // C-CDA / CCD detection
  if (
    upper.includes('CLINICALDOCUMENT') ||
    upper.includes('URN:HL7-ORG:V3') ||
    upper.includes('CDA:') ||
    upper.includes('CONTINUITYOFCAREDOCUMENT') ||
    upper.includes('CCDA') ||
    (upper.includes('<COMPONENT') && upper.includes('<SECTION'))
  ) {
    return { format: 'ccda-xml', confidence: 0.9, hints: ['C-CDA/CCD clinical document markers found'] }
  }

  // Apple Health export detection
  if (
    upper.includes('HEALTHDATA') ||
    upper.includes('HKQUANTITYTYPEIDENTIFIER') ||
    upper.includes('HKCATEGORYTYPEIDENTIFIER') ||
    upper.includes('EXPORTDATE')
  ) {
    return { format: 'apple-health-xml', confidence: 0.95, hints: ['Apple Health export markers (HealthData, HK types)'] }
  }

  // GPX detection
  if (upper.includes('<GPX') || upper.includes('XMLNS="HTTP://WWW.TOPOGRAFIX.COM')) {
    return { format: 'gpx-route', confidence: 0.9, hints: ['GPX route file'] }
  }

  // TCX detection
  if (upper.includes('<TRAININGCENTERDATABASE') || upper.includes('XMLNS="HTTP://WWW.GARMIN.COM/XMLSCHEMAS/TRAININGCENTERDATABASE')) {
    return { format: 'tcx-workout', confidence: 0.9, hints: ['TCX workout file'] }
  }

  return { format: 'xml-generic', confidence: 0.4, hints: ['XML document, unknown schema'] }
}

function sniffCsv(content: string): { format: DetectedFormat; confidence: number; hints: string[] } {
  const firstLine = content.split('\n')[0]?.toLowerCase() ?? ''

  // MyNetDiary: has "Date", "Meal", "Food Name" or similar columns
  if (firstLine.includes('meal') && (firstLine.includes('food') || firstLine.includes('cals') || firstLine.includes('calories'))) {
    return { format: 'csv-mynetdiary', confidence: 0.85, hints: ['MyNetDiary CSV: meal + food/calories columns'] }
  }

  // Natural Cycles: has "Temperature", "Menstruation", "Cycle Day"
  if (firstLine.includes('temperature') && (firstLine.includes('menstruation') || firstLine.includes('cycle'))) {
    return { format: 'csv-natural-cycles', confidence: 0.85, hints: ['Natural Cycles CSV: temperature + menstruation/cycle columns'] }
  }

  // Cronometer: has "Energy (kcal)", "Protein (g)", or "Day", "Group", "Food Name"
  if (firstLine.includes('energy') && firstLine.includes('kcal')) {
    return { format: 'csv-cronometer', confidence: 0.8, hints: ['Cronometer CSV: energy (kcal) column'] }
  }

  // MyFitnessPal: usually has "Date", "Meal", "Calories"
  if (firstLine.includes('date') && firstLine.includes('calories') && !firstLine.includes('temperature')) {
    return { format: 'csv-mfp', confidence: 0.6, hints: ['Possible MFP CSV: date + calories columns'] }
  }

  // Bearable: has unique column patterns like "Mood", "Symptoms", "Factors"
  if (firstLine.includes('mood') && firstLine.includes('symptom') && firstLine.includes('factor')) {
    return { format: 'csv-bearable', confidence: 0.85, hints: ['Bearable CSV: mood + symptoms + factors columns'] }
  }

  // Daylio: has "date", "mood", "activities", "note"
  if (firstLine.includes('mood') && firstLine.includes('activities') && firstLine.includes('note')) {
    return { format: 'csv-daylio', confidence: 0.85, hints: ['Daylio CSV: mood + activities + note columns'] }
  }

  return { format: 'csv-generic', confidence: 0.4, hints: ['CSV file, unknown format -- will use intelligent column mapping'] }
}

// ── Main Detection Function ────────────────────────────────────────

export function detectFormat(
  content: string | Buffer,
  fileName?: string,
  mimeType?: string,
): FormatDetectionResult {
  const ext = fileName ? '.' + fileName.split('.').pop()?.toLowerCase() : ''
  const sizeBytes = typeof content === 'string' ? Buffer.byteLength(content) : content.length
  const textContent = typeof content === 'string' ? content : content.toString('utf-8', 0, Math.min(content.length, 5000))

  const hints: string[] = []

  // Image detection (binary -- don't try to parse as text)
  const imageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
  const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic']
  if ((mimeType && imageMimes.includes(mimeType)) || imageExts.includes(ext)) {
    return {
      format: 'image-medical',
      confidence: 0.9,
      mimeType: mimeType ?? 'image/jpeg',
      fileExtension: ext,
      sizeBytes,
      hints: ['Image file detected -- will use Claude Vision OCR'],
    }
  }

  // PDF detection
  if (ext === '.pdf' || mimeType === 'application/pdf' || textContent.startsWith('%PDF')) {
    return {
      format: 'pdf-medical',
      confidence: 0.9,
      mimeType: 'application/pdf',
      fileExtension: '.pdf',
      sizeBytes,
      hints: ['PDF document detected'],
    }
  }

  // FIT file detection (binary format)
  if (ext === '.fit' || mimeType === 'application/vnd.ant.fit') {
    return {
      format: 'fit-garmin',
      confidence: 0.9,
      mimeType: 'application/vnd.ant.fit',
      fileExtension: '.fit',
      sizeBytes,
      hints: ['Garmin FIT file detected'],
    }
  }

  // Text-based content sniffing
  const trimmed = textContent.trim()

  // JSON content
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const result = sniffJson(textContent)
    hints.push(...result.hints)
    return {
      format: result.format,
      confidence: result.confidence,
      mimeType: mimeType ?? 'application/json',
      fileExtension: ext || '.json',
      sizeBytes,
      hints,
    }
  }

  // XML content
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    const result = sniffXml(textContent)
    hints.push(...result.hints)
    return {
      format: result.format,
      confidence: result.confidence,
      mimeType: mimeType ?? 'application/xml',
      fileExtension: ext || '.xml',
      sizeBytes,
      hints,
    }
  }

  // CSV content (check if it looks tabular)
  const lines = trimmed.split('\n').slice(0, 5)
  const commaCount = lines[0]?.split(',').length ?? 0
  const tabCount = lines[0]?.split('\t').length ?? 0
  if (commaCount >= 3 || tabCount >= 3 || ext === '.csv' || ext === '.tsv') {
    const result = sniffCsv(textContent)
    hints.push(...result.hints)
    return {
      format: result.format,
      confidence: result.confidence,
      mimeType: mimeType ?? 'text/csv',
      fileExtension: ext || '.csv',
      sizeBytes,
      hints,
    }
  }

  // Plain text fallback (portal copy-paste, clinical notes)
  if (trimmed.length > 0) {
    return {
      format: 'text-plain',
      confidence: 0.3,
      mimeType: mimeType ?? 'text/plain',
      fileExtension: ext || '.txt',
      sizeBytes,
      hints: ['Plain text -- will use Claude AI to identify and extract health data'],
    }
  }

  return {
    format: 'unknown',
    confidence: 0,
    mimeType: mimeType ?? 'application/octet-stream',
    fileExtension: ext,
    sizeBytes,
    hints: ['Could not determine format'],
  }
}
