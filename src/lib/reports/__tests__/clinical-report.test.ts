/**
 * Tests for the clinical PDF generator.
 *
 * We can't pixel-inspect a PDF in a unit test, but we can:
 *   - Check total page count changes when toggles flip.
 *   - Inspect the PDF's internal text stream for strings like the
 *     patient name, absence of app-branding, reporting period, and
 *     per-section headings.
 *   - Validate the cover-page builder produces expected content.
 */

import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";
import {
  generateClinicalReport,
  buildCoverContent,
  type ReportSectionToggles,
} from "@/lib/reports/clinical-report";
import { generateCoverPage, applyRunningFooter } from "@/lib/reports/cover-page";
import type { ReportData } from "@/lib/reports/report-data";

// ── Test fixtures ──────────────────────────────────────────────────

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    startDate: "2026-01-01",
    endDate: "2026-04-01",
    dailyLogs: [],
    symptoms: [],
    painPoints: [],
    ouraData: [],
    cycleEntries: [],
    labResults: [],
    appointments: [],
    foodEntries: [],
    summary: {
      totalDaysLogged: 42,
      avgPain: 4.2,
      maxPain: 8,
      avgFatigue: 5.1,
      avgSleepScore: 72,
      avgHrv: 48,
      avgRestingHr: 62,
      avgTempDeviation: 0.1,
      topSymptoms: [
        { symptom: "dizziness", count: 12 },
        { symptom: "nausea", count: 7 },
      ],
      topPainRegions: [{ region: "pelvis", count: 5, avgIntensity: 7.2 }],
      topTriggers: [],
      periodDays: 6,
      avgCycleLength: 29,
    },
    patient: {
      name: "Lanae A. Bond",
      age: 24,
      sex: "Female",
      bloodType: "A+",
      heightCm: 170,
      weightKg: 67.3,
      dob: "2001-08-12",
      diagnoses: ["Suspected endometriosis", "Suspected POTS"],
      allergies: ["Penicillin", "Sulfa"],
      medications: [{ name: "Ibuprofen", dose: "400mg", frequency: "PRN" }],
    },
    ...overrides,
  };
}

/**
 * Extract concatenated text from the PDF internal structure.
 *
 * jsPDF stores each text draw as a `(literal) Tj` PDF operator in
 * doc.internal.pages. We scan those operators and concatenate the
 * parenthesized literals. Enough for assertions about strings.
 */
function pdfText(doc: jsPDF): string {
  const pages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
  const chunks: string[] = [];
  for (const page of pages) {
    if (!page) continue;
    for (const op of page) {
      if (typeof op !== "string") continue;
      const re = /\(((?:[^()\\]|\\[\s\S])*)\)\s*Tj/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(op)) !== null) {
        chunks.push(m[1].replace(/\\([()\\])/g, "$1"));
      }
    }
  }
  return chunks.join("\n");
}

/**
 * Duck-typed jsPDF check. `instanceof jsPDF` can be unreliable across
 * the ESM/CJS boundary in this project, so we check for the ducks.
 */
function isJsPDFLike(doc: unknown): boolean {
  return (
    doc !== null &&
    typeof doc === "object" &&
    typeof (doc as { getNumberOfPages?: unknown }).getNumberOfPages === "function" &&
    typeof (doc as { addPage?: unknown }).addPage === "function" &&
    typeof (doc as { text?: unknown }).text === "function"
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe("generateClinicalReport", () => {
  it("returns a jsPDF document with at least one page", () => {
    const doc = generateClinicalReport(makeReportData());
    expect(isJsPDFLike(doc)).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });

  it("renders the cover page first with patient name and reporting period", () => {
    const doc = generateClinicalReport(makeReportData());
    const text = pdfText(doc);
    expect(text).toContain("Lanae A. Bond");
    expect(text).toContain("Clinical Report");
    // date-fns MMM d, yyyy, anchored at local midnight
    expect(text).toContain("Jan 1, 2026");
    expect(text).toContain("Apr 1, 2026");
  });

  it("does NOT include app branding in the PDF", () => {
    const doc = generateClinicalReport(makeReportData());
    const text = pdfText(doc);
    expect(text).not.toContain("EndoTracker");
    expect(text).not.toContain("LanaeHealth");
    expect(text).not.toContain("lanaehealth");
  });

  it("includes allergies on the cover page (safety-critical)", () => {
    const doc = generateClinicalReport(makeReportData());
    const text = pdfText(doc);
    expect(text).toContain("Penicillin");
    expect(text).toContain("Sulfa");
    expect(text).toContain("ALLERGIES");
  });

  it("includes diagnoses on the cover page", () => {
    const doc = generateClinicalReport(makeReportData());
    const text = pdfText(doc);
    expect(text).toContain("Suspected endometriosis");
    expect(text).toContain("Suspected POTS");
  });

  it("renders medications on the cover page", () => {
    const doc = generateClinicalReport(makeReportData());
    const text = pdfText(doc);
    expect(text).toContain("Ibuprofen");
  });

  it("respects section toggles - omits labs when labs:false", () => {
    const data = makeReportData({
      labResults: [
        {
          id: "1",
          date: "2026-03-01",
          test_name: "TSH",
          value: 5.1,
          unit: "uIU/mL",
          reference_range_low: 0.4,
          reference_range_high: 4.0,
          flag: "high",
        } as ReportData["labResults"][number],
      ],
    });
    const withLabs = generateClinicalReport(data, { sections: {} });
    const withoutLabs = generateClinicalReport(data, { sections: { labs: false } });
    expect(pdfText(withLabs)).toContain("Lab Results");
    expect(pdfText(withoutLabs)).not.toContain("Lab Results");
  });

  it("respects section toggles - omits cycle when cycle:false", () => {
    const data = makeReportData();
    const withCycle = generateClinicalReport(data);
    const withoutCycle = generateClinicalReport(data, {
      sections: { cycle: false },
    });
    expect(pdfText(withCycle)).toContain("Cycle Data");
    expect(pdfText(withoutCycle)).not.toContain("Cycle Data");
  });

  it("skips sections entirely when there is no data for them", () => {
    // Empty pain data -> no "Pain Summary" heading.
    const data = makeReportData({
      summary: {
        ...makeReportData().summary,
        avgPain: null,
        maxPain: null,
        avgFatigue: null,
        topPainRegions: [],
      },
    });
    const doc = generateClinicalReport(data);
    expect(pdfText(doc)).not.toContain("Pain Summary");
  });

  it("skips the cover page when cover:false", () => {
    const toggles: ReportSectionToggles = { cover: false };
    const doc = generateClinicalReport(makeReportData(), { sections: toggles });
    const text = pdfText(doc);
    // The large "Clinical Report" title lives on the cover and should vanish.
    expect(text).not.toContain("Clinical Report");
  });

  it("legacy 2-arg call (data, AnalysisFinding[]) still works", () => {
    const doc = generateClinicalReport(makeReportData(), []);
    expect(isJsPDFLike(doc)).toBe(true);
  });

  it("footer includes patient name and page X of Y on every page", () => {
    const doc = generateClinicalReport(makeReportData());
    const text = pdfText(doc);
    const totalPages = doc.getNumberOfPages();
    expect(text).toContain(`Page 1 of ${totalPages}`);
    expect(text).toContain("Lanae A. Bond");
  });
});

describe("buildCoverContent", () => {
  it("copies the patient identity block verbatim", () => {
    const data = makeReportData();
    const cover = buildCoverContent(data);
    expect(cover.patient.name).toBe("Lanae A. Bond");
    expect(cover.patient.age).toBe(24);
    expect(cover.patient.bloodType).toBe("A+");
    expect(cover.allergies).toEqual(["Penicillin", "Sulfa"]);
    expect(cover.reportingPeriod).toEqual({ start: "2026-01-01", end: "2026-04-01" });
  });

  it("handles missing patient gracefully", () => {
    const data = makeReportData({ patient: undefined });
    const cover = buildCoverContent(data);
    expect(cover.patient.name).toBe("Patient");
    expect(cover.diagnoses).toEqual([]);
    expect(cover.allergies).toEqual([]);
  });
});

describe("generateCoverPage (unit)", () => {
  it("does not throw when rendering with just required fields", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    expect(() =>
      generateCoverPage(doc, {
        patient: { name: "Patient" },
        diagnoses: [],
        medications: [],
        allergies: [],
        reportingPeriod: { start: "2026-01-01", end: "2026-01-31" },
      }),
    ).not.toThrow();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders 'No known allergies on file' when none provided", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    generateCoverPage(doc, {
      patient: { name: "Jane Doe" },
      diagnoses: [],
      medications: [],
      allergies: [],
      reportingPeriod: { start: "2026-01-01", end: "2026-01-31" },
    });
    const text = pdfText(doc);
    expect(text).toContain("No known allergies on file");
  });
});

describe("applyRunningFooter", () => {
  it("writes the patient name onto every existing page", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.addPage();
    doc.addPage();
    expect(doc.getNumberOfPages()).toBe(3);
    applyRunningFooter(doc, "Jane Doe");
    const text = pdfText(doc);
    expect(text).toContain("Jane Doe");
    expect(text).toContain("Page 1 of 3");
    expect(text).toContain("Page 3 of 3");
  });
});
