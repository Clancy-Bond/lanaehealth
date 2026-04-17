/**
 * Tests for CyclePredictionCard pure helpers.
 *
 * The card is presentational. The logic worth testing is the derivation
 * from EngineSummary into a UI shape:
 *   - confidence threshold flips single-date vs range
 *   - plain-language reason copy selection
 *   - no em dashes in any copy path
 */
import { describe, it, expect } from "vitest";
import {
  buildUiPrediction,
  deriveConfidenceLabel,
  deriveReason,
} from "../../components/patterns/CyclePredictionCard";
import type {
  EngineSummary,
  EnginePrediction,
} from "../intelligence/cycle-engine/engine";

function mkPrediction(overrides: Partial<EnginePrediction> = {}): EnginePrediction {
  return {
    cycleStart: "2026-03-15",
    cycleEnd: null,
    cycleNumber: 42,
    coverLine: null,
    shift: {
      confirmed: false,
      firstElevatedDate: null,
      estimatedOvulationDate: null,
      elevatedRun: 0,
      triggeringReads: [],
    },
    predictedOvulationDate: "2026-03-29",
    confirmedOvulationDate: null,
    lhSurgeDate: null,
    fertileWindow: null,
    periodPrediction: {
      predictedStart: "2026-04-12",
      uncertaintyDays: 2,
      basis: "ovulation_plus_luteal",
    },
    lutealLengthDays: null,
    shortLutealFlag: false,
    anovulatory: {
      cycleStart: "2026-03-15",
      cycleEnd: null,
      status: "likely_ovulatory",
      confidence: 0.6,
      reason: "",
      signals: {
        tempDaysAvailable: 0,
        tempDaysRequired: 10,
        biphasicShiftDetected: false,
        lhSurgeDetected: false,
        hormonalBirthControl: false,
      },
    },
    multiSignal: {
      confidence: 0.5,
      signalsUsed: ["bbt_shift"],
      breakdown: [],
      multiSignalOvulatory: false,
    },
    signalsUsed: ["bbt_shift"],
    signalBreakdown: [],
    excludedData: [],
    confidence: 0.5,
    computedAt: "2026-04-01T00:00:00Z",
    engineVersion: "cycle-engine-v1",
    ...overrides,
  };
}

function mkSummary(overrides: Partial<EngineSummary> = {}): EngineSummary {
  return {
    patientId: "lanae",
    totalCycles: 6,
    confirmedOvulatoryCycles: 4,
    likelyAnovulatoryCycles: 0,
    insufficientDataCycles: 0,
    averageCycleLength: 28.5,
    sdCycleLength: 2,
    averageLutealLength: 13.5,
    sdLutealLength: 1.5,
    shortLutealCycles: 0,
    predictions: [mkPrediction()],
    computedAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("deriveConfidenceLabel", () => {
  it("returns high for >= 0.8", () => {
    expect(deriveConfidenceLabel(0.8)).toBe("high");
    expect(deriveConfidenceLabel(0.95)).toBe("high");
  });

  it("returns medium for 0.7 to 0.8", () => {
    expect(deriveConfidenceLabel(0.7)).toBe("medium");
    expect(deriveConfidenceLabel(0.75)).toBe("medium");
  });

  it("returns low below 0.7", () => {
    expect(deriveConfidenceLabel(0.69)).toBe("low");
    expect(deriveConfidenceLabel(0.3)).toBe("low");
    expect(deriveConfidenceLabel(0)).toBe("low");
  });
});

describe("deriveReason", () => {
  it("returns null when confidence is high", () => {
    const reason = deriveReason({
      confidence: 0.85,
      confidenceLabel: "high",
      sdCycleLength: 2,
      totalCycles: 6,
      confirmedCycles: 5,
      signalsUsed: 3,
    });
    expect(reason).toBeNull();
  });

  it("prioritizes thin history when fewer than 3 confirmed cycles", () => {
    const reason = deriveReason({
      confidence: 0.5,
      confidenceLabel: "low",
      sdCycleLength: 6,
      totalCycles: 2,
      confirmedCycles: 1,
      signalsUsed: 1,
    });
    expect(reason).toMatch(/still learning/i);
  });

  it("uses plain-language copy for high variability", () => {
    const reason = deriveReason({
      confidence: 0.5,
      confidenceLabel: "low",
      sdCycleLength: 6,
      totalCycles: 8,
      confirmedCycles: 6,
      signalsUsed: 3,
    });
    expect(reason).toMatch(/varies/i);
    expect(reason).not.toMatch(/algorithmic/i);
  });

  it("explains when signal count is low", () => {
    const reason = deriveReason({
      confidence: 0.5,
      confidenceLabel: "low",
      sdCycleLength: 1.5,
      totalCycles: 6,
      confirmedCycles: 5,
      signalsUsed: 1,
    });
    expect(reason).toMatch(/one signal|BBT|wearable/i);
  });

  it("never uses em dashes in any copy path", () => {
    const cases = [
      { confidence: 0.5, confidenceLabel: "low" as const, sdCycleLength: 6, totalCycles: 8, confirmedCycles: 6, signalsUsed: 3 },
      { confidence: 0.5, confidenceLabel: "low" as const, sdCycleLength: 3.5, totalCycles: 8, confirmedCycles: 6, signalsUsed: 3 },
      { confidence: 0.6, confidenceLabel: "medium" as const, sdCycleLength: 1.5, totalCycles: 6, confirmedCycles: 5, signalsUsed: 1 },
      { confidence: 0.6, confidenceLabel: "medium" as const, sdCycleLength: 1.5, totalCycles: 6, confirmedCycles: 5, signalsUsed: 3 },
      { confidence: 0.5, confidenceLabel: "low" as const, sdCycleLength: 6, totalCycles: 2, confirmedCycles: 1, signalsUsed: 1 },
    ];
    for (const c of cases) {
      const reason = deriveReason(c);
      if (reason) {
        expect(reason).not.toContain("\u2014"); // em dash
        expect(reason).not.toContain("\u2013"); // en dash
      }
    }
  });
});

describe("buildUiPrediction", () => {
  const fixedNow = new Date("2026-04-01T12:00:00Z");

  it("returns null when no prediction has a periodPrediction", () => {
    const summary = mkSummary({
      predictions: [mkPrediction({ periodPrediction: null })],
    });
    expect(buildUiPrediction(summary, fixedNow)).toBeNull();
  });

  it("returns null when there are no predictions", () => {
    const summary = mkSummary({ predictions: [] });
    expect(buildUiPrediction(summary, fixedNow)).toBeNull();
  });

  it("prefers the open cycle over closed ones", () => {
    const closed = mkPrediction({
      cycleStart: "2026-02-01",
      cycleEnd: "2026-02-28",
      periodPrediction: {
        predictedStart: "2026-03-01",
        uncertaintyDays: 2,
        basis: "ovulation_plus_luteal",
      },
    });
    const open = mkPrediction({
      cycleStart: "2026-03-15",
      cycleEnd: null,
      periodPrediction: {
        predictedStart: "2026-04-12",
        uncertaintyDays: 2,
        basis: "ovulation_plus_luteal",
      },
    });
    const summary = mkSummary({ predictions: [closed, open] });
    const ui = buildUiPrediction(summary, fixedNow);
    expect(ui?.cycleStart).toBe("2026-03-15");
    expect(ui?.predictedStart).toBe("2026-04-12");
  });

  it("widens the range using uncertaintyDays", () => {
    const summary = mkSummary({
      predictions: [
        mkPrediction({
          confidence: 0.5,
          periodPrediction: {
            predictedStart: "2026-04-12",
            uncertaintyDays: 4,
            basis: "ovulation_plus_luteal",
          },
        }),
      ],
    });
    const ui = buildUiPrediction(summary, fixedNow);
    expect(ui?.rangeStart).toBe("2026-04-08");
    expect(ui?.rangeEnd).toBe("2026-04-16");
  });

  it("surfaces a reason when confidence is below 0.7", () => {
    const summary = mkSummary({
      sdCycleLength: 6,
      confirmedOvulatoryCycles: 5,
      predictions: [mkPrediction({ confidence: 0.5 })],
    });
    const ui = buildUiPrediction(summary, fixedNow);
    expect(ui?.reason).toBeTruthy();
    expect(ui?.reason).not.toContain("\u2014");
  });

  it("does not surface a reason when confidence is 0.8 or higher", () => {
    const summary = mkSummary({
      sdCycleLength: 1.5,
      confirmedOvulatoryCycles: 6,
      predictions: [mkPrediction({ confidence: 0.85 })],
    });
    const ui = buildUiPrediction(summary, fixedNow);
    expect(ui?.reason).toBeNull();
  });

  it("produces 7 future day chips all marked predicted", () => {
    const summary = mkSummary({
      predictions: [mkPrediction({ confidence: 0.85 })],
    });
    const ui = buildUiPrediction(summary, fixedNow);
    expect(ui?.futureDays.length).toBe(7);
    expect(ui?.futureDays.every((d) => d.variant === "predicted")).toBe(true);
  });

  it("marks past day chips as confirmed", () => {
    const summary = mkSummary({
      predictions: [mkPrediction({ confidence: 0.85, cycleStart: "2026-03-25" })],
    });
    const ui = buildUiPrediction(summary, fixedNow);
    expect(ui?.pastDays.length).toBeGreaterThan(0);
    expect(ui?.pastDays.every((d) => d.variant === "confirmed")).toBe(true);
  });

  it("clamps confidence into 0..1 range", () => {
    const summary = mkSummary({
      predictions: [mkPrediction({ confidence: 1.4 })],
    });
    const ui = buildUiPrediction(summary, fixedNow);
    expect(ui?.confidence).toBeLessThanOrEqual(1);
    expect(ui?.confidence).toBeGreaterThanOrEqual(0);
  });

  it("enforces minimum uncertainty of 1 day", () => {
    const summary = mkSummary({
      predictions: [
        mkPrediction({
          periodPrediction: {
            predictedStart: "2026-04-12",
            uncertaintyDays: 0,
            basis: "ovulation_plus_luteal",
          },
        }),
      ],
    });
    const ui = buildUiPrediction(summary, fixedNow);
    expect(ui?.uncertaintyDays).toBeGreaterThanOrEqual(1);
  });
});
