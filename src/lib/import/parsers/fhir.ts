/**
 * FHIR R4 JSON Parser
 *
 * Parses FHIR Bundles and individual resources into canonical records.
 * Handles: Patient, Observation, Condition, MedicationRequest/Statement,
 * DiagnosticReport, AllergyIntolerance, Immunization, Procedure, Encounter.
 *
 * The 21st Century Cures Act mandates all US healthcare providers offer
 * FHIR APIs by 2026, making this the most important structured parser.
 */

import type {
  DetectedFormat, ParseResult, CanonicalRecord, CanonicalRecordType,
  LabResultData, VitalSignData, MedicationData, ConditionData,
  AppointmentData, ProcedureData, AllergyData, ImmunizationData,
  ClinicalNoteData, ImportSource, Parser,
} from '../types'
import { createDedupeKey } from '../deduplicator'

// ── FHIR Type Guards ───────────────────────────────────────────────

interface FhirResource {
  resourceType: string
  id?: string
  [key: string]: unknown
}

interface FhirBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: FhirResource; fullUrl?: string }>
}

interface FhirCoding {
  system?: string
  code?: string
  display?: string
}

interface FhirCodeableConcept {
  coding?: FhirCoding[]
  text?: string
}

interface FhirReference {
  reference?: string
  display?: string
}

interface FhirQuantity {
  value?: number
  unit?: string
  system?: string
  code?: string
}

interface FhirPeriod {
  start?: string
  end?: string
}

// ── Helper Functions ───────────────────────────────────────────────

function getCodeText(concept: FhirCodeableConcept | undefined): string {
  if (!concept) return ''
  return concept.text ?? concept.coding?.[0]?.display ?? concept.coding?.[0]?.code ?? ''
}

function getCodeValue(concept: FhirCodeableConcept | undefined, system: string): string | null {
  if (!concept?.coding) return null
  const match = concept.coding.find(c => c.system?.includes(system))
  return match?.code ?? null
}

function extractDate(resource: FhirResource): string {
  // Try common FHIR date fields in priority order
  const dateFields = [
    'effectiveDateTime', 'issued', 'recordedDate', 'onsetDateTime',
    'authoredOn', 'occurrenceDateTime', 'date', 'created',
  ]
  for (const field of dateFields) {
    const val = resource[field]
    if (typeof val === 'string' && val.length >= 10) {
      return val.slice(0, 10) // YYYY-MM-DD
    }
  }

  // Try period.start
  const period = resource.effectivePeriod as FhirPeriod | undefined
  if (period?.start) return period.start.slice(0, 10)

  return new Date().toISOString().slice(0, 10)
}

function extractDatetime(resource: FhirResource): string | null {
  const dateFields = [
    'effectiveDateTime', 'issued', 'recordedDate', 'onsetDateTime',
    'authoredOn', 'occurrenceDateTime', 'date',
  ]
  for (const field of dateFields) {
    const val = resource[field]
    if (typeof val === 'string' && val.includes('T')) return val
  }
  return null
}

function makeSource(format: DetectedFormat, fileName?: string): ImportSource {
  return {
    format,
    fileName: fileName ?? null,
    appName: 'FHIR',
    importedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  }
}

// ── Resource Parsers ───────────────────────────────────────────────

// Vital sign LOINC codes that indicate vital signs vs lab results
const VITAL_LOINC: Record<string, VitalSignData['vitalType']> = {
  '85354-9': 'blood_pressure',
  '8480-6': 'blood_pressure',    // Systolic
  '8462-4': 'blood_pressure',    // Diastolic
  '8867-4': 'heart_rate',
  '8310-5': 'temperature',
  '9279-1': 'respiratory_rate',
  '2708-6': 'spo2',
  '59408-5': 'spo2',
  '29463-7': 'weight',
  '8302-2': 'height',
  '39156-5': 'bmi',
  '2339-0': 'blood_glucose',
  '2345-7': 'blood_glucose',
}

function parseObservation(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  const code = resource.code as FhirCodeableConcept | undefined
  const loincCode = getCodeValue(code, 'loinc')
  const testName = getCodeText(code)
  if (!testName) return null

  const date = extractDate(resource)
  const datetime = extractDatetime(resource)

  // Check if this is a vital sign
  const vitalType = loincCode ? VITAL_LOINC[loincCode] : null

  if (vitalType) {
    // Blood pressure is special -- has components
    if (vitalType === 'blood_pressure') {
      const components = resource.component as Array<{
        code?: FhirCodeableConcept
        valueQuantity?: FhirQuantity
      }> | undefined

      let systolic: number | null = null
      let diastolic: number | null = null

      if (components) {
        for (const comp of components) {
          const compCode = getCodeValue(comp.code, 'loinc')
          if (compCode === '8480-6') systolic = comp.valueQuantity?.value ?? null
          if (compCode === '8462-4') diastolic = comp.valueQuantity?.value ?? null
        }
      }

      if (systolic === null) {
        const vq = resource.valueQuantity as FhirQuantity | undefined
        systolic = vq?.value ?? null
      }

      if (systolic === null) return null

      const data: VitalSignData = {
        vitalType: 'blood_pressure',
        value: systolic,
        value2: diastolic,
        unit: 'mmHg',
        position: null,
        context: null,
      }

      return {
        type: 'vital_sign',
        date,
        datetime,
        source,
        confidence: 0.9,
        data,
        rawText: null,
        dedupeKey: createDedupeKey('vital_sign', date, `bp_${systolic}_${diastolic}`),
      }
    }

    // Other vital signs
    const vq = resource.valueQuantity as FhirQuantity | undefined
    if (!vq?.value) return null

    const data: VitalSignData = {
      vitalType,
      value: vq.value,
      value2: null,
      unit: vq.unit ?? '',
      position: null,
      context: null,
    }

    return {
      type: 'vital_sign',
      date,
      datetime,
      source,
      confidence: 0.9,
      data,
      rawText: null,
      dedupeKey: createDedupeKey('vital_sign', date, `${vitalType}_${vq.value}`),
    }
  }

  // Lab result
  const vq = resource.valueQuantity as FhirQuantity | undefined
  const valueStr = resource.valueString as string | undefined
  const refRange = (resource.referenceRange as Array<{
    low?: FhirQuantity
    high?: FhirQuantity
    text?: string
  }> | undefined)?.[0]

  // Determine flag from interpretation
  const interp = resource.interpretation as FhirCodeableConcept[] | undefined
  let flag: LabResultData['flag'] = null
  const interpCode = interp?.[0]?.coding?.[0]?.code?.toLowerCase()
  if (interpCode === 'n' || interpCode === 'normal') flag = 'normal'
  else if (interpCode === 'l' || interpCode === 'low') flag = 'low'
  else if (interpCode === 'h' || interpCode === 'high') flag = 'high'
  else if (interpCode === 'hh' || interpCode === 'll' || interpCode === 'critical') flag = 'critical'

  const data: LabResultData = {
    testName,
    value: vq?.value ?? null,
    valueText: valueStr ?? null,
    unit: vq?.unit ?? null,
    referenceRangeLow: refRange?.low?.value ?? null,
    referenceRangeHigh: refRange?.high?.value ?? null,
    flag,
    category: (resource.category as FhirCodeableConcept[])
      ?.[0]?.coding?.[0]?.display ?? null,
    orderedBy: null,
    loincCode,
  }

  return {
    type: 'lab_result',
    date,
    datetime,
    source,
    confidence: 0.9,
    data,
    rawText: null,
    dedupeKey: createDedupeKey('lab_result', date, `${testName}_${vq?.value ?? valueStr}`),
  }
}

function parseCondition(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  const code = resource.code as FhirCodeableConcept | undefined
  const name = getCodeText(code)
  if (!name) return null

  const clinicalStatus = (resource.clinicalStatus as FhirCodeableConcept)
    ?.coding?.[0]?.code ?? 'unknown'

  let status: ConditionData['status'] = 'unknown'
  if (clinicalStatus === 'active') status = 'active'
  else if (clinicalStatus === 'resolved' || clinicalStatus === 'remission') status = 'resolved'
  else if (clinicalStatus === 'inactive') status = 'inactive'

  const data: ConditionData = {
    name,
    status,
    onsetDate: (resource.onsetDateTime as string)?.slice(0, 10) ?? null,
    resolvedDate: (resource.abatementDateTime as string)?.slice(0, 10) ?? null,
    severity: getCodeText(resource.severity as FhirCodeableConcept | undefined) || null,
    icdCode: getCodeValue(code, 'icd') ?? getCodeValue(code, 'icd10'),
    snomedCode: getCodeValue(code, 'snomed'),
  }

  return {
    type: 'condition',
    date: extractDate(resource),
    datetime: extractDatetime(resource),
    source,
    confidence: 0.9,
    data,
    rawText: null,
    dedupeKey: createDedupeKey('condition', extractDate(resource), name),
  }
}

function parseMedication(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  // MedicationRequest or MedicationStatement
  const medCode = resource.medicationCodeableConcept as FhirCodeableConcept | undefined
  const medRef = resource.medicationReference as FhirReference | undefined
  const name = getCodeText(medCode) || medRef?.display || ''
  if (!name) return null

  const dosage = (resource.dosageInstruction as Array<{
    text?: string
    doseAndRate?: Array<{ doseQuantity?: FhirQuantity }>
    route?: FhirCodeableConcept
    timing?: { code?: FhirCodeableConcept }
  }> | undefined)?.[0]

  const statusRaw = resource.status as string | undefined
  let status: MedicationData['status'] = 'unknown'
  if (statusRaw === 'active') status = 'active'
  else if (statusRaw === 'completed' || statusRaw === 'stopped') status = statusRaw

  const data: MedicationData = {
    name,
    dose: dosage?.doseAndRate?.[0]?.doseQuantity?.value?.toString() ?? null,
    unit: dosage?.doseAndRate?.[0]?.doseQuantity?.unit ?? null,
    frequency: dosage?.timing?.code?.text ?? dosage?.text ?? null,
    route: getCodeText(dosage?.route) || null,
    prescriber: (resource.requester as FhirReference)?.display ?? null,
    startDate: (resource.authoredOn as string)?.slice(0, 10) ?? null,
    endDate: null,
    status,
    reason: getCodeText((resource.reasonCode as FhirCodeableConcept[])?.[0]) || null,
    rxcui: getCodeValue(medCode, 'rxnorm'),
  }

  return {
    type: 'medication',
    date: extractDate(resource),
    datetime: extractDatetime(resource),
    source,
    confidence: 0.9,
    data,
    rawText: null,
    dedupeKey: createDedupeKey('medication', extractDate(resource), name),
  }
}

function parseAllergyIntolerance(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  const code = resource.code as FhirCodeableConcept | undefined
  const substance = getCodeText(code)
  if (!substance) return null

  const reactions = resource.reaction as Array<{
    manifestation?: FhirCodeableConcept[]
    severity?: string
  }> | undefined

  const data: AllergyData = {
    substance,
    reaction: reactions?.[0]?.manifestation?.map(m => getCodeText(m)).join(', ') ?? null,
    severity: (reactions?.[0]?.severity as AllergyData['severity']) ?? null,
    status: (resource.clinicalStatus as FhirCodeableConcept)?.coding?.[0]?.code === 'active'
      ? 'active' : 'inactive',
  }

  return {
    type: 'allergy',
    date: extractDate(resource),
    datetime: extractDatetime(resource),
    source,
    confidence: 0.9,
    data,
    rawText: null,
    dedupeKey: createDedupeKey('allergy', extractDate(resource), substance),
  }
}

function parseImmunization(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  const vaccineCode = resource.vaccineCode as FhirCodeableConcept | undefined
  const vaccine = getCodeText(vaccineCode)
  if (!vaccine) return null

  const data: ImmunizationData = {
    vaccine,
    status: (resource.status as string) === 'completed' ? 'completed' : 'not-done',
    site: getCodeText(resource.site as FhirCodeableConcept | undefined) || null,
    route: getCodeText(resource.route as FhirCodeableConcept | undefined) || null,
    lotNumber: (resource.lotNumber as string) ?? null,
    manufacturer: (resource.manufacturer as FhirReference)?.display ?? null,
  }

  return {
    type: 'immunization',
    date: extractDate(resource),
    datetime: extractDatetime(resource),
    source,
    confidence: 0.9,
    data,
    rawText: null,
    dedupeKey: createDedupeKey('immunization', extractDate(resource), vaccine),
  }
}

function parseProcedure(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  const code = resource.code as FhirCodeableConcept | undefined
  const name = getCodeText(code)
  if (!name) return null

  const data: ProcedureData = {
    name,
    status: (resource.status as string) === 'completed' ? 'completed' : 'planned',
    performer: (resource.performer as Array<{ actor?: FhirReference }>)?.[0]?.actor?.display ?? null,
    location: (resource.location as FhirReference)?.display ?? null,
    notes: (resource.note as Array<{ text?: string }>)?.[0]?.text ?? null,
    cptCode: getCodeValue(code, 'cpt'),
  }

  return {
    type: 'procedure',
    date: extractDate(resource),
    datetime: extractDatetime(resource),
    source,
    confidence: 0.9,
    data,
    rawText: null,
    dedupeKey: createDedupeKey('procedure', extractDate(resource), name),
  }
}

function parseEncounter(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  const typeText = getCodeText((resource.type as FhirCodeableConcept[])?.[0])
  const period = resource.period as FhirPeriod | undefined

  const data: AppointmentData = {
    doctorName: (resource.participant as Array<{ individual?: FhirReference }>)
      ?.[0]?.individual?.display ?? null,
    specialty: null,
    clinic: (resource.serviceProvider as FhirReference)?.display ?? null,
    reason: getCodeText((resource.reasonCode as FhirCodeableConcept[])?.[0]) || typeText || null,
    notes: null,
    followUpDate: null,
  }

  return {
    type: 'appointment',
    date: period?.start?.slice(0, 10) ?? extractDate(resource),
    datetime: period?.start ?? null,
    source,
    confidence: 0.85,
    data,
    rawText: null,
    dedupeKey: createDedupeKey('appointment', period?.start?.slice(0, 10) ?? extractDate(resource), data.reason ?? ''),
  }
}

function parseDiagnosticReport(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  const code = resource.code as FhirCodeableConcept | undefined
  const title = getCodeText(code) || 'Diagnostic Report'

  const conclusion = resource.conclusion as string | undefined
  const presentedForm = resource.presentedForm as Array<{ data?: string }> | undefined

  const data: ClinicalNoteData = {
    title,
    content: conclusion ?? presentedForm?.[0]?.data ?? 'See attached results',
    author: (resource.performer as FhirReference[])
      ?.[0]?.display ?? null,
    noteType: 'diagnostic report',
  }

  return {
    type: 'clinical_note',
    date: extractDate(resource),
    datetime: extractDatetime(resource),
    source,
    confidence: 0.85,
    data,
    rawText: null,
    dedupeKey: createDedupeKey('clinical_note', extractDate(resource), title),
  }
}

// ── Resource Router ────────────────────────────────────────────────

function parseResource(resource: FhirResource, source: ImportSource): CanonicalRecord | null {
  switch (resource.resourceType) {
    case 'Observation': return parseObservation(resource, source)
    case 'Condition': return parseCondition(resource, source)
    case 'MedicationRequest':
    case 'MedicationStatement': return parseMedication(resource, source)
    case 'AllergyIntolerance': return parseAllergyIntolerance(resource, source)
    case 'Immunization': return parseImmunization(resource, source)
    case 'Procedure': return parseProcedure(resource, source)
    case 'Encounter': return parseEncounter(resource, source)
    case 'DiagnosticReport': return parseDiagnosticReport(resource, source)
    // Skip Patient, Practitioner, Organization -- metadata, not health data
    default: return null
  }
}

// ── Main Parser ────────────────────────────────────────────────────

const fhirParser: Parser = {
  supportedFormats: ['fhir-bundle', 'fhir-resource'],

  async parse(content: string | Buffer, format: DetectedFormat, fileName?: string): Promise<ParseResult> {
    const text = typeof content === 'string' ? content : content.toString('utf-8')
    const source = makeSource(format, fileName)
    const records: CanonicalRecord[] = []
    const warnings: string[] = []
    const errors: string[] = []

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return {
        records: [],
        warnings: [],
        errors: [`Failed to parse JSON: ${e instanceof Error ? e.message : 'Unknown error'}`],
        metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'FHIR' },
      }
    }

    const resources: FhirResource[] = []

    if (format === 'fhir-bundle') {
      const bundle = parsed as FhirBundle
      if (bundle.entry) {
        for (const entry of bundle.entry) {
          if (entry.resource) resources.push(entry.resource)
        }
      }
    } else {
      // Single resource
      resources.push(parsed as FhirResource)
    }

    for (const resource of resources) {
      try {
        const record = parseResource(resource, source)
        if (record) records.push(record)
      } catch (e) {
        warnings.push(`Failed to parse ${resource.resourceType} ${resource.id ?? ''}: ${e instanceof Error ? e.message : 'Unknown'}`)
      }
    }

    // Compute metadata
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
        sourceName: 'FHIR',
      },
    }
  },
}

export default fhirParser
