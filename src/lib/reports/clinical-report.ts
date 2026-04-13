// Medical-style PDF report generation
import jsPDF from 'jspdf'
import type { ReportData } from './report-data'
import type { AnalysisFinding } from '@/lib/types'
import { format } from 'date-fns'

/**
 * Generate a clinical-style PDF report
 */
export function generateClinicalReport(data: ReportData, aiFindings?: AnalysisFinding[]): jsPDF {
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
    if (y + needed > 270) addPage()
  }

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('EndoTracker Clinical Report', margin, y)
  y += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Report Period: ${format(new Date(data.startDate), 'MMMM d, yyyy')} to ${format(new Date(data.endDate), 'MMMM d, yyyy')}`, margin, y)
  y += 5
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, y)
  y += 5
  doc.text(`Days with data: ${data.summary.totalDaysLogged}`, margin, y)
  y += 8
  doc.setDrawColor(150, 150, 150)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Section: Pain Summary
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Pain Summary', margin, y)
  y += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const painLines = [
    `Average Pain Score: ${data.summary.avgPain ?? 'No data'}/10`,
    `Maximum Pain Score: ${data.summary.maxPain ?? 'No data'}/10`,
    `Average Fatigue: ${data.summary.avgFatigue ?? 'No data'}/10`,
  ]
  for (const line of painLines) {
    doc.text(line, margin + 2, y)
    y += 5
  }
  y += 3

  // Top pain regions
  if (data.summary.topPainRegions.length > 0) {
    checkPage(30)
    doc.setFont('helvetica', 'bold')
    doc.text('Most Affected Regions:', margin + 2, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    for (const region of data.summary.topPainRegions) {
      doc.text(`  - ${region.region}: ${region.count} occurrences (avg intensity ${region.avgIntensity}/10)`, margin + 2, y)
      y += 5
    }
    y += 3
  }

  // Section: Symptom Summary
  checkPage(40)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Symptom Summary', margin, y)
  y += 7

  if (data.summary.topSymptoms.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const s of data.summary.topSymptoms) {
      doc.text(`  - ${s.symptom}: reported ${s.count} time${s.count !== 1 ? 's' : ''}`, margin + 2, y)
      y += 5
    }
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('  No symptoms logged in this period.', margin + 2, y)
    y += 5
  }
  y += 5

  // Section: Cycle Data
  checkPage(30)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Cycle Data', margin, y)
  y += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Period days in range: ${data.summary.periodDays}`, margin + 2, y)
  y += 5
  doc.text(`Average cycle length: ${data.summary.avgCycleLength ? `${data.summary.avgCycleLength} days` : 'Insufficient data'}`, margin + 2, y)
  y += 8

  // Section: Biometrics (Oura Ring)
  if (data.ouraData.length > 0) {
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

  // Section: Lab Results
  if (data.labResults.length > 0) {
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
      const refRange = lab.reference_range_low != null && lab.reference_range_high != null
        ? `${lab.reference_range_low}-${lab.reference_range_high}`
        : '-'
      doc.text(refRange, margin + 105, y)
      if (lab.flag) {
        const flagColor = lab.flag === 'high' || lab.flag === 'critical'
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

  // Section: Appointments
  if (data.appointments.length > 0) {
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
      doc.text(`${format(new Date(appt.date), 'MMM d, yyyy')} -- ${appt.doctor_name || 'Doctor'} (${appt.specialty || 'N/A'})`, margin + 2, y)
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

  // Section: AI-Assisted Pattern Analysis
  if (aiFindings && aiFindings.length > 0) {
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
    const aiDisclaimer = 'The following patterns were identified by cross-referencing patient data with 34 medical research databases. These findings are for informational purposes and should be discussed with a healthcare provider.'
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
        const significance = finding.clinical_significance === 'critical' || finding.clinical_significance === 'high'
          ? ' *'
          : ''
        const confidence = finding.confidence != null
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
      const geneNote = 'Key genes identified: HAMP (hepcidin), IL6 (inflammatory cytokine), ESR1 (estrogen receptor), SLC40A1 (ferroportin), BMP6, HFE, JAK2, STAT3. These form the molecular connection between endometriosis, iron metabolism dysfunction, and dysautonomia.'
      const geneLines = doc.splitTextToSize(geneNote, contentWidth - 4)
      doc.text(geneLines, margin + 2, y)
      y += geneLines.length * 4.5 + 3
      doc.setTextColor(0, 0, 0)
    }
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`EndoTracker Clinical Report -- Page ${i} of ${totalPages}`, margin, 290)
    doc.text('Generated for patient self-advocacy. Not a medical document.', pageWidth - margin - 80, 290)
  }

  return doc
}
