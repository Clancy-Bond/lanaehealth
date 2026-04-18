/**
 * Tests for Year-in-Pixels data shaping.
 *
 * Focus areas:
 *   - buildPixelDays emits exactly windowDays rows in chronological order
 *   - Empty cells remain null (non-shaming rule)
 *   - colorForDay returns EMPTY_FILL for missing data, --pain-* for pain,
 *     and color-mix accent-ramp for everything else
 *   - borderForPhase maps every CyclePhase and null safely
 *   - groupByMonthWeek shapes columns with Monday-start padding
 *   - No em dashes anywhere in the output
 */
import { describe, it, expect } from "vitest";
import {
  buildPixelDays,
  colorForDay,
  painColor,
  accentRamp,
  borderForPhase,
  groupByMonthWeek,
  ariaLabelForDay,
  isoDate,
  addDaysIso,
  mondayStartDow,
  monthLabel,
  EMPTY_FILL,
  type PixelDay,
} from "../../patterns/pixel-data";

function mkDay(overrides: Partial<PixelDay> = {}): PixelDay {
  return {
    date: "2026-04-10",
    mood: null,
    pain: null,
    fatigue: null,
    sleep: null,
    flow: null,
    hrv: null,
    cyclePhase: null,
    ...overrides,
  };
}

describe("buildPixelDays", () => {
  it("emits exactly 365 rows by default, oldest first", () => {
    const today = new Date(Date.UTC(2026, 3, 17)); // April 17, 2026
    const days = buildPixelDays({
      dailyLogs: [],
      ouraDaily: [],
      cycleEntries: [],
      ncImported: [],
      today,
    });
    expect(days.length).toBe(365);
    expect(days[0].date < days[days.length - 1].date).toBe(true);
    expect(days[days.length - 1].date).toBe("2026-04-17");
  });

  it("respects a custom window size", () => {
    const today = new Date(Date.UTC(2026, 3, 17));
    const days = buildPixelDays({
      dailyLogs: [],
      ouraDaily: [],
      cycleEntries: [],
      ncImported: [],
      today,
      windowDays: 30,
    });
    expect(days.length).toBe(30);
  });

  it("flattens daily_logs, oura_daily, cycle_entries, and mood by date", () => {
    const today = new Date(Date.UTC(2026, 3, 17));
    const days = buildPixelDays({
      dailyLogs: [
        { date: "2026-04-15", overall_pain: 4, fatigue: 6, cycle_phase: "luteal" },
      ],
      ouraDaily: [
        { date: "2026-04-15", sleep_score: 78, hrv_avg: 42 },
      ],
      cycleEntries: [
        { date: "2026-04-15", flow_level: "light", menstruation: false },
      ],
      ncImported: [],
      moodByDate: { "2026-04-15": 3 },
      today,
    });
    const row = days.find((d) => d.date === "2026-04-15");
    expect(row).toBeDefined();
    expect(row!.pain).toBe(4);
    expect(row!.fatigue).toBe(6);
    expect(row!.sleep).toBe(78);
    expect(row!.hrv).toBe(42);
    expect(row!.flow).toBe(2); // "light" ranks as 2
    expect(row!.mood).toBe(3);
    expect(row!.cyclePhase).toBe("luteal");
  });

  it("leaves metric fields null when no source row matches (non-shaming rule)", () => {
    const today = new Date(Date.UTC(2026, 3, 17));
    const days = buildPixelDays({
      dailyLogs: [],
      ouraDaily: [],
      cycleEntries: [],
      ncImported: [],
      today,
    });
    const first = days[0];
    expect(first.mood).toBeNull();
    expect(first.pain).toBeNull();
    expect(first.sleep).toBeNull();
    expect(first.cyclePhase).toBeNull();
  });

  it("treats nc_imported menstruation as a light-flow proxy when cycle_entries lacks the row", () => {
    const today = new Date(Date.UTC(2026, 3, 17));
    const days = buildPixelDays({
      dailyLogs: [],
      ouraDaily: [],
      cycleEntries: [],
      ncImported: [
        { date: "2026-04-10", menstruation: "yes", cycle_day: 1 },
      ],
      today,
    });
    const row = days.find((d) => d.date === "2026-04-10");
    expect(row!.flow).toBe(2);
  });
});

describe("colorForDay", () => {
  it("returns EMPTY_FILL when the selected metric is null", () => {
    expect(colorForDay(mkDay({ mood: null }), "mood")).toBe(EMPTY_FILL);
    expect(colorForDay(mkDay({ pain: null }), "pain")).toBe(EMPTY_FILL);
    expect(colorForDay(mkDay({ hrv: null }), "hrv")).toBe(EMPTY_FILL);
  });

  it("uses the --pain-* ramp when metric is pain", () => {
    expect(colorForDay(mkDay({ pain: 0 }), "pain")).toBe("var(--pain-none)");
    expect(colorForDay(mkDay({ pain: 2 }), "pain")).toBe("var(--pain-low)");
    expect(colorForDay(mkDay({ pain: 5 }), "pain")).toBe("var(--pain-moderate)");
    expect(colorForDay(mkDay({ pain: 10 }), "pain")).toBe("var(--pain-extreme)");
  });

  it("uses the accent ramp for non-pain metrics", () => {
    const moodHigh = colorForDay(mkDay({ mood: 5 }), "mood");
    expect(moodHigh).toContain("var(--accent-sage)");
    expect(moodHigh).toContain("var(--accent-blush)");

    const fatigueHigh = colorForDay(mkDay({ fatigue: 10 }), "fatigue");
    expect(fatigueHigh).toContain("color-mix");
  });

  it("does not emit em dashes anywhere", () => {
    const colors = [
      colorForDay(mkDay({ pain: 7 }), "pain"),
      colorForDay(mkDay({ mood: 2 }), "mood"),
      colorForDay(mkDay({ sleep: 50 }), "sleep"),
    ];
    for (const c of colors) {
      expect(c).not.toMatch(/\u2014/);
    }
  });
});

describe("painColor", () => {
  it("buckets 0 to none, 10 to extreme", () => {
    expect(painColor(0)).toBe("var(--pain-none)");
    expect(painColor(10)).toBe("var(--pain-extreme)");
  });

  it("covers each boundary", () => {
    expect(painColor(1)).toBe("var(--pain-low)");
    expect(painColor(3)).toBe("var(--pain-mild)");
    expect(painColor(6)).toBe("var(--pain-moderate)");
    expect(painColor(8)).toBe("var(--pain-severe)");
    expect(painColor(9)).toBe("var(--pain-extreme)");
  });
});

describe("accentRamp", () => {
  it("maps t=0 to fully blush when higherIsBetter is true", () => {
    const c = accentRamp(0, { higherIsBetter: true });
    expect(c).toContain("var(--accent-sage) 0%");
  });

  it("maps t=1 to fully sage when higherIsBetter is true", () => {
    const c = accentRamp(1, { higherIsBetter: true });
    expect(c).toContain("var(--accent-sage) 100%");
  });

  it("inverts the direction when higherIsBetter is false", () => {
    const c = accentRamp(1, { higherIsBetter: false });
    expect(c).toContain("var(--accent-sage) 0%");
  });

  it("clamps values outside 0..1", () => {
    const lo = accentRamp(-5, { higherIsBetter: true });
    const hi = accentRamp(5, { higherIsBetter: true });
    expect(lo).toContain("var(--accent-sage) 0%");
    expect(hi).toContain("var(--accent-sage) 100%");
  });
});

describe("borderForPhase", () => {
  it("maps each phase to its token", () => {
    expect(borderForPhase("menstrual")).toBe("var(--phase-menstrual)");
    expect(borderForPhase("follicular")).toBe("var(--phase-follicular)");
    expect(borderForPhase("ovulatory")).toBe("var(--phase-ovulatory)");
    expect(borderForPhase("luteal")).toBe("var(--phase-luteal)");
  });

  it("returns null for null phase", () => {
    expect(borderForPhase(null)).toBeNull();
  });
});

describe("groupByMonthWeek", () => {
  it("buckets days into month columns", () => {
    const today = new Date(Date.UTC(2026, 3, 17));
    const days = buildPixelDays({
      dailyLogs: [],
      ouraDaily: [],
      cycleEntries: [],
      ncImported: [],
      today,
      windowDays: 90,
    });
    const cols = groupByMonthWeek(days);
    expect(cols.length).toBeGreaterThanOrEqual(3);
    const last = cols[cols.length - 1];
    const cellsFlat = last.weeks.flat().filter((d): d is PixelDay => d !== null);
    expect(cellsFlat[cellsFlat.length - 1].date).toBe("2026-04-17");
  });

  it("pads leading days with null so each week has 7 cells", () => {
    const today = new Date(Date.UTC(2026, 3, 17));
    const days = buildPixelDays({
      dailyLogs: [],
      ouraDaily: [],
      cycleEntries: [],
      ncImported: [],
      today,
      windowDays: 60,
    });
    const cols = groupByMonthWeek(days);
    for (const col of cols) {
      for (const week of col.weeks) {
        expect(week.length).toBe(7);
      }
    }
  });
});

describe("ariaLabelForDay", () => {
  it("announces not-logged when the metric is null", () => {
    const label = ariaLabelForDay(mkDay({ mood: null }), "mood");
    expect(label).toMatch(/not logged/);
  });

  it("includes the date, value, and phase when present", () => {
    const label = ariaLabelForDay(
      mkDay({ date: "2026-04-10", pain: 5, cyclePhase: "luteal" }),
      "pain",
    );
    expect(label).toMatch(/April 10, 2026/);
    expect(label).toMatch(/pain 5 of 10/);
    expect(label).toMatch(/luteal phase/);
  });

  it("never contains em dashes", () => {
    const label = ariaLabelForDay(mkDay({ pain: 5, cyclePhase: "menstrual" }), "pain");
    expect(label).not.toMatch(/\u2014/);
  });
});

describe("date helpers", () => {
  it("isoDate formats UTC Dates", () => {
    expect(isoDate(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01-01");
  });

  it("addDaysIso handles month/year rollover", () => {
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("mondayStartDow gives 0 for Monday, 6 for Sunday", () => {
    // 2026-04-13 is a Monday.
    expect(mondayStartDow("2026-04-13")).toBe(0);
    // 2026-04-19 is a Sunday.
    expect(mondayStartDow("2026-04-19")).toBe(6);
  });

  it("monthLabel returns the short name", () => {
    expect(monthLabel("2026-04-10")).toBe("Apr");
    expect(monthLabel("2026-12-10")).toBe("Dec");
  });
});
