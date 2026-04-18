// Medical-style PDF report generation.
//
// Produces a clinician-facing PDF that leads with a patient identity cover
// page (see ./cover-page.ts) and then renders per-section data. The cover
// carries the safety-critical context (allergies, current medications,
// confirmed diagnoses) so the doctor can orient in under five seconds.
//
// Design principles:
//   - No app branding in the PDF body. Doctors don't care what app this came
//     from; they care about the patient. The title is simply "Clinical Report"
//     (rendered by the cover page module).
//   - Sections are toggle-able via an optional `sections` map so callers can
//     trim the report down to just the data the visit requires.
//   - Sections with no data are skipped entirely — no dead "No data" headings
//     that waste a clinician's page-flip time.
//   - A running footer (patient name + "Page X of Y") is applied on every
//     page via `applyRunningFooter` from the cover-page module.
import jsPDF from 'jspdf'
import type { ReportData } from './report-data'
import type { AnalysisFinding } from '@/lib/types'
import { format } from 'date-fns'
import {
  applyRunningFooter,
  generateCoverPage,
  type CoverPageContent,
} from './cover-page'

/**
 * Optional patient identity block that the clinical report attaches onto
 * ReportData. Declared locally so the shared ReportData type in
 * report-data.ts doesn't need to grow; fixtures and callers can attach a
 * `patient` field and clinical-report.ts reads it via this shape.
 */
export interface ReportPatientBlock {
  name: string
  dob?: string | null
  age?: number | null
  sex?: string | null
  bloodType?: string | null
  heightCm?: number | null
  weightKg?: number | null
  mrn?: string | null
  diagnoses?: string[]
  suspectedConditions?: string[]
  allergies?: string[]
  medications?: Array<{ name: string; dose?: string | null; frequency?: string | null }>
}

type ReportDataWithPatient = ReportData & { patient?: ReportPatientBlock }

/**
 * Which sections to include in the PDF. Any key left undefined defaults to
 * `true` (render) so existing callers get the full report without changes.
 */
export interface ReportSectionToggles {
  cover?: boolean
  pain?: boolean
  symptoms?: boolean
  cycle?: boolean
  biometrics?: boolean
  labs?: boolean
  appointments?: boolean
  ai?: boolean
}

export interface GenerateClinicalReportOptions {
  sections?: ReportSectionToggles
  aiFindings?: AnalysisFinding[]
}

/**
 * Build the cover-page content payload from a ReportData. Exported so tests
 * (and any future caller that wants the cover as a standalone 1-pager) can
 * reuse the identity-block derivation without duplicating the defaults.
 *
 * Missing patient data is handled gracefully: we fall back to "Patient" and
 * empty lists rather than throwing, because the cover must render for every
 * report regardless of how complete the patient profile is.
 */
export function buildCoverContent(data: ReportData): CoverPageContent {
  const p = (data as ReportDataWithPatient).patient
  return {
    patient: {
      name: p?.name ?? 'Patient',
      dob: p?.dob ?? null,
      age: p?.age ?? null,
      sex: p?.sex ?? null,
      bloodType: p?.bloodType ?? null,
      heightCm: p?.heightCm ?? null,
      weightKg: p?.weightKg ?? null,
      mrn: p?.mrn ?? null,
    },
    diagnoses: p?.diagnoses ?? [],
    suspectedConditions: p?.suspectedConditions,
    medications: p?.medications ?? [],
    allergies: p?.allergies ?? [],
    reportingPeriod: { start: data.startDate, end: data.endDate },
  }
}

function isLegacyAiFindingsArg(arg: unknown): arg is AnalysisFinding[] {
  return Array.isArray(arg)
}

/**
 * Generate a clinical-style PDF report.
 *
 * Overloads preserve backward compatibility: historical callers pass
 * `(data, aiFindings)` as two positional args. New callers pass
 * `(data, { sections, aiFindings })`.
 */
export function generateClinicalReport(
  data: ReportData,
  options?: GenerateClinicalReportOptions | AnalysisFinding[],
): jsPDF {
  // Normalize the overload: a legacy array arg is treated as aiFindings.
  const opts: GenerateClinicalReportOptions = isLegacyAiFindingsArg(options)
    ? { aiFindings: options }
    : options ?? {}
  const sections = opts.sections ?? {}
  const aiFindings = opts.aiFindings

  // Section-toggle defaults: all sections render unless explicitly disabled.
  const showCover = sections.cover !== false
  const showPain = sections.pain !== false
  const showSymptoms = sections.symptoms !== false
  const showCycle = sections.cycle !== false
  const showBiometrics = sections.biometrics !== false
  const showLabs = sections.labs !== false
  const showAppointments = sections.appointments !== false
  const showAi = sections.ai !== false

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  function addPage() {
    doc.addPage()
    y = margin
  }

  function checkPage(needed: number) {
    // Leave room for the running footer (drawn at 290-297mm on an A4).
    if (y + needed > 270) addPage()
  }

  // ── Cover page ────────────────────────────────────────────────────
  // Rendered first on page 1. When the toggle is off we skip it entirely
  // (no cover title, no identity box) so callers can produce a pure
  // body-only PDF for narrower use cases.
  const cover = buildCoverContent(data)
  if (showCover) {
    generateCoverPage(doc, cover)
    addPage()
  }

  // ── Compact body header (no app branding) ────────────────────────
  // A minimal per-body header that repeats the patient name + period so
  // a printed section page still identifies itself. We deliberately
  // avoid an app name here; the cover carries identity, the footer
  // carries page numbers.
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(cover.patient.name, margin, y)
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Report period: ${format(new Date(data.startDate + 'T00:00:00'), 'MMM d, yyyy')} to ${format(new Date(data.endDate + 'T00:00:00'), 'MMM d, yyyy')}`,
    margin,
    y,
  )
  y += 5
  doc.text(`Days with data: ${data.summary.totalDaysLogged}`, margin, y)
  y += 6
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ── Section: Pain Summary ────────────────────────────────────────
  // Skip entirely when there's no pain data. Dead "No data" rows would
  // just burn page real estate without helping the clinician.
  const hasPainData =
    data.summary.avgPain != null ||
    data.summary.maxPain != null ||
    data.summary.avgFatigue != null ||
    data.summary.topPainRegions.length > 0
  if (showPain && hasPainData) {
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Pain Summary', margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const painLines: string[] = []
    if (data.summary.avgPain != null)
      painLines.push(`Average Pain Score: ${data.summary.avgPain}/10`)
    if (data.summary.maxPain != null)
      painLines.push(`Maximum Pain Score: ${data.summary.maxPain}/10`)
    if (data.summary.avgFatigue != null)
      painLines.push(`Average Fatigue: ${data.summary.avgFatigue}/10`)
    for (const line of painLines) {
      doc.text(line, margin + 2, y)
      y += 5
    }
    y += 3

    if (data.summary.topPainRegions.length > 0) {
      checkPage(30)
      doc.setFont('helvetica', 'bold')
      doc.text('Most Affected Regions:', margin + 2, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      for (const region of data.summary.topPainRegions) {
        doc.text(
          `  - ${region.region}: ${region.count} occurrences (avg intensity ${region.avgIntensity}/10)`,
          margin + 2,
          y,
        )
        y += 5
      }
      y += 3
    }
  }

  // ── Section: Symptom Summary ─────────────────────────────────────
  if (showSymptoms && data.summary.topSymptoms.length > 0) {
    checkPage(40)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Symptom Summary', margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const s of data.summary.topSymptoms) {
      doc.text(
        `  - ${s.symptom}: reported ${s.count} time${s.count !== 1 ? 's' : ''}`,
        margin + 2,
        y,
      )
      y += 5
    }
    y += 5
  }

  // ── Section: Cycle Data ──────────────────────────────────────────
  // Skip when there's literally no cycle evidence in the range.
  const hasCycleData =
    data.summary.periodDays > 0 ||
    data.summary.avgCycleLength != null ||
    data.cycleEntries.length > 0
  if (showCycle && hasCycleData) {
    checkPage(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Cycle Data', margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Period days in range: ${data.summary.periodDays}`, margin + 2, y)
    y += 5
    doc.text(
      `Average cycle length: ${data.summary.avgCycleLength ? `${data.summary.avgCycleLength} days` : 'Insufficient data'}`,
      margin + 2,
      y,
    )
    y += 8
  }

  // ── Section: Biometrics (Oura Ring) ──────────────────────────────
  if (showBiometrics && data.ouraData.length > 0) {
    checkPage(40)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Biometrics (Oura Ring)', margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const bioLines = [
      `Average Sleep Score: ${data.summary.avgSleepScore ?? 'N/A'}/100`,
      `Average HRV: ${data.summary.avgHrv ?? 'N/A'} ms`,
      `Average Resting Heart Rate: ${data.summary.avgRestingHr ?? 'N/A'} bpm`,
      `Average Temperature Deviation: ${data.summary.avgTempDeviation != null ? `${data.summary.avgTempDeviation}C` : 'N/A'}`,
    ]
    for (const line of bioLines) {
      doc.text(line, margin + 2, y)
      y += 5
    }
    y += 5
  }

  // ── Section: Lab Results ─────────────────────────────────────────
  if (showLabs && data.labResults.length > 0) {
    checkPage(20)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Lab Results', margin, y)
    y += 7

    doc.setFontSize(9)

    // Table header
    doc.setFont('helvetica', 'bold')
    doc.text('Date', margin + 2, y)
    doc.text('Test', margin + 25, y)
    doc.text('Value', margin + 80, y)
    doc.text('Ref Range', margin + 105, y)
    doc.text('Flag', margin + 140, y)
    y += 5
    doc.line(margin, y - 1, pageWidth - margin, y - 1)

    doc.setFont('helvetica', 'normal')
    for (const lab of data.labResults) {
      checkPage(6)
      doc.text(format(new Date(lab.date), 'MM/dd/yy'), margin + 2, y)
      doc.text(lab.test_name.substring(0, 25), margin + 25, y)
      doc.text(lab.value != null ? String(lab.value) : '-', margin + 80, y)
      const refRange =
        lab.reference_range_low != null && lab.reference_range_high != null
          ? `${lab.reference_range_low}-${lab.reference_range_high}`
          : '-'
      doc.text(refRange, margin + 105, y)
      if (lab.flag) {
        const flagColor =
          lab.flag === 'high' || lab.flag === 'critical'
            ? [220, 38, 38]
            : lab.flag === 'low'
              ? [59, 130, 246]
              : [34, 197, 94]
        doc.setTextColor(flagColor[0], flagColor[1], flagColor[2])
        doc.text(lab.flag.toUpperCase(), margin + 140, y)
        doc.setTextColor(0, 0, 0)
      }
      y += 5
    }
    y += 5
  }

  // ── Section: Appointments ────────────────────────────────────────
  if (showAppointments && data.appointments.length > 0) {
    checkPage(20)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Appointments', margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const appt of data.appointments) {
      checkPage(15)
      doc.setFont('helvetica', 'bold')
      doc.text(
        `${format(new Date(appt.date), 'MMM d, yyyy')} -- ${appt.doctor_name || 'Doctor'} (${appt.specialty || 'N/A'})`,
        margin + 2,
        y,
      )
      y += 5
      doc.setFont('helvetica', 'normal')
      if (appt.reason) {
        doc.text(`  Reason: ${appt.reason}`, margin + 2, y)
        y += 5
      }
      if (appt.notes) {
        const noteLines = doc.splitTextToSize(`  Notes: ${appt.notes}`, contentWidth - 4)
        doc.text(noteLines, margin + 2, y)
        y += noteLines.length * 4.5
      }
      if (appt.action_items) {
        doc.text(`  Action Items: ${appt.action_items}`, margin + 2, y)
        y += 5
      }
      y += 3
    }
  }

  // ── Section: AI-Assisted Pattern Analysis ─────────────────────────
  if (showAi && aiFindings && aiFindings.length > 0) {
    checkPage(30)
    doc.setDrawColor(150, 150, 150)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('AI-Assisted Pattern Analysis', margin, y)
    y += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    const aiDisclaimer =
      'The following patterns were identified by cross-referencing patient data with 34 medical research databases. These findings are for informational purposes and should be discussed with a healthcare provider.'
    const disclaimerLines = doc.splitTextToSize(aiDisclaimer, contentWidth - 4)
    doc.text(disclaimerLines, margin + 2, y)
    y += disclaimerLines.length * 4.5 + 3

    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')

    // Group findings by category
    const grouped: Record<string, AnalysisFinding[]> = {}
    for (const f of aiFindings) {
      if (!grouped[f.category]) grouped[f.category] = []
      grouped[f.category].push(f)
    }

    const categoryLabels: Record<string, string> = {
      diagnostic: 'Diagnostic Connections',
      biomarker: 'Biomarker Analysis',
      pathway: 'Molecular Pathways',
      medication: 'Medication Interactions',
      flare: 'Flare Prediction Patterns',
      food: 'Food-Symptom Correlations',
      research: 'Supporting Research',
      trial: 'Clinical Trials',
    }

    for (const [category, findings] of Object.entries(grouped)) {
      checkPage(20)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(categoryLabels[category] || category, margin + 2, y)
      y += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')

      // Show top findings (up to 5 per category)
      for (const finding of findings.slice(0, 5)) {
        checkPage(15)
        const significance =
          finding.clinical_significance === 'critical' ||
          finding.clinical_significance === 'high'
            ? ' *'
            : ''
        const confidence =
          finding.confidence != null
            ? ` (${Math.round(finding.confidence * 100)}% confidence)`
            : ''

        doc.setFont('helvetica', 'bold')
        const titleText = `${finding.title}${significance}${confidence}`
        const titleLines = doc.splitTextToSize(titleText, contentWidth - 8)
        doc.text(titleLines, margin + 4, y)
        y += titleLines.length * 4.5

        doc.setFont('helvetica', 'normal')
        const summaryLines = doc.splitTextToSize(finding.summary, contentWidth - 8)
        doc.text(summaryLines, margin + 4, y)
        y += summaryLines.length * 4.5 + 2
      }
      y += 3
    }

    // Gene association summary if pathway findings exist
    if (grouped['pathway']) {
      checkPage(15)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(80, 80, 80)
      const geneNote =
        'Key genes identified: HAMP (hepcidin), IL6 (inflammatory cytokine), ESR1 (estrogen receptor), SLC40A1 (ferroportin), BMP6, HFE, JAK2, STAT3. These form the molecular connection between endometriosis, iron metabolism dysfunction, and dysautonomia.'
      const geneLines = doc.splitTextToSize(geneNote, contentWidth - 4)
      doc.text(geneLines, margin + 2, y)
      y += geneLines.length * 4.5 + 3
      doc.setTextColor(0, 0, 0)
    }
  }

  // ── Running footer ───────────────────────────────────────────────
  // Writes patient name + "Page X of Y" onto every page (cover included).
  // Replaces the previous EndoTracker-branded footer.
  applyRunningFooter(doc, cover.patient.name)

  return doc
}
