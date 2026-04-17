/**
 * Tests for pre-visit report pure helpers.
 *
 * Covers:
 *   - inferSpecialty bucket classification
 *   - rankOutstandingTests deduplication + recency sort
 *   - summarizeSymptomWindow null-safety + averages
 *   - SPECIALTY_ORDER contract: first section key matches brief priority
 */

import { describe, it, expect } from "vitest";
import {
  inferSpecialty,
  rankOutstandingTests,
  summarizeSymptomWindow,
  SPECIALTY_ORDER,
  type OutstandingTestInput,
} from "../../reports/pre-visit";

describe("inferSpecialty", () => {
  it("classifies OB/GYN from specialty string", () => {
    expect(inferSpecialty({ specialty: "OB/GYN", reason: null, doctor_name: null })).toBe("obgyn");
    expect(inferSpecialty({ specialty: "Obstetrics & Gynecology", reason: null, doctor_name: null })).toBe("obgyn");
  });

  it("classifies cardiology", () => {
    expect(inferSpecialty({ specialty: "Cardiology", reason: null, doctor_name: null })).toBe("cardiology");
    expect(inferSpecialty({ specialty: null, reason: "Heart follow-up", doctor_name: null })).toBe("cardiology");
  });

  it("classifies neurology including headache/migraine reasons", () => {
    expect(inferSpecialty({ specialty: "Neurology", reason: null, doctor_name: null })).toBe("neurology");
    expect(inferSpecialty({ specialty: null, reason: "migraine follow-up", doctor_name: null })).toBe("neurology");
  });

  it("classifies pcp from reason text", () => {
    expect(inferSpecialty({ specialty: null, reason: "primary care check-in", doctor_name: null })).toBe("pcp");
    expect(inferSpecialty({ specialty: "PCP", reason: null, doctor_name: null })).toBe("pcp");
  });

  it("falls back to other", () => {
    expect(inferSpecialty({ specialty: null, reason: null, doctor_name: null })).toBe("other");
    expect(inferSpecialty({ specialty: "Allergy & Immunology", reason: null, doctor_name: null })).toBe("other");
  });
});

describe("rankOutstandingTests", () => {
  const mk = (text: string, refDate: string): OutstandingTestInput => ({
    source: "action_items",
    text,
    sourceRef: "test",
    referenceDate: refDate,
  });

  it("returns empty list for empty input", () => {
    expect(rankOutstandingTests([])).toEqual([]);
  });

  it("sorts items by most recent reference date first", () => {
    const items = [mk("Old test", "2026-01-01"), mk("New test", "2026-04-01")];
    const out = rankOutstandingTests(items);
    expect(out.map((i) => i.text)).toEqual(["New test", "Old test"]);
  });

  it("deduplicates by lowercased text", () => {
    const items = [
      mk("Order CBC", "2026-04-01"),
      mk("order cbc", "2026-02-01"),
      mk("Check iron", "2026-03-01"),
    ];
    const out = rankOutstandingTests(items);
    expect(out.length).toBe(2);
    expect(out.map((i) => i.text.toLowerCase())).toEqual([
      "order cbc",
      "check iron",
    ]);
  });

  it("drops empty whitespace entries", () => {
    const items = [mk("   ", "2026-04-01"), mk("Something", "2026-03-01")];
    expect(rankOutstandingTests(items).map((i) => i.text)).toEqual([
      "Something",
    ]);
  });
});

describe("summarizeSymptomWindow", () => {
  it("returns all-null with zero days on empty input", () => {
    const out = summarizeSymptomWindow([]);
    expect(out).toEqual({ nDays: 0, avgPain: null, avgFatigue: null, avgSleep: null });
  });

  it("averages across rows ignoring nulls", () => {
    const out = summarizeSymptomWindow([
      { date: "2026-04-01", overall_pain: 4, fatigue: 6, sleep_quality: 7 },
      { date: "2026-04-02", overall_pain: 6, fatigue: null, sleep_quality: 5 },
      { date: "2026-04-03", overall_pain: null, fatigue: 4, sleep_quality: null },
    ]);
    expect(out.nDays).toBe(3);
    expect(out.avgPain).toBe(5);
    expect(out.avgFatigue).toBe(5);
    expect(out.avgSleep).toBe(6);
  });

  it("returns null on a metric when every row is null for it", () => {
    const out = summarizeSymptomWindow([
      { date: "2026-04-01", overall_pain: 4, fatigue: null, sleep_quality: null },
    ]);
    expect(out.avgFatigue).toBeNull();
    expect(out.avgSleep).toBeNull();
    expect(out.avgPain).toBe(4);
  });
});

describe("SPECIALTY_ORDER contract", () => {
  it("OB/GYN leads with cycle and pain priorities", () => {
    expect(SPECIALTY_ORDER.obgyn.slice(0, 3)).toEqual([
      "cycle_stats",
      "pelvic_pain",
      "hormonal_symptoms",
    ]);
  });

  it("Cardiology leads with orthostatic + vitals trends", () => {
    expect(SPECIALTY_ORDER.cardiology.slice(0, 3)).toEqual([
      "orthostatic",
      "vitals_trends",
      "cardiovascular_labs",
    ]);
  });

  it("Neurology leads with headache summary + cycle correlation", () => {
    expect(SPECIALTY_ORDER.neurology.slice(0, 3)).toEqual([
      "headache_summary",
      "cycle_migraine_correlation",
      "triggers",
    ]);
  });

  it("PCP leads with whole-picture summary", () => {
    expect(SPECIALTY_ORDER.pcp[0]).toBe("whole_picture");
  });

  it("every bucket has at least 3 ordered sections", () => {
    for (const key of Object.keys(SPECIALTY_ORDER)) {
      const val = SPECIALTY_ORDER[key as keyof typeof SPECIALTY_ORDER];
      expect(val.length).toBeGreaterThanOrEqual(3);
    }
  });
});
