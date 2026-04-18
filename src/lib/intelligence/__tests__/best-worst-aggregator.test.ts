/**
 * Tests for the Best vs Worst aggregator.
 *
 * Focus:
 *   - Bucket assignment from mood_score
 *   - Threshold gating (minimum 10 days per bucket)
 *   - Correct frequency math and TOP_N ranking with deterministic ties
 *   - Non-shaming voice: forbidden language check on all copy
 *   - entryCounts behavior across toggled/value combinations
 */

import { describe, it, expect } from "vitest";
import {
  aggregateBestWorst,
  bucketForScore,
  bucketLogIds,
  countByTrackable,
  entryCounts,
  formatFrequency,
  rankTop,
  COPY,
  MIN_DAYS_PER_BUCKET,
  TOP_N,
  type MoodRow,
  type TrackableEntryRow,
} from "../best-worst-aggregator";
import type { MoodScore, TrackableCategory } from "@/lib/types";

// ── Fixture helpers ────────────────────────────────────────────────────

function mood(logId: string, score: MoodScore): MoodRow {
  return { log_id: logId, mood_score: score };
}

function entry(
  logId: string,
  trackableId: string,
  name: string,
  overrides: Partial<TrackableEntryRow> & {
    category?: TrackableCategory;
    icon?: string | null;
  } = {},
): TrackableEntryRow {
  const { category, icon, ...rest } = overrides;
  return {
    log_id: logId,
    trackable_id: trackableId,
    toggled: true,
    value: null,
    trackable: {
      id: trackableId,
      name,
      category: category ?? "activity",
      icon: icon ?? name.slice(0, 2).toLowerCase(),
    },
    ...rest,
  };
}

/** Build N fake log_ids, all attached to the same mood_score. */
function moodDays(score: MoodScore, n: number, prefix: string): MoodRow[] {
  return Array.from({ length: n }, (_, i) => mood(`${prefix}-${i}`, score));
}

// ── bucketForScore ─────────────────────────────────────────────────────

describe("bucketForScore", () => {
  it("assigns 4 and 5 to best", () => {
    expect(bucketForScore(4)).toBe("best");
    expect(bucketForScore(5)).toBe("best");
  });

  it("assigns 1 and 2 to worst", () => {
    expect(bucketForScore(1)).toBe("worst");
    expect(bucketForScore(2)).toBe("worst");
  });

  it("excludes neutral 3 from both buckets", () => {
    expect(bucketForScore(3)).toBeNull();
  });
});

// ── bucketLogIds ───────────────────────────────────────────────────────

describe("bucketLogIds", () => {
  it("distributes log_ids to best/worst sets ignoring neutrals", () => {
    const moods = [
      mood("a", 5),
      mood("b", 4),
      mood("c", 3),
      mood("d", 2),
      mood("e", 1),
    ];
    const { best, worst } = bucketLogIds(moods);
    expect([...best].sort()).toEqual(["a", "b"]);
    expect([...worst].sort()).toEqual(["d", "e"]);
  });

  it("applies latest-write-wins when the same log_id appears twice", () => {
    const moods = [mood("x", 5), mood("x", 1)];
    const { best, worst } = bucketLogIds(moods);
    expect(best.has("x")).toBe(false);
    expect(worst.has("x")).toBe(true);
  });
});

// ── entryCounts ────────────────────────────────────────────────────────

describe("entryCounts", () => {
  it("treats toggled=true as present", () => {
    expect(entryCounts(entry("l1", "t1", "Coffee", { toggled: true }))).toBe(true);
  });

  it("treats toggled=false as absent even with value>0", () => {
    expect(
      entryCounts(entry("l1", "t1", "Coffee", { toggled: false, value: 3 })),
    ).toBe(false);
  });

  it("treats numeric value > 0 with null toggle as present", () => {
    expect(
      entryCounts(entry("l1", "t1", "Coffee", { toggled: null, value: 2 })),
    ).toBe(true);
  });

  it("treats fully empty rows as absent", () => {
    expect(
      entryCounts(entry("l1", "t1", "Coffee", { toggled: null, value: null })),
    ).toBe(false);
  });

  it("treats value=0 with null toggle as absent", () => {
    expect(
      entryCounts(entry("l1", "t1", "Coffee", { toggled: null, value: 0 })),
    ).toBe(false);
  });
});

// ── countByTrackable ───────────────────────────────────────────────────

describe("countByTrackable", () => {
  it("counts distinct log_ids per trackable and filters by bucket", () => {
    const bucket = new Set(["a", "b", "c"]);
    const entries = [
      entry("a", "t1", "Coffee"),
      entry("b", "t1", "Coffee"),
      entry("c", "t2", "Salt"),
      entry("zz", "t1", "Coffee"), // outside bucket, ignored
    ];
    const counts = countByTrackable(bucket, entries);
    expect(counts.get("t1")?.count).toBe(2);
    expect(counts.get("t2")?.count).toBe(1);
  });

  it("de-duplicates when the same trackable toggles twice on the same day", () => {
    const bucket = new Set(["a"]);
    const entries = [
      entry("a", "t1", "Coffee", { toggled: true }),
      entry("a", "t1", "Coffee", { toggled: true }),
    ];
    const counts = countByTrackable(bucket, entries);
    expect(counts.get("t1")?.count).toBe(1);
  });

  it("ignores entries whose toggled is explicitly false", () => {
    const bucket = new Set(["a"]);
    const entries = [entry("a", "t1", "Coffee", { toggled: false })];
    const counts = countByTrackable(bucket, entries);
    expect(counts.has("t1")).toBe(false);
  });
});

// ── rankTop ────────────────────────────────────────────────────────────

describe("rankTop", () => {
  it("returns empty list for zero-size bucket", () => {
    const counts = new Map([
      ["t1", { count: 3, sample: entry("a", "t1", "X") }],
    ]);
    expect(rankTop(counts, 0)).toEqual([]);
  });

  it("sorts by count desc then alphabetical by name", () => {
    const counts = new Map([
      ["t1", { count: 5, sample: entry("a", "t1", "Zeta") }],
      ["t2", { count: 5, sample: entry("a", "t2", "Alpha") }],
      ["t3", { count: 7, sample: entry("a", "t3", "Mike") }],
    ]);
    const top = rankTop(counts, 10);
    expect(top.map((t) => t.name)).toEqual(["Mike", "Alpha", "Zeta"]);
  });

  it("caps at topN", () => {
    const counts = new Map(
      Array.from({ length: 8 }, (_, i) => [
        `t${i}`,
        { count: 8 - i, sample: entry("a", `t${i}`, `Name${i}`) },
      ]),
    );
    const top = rankTop(counts, 10, 5);
    expect(top.length).toBe(5);
    expect(top[0].count).toBe(8);
    expect(top[4].count).toBe(4);
  });

  it("computes frequency as count / bucketSize", () => {
    const counts = new Map([
      ["t1", { count: 8, sample: entry("a", "t1", "A") }],
    ]);
    const top = rankTop(counts, 10);
    expect(top[0].frequency).toBeCloseTo(0.8, 6);
  });
});

// ── formatFrequency ────────────────────────────────────────────────────

describe("formatFrequency", () => {
  it("renders integer percentages", () => {
    expect(formatFrequency(0.82)).toBe("82%");
    expect(formatFrequency(0)).toBe("0%");
    expect(formatFrequency(1)).toBe("100%");
  });

  it("clamps values outside [0,1]", () => {
    expect(formatFrequency(1.5)).toBe("100%");
    expect(formatFrequency(-0.2)).toBe("0%");
  });

  it("rounds half-up", () => {
    expect(formatFrequency(0.715)).toBe("72%");
  });
});

// ── aggregateBestWorst: threshold gating ───────────────────────────────

describe("aggregateBestWorst threshold gating", () => {
  it("returns anyBucketReady=false when both buckets are under 10 days", () => {
    const result = aggregateBestWorst({
      moods: [...moodDays(5, 3, "best"), ...moodDays(1, 4, "worst")],
      entries: [],
    });
    expect(result.anyBucketReady).toBe(false);
    expect(result.best.hasEnoughData).toBe(false);
    expect(result.worst.hasEnoughData).toBe(false);
    expect(result.best.items).toEqual([]);
    expect(result.worst.items).toEqual([]);
  });

  it("emits items only for the side that met threshold", () => {
    const bestMoods = moodDays(5, MIN_DAYS_PER_BUCKET, "b");
    const worstMoods = moodDays(1, MIN_DAYS_PER_BUCKET - 1, "w");
    const entries: TrackableEntryRow[] = [
      ...bestMoods.map((m) => entry(m.log_id, "t1", "Salt water")),
      ...worstMoods.map((m) => entry(m.log_id, "t2", "Long standing")),
    ];
    const result = aggregateBestWorst({
      moods: [...bestMoods, ...worstMoods],
      entries,
    });
    expect(result.best.hasEnoughData).toBe(true);
    expect(result.best.items.length).toBe(1);
    expect(result.worst.hasEnoughData).toBe(false);
    expect(result.worst.items.length).toBe(0);
    expect(result.anyBucketReady).toBe(true);
  });

  it("respects a custom minDaysPerBucket override", () => {
    const moods = moodDays(5, 3, "b");
    const entries = moods.map((m) => entry(m.log_id, "t1", "Coffee"));
    const result = aggregateBestWorst({
      moods,
      entries,
      minDaysPerBucket: 3,
    });
    expect(result.best.hasEnoughData).toBe(true);
    expect(result.best.items[0].count).toBe(3);
  });
});

// ── aggregateBestWorst: ranking with realistic data ────────────────────

describe("aggregateBestWorst ranking", () => {
  it("produces a realistic top-5 with correct frequencies", () => {
    // 12 best days, 11 rough days. Expected:
    //   Best: Salt 10/12 (83%), Sleep 8/12 (67%), Coffee 5/12
    //   Rough: Long standing 9/11 (82%), Skipped meal 7/11 (64%)
    const bestMoods = moodDays(5, 12, "b");
    const worstMoods = moodDays(1, 11, "w");

    const entries: TrackableEntryRow[] = [
      ...bestMoods.slice(0, 10).map((m) => entry(m.log_id, "t1", "Salt water")),
      ...bestMoods.slice(0, 8).map((m) => entry(m.log_id, "t2", "Good sleep")),
      ...bestMoods.slice(0, 5).map((m) => entry(m.log_id, "t3", "Coffee")),
      ...worstMoods.slice(0, 9).map((m) => entry(m.log_id, "t4", "Long standing")),
      ...worstMoods.slice(0, 7).map((m) => entry(m.log_id, "t5", "Skipped meal")),
    ];

    const result = aggregateBestWorst({
      moods: [...bestMoods, ...worstMoods],
      entries,
    });

    expect(result.best.bucketSize).toBe(12);
    expect(result.worst.bucketSize).toBe(11);
    expect(result.best.items[0].name).toBe("Salt water");
    expect(result.best.items[0].count).toBe(10);
    expect(result.best.items[0].frequency).toBeCloseTo(10 / 12, 6);
    expect(result.worst.items[0].name).toBe("Long standing");
    expect(result.worst.items[0].count).toBe(9);
    expect(result.worst.items[0].frequency).toBeCloseTo(9 / 11, 6);
  });

  it("caps each column at TOP_N", () => {
    const bestMoods = moodDays(5, 10, "b");
    const entries: TrackableEntryRow[] = [];
    for (let i = 0; i < 8; i++) {
      const count = 8 - i; // 8, 7, 6, 5, 4, 3, 2, 1
      for (let j = 0; j < count; j++) {
        entries.push(entry(bestMoods[j].log_id, `t${i}`, `Item${i}`));
      }
    }
    const result = aggregateBestWorst({ moods: bestMoods, entries });
    expect(result.best.items.length).toBe(TOP_N);
  });
});

// ── aggregateBestWorst: copy and voice ─────────────────────────────────

describe("aggregateBestWorst voice", () => {
  it("uses the non-shaming column labels", () => {
    const result = aggregateBestWorst({ moods: [], entries: [] });
    expect(result.best.label).toBe("Best days");
    expect(result.worst.label).toBe("Rough days");
    // Never "bad" or "good"
    expect(result.best.label.toLowerCase()).not.toContain("good");
    expect(result.worst.label.toLowerCase()).not.toContain("bad");
  });

  it("centralizes footnote and hold copy", () => {
    const result = aggregateBestWorst({ moods: [], entries: [] });
    expect(result.footnote).toBe(COPY.footnote);
  });

  it("footer and hold copy avoid adherence and shame framing", () => {
    const forbidden = [
      "should",
      "must",
      "fail",
      "failed",
      "bad",
      "adherence",
      "compliant",
      "compliance",
      "discipline",
      "lazy",
    ];
    // Column headers and hold copy must never use these words. Footnote is
    // deliberately excluded because it uses "not causes" to REJECT causal
    // framing, which is the point of the non-shaming voice rule.
    const bodies = [COPY.holdTitle, COPY.holdBody, COPY.bestLabel, COPY.worstLabel];
    for (const body of bodies) {
      for (const word of forbidden) {
        // whole-word match so "pattern" does not trip "pat"
        const regex = new RegExp(`\\b${word}\\b`, "i");
        expect(body.match(regex), `"${body}" contained forbidden "${word}"`).toBeNull();
      }
    }
  });

  it("footnote explicitly disclaims causation", () => {
    // The voice rule wants us to REJECT causal framing. Checking the
    // footnote contains a negation of causal language guards against
    // future edits that weaken the disclaimer.
    expect(COPY.footnote.toLowerCase()).toMatch(/not\s+causes?/);
  });

  it("never emits em dashes anywhere in copy", () => {
    const result = aggregateBestWorst({ moods: [], entries: [] });
    const body = JSON.stringify(result);
    expect(body.includes("\u2014")).toBe(false);
    expect(COPY.footnote.includes("\u2014")).toBe(false);
    expect(COPY.holdBody.includes("\u2014")).toBe(false);
  });
});
