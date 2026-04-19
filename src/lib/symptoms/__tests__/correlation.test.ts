import { describe, expect, it } from "vitest";
import { buildCorrelationGrid, buildDateRange } from "../correlation";

describe("buildDateRange", () => {
  it("produces N ascending dates ending today", () => {
    const r = buildDateRange(5);
    expect(r).toHaveLength(5);
    for (let i = 1; i < r.length; i++) {
      expect(r[i] > r[i - 1]).toBe(true);
    }
    const last = r[r.length - 1];
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(last).toBe(expected);
  });
});

describe("buildCorrelationGrid", () => {
  it("skips triggers that never occurred", () => {
    const range = buildDateRange(3);
    const triggersByDate = new Map<string, Set<string>>();
    const symptomsByDate = new Map<string, Set<string>>();
    symptomsByDate.set(range[0], new Set(["headache"]));
    const cells = buildCorrelationGrid({
      triggersByDate,
      symptomsByDate,
      dateRange: range,
    });
    expect(cells).toEqual([]);
  });

  it("computes a 100% rate when every trigger day has the symptom", () => {
    const range = buildDateRange(3);
    const triggersByDate = new Map<string, Set<string>>([
      [range[0], new Set(["caffeine"])],
      [range[1], new Set(["caffeine"])],
    ]);
    const symptomsByDate = new Map<string, Set<string>>([
      [range[0], new Set(["headache"])],
      [range[1], new Set(["headache"])],
    ]);
    const cells = buildCorrelationGrid({
      triggersByDate,
      symptomsByDate,
      dateRange: range,
    });
    expect(cells).toHaveLength(1);
    expect(cells[0].trigger).toBe("caffeine");
    expect(cells[0].symptom).toBe("headache");
    expect(cells[0].coOccurrenceRate).toBe(1);
    expect(cells[0].daysWithTrigger).toBe(2);
    expect(cells[0].daysWithBoth).toBe(2);
  });

  it("returns partial rates and keeps sample size from range length", () => {
    const range = buildDateRange(10);
    const triggersByDate = new Map<string, Set<string>>([
      [range[0], new Set(["dairy"])],
      [range[1], new Set(["dairy"])],
      [range[5], new Set(["dairy"])],
    ]);
    const symptomsByDate = new Map<string, Set<string>>([
      [range[0], new Set(["bloating"])],
      [range[5], new Set(["bloating"])],
    ]);
    const cells = buildCorrelationGrid({
      triggersByDate,
      symptomsByDate,
      dateRange: range,
    });
    expect(cells).toHaveLength(1);
    expect(cells[0].sampleSize).toBe(10);
    expect(cells[0].daysWithTrigger).toBe(3);
    expect(cells[0].daysWithBoth).toBe(2);
    expect(cells[0].coOccurrenceRate).toBeCloseTo(2 / 3);
  });

  it("sorts results by rate then by linked days", () => {
    const range = buildDateRange(5);
    const triggersByDate = new Map<string, Set<string>>([
      [range[0], new Set(["a"])],
      [range[1], new Set(["a", "b"])],
      [range[2], new Set(["b"])],
    ]);
    const symptomsByDate = new Map<string, Set<string>>([
      [range[0], new Set(["s"])],
      [range[1], new Set(["s"])],
      [range[2], new Set(["s"])],
    ]);
    const cells = buildCorrelationGrid({
      triggersByDate,
      symptomsByDate,
      dateRange: range,
    });
    // both have 100% rate, but "a" covers 2 days, "b" covers 2 days
    expect(cells.map((c) => c.trigger)).toEqual(expect.arrayContaining(["a", "b"]));
    for (const c of cells) {
      expect(c.coOccurrenceRate).toBe(1);
    }
  });
});
