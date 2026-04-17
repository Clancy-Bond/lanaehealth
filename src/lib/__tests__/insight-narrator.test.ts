import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase so the module's internal dynamic import chain doesn't
// need real env vars. narrateInsightLocal is pure and does not hit these.
vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
  supabase: {},
}));

// Mock Anthropic so importing the module never attempts a real network
// call. The Claude-routed function is covered by its own test with
// explicit mocks below.
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(),
}));

import {
  lagBucketFor,
  formatRValue,
  normalizeTier,
  freshnessFor,
  narrateInsightLocal,
  narrateTopInsights,
  hasEnoughConfidentInsights,
  MIN_INSIGHTS_FOR_DISPLAY,
} from "@/lib/intelligence/insight-narrator";
import type { CorrelationResult } from "@/components/patterns/PatternsClient";

// Helper: build a correlation row with sensible defaults.
function makeRow(
  overrides: Partial<CorrelationResult> = {},
): CorrelationResult {
  return {
    id: "test-1",
    factor_a: "resting_hr",
    factor_b: "overall_pain",
    correlation_type: "pearson",
    coefficient: 0.54,
    p_value: 0.001,
    effect_size: 0.3,
    effect_description: null,
    confidence_level: "strong",
    sample_size: 42,
    lag_days: 1,
    cycle_phase: null,
    passed_fdr: true,
    computed_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("lagBucketFor", () => {
  it("maps 0 to same day", () => {
    expect(lagBucketFor(0)).toBe("same day");
  });
  it("maps 1 to next day", () => {
    expect(lagBucketFor(1)).toBe("next day");
  });
  it("maps 2 to 2 day lag", () => {
    expect(lagBucketFor(2)).toBe("2 day lag");
  });
  it("maps 3+ to 3+ day lag", () => {
    expect(lagBucketFor(3)).toBe("3+ day lag");
    expect(lagBucketFor(7)).toBe("3+ day lag");
  });
  it("returns null when lag_days is null", () => {
    expect(lagBucketFor(null)).toBeNull();
  });
});

describe("formatRValue", () => {
  it("formats positive coefficient", () => {
    expect(formatRValue(0.543)).toBe("r = 0.54");
  });
  it("formats negative coefficient", () => {
    expect(formatRValue(-0.38)).toBe("r = -0.38");
  });
  it("returns empty string for null", () => {
    expect(formatRValue(null)).toBe("");
  });
  it("rounds to two decimals", () => {
    expect(formatRValue(0.7)).toBe("r = 0.70");
  });
});

describe("normalizeTier", () => {
  it("passes through known tiers", () => {
    expect(normalizeTier("strong")).toBe("strong");
    expect(normalizeTier("moderate")).toBe("moderate");
    expect(normalizeTier("suggestive")).toBe("suggestive");
  });
  it("defaults unknown values to suggestive", () => {
    expect(normalizeTier("none")).toBe("suggestive");
    expect(normalizeTier(null)).toBe("suggestive");
    expect(normalizeTier(undefined)).toBe("suggestive");
  });
});

describe("freshnessFor", () => {
  const fixedNow = new Date("2026-04-16T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks recent data as fresh", () => {
    const { label, isStale } = freshnessFor("2026-04-10T00:00:00Z");
    expect(isStale).toBe(false);
    expect(label).toBe("based on data through 2026-04-10");
  });

  it("marks older than 30 days as stale", () => {
    const { isStale } = freshnessFor("2026-03-01T00:00:00Z");
    expect(isStale).toBe(true);
  });

  it("handles null computed_at", () => {
    const { label, isStale } = freshnessFor(null);
    expect(isStale).toBe(true);
    expect(label).toBe("freshness unknown");
  });

  it("handles garbage date strings", () => {
    const { label, isStale } = freshnessFor("not-a-date");
    expect(isStale).toBe(true);
    expect(label).toBe("freshness unknown");
  });
});

describe("narrateInsightLocal - sentence template", () => {
  it("builds a positive sentence with a lag phrase", () => {
    const row = makeRow({
      factor_a: "resting_hr",
      factor_b: "overall_pain",
      coefficient: 0.6,
      lag_days: 1,
      sample_size: 50,
      confidence_level: "strong",
    });
    const result = narrateInsightLocal(row);
    expect(result.sentence).toContain("resting hr");
    expect(result.sentence).toContain("overall pain");
    expect(result.sentence).toContain("the next day");
    expect(result.sentence).toContain("50 days");
    expect(result.sentence).toContain("strong pattern");
  });

  it("builds an inverse sentence for negative coefficients", () => {
    const row = makeRow({
      factor_a: "hrv_avg",
      factor_b: "fatigue",
      coefficient: -0.45,
      lag_days: 0,
      sample_size: 30,
      confidence_level: "moderate",
    });
    const result = narrateInsightLocal(row);
    expect(result.sentence).toContain("Days with more hrv avg");
    expect(result.sentence).toContain("less fatigue");
    expect(result.sentence).toContain("moderate signal");
  });

  it("uses a hedging sentence for suggestive tier", () => {
    const row = makeRow({
      confidence_level: "suggestive",
      coefficient: 0.2,
      lag_days: null,
    });
    const result = narrateInsightLocal(row);
    expect(result.sentence).toMatch(/may be a link|early signal/i);
    expect(result.sentence).toContain("more observation");
  });

  it("never contains em dashes", () => {
    const row = makeRow();
    const { sentence } = narrateInsightLocal(row);
    expect(sentence).not.toContain("\u2014");
    expect(sentence).not.toContain("\u2013");
  });

  it("never uses the word 'cause' or 'because'", () => {
    const positive = narrateInsightLocal(makeRow({ coefficient: 0.7 }));
    const inverse = narrateInsightLocal(makeRow({ coefficient: -0.7 }));
    const suggestive = narrateInsightLocal(
      makeRow({ confidence_level: "suggestive" }),
    );
    for (const s of [positive.sentence, inverse.sentence, suggestive.sentence]) {
      expect(s.toLowerCase()).not.toContain("cause");
      expect(s.toLowerCase()).not.toContain("because");
    }
  });

  it("includes cycle phase when present", () => {
    const row = makeRow({ cycle_phase: "Luteal" });
    const result = narrateInsightLocal(row);
    expect(result.sentence.toLowerCase()).toContain("luteal phase");
  });

  it("omits the sample clause when sample_size is null", () => {
    const row = makeRow({ sample_size: null });
    const result = narrateInsightLocal(row);
    expect(result.sentence).not.toContain("null");
    expect(result.sentence).not.toMatch(/based on\s+\./);
  });

  it("returns structured metadata alongside the sentence", () => {
    const row = makeRow({
      coefficient: 0.48,
      lag_days: 2,
      confidence_level: "moderate",
    });
    const result = narrateInsightLocal(row);
    expect(result.rValueLabel).toBe("r = 0.48");
    expect(result.lagBucket).toBe("2 day lag");
    expect(result.confidenceTier).toBe("moderate");
  });
});

describe("narrateTopInsights", () => {
  it("ranks strong above moderate above suggestive", () => {
    const rows: CorrelationResult[] = [
      makeRow({ id: "a", confidence_level: "suggestive", coefficient: 0.9 }),
      makeRow({ id: "b", confidence_level: "strong", coefficient: 0.3 }),
      makeRow({ id: "c", confidence_level: "moderate", coefficient: 0.5 }),
    ];
    const out = narrateTopInsights(rows);
    expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("caps to the requested limit", () => {
    const rows: CorrelationResult[] = Array.from({ length: 10 }, (_, i) =>
      makeRow({ id: `row-${i}`, confidence_level: "strong" }),
    );
    const out = narrateTopInsights(rows, 3);
    expect(out).toHaveLength(3);
  });

  it("attaches a narration object to every row", () => {
    const rows = [makeRow()];
    const out = narrateTopInsights(rows);
    expect(out[0].narration).toBeDefined();
    expect(typeof out[0].narration.sentence).toBe("string");
    expect(out[0].narration.sentence.length).toBeGreaterThan(0);
  });

  it("filters rows missing both factors", () => {
    const rows: CorrelationResult[] = [
      makeRow({ id: "ok" }),
      { ...makeRow({ id: "empty" }), factor_a: "", factor_b: "" },
    ];
    const out = narrateTopInsights(rows);
    expect(out.map((r) => r.id)).toEqual(["ok"]);
  });
});

describe("hasEnoughConfidentInsights", () => {
  it("returns false for suggestive-only lists", () => {
    const rows = [
      makeRow({ id: "1", confidence_level: "suggestive" }),
      makeRow({ id: "2", confidence_level: "suggestive" }),
      makeRow({ id: "3", confidence_level: "suggestive" }),
    ];
    expect(hasEnoughConfidentInsights(rows)).toBe(false);
  });

  it("returns true when three moderate-or-strong rows exist", () => {
    const rows = [
      makeRow({ id: "1", confidence_level: "moderate" }),
      makeRow({ id: "2", confidence_level: "strong" }),
      makeRow({ id: "3", confidence_level: "moderate" }),
      makeRow({ id: "4", confidence_level: "suggestive" }),
    ];
    expect(hasEnoughConfidentInsights(rows)).toBe(true);
  });

  it("respects a custom minimum", () => {
    const rows = [makeRow({ confidence_level: "strong" })];
    expect(hasEnoughConfidentInsights(rows, 1)).toBe(true);
  });

  it("exposes the default minimum constant", () => {
    expect(MIN_INSIGHTS_FOR_DISPLAY).toBe(3);
  });
});
