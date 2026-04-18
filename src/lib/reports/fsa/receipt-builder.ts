// FSA/HSA itemized receipt builder.
//
// Generates a single-page PDF that meets the documentation standard most
// FSA/HSA administrators require:
//   1. Patient name
//   2. Plan year
//   3. Itemized expenses: service date, provider, description, amount, category
//   4. Totals by category and a grand total
//   5. Signed statement that expenses are for qualified medical care
//
// Directly addresses the Oura Trustpilot complaint pattern "no itemized
// receipt for FSA claims" - LanaeHealth has all this data already; the
// user just needs it rendered in a format the benefits administrator
// accepts.
//
// Legal framing: this is a SUMMARY generated from patient records, NOT
// a substitute for provider-issued itemized statements. The footer
// states this explicitly.

import jsPDF from "jspdf";
import { format } from "date-fns";
import type {
  MedicalExpense,
  MedicalExpenseCategory,
} from "@/lib/types";

// --- Config ----------------------------------------------------------------

const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 15;

// Warm Modern palette (matches CLAUDE.md brand direction). jsPDF takes RGB.
const SAGE: [number, number, number] = [107, 144, 128];
const BLUSH: [number, number, number] = [212, 160, 160];
const CREAM_BG: [number, number, number] = [250, 250, 247];
const TEXT_DARK: [number, number, number] = [45, 45, 45];
const TEXT_MUTED: [number, number, number] = [120, 120, 120];

// LEARNING MODE CONTRIBUTION POINT (CATEGORY LABELS + FSA-ELIGIBILITY)
// ----------------------------------------------------------------------
// Each category gets (a) a human label shown on the PDF and (b) a
// default FSA-eligibility hint. Edit the labels to match the language
// Lanae's actual FSA administrator prefers on submissions.
//
// `eligibility` is not a legal claim; it's a soft hint to the patient.
// `supplement` and `other` require a Letter of Medical Necessity and
// are flagged accordingly.
const CATEGORY_META: Record<
  MedicalExpenseCategory,
  { label: string; eligibility: "standard" | "lmn_required" | "case_by_case" }
> = {
  office_visit: { label: "Office / Telehealth Visit", eligibility: "standard" },
  prescription: { label: "Prescription", eligibility: "standard" },
  lab_imaging: { label: "Lab / Imaging", eligibility: "standard" },
  device: { label: "Medical Device", eligibility: "standard" },
  subscription: {
    label: "Health Tracking Subscription",
    eligibility: "case_by_case",
  },
  supplement: { label: "Supplement (LMN required)", eligibility: "lmn_required" },
  therapy: { label: "Therapy / Rehab", eligibility: "standard" },
  dental_vision: { label: "Dental / Vision", eligibility: "standard" },
  travel_medical: { label: "Medical Travel", eligibility: "standard" },
  other: { label: "Other (LMN required)", eligibility: "lmn_required" },
};

// --- Types ----------------------------------------------------------------

export interface BuildReceiptArgs {
  patientName: string;
  planYear: number;
  expenses: MedicalExpense[];
  generatedAt?: Date;
}

// --- Helpers --------------------------------------------------------------

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

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

function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setText(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

// --- Main builder ---------------------------------------------------------

/**
 * Produce the PDF as a Uint8Array so it can be returned by a Next.js route
 * handler with Content-Type: application/pdf.
 */
export function buildFsaReceipt(args: BuildReceiptArgs): Uint8Array {
  const {
    patientName,
    planYear,
    expenses,
    generatedAt = new Date(),
  } = args;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // ---- Title band (sage stripe) -----------------------------------------
  setFill(doc, SAGE);
  doc.rect(0, 0, A4_WIDTH, 30, "F");
  setText(doc, [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Medical Expense Receipt", MARGIN, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `Plan year ${planYear}  \u00B7  Itemized for FSA / HSA submission`,
    MARGIN,
    22,
  );
  y = 38;

  // ---- Patient block ----------------------------------------------------
  setText(doc, TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Patient:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(patientName, MARGIN + 22, y);

  doc.setFont("helvetica", "bold");
  doc.text("Prepared:", MARGIN + 110, y);
  doc.setFont("helvetica", "normal");
  doc.text(format(generatedAt, "MMM d, yyyy"), MARGIN + 133, y);
  y += 8;

  // ---- Itemized table ---------------------------------------------------
  const COLS = {
    date: MARGIN,
    provider: MARGIN + 28,
    description: MARGIN + 75,
    category: MARGIN + 130,
    amount: A4_WIDTH - MARGIN,
  };

  // Header row with sage underline
  setDraw(doc, SAGE);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 1, A4_WIDTH - MARGIN, y + 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, TEXT_MUTED);
  doc.text("Date", COLS.date, y);
  doc.text("Provider / Vendor", COLS.provider, y);
  doc.text("Description", COLS.description, y);
  doc.text("Category", COLS.category, y);
  doc.text("Amount", COLS.amount, y, { align: "right" });
  y += 5;

  doc.line(MARGIN, y - 1.5, A4_WIDTH - MARGIN, y - 1.5);

  // Sort ascending by service_date so the receipt reads chronologically
  const sorted = [...expenses].sort((a, b) =>
    a.service_date.localeCompare(b.service_date),
  );

  const totalsByCategory: Record<string, number> = {};
  let grandTotal = 0;
  let lmnFlagged = false;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, TEXT_DARK);

  for (const e of sorted) {
    if (y > A4_HEIGHT - 60) {
      doc.addPage();
      y = MARGIN;
    }

    const meta = CATEGORY_META[e.category];
    if (meta.eligibility !== "standard") lmnFlagged = true;

    doc.text(formatIsoDate(e.service_date), COLS.date, y);

    const providerClipped =
      e.provider_or_vendor.length > 26
        ? e.provider_or_vendor.slice(0, 25) + "\u2026"
        : e.provider_or_vendor;
    doc.text(providerClipped, COLS.provider, y);

    const descClipped =
      e.description.length > 32
        ? e.description.slice(0, 31) + "\u2026"
        : e.description;
    doc.text(descClipped, COLS.description, y);

    const catClipped = meta.label.length > 22
      ? meta.label.slice(0, 21) + "\u2026"
      : meta.label;
    doc.text(catClipped, COLS.category, y);

    doc.text(dollars(e.amount_cents), COLS.amount, y, { align: "right" });

    totalsByCategory[e.category] =
      (totalsByCategory[e.category] ?? 0) + e.amount_cents;
    grandTotal += e.amount_cents;

    y += 5.5;
  }

  // ---- Totals -----------------------------------------------------------
  y += 4;
  setDraw(doc, TEXT_MUTED);
  doc.line(MARGIN, y, A4_WIDTH - MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, TEXT_DARK);
  doc.text("Totals by category", MARGIN, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const [cat, cents] of Object.entries(totalsByCategory)) {
    const meta = CATEGORY_META[cat as MedicalExpenseCategory];
    doc.text(meta.label, MARGIN + 4, y);
    doc.text(dollars(cents), COLS.amount, y, { align: "right" });
    y += 4.5;
  }

  y += 4;
  // Grand total band (blush)
  setFill(doc, BLUSH);
  doc.rect(MARGIN, y, A4_WIDTH - 2 * MARGIN, 10, "F");
  setText(doc, [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Grand total", MARGIN + 4, y + 6.5);
  doc.text(dollars(grandTotal), A4_WIDTH - MARGIN - 4, y + 6.5, {
    align: "right",
  });
  y += 16;

  // ---- Attestation + footer --------------------------------------------
  setText(doc, TEXT_DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const attestLines = [
    "I certify that the expenses listed above were incurred for qualified medical",
    "care for myself or an eligible dependent, are not reimbursed by any other",
    "source, and will not be claimed as an itemized deduction on my tax return.",
  ];
  for (const line of attestLines) {
    doc.text(line, MARGIN, y);
    y += 4;
  }

  y += 6;
  // Signature line
  setDraw(doc, TEXT_DARK);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.line(A4_WIDTH - MARGIN - 50, y, A4_WIDTH - MARGIN, y);
  doc.setFontSize(8);
  setText(doc, TEXT_MUTED);
  doc.text("Signature", MARGIN, y + 4);
  doc.text("Date", A4_WIDTH - MARGIN - 50, y + 4);

  // ---- LMN note (only if any row needs it) -----------------------------
  if (lmnFlagged) {
    y += 10;
    setFill(doc, CREAM_BG);
    doc.rect(MARGIN, y, A4_WIDTH - 2 * MARGIN, 14, "F");
    setText(doc, TEXT_DARK);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      "Some line items (supplements, subscriptions, or other) may require a",
      MARGIN + 3,
      y + 5,
    );
    doc.text(
      "Letter of Medical Necessity from your provider. Attach separately.",
      MARGIN + 3,
      y + 9,
    );
  }

  // ---- Bottom footer ---------------------------------------------------
  setText(doc, TEXT_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    "Generated by LanaeHealth. This is a patient-prepared summary and does not replace provider-issued receipts.",
    MARGIN,
    A4_HEIGHT - 8,
  );

  // Return as Uint8Array for the Next.js response
  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
