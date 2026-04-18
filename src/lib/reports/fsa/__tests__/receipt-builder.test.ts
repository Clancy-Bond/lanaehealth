/**
 * Tests for the FSA/HSA receipt PDF builder.
 *
 * PDFs are binary, but jsPDF emits readable text streams that we can
 * inspect with a Buffer -> string conversion. This is enough to verify:
 *   - All required elements appear (patient name, plan year, each row).
 *   - Dollar amounts format correctly.
 *   - LMN footer appears only when at least one LMN-flagged row is included.
 *   - The attestation statement is always rendered.
 */

import { describe, it, expect } from "vitest";
import { buildFsaReceipt } from "@/lib/reports/fsa/receipt-builder";
import type { MedicalExpense } from "@/lib/types";

function makeExpense(overrides: Partial<MedicalExpense> = {}): MedicalExpense {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    service_date: "2026-04-01",
    provider_or_vendor: "Dr. Test",
    description: "Office visit copay",
    amount_cents: 5000,
    category: "office_visit",
    letter_of_medical_necessity: false,
    receipt_url: null,
    notes: null,
    appointment_id: null,
    claimed: false,
    claimed_at: null,
    plan_year: 2026,
    created_at: "2026-04-01T12:00:00Z",
    updated_at: "2026-04-01T12:00:00Z",
    ...overrides,
  };
}

/**
 * jsPDF concatenates text into the PDF stream as parenthesized strings
 * in the content objects. We convert the Uint8Array to a Latin1-safe
 * string and search it. Not every character survives (some get escaped
 * or split across lines), but common ASCII does, which is enough for
 * assertion.
 */
function pdfText(pdf: Uint8Array): string {
  // Use Latin1-ish conversion so each byte maps to a char
  let out = "";
  for (let i = 0; i < pdf.length; i++) out += String.fromCharCode(pdf[i]);
  return out;
}

describe("buildFsaReceipt", () => {
  it("produces a non-empty PDF", () => {
    const pdf = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: [makeExpense()],
    });
    expect(pdf.byteLength).toBeGreaterThan(800);
    expect(pdfText(pdf).startsWith("%PDF-")).toBe(true);
  });

  it("includes patient name and plan year", () => {
    const pdf = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: [makeExpense()],
    });
    const text = pdfText(pdf);
    expect(text).toContain("Lanae Bond");
    expect(text).toContain("2026");
  });

  it("lists provider, description, and amount", () => {
    const pdf = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: [
        makeExpense({
          provider_or_vendor: "Imaging Center",
          description: "CT Head",
          amount_cents: 48000,
        }),
      ],
    });
    const text = pdfText(pdf);
    expect(text).toContain("Imaging Center");
    expect(text).toContain("CT Head");
    // Dollar formatting uses $480.00
    expect(text).toContain("480.00");
  });

  it("always renders the attestation statement", () => {
    const pdf = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: [makeExpense()],
    });
    const text = pdfText(pdf);
    // We split to accommodate jsPDF wrapping
    expect(text).toMatch(/qualified medical|medical care/);
  });

  it("renders LMN footer only when at least one expense needs it", () => {
    const pdfNoLmn = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: [makeExpense({ category: "office_visit" })],
    });
    const pdfWithLmn = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: [makeExpense({ category: "supplement" })],
    });
    expect(pdfText(pdfNoLmn)).not.toMatch(/Letter of Medical Necessity/);
    expect(pdfText(pdfWithLmn)).toMatch(/Letter of Medical Necessity/);
  });

  it("sums per-category totals and grand total correctly", () => {
    const pdf = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: [
        makeExpense({
          provider_or_vendor: "Labcorp",
          description: "Comprehensive labs",
          amount_cents: 28500,
          category: "lab_imaging",
        }),
        makeExpense({
          provider_or_vendor: "Imaging Center",
          description: "CT Head",
          amount_cents: 48000,
          category: "lab_imaging",
        }),
        makeExpense({
          provider_or_vendor: "PCP",
          description: "Visit copay",
          amount_cents: 5000,
          category: "office_visit",
        }),
      ],
    });
    const text = pdfText(pdf);
    // lab_imaging total = 765.00
    expect(text).toContain("765.00");
    // grand total = 815.00
    expect(text).toContain("815.00");
  });

  it("paginates when there are many rows", () => {
    const many: MedicalExpense[] = Array.from({ length: 60 }, (_, i) =>
      makeExpense({
        id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        description: `Row ${i}`,
        amount_cents: 100 + i,
      }),
    );
    const pdf = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: many,
    });
    // A 60-row receipt has to overflow the first page
    const text = pdfText(pdf);
    const pageCount = (text.match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });

  it("sorts rows by service_date ascending (chronological reading)", () => {
    const pdf = buildFsaReceipt({
      patientName: "Lanae Bond",
      planYear: 2026,
      expenses: [
        makeExpense({
          service_date: "2026-03-15",
          description: "Later visit",
        }),
        makeExpense({
          service_date: "2026-01-05",
          description: "Earlier visit",
        }),
      ],
    });
    const text = pdfText(pdf);
    const earlierIdx = text.indexOf("Earlier visit");
    const laterIdx = text.indexOf("Later visit");
    expect(earlierIdx).toBeGreaterThan(-1);
    expect(laterIdx).toBeGreaterThan(earlierIdx);
  });
});
