// Clinical PDF cover page builder.
//
// First page of the clinical report. Renders patient identity, current
// diagnoses, active medications, allergies, and the reporting period so
// a clinician can orient themselves in under five seconds without flipping
// pages.
//
// Design principles:
//   - No app branding. Doctors don't care what app this came from; they
//     care about the patient.
//   - Patient identity block is visually distinct (boxed, larger type).
//   - Allergies are highlighted in a warning band since they're
//     safety-critical for any prescribing decision.
//   - Typography is conservative helvetica, readable at print scale.
//
// This module is consumed by clinical-report.ts to assemble the full
// PDF; keeping the cover isolated makes it easy to test layout math and
// re-use if we ever spin off a 1-page summary.

import type jsPDF from "jspdf";
import { format } from "date-fns";

export interface CoverPagePatient {
  name: string;
  dob?: string | null;
  age?: number | null;
  sex?: string | null;
  bloodType?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  mrn?: string | null;
}

export interface CoverPageContent {
  patient: CoverPagePatient;
  diagnoses: string[];
  suspectedConditions?: string[];
  medications: Array<{ name: string; dose?: string | null; frequency?: string | null }>;
  allergies: string[];
  reportingPeriod: { start: string; end: string };
  generatedAt?: Date;
}

const COVER_MARGIN = 15;
const A4_WIDTH = 210;
const A4_HEIGHT = 297;

/**
 * Format a YYYY-MM-DD as "MMM d, yyyy" in LOCAL time.
 * new Date("2026-01-01") is UTC midnight per spec, which prints as the
 * previous day in timezones west of UTC. Anchor at local midnight.
 */
function formatIsoDate(iso: string): string {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return format(new Date(iso + "T00:00:00"), "MMM d, yyyy");
    }
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

/**
 * Render the cover onto the current (first) page of the jsPDF doc.
 */
export function generateCoverPage(doc: jsPDF, content: CoverPageContent): number {
  const pageWidth = doc.internal.pageSize.getWidth() || A4_WIDTH;
  const contentWidth = pageWidth - COVER_MARGIN * 2;
  let y = COVER_MARGIN + 5;

  // ── Title ─────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Clinical Report", COVER_MARGIN, y);
  y += 9;

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(content.patient.name, COVER_MARGIN, y);
  y += 10;

  // ── Reporting period ──────────────────────────────────────────────
  const period = `${formatIsoDate(content.reportingPeriod.start)} to ${formatIsoDate(
    content.reportingPeriod.end,
  )}`;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Reporting period: ${period}`, COVER_MARGIN, y);
  y += 4;
  const generated = content.generatedAt ?? new Date();
  doc.text(`Generated: ${format(generated, "MMMM d, yyyy h:mm a")}`, COVER_MARGIN, y);
  y += 8;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(COVER_MARGIN, y, pageWidth - COVER_MARGIN, y);
  y += 8;

  // ── Patient identity box ──────────────────────────────────────────
  const identityBoxHeight = 36;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.4);
  doc.rect(COVER_MARGIN, y, contentWidth, identityBoxHeight);

  const colWidth = contentWidth / 3;
  const pad = 3;
  const topRowY = y + 6;
  const midRowY = topRowY + 7;
  const botRowY = midRowY + 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("AGE / SEX", COVER_MARGIN + pad, topRowY);
  doc.text("BLOOD TYPE", COVER_MARGIN + colWidth + pad, topRowY);
  doc.text("HEIGHT / WEIGHT", COVER_MARGIN + colWidth * 2 + pad, topRowY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const ageSex = [
    content.patient.age != null ? `${content.patient.age}` : "-",
    content.patient.sex ?? "-",
  ].join(" / ");
  doc.text(ageSex, COVER_MARGIN + pad, midRowY);
  doc.text(content.patient.bloodType ?? "-", COVER_MARGIN + colWidth + pad, midRowY);
  const hw =
    content.patient.heightCm != null && content.patient.weightKg != null
      ? `${content.patient.heightCm} cm / ${content.patient.weightKg} kg`
      : "-";
  doc.text(hw, COVER_MARGIN + colWidth * 2 + pad, midRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("DATE OF BIRTH", COVER_MARGIN + pad, botRowY);
  doc.text("PATIENT ID", COVER_MARGIN + colWidth + pad, botRowY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const dobStr = content.patient.dob ? formatIsoDate(content.patient.dob) : "-";
  doc.text(dobStr, COVER_MARGIN + pad, botRowY + 5);
  doc.text(content.patient.mrn ?? "-", COVER_MARGIN + colWidth + pad, botRowY + 5);

  y += identityBoxHeight + 8;

  // ── Allergies band (safety-critical) ──────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(150, 40, 40);
  doc.text("ALLERGIES", COVER_MARGIN, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const allergyText =
    content.allergies.length > 0 ? content.allergies.join(", ") : "No known allergies on file.";
  const allergyLines = doc.splitTextToSize(allergyText, contentWidth);
  doc.text(allergyLines, COVER_MARGIN, y);
  y += allergyLines.length * 5 + 6;

  // ── Confirmed diagnoses ───────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("CONFIRMED DIAGNOSES", COVER_MARGIN, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  if (content.diagnoses.length > 0) {
    for (const dx of content.diagnoses) {
      if (y > A4_HEIGHT - 30) break;
      doc.text(`- ${dx}`, COVER_MARGIN + 2, y);
      y += 5;
    }
  } else {
    doc.setTextColor(120, 120, 120);
    doc.text("None recorded.", COVER_MARGIN + 2, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }
  y += 4;

  if (content.suspectedConditions && content.suspectedConditions.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("SUSPECTED / UNDER WORKUP", COVER_MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    for (const sx of content.suspectedConditions) {
      if (y > A4_HEIGHT - 30) break;
      doc.text(`- ${sx}`, COVER_MARGIN + 2, y);
      y += 5;
    }
    y += 4;
  }

  // ── Current medications ───────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("CURRENT MEDICATIONS", COVER_MARGIN, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  if (content.medications.length > 0) {
    for (const med of content.medications) {
      if (y > A4_HEIGHT - 30) break;
      const detail = [med.dose, med.frequency].filter(Boolean).join(", ");
      const line = detail ? `${med.name} (${detail})` : med.name;
      const wrapped = doc.splitTextToSize(`- ${line}`, contentWidth - 4);
      doc.text(wrapped, COVER_MARGIN + 2, y);
      y += wrapped.length * 5;
    }
  } else {
    doc.setTextColor(120, 120, 120);
    doc.text("None recorded.", COVER_MARGIN + 2, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  return y;
}

/**
 * Write a patient-name + page X of Y footer onto every page. Also
 * appends a short "Patient-generated" disclaimer line below.
 */
export function applyRunningFooter(
  doc: jsPDF,
  patientName: string,
  options: { disclaimer?: string } = {},
): void {
  const pageWidth = doc.internal.pageSize.getWidth() || A4_WIDTH;
  const totalPages = doc.getNumberOfPages();
  const disclaimer =
    options.disclaimer ??
    "Patient-generated data. Intended to support, not replace, clinical assessment.";

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(patientName, COVER_MARGIN, A4_HEIGHT - 7);
    const pageLabel = `Page ${i} of ${totalPages}`;
    const pageLabelWidth = doc.getTextWidth(pageLabel);
    doc.text(pageLabel, pageWidth - COVER_MARGIN - pageLabelWidth, A4_HEIGHT - 7);
    doc.text(disclaimer, COVER_MARGIN, A4_HEIGHT - 3);
  }
}
