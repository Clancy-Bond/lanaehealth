/**
 * Tests for src/lib/symptoms/queries.ts.
 *
 * The module takes a SupabaseClient so tests swap in a stubbed client
 * that records the chained calls and returns canned rows. No network
 * traffic, no env vars.
 *
 * Coverage targets:
 *   - loadTodaySymptoms: happy path + day with no daily_log row
 *   - loadPainSparkline: fills null days so the chart always has N points
 *   - loadSymptomHistory: per-day rollup with severity escalation
 *   - loadSymptomIndex: dedupes by symptom label across categories
 */

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadTodaySymptoms,
  loadPainSparkline,
  loadSymptomHistory,
  loadSymptomIndex,
} from "../queries";
import { format, subDays } from "date-fns";

type FakeRow = Record<string, unknown>;
type TableResolver = () => FakeRow[];

interface StubOpts {
  /** Per-table resolver. Default returns []. */
  tables?: Record<string, TableResolver>;
  /** maybeSingle resolver. Default returns null. */
  maybeSingle?: () => FakeRow | null;
}

function stubClient(opts: StubOpts = {}): SupabaseClient {
  const buildChain = (table: string) => {
    const tableRows = () => opts.tables?.[table]?.() ?? [];
    // A builder that is both chainable and thenable. Every method returns
    // the same object, and `await`-ing it resolves to {data, error:null}.
    type Chain = Record<string, unknown>;
    const chain: Chain = {};
    const passthrough = () => chain;
    const resolveData = (resolve: (v: { data: FakeRow[]; error: null }) => void) =>
      resolve({ data: tableRows(), error: null });
    chain.select = passthrough;
    chain.eq = passthrough;
    chain.ilike = passthrough;
    chain.gte = passthrough;
    chain.lte = passthrough;
    chain.in = passthrough;
    chain.limit = passthrough;
    chain.order = passthrough;
    chain.maybeSingle = () =>
      Promise.resolve({
        data: opts.maybeSingle?.() ?? null,
        error: null,
      });
    chain.then = resolveData;
    return chain;
  };
  return {
    from: (table: string) => buildChain(table),
  } as unknown as SupabaseClient;
}

describe("loadTodaySymptoms", () => {
  it("returns [] when no daily_log row exists for the date", async () => {
    const sb = stubClient();
    const res = await loadTodaySymptoms(sb, "2026-04-19");
    expect(res).toEqual([]);
  });

  it("loads symptoms scoped to the log id", async () => {
    const sb = stubClient({
      maybeSingle: () => ({ id: "log-1" }),
      tables: {
        symptoms: () => [
          {
            id: "s1",
            log_id: "log-1",
            category: "physical",
            symptom: "Headache",
            severity: "moderate",
            logged_at: "2026-04-19T10:00:00Z",
          },
        ],
      },
    });
    const res = await loadTodaySymptoms(sb, "2026-04-19");
    expect(res).toHaveLength(1);
    expect(res[0].symptom).toBe("Headache");
  });
});

describe("loadPainSparkline", () => {
  it("returns N days even when the DB has fewer rows", async () => {
    const sb = stubClient({
      tables: {
        daily_logs: () => [
          {
            date: format(subDays(new Date(), 3), "yyyy-MM-dd"),
            overall_pain: 6,
            fatigue: 4,
          },
        ],
      },
    });
    const res = await loadPainSparkline(sb, 7);
    expect(res).toHaveLength(7);
    const withPain = res.filter((p) => p.overallPain !== null);
    expect(withPain).toHaveLength(1);
    expect(withPain[0].overallPain).toBe(6);
  });

  it("fills all N days with nulls when there is no data at all", async () => {
    const sb = stubClient();
    const res = await loadPainSparkline(sb, 5);
    expect(res).toHaveLength(5);
    expect(res.every((p) => p.overallPain === null)).toBe(true);
    expect(res.every((p) => p.fatigue === null)).toBe(true);
  });
});

describe("loadSymptomHistory", () => {
  it("rolls multiple entries on the same day into one row, with count", async () => {
    const day = "2026-04-19";
    const sb = stubClient({
      tables: {
        symptoms: () => [
          {
            id: "s1",
            log_id: "log-a",
            category: "physical",
            symptom: "Headache",
            severity: "mild",
            logged_at: `${day}T08:00:00Z`,
          },
          {
            id: "s2",
            log_id: "log-a",
            category: "physical",
            symptom: "Headache",
            severity: "severe",
            logged_at: `${day}T15:00:00Z`,
          },
        ],
      },
    });
    const res = await loadSymptomHistory(sb, "Headache", 60);
    expect(res).toHaveLength(1);
    expect(res[0].count).toBe(2);
    // severity escalates to "severe" (worst of the day)
    expect(res[0].severity).toBe("severe");
  });

  it("returns an empty array when no rows match the label", async () => {
    const sb = stubClient();
    const res = await loadSymptomHistory(sb, "Nonexistent", 60);
    expect(res).toEqual([]);
  });
});

describe("loadSymptomIndex", () => {
  it("dedupes by case-insensitive label, keeps the latest logged_at", async () => {
    const newer = "2026-04-19T10:00:00Z";
    const older = "2026-04-01T10:00:00Z";
    const sb = stubClient({
      tables: {
        symptoms: () => [
          {
            id: "s1",
            log_id: "l1",
            category: "physical",
            symptom: "Headache",
            severity: "moderate",
            logged_at: newer,
          },
          {
            id: "s2",
            log_id: "l2",
            category: "physical",
            symptom: "headache",
            severity: "mild",
            logged_at: older,
          },
        ],
      },
    });
    const res = await loadSymptomIndex(sb);
    expect(res).toHaveLength(1);
    expect(res[0].totalEntries).toBe(2);
    expect(res[0].lastLoggedAt).toBe(newer);
  });

  it("sorts by most-recent entry first", async () => {
    const sb = stubClient({
      tables: {
        symptoms: () => [
          {
            id: "s1",
            log_id: "l1",
            category: "physical",
            symptom: "Nausea",
            severity: "mild",
            logged_at: "2026-04-01T10:00:00Z",
          },
          {
            id: "s2",
            log_id: "l2",
            category: "physical",
            symptom: "Headache",
            severity: "moderate",
            logged_at: "2026-04-19T10:00:00Z",
          },
        ],
      },
    });
    const res = await loadSymptomIndex(sb);
    expect(res).toHaveLength(2);
    expect(res[0].symptom).toBe("Headache");
    expect(res[1].symptom).toBe("Nausea");
  });
});
