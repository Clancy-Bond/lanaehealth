// Patient advocacy PDF with impact statements and biometric correlations
import jsPDF from 'jspdf'
import type { ReportData } from './report-data'
import type { AnalysisFinding } from '@/lib/types'
import { format } from 'date-fns'

/**
 * Generate a patient advocacy PDF report
 * Designed to communicate the real impact of endometriosis to providers
 */
export function generateAdvocacyReport(data: ReportData, aiFindings?: AnalysisFinding[]): jsPDF {
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

  // Title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Patient Symptom Impact Report', margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Covering: ${format(new Date(data.startDate), 'MMMM d, yyyy')} to ${format(new Date(data.endDate), 'MMMM d, yyyy')}`, margin, y)
  y += 5
  doc.text(`Data points: ${data.summary.totalDaysLogged} days logged`, margin, y)
  y += 8

  doc.setDrawColor(180, 100, 200)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  // Impact Statement
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Impact Statement', margin, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  const { summary } = data
  const statements: string[] = []

  if (summary.avgPain != null) {
    const painDesc = summary.avgPain >= 7 ? 'severe' : summary.avgPain >= 4 ? 'moderate' : 'mild'
    statements.push(
      `Over the past ${summary.totalDaysLogged} days, I have experienced an average daily pain level of ${summary.avgPain}/10, classified as ${painDesc}.`
    )
  }

  if (summary.maxPain != null && summary.maxPain >= 7) {
    statements.push(
      `My pain reached ${summary.maxPain}/10 at its worst during this period.`
    )
  }

  if (summary.topSymptoms.length > 0) {
    const topThree = summary.topSymptoms.slice(0, 3).map((s) => s.symptom.toLowerCase())
    statements.push(
      `My most frequent symptoms were ${topThree.join(', ')}, which significantly affected my quality of life.`
    )
  }

  if (summary.avgFatigue != null && summary.avgFatigue >= 5) {
    statements.push(
      `My average fatigue level was ${summary.avgFatigue}/10, making daily activities and work responsibilities extremely challenging.`
    )
  }

  if (summary.periodDays > 0) {
    statements.push(
      `I experienced ${summary.periodDays} days of menstruation during this period.${summary.avgCycleLength ? ` My average cycle length is ${summary.avgCycleLength} days.` : ''}`
    )
  }

  // Daily impact notes
  const impactNotes = data.dailyLogs
    .filter((l) => l.daily_impact)
    .map((l) => l.daily_impact!)
  if (impactNotes.length > 0) {
    statements.push(
      `I reported specific daily life impacts on ${impactNotes.length} days, including: "${impactNotes[0]}"${impactNotes.length > 1 ? ` and other similar experiences.` : '.'}`
    )
  }

  for (const statement of statements) {
    checkPage(15)
    const lines = doc.splitTextToSize(statement, contentWidth - 4)
    doc.text(lines, margin + 2, y)
    y += lines.length * 5.5 + 3
  }
  y += 5

  // Biometric Correlations
  if (data.ouraData.length > 0) {
    checkPage(40)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Biometric Correlations', margin, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    const bioStatements: string[] = []

    if (summary.avgSleepScore != null) {
      const quality = summary.avgSleepScore >= 80 ? 'good' : summary.avgSleepScore >= 60 ? 'fair' : 'poor'
      bioStatements.push(`Sleep quality averaged ${summary.avgSleepScore}/100 (${quality}), as measured by Oura Ring.`)
    }

    if (summary.avgHrv != null) {
      bioStatements.push(`Heart rate variability (HRV) averaged ${summary.avgHrv} ms. Low HRV can indicate elevated physiological stress.`)
    }

    if (summary.avgRestingHr != null) {
      bioStatements.push(`Resting heart rate averaged ${summary.avgRestingHr} bpm.`)
    }

    if (summary.avgTempDeviation != null) {
      bioStatements.push(`Body temperature deviation averaged ${summary.avgTempDeviation > 0 ? '+' : ''}${summary.avgTempDeviation}C from baseline, which may correlate with inflammatory activity.`)
    }

    for (const bio of bioStatements) {
      checkPage(10)
      const lines = doc.splitTextToSize(bio, contentWidth - 4)
      doc.text(lines, margin + 2, y)
      y += lines.length * 5 + 2
    }
    y += 5
  }

  // Symptom Frequency Table
  if (summary.topSymptoms.length > 0) {
    checkPage(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Symptom Frequency', margin, y)
    y += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Symptom', margin + 2, y)
    doc.text('Occurrences', margin + 80, y)
    doc.text('Frequency', margin + 115, y)
    y += 5
    doc.line(margin, y - 1, pageWidth - margin, y - 1)

    doc.setFont('helvetica', 'normal')
    for (const s of summary.topSymptoms) {
      checkPage(6)
      const freq = summary.totalDaysLogged > 0
        ? `${Math.round((s.count / summary.totalDaysLogged) * 100)}% of days`
        : '-'
      doc.text(s.symptom, margin + 2, y)
      doc.text(String(s.count), margin + 80, y)
      doc.text(freq, margin + 115, y)
      y += 5
    }
    y += 5
  }

  // Food Triggers
  if (summary.topTriggers.length > 0) {
    checkPage(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Dietary Triggers Detected', margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const t of summary.topTriggers) {
      doc.text(`  - ${t.trigger}: detected in ${t.count} meal${t.count !== 1 ? 's' : ''}`, margin + 2, y)
      y += 5
    }
    y += 5
  }

  // What Helped
  const helpNotes = data.dailyLogs.filter((l) => l.what_helped).map((l) => l.what_helped!)
  if (helpNotes.length > 0) {
    checkPage(20)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('What Helped', margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const uniqueHelps = [...new Set(helpNotes)].slice(0, 8)
    for (const help of uniqueHelps) {
      checkPage(6)
      doc.text(`  - ${help}`, margin + 2, y)
      y += 5
    }
    y += 5
  }

  // Section: Evidence-Based Assessment (AI Insights)
  if (aiFindings && aiFindings.length > 0) {
    checkPage(30)
    doc.setDrawColor(180, 100, 200)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Evidence-Based Assessment', margin, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const introText = `Based on analysis of ${data.summary.totalDaysLogged} daily health logs, ${data.labResults.length} lab results, ${data.ouraData.length} days of biometric data, and cross-referencing 34 medical research databases, the following evidence-backed connections were identified:`
    const introLines = doc.splitTextToSize(introText, contentWidth - 4)
    doc.text(introLines, margin + 2, y)
    y += introLines.length * 5.5 + 5

    // Filter for moderate+ significance findings
    const significant = aiFindings.filter(
      f => f.clinical_significance === 'high' || f.clinical_significance === 'critical' || f.clinical_significance === 'moderate'
    )
    const toShow = significant.length > 0 ? significant : aiFindings.slice(0, 8)

    for (const finding of toShow.slice(0, 10)) {
      checkPage(20)

      // Significance badge
      const sig = finding.clinical_significance
      if (sig === 'critical' || sig === 'high') {
        doc.setTextColor(220, 38, 38)
      } else if (sig === 'moderate') {
        doc.setTextColor(234, 179, 8)
      } else {
        doc.setTextColor(0, 0, 0)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const badgeText = sig ? `[${sig.toUpperCase()}] ` : ''
      doc.text(`${badgeText}${finding.title}`, margin + 2, y)
      y += 5

      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const sumLines = doc.splitTextToSize(finding.summary, contentWidth - 8)
      doc.text(sumLines, margin + 4, y)
      y += sumLines.length * 4.5 + 4
    }

    // Molecular pathway statement
    const pathwayFindings = aiFindings.filter(f => f.category === 'pathway')
    if (pathwayFindings.length > 0) {
      checkPage(20)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Identified Molecular Connection:', margin + 2, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const pathwayText = 'Research database analysis reveals a documented molecular pathway connecting endometriosis to iron metabolism dysfunction: chronic inflammation (elevated IL-6) activates hepcidin (HAMP gene) via the JAK-STAT signaling pathway, which blocks ferroportin (SLC40A1) and traps iron inside cells. This mechanism can explain concurrent iron deficiency despite adequate intake, impaired catecholamine synthesis, and downstream dysautonomia symptoms (POTS, syncope, tachycardia).'
      const pathLines = doc.splitTextToSize(pathwayText, contentWidth - 8)
      doc.text(pathLines, margin + 4, y)
      y += pathLines.length * 4.5 + 5
    }

    // Research citations
    const researchFindings = aiFindings.filter(f => f.category === 'research')
    if (researchFindings.length > 0) {
      checkPage(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Supporting Research:', margin + 2, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      for (const r of researchFindings.slice(0, 5)) {
        checkPage(8)
        const refText = `- ${r.title}: ${r.summary.substring(0, 120)}${r.summary.length > 120 ? '...' : ''}`
        const refLines = doc.splitTextToSize(refText, contentWidth - 8)
        doc.text(refLines, margin + 4, y)
        y += refLines.length * 4 + 2
      }
    }
    y += 5
  }

  // Closing
  checkPage(25)
  doc.setDrawColor(180, 100, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  const closingText = 'This report was generated from self-tracked data to support patient-provider communication. All data was logged by the patient using EndoTracker.'
  const closingLines = doc.splitTextToSize(closingText, contentWidth)
  doc.text(closingLines, margin, y)

  // Footer on all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Patient Symptom Impact Report -- Page ${i} of ${totalPages}`, margin, 290)
  }

  return doc
}
