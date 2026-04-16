/**
 * C-CDA / CCD XML Parser
 *
 * Parses Consolidated Clinical Document Architecture XML documents.
 * This is the standard format used by US hospitals for medical record exchange.
 * CCD (Continuity of Care Document) is a subset of C-CDA.
 *
 * Extracts: labs, vitals, medications, conditions/problems, allergies,
 * immunizations, procedures, encounters.
 *
 * Uses regex-based parsing (no XML library dependency) for sections defined
 * by LOINC section codes in the C-CDA standard.
 */

import type {
  DetectedFormat, ParseResult, CanonicalRecord,
  LabResultData, MedicationData, ConditionData,
  AllergyData, ImmunizationData, ProcedureData, AppointmentData,
  ImportSource, Parser,
} from '../types'
import { createDedupeKey } from '../deduplicator'

// ── C-CDA Section LOINC Codes ──────────────────────────────────────

const SECTION_CODES: Record<string, string> = {
  '30954-2': 'results',
  '8716-3':  'vitals',
  '10160-0': 'medications',
  '11450-4': 'problems',
  '48765-2': 'allergies',
  '11369-6': 'immunizations',
  '47519-4': 'procedures',
  '46240-8': 'encounters',
}

// ── XML Helpers (regex-based, no library) ──────────────────────────

function extractSections(xml: string): Map<string, string> {
  const sections = new Map<string, string>()
  const sectionRegex = /<component>\s*<section>([\s\S]*?)<\/section>\s*<\/component>/gi
  let match: RegExpExecArray | null

  while ((match = sectionRegex.exec(xml)) !== null) {
    const sectionXml = match[1]
    const codeMatch = sectionXml.match(/<code[^>]*code="([^"]+)"/)
    if (codeMatch) {
      const sectionType = SECTION_CODES[codeMatch[1]]
      if (sectionType) {
        sections.set(sectionType, sectionXml)
      }
    }
  }

  return sections
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i')
  const match = xml.match(regex)
  return match?.[1]?.trim() ?? ''
}

function extractDate(xml: string): string {
  const match = xml.match(/effectiveTime[^>]*value="(\d{4,14})"/) ??
    xml.match(/<time[^>]*value="(\d{4,14})"/) ??
    xml.match(/<low[^>]*value="(\d{4,14})"/)

  if (match) {
    const v = match[1]
    if (v.length >= 8) {
      return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
    }
  }
  return new Date().toISOString().slice(0, 10)
}

function makeSource(fileName?: string): ImportSource {
  return {
    format: 'ccda-xml',
    fileName: fileName ?? null,
    appName: 'C-CDA',
    importedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  }
}

// ── Section Parsers ────────────────────────────────────────────────

function parseResultsSection(sectionXml: string, source: ImportSource): CanonicalRecord[] {
  const records: CanonicalRecord[] = []
  const obsRegex = /<observation[^>]*classCode="OBS"[^>]*>([\s\S]*?)<\/observation>/gi
  let match: RegExpExecArray | null

  while ((match = obsRegex.exec(sectionXml)) !== null) {
    const obsXml = match[1]
    const testName = extractAttr(obsXml, 'code', 'displayName')
    if (!testName) continue

    const valueMatch = obsXml.match(/<value[^>]*value="([^"]*)"[^>]*unit="([^"]*)"/)
    const value = valueMatch ? parseFloat(valueMatch[1]) : null
    const unit = valueMatch?.[2] ?? null

    const refMatch = obsXml.match(/<referenceRange>[\s\S]*?<low[^>]*value="([^"]*)"[\s\S]*?<high[^>]*value="([^"]*)"/)
    const refLow = refMatch ? parseFloat(refMatch[1]) : null
    const refHigh = refMatch ? parseFloat(refMatch[2]) : null

    let flag: LabResultData['flag'] = null
    if (value !== null && refLow !== null && refHigh !== null) {
      if (value < refLow) flag = 'low'
      else if (value > refHigh) flag = 'high'
      else flag = 'normal'
    }

    const interpMatch = obsXml.match(/<interpretationCode[^>]*code="([^"]*)"/)
    if (interpMatch) {
      const code = interpMatch[1].toUpperCase()
      if (code === 'N') flag = 'normal'
      else if (code === 'L') flag = 'low'
      else if (code === 'H') flag = 'high'
      else if (code === 'HH' || code === 'LL') flag = 'critical'
    }

    const date = extractDate(obsXml)
    const loincCode = extractAttr(obsXml, 'code', 'code')

    const data: LabResultData = {
      testName,
      value: isNaN(value ?? NaN) ? null : value,
      valueText: null,
      unit,
      referenceRangeLow: isNaN(refLow ?? NaN) ? null : refLow,
      referenceRangeHigh: isNaN(refHigh ?? NaN) ? null : refHigh,
      flag,
      category: null,
      orderedBy: null,
      loincCode: loincCode || null,
    }

    records.push({
      type: 'lab_result',
      date,
      datetime: null,
      source,
      confidence: 0.85,
      data,
      rawText: null,
      dedupeKey: createDedupeKey('lab_result', date, `${testName}_${value}`),
    })
  }

  return records
}

function parseMedicationsSection(sectionXml: string, source: ImportSource): CanonicalRecord[] {
  const records: CanonicalRecord[] = []
  const medRegex = /<substanceAdministration[^>]*>([\s\S]*?)<\/substanceAdministration>/gi
  let match: RegExpExecArray | null

  while ((match = medRegex.exec(sectionXml)) !== null) {
    const medXml = match[1]
    const name = extractAttr(medXml, 'code', 'displayName')
    if (!name) continue

    const doseMatch = medXml.match(/<doseQuantity[^>]*value="([^"]*)"[^>]*unit="([^"]*)"/)
    const routeDisplay = extractAttr(medXml, 'routeCode', 'displayName')
    const statusMatch = medXml.match(/<statusCode[^>]*code="([^"]*)"/)
    const statusCode = statusMatch?.[1]?.toLowerCase()

    const data: MedicationData = {
      name,
      dose: doseMatch?.[1] ?? null,
      unit: doseMatch?.[2] ?? null,
      frequency: null,
      route: routeDisplay || null,
      prescriber: null,
      startDate: extractDate(medXml),
      endDate: null,
      status: statusCode === 'completed' ? 'completed' : statusCode === 'active' ? 'active' : 'unknown',
      reason: null,
      rxcui: extractAttr(medXml, 'code', 'code') || null,
    }

    records.push({
      type: 'medication',
      date: data.startDate ?? extractDate(sectionXml),
      datetime: null,
      source,
      confidence: 0.8,
      data,
      rawText: null,
      dedupeKey: createDedupeKey('medication', data.startDate ?? '', name),
    })
  }

  return records
}

function parseProblemsSection(sectionXml: string, source: ImportSource): CanonicalRecord[] {
  const records: CanonicalRecord[] = []
  const obsRegex = /<observation[^>]*>([\s\S]*?)<\/observation>/gi
  let match: RegExpExecArray | null

  while ((match = obsRegex.exec(sectionXml)) !== null) {
    const obsXml = match[1]
    const name = extractAttr(obsXml, 'value', 'displayName') ||
      extractAttr(obsXml, 'code', 'displayName')
    if (!name) continue

    const statusMatch = obsXml.match(/<statusCode[^>]*code="([^"]*)"/)
    const status = statusMatch?.[1] === 'completed' ? 'resolved' as const : 'active' as const
    const codeValue = extractAttr(obsXml, 'value', 'code')
    const isSnomedSystem = obsXml.includes('2.16.840.1.113883.6.96')

    const data: ConditionData = {
      name,
      status,
      onsetDate: extractDate(obsXml),
      resolvedDate: null,
      severity: null,
      icdCode: !isSnomedSystem ? codeValue || null : null,
      snomedCode: isSnomedSystem ? codeValue || null : null,
    }

    records.push({
      type: 'condition',
      date: data.onsetDate ?? extractDate(sectionXml),
      datetime: null,
      source,
      confidence: 0.8,
      data,
      rawText: null,
      dedupeKey: createDedupeKey('condition', data.onsetDate ?? '', name),
    })
  }

  return records
}

function parseAllergiesSection(sectionXml: string, source: ImportSource): CanonicalRecord[] {
  const records: CanonicalRecord[] = []
  const obsRegex = /<observation[^>]*>([\s\S]*?)<\/observation>/gi
  let match: RegExpExecArray | null

  while ((match = obsRegex.exec(sectionXml)) !== null) {
    const obsXml = match[1]
    const substance = extractAttr(obsXml, 'value', 'displayName') ||
      extractAttr(obsXml, 'code', 'displayName')
    if (!substance) continue

    const reactionMatch = obsXml.match(/<entryRelationship[\s\S]*?<value[^>]*displayName="([^"]*)"/)

    const data: AllergyData = {
      substance,
      reaction: reactionMatch?.[1] ?? null,
      severity: null,
      status: 'active',
    }

    records.push({
      type: 'allergy',
      date: extractDate(sectionXml),
      datetime: null,
      source,
      confidence: 0.8,
      data,
      rawText: null,
      dedupeKey: createDedupeKey('allergy', extractDate(sectionXml), substance),
    })
  }

  return records
}

function parseImmunizationsSection(sectionXml: string, source: ImportSource): CanonicalRecord[] {
  const records: CanonicalRecord[] = []
  const subRegex = /<substanceAdministration[^>]*>([\s\S]*?)<\/substanceAdministration>/gi
  let match: RegExpExecArray | null

  while ((match = subRegex.exec(sectionXml)) !== null) {
    const xml = match[1]
    const vaccine = extractAttr(xml, 'code', 'displayName')
    if (!vaccine) continue

    const date = extractDate(xml)
    const lotMatch = xml.match(/<lotNumberText>([^<]*)<\/lotNumberText>/)

    const data: ImmunizationData = {
      vaccine,
      status: 'completed',
      site: null,
      route: extractAttr(xml, 'routeCode', 'displayName') || null,
      lotNumber: lotMatch?.[1] ?? null,
      manufacturer: null,
    }

    records.push({
      type: 'immunization',
      date,
      datetime: null,
      source,
      confidence: 0.8,
      data,
      rawText: null,
      dedupeKey: createDedupeKey('immunization', date, vaccine),
    })
  }

  return records
}

function parseProceduresSection(sectionXml: string, source: ImportSource): CanonicalRecord[] {
  const records: CanonicalRecord[] = []
  const procRegex = /<procedure[^>]*>([\s\S]*?)<\/procedure>/gi
  let match: RegExpExecArray | null

  while ((match = procRegex.exec(sectionXml)) !== null) {
    const xml = match[1]
    const name = extractAttr(xml, 'code', 'displayName')
    if (!name) continue

    const data: ProcedureData = {
      name,
      status: 'completed',
      performer: null,
      location: null,
      notes: null,
      cptCode: extractAttr(xml, 'code', 'code') || null,
    }

    records.push({
      type: 'procedure',
      date: extractDate(xml),
      datetime: null,
      source,
      confidence: 0.8,
      data,
      rawText: null,
      dedupeKey: createDedupeKey('procedure', extractDate(xml), name),
    })
  }

  return records
}

function parseEncountersSection(sectionXml: string, source: ImportSource): CanonicalRecord[] {
  const records: CanonicalRecord[] = []
  const encRegex = /<encounter[^>]*>([\s\S]*?)<\/encounter>/gi
  let match: RegExpExecArray | null

  while ((match = encRegex.exec(sectionXml)) !== null) {
    const xml = match[1]
    const reason = extractAttr(xml, 'code', 'displayName')

    const data: AppointmentData = {
      doctorName: null,
      specialty: null,
      clinic: null,
      reason: reason || null,
      notes: null,
      followUpDate: null,
    }

    records.push({
      type: 'appointment',
      date: extractDate(xml),
      datetime: null,
      source,
      confidence: 0.75,
      data,
      rawText: null,
      dedupeKey: createDedupeKey('appointment', extractDate(xml), reason ?? 'encounter'),
    })
  }

  return records
}

// ── Main Parser ────────────────────────────────────────────────────

const ccdaParser: Parser = {
  supportedFormats: ['ccda-xml'],

  async parse(content: string | Buffer, _format: DetectedFormat, fileName?: string): Promise<ParseResult> {
    const xml = typeof content === 'string' ? content : content.toString('utf-8')
    const source = makeSource(fileName)
    const records: CanonicalRecord[] = []
    const warnings: string[] = []
    const errors: string[] = []

    const sections = extractSections(xml)

    if (sections.size === 0) {
      errors.push('No recognized C-CDA sections found. The document may not be a valid C-CDA/CCD.')
      return {
        records: [],
        warnings: [],
        errors,
        metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'C-CDA' },
      }
    }

    const sectionParsers: Record<string, (xml: string, source: ImportSource) => CanonicalRecord[]> = {
      results: parseResultsSection,
      medications: parseMedicationsSection,
      problems: parseProblemsSection,
      allergies: parseAllergiesSection,
      immunizations: parseImmunizationsSection,
      procedures: parseProceduresSection,
      encounters: parseEncountersSection,
    }

    for (const [sectionType, sectionXml] of sections) {
      const parser = sectionParsers[sectionType]
      if (parser) {
        try {
          const sectionRecords = parser(sectionXml, source)
          records.push(...sectionRecords)
        } catch (e) {
          warnings.push(`Error parsing ${sectionType} section: ${e instanceof Error ? e.message : 'Unknown'}`)
        }
      }
    }

    const byType: Record<string, number> = {}
    let earliest = ''
    let latest = ''
    for (const r of records) {
      byType[r.type] = (byType[r.type] ?? 0) + 1
      if (!earliest || r.date < earliest) earliest = r.date
      if (!latest || r.date > latest) latest = r.date
    }

    return {
      records,
      warnings,
      errors,
      metadata: {
        totalExtracted: records.length,
        byType,
        dateRange: records.length > 0 ? { earliest, latest } : null,
        sourceName: 'C-CDA',
      },
    }
  },
}

export default ccdaParser
