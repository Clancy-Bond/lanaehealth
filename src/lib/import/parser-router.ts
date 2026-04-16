/**
 * Universal Import Engine -- Parser Router
 *
 * Routes detected formats to the appropriate parser.
 * Falls back to Claude AI normalization for unknown formats.
 */

import type { DetectedFormat, ParseResult, FormatDetectionResult } from './types'
import { detectFormat } from './format-detector'
import { normalizeRecords, quickValidate } from './normalizer'

// Parser imports -- each parser handles one or more formats
// Lazy-loaded to avoid bundling unused parsers
async function getParser(format: DetectedFormat) {
  switch (format) {
    case 'fhir-bundle':
    case 'fhir-resource':
      return (await import('./parsers/fhir')).default

    case 'ccda-xml':
      return (await import('./parsers/ccda')).default

    case 'pdf-medical':
      return (await import('./parsers/pdf')).default

    case 'image-medical':
      return (await import('./parsers/screenshot')).default

    case 'csv-generic':
    case 'csv-cronometer':
    case 'csv-mfp':
    case 'csv-bearable':
    case 'csv-daylio':
      return (await import('./parsers/generic-csv')).default

    case 'json-flo':
    case 'json-clue':
    case 'json-generic':
      return (await import('./parsers/generic-json')).default

    case 'text-plain':
      return (await import('./parsers/text-ai')).default

    // These use existing importers (already built)
    case 'apple-health-xml':
    case 'csv-mynetdiary':
    case 'csv-natural-cycles':
      return (await import('./parsers/legacy-bridge')).default

    default:
      // Unknown format -- try Claude AI
      return (await import('./parsers/text-ai')).default
  }
}

// ── Main Router ────────────────────────────────────────────────────

export interface ImportInput {
  content: string | Buffer
  fileName?: string
  mimeType?: string
}

export interface ImportPipelineResult {
  detection: FormatDetectionResult
  parseResult: ParseResult
}

/**
 * Run the full import pipeline: detect -> parse -> return canonical records.
 * Does NOT save to database -- caller decides when to persist (after user review).
 */
export async function runImportPipeline(input: ImportInput): Promise<ImportPipelineResult> {
  // Step 1: Detect format
  const detection = detectFormat(input.content, input.fileName, input.mimeType)

  // Step 2: Get appropriate parser
  const parser = await getParser(detection.format)

  // Step 3: Parse content
  const parseResult = await parser.parse(input.content, detection.format, input.fileName)

  // Step 4: Validate (quick local pass -- no API call)
  parseResult.records = quickValidate(parseResult.records)

  // Step 5: Normalize (Claude AI pass for low-confidence records)
  if (parseResult.records.some(r => r.confidence < 0.85)) {
    const { records: normalized, changes } = await normalizeRecords(parseResult.records)
    parseResult.records = normalized
    if (changes.length > 0) {
      parseResult.warnings.push(...changes)
    }
  }

  return { detection, parseResult }
}

/**
 * Run pipeline on multiple files. Returns results per file.
 */
export async function runBatchImport(
  inputs: ImportInput[],
): Promise<ImportPipelineResult[]> {
  // Process sequentially to avoid overloading Claude API
  const results: ImportPipelineResult[] = []
  for (const input of inputs) {
    results.push(await runImportPipeline(input))
  }
  return results
}
