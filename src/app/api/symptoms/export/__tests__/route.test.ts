/**
 * Tests for /api/symptoms/export.
 *
 * The core invariant here is the one Bearable reviewers complain about:
 * a symptom export MUST include rows for days with no symptoms. These
 * tests fake a handful of daily_logs + symptom rows, then assert that
 * every date in the requested window appears in the CSV output, whether
 * or not it contained a symptom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { format, subDays } from "date-fns";

const today = format(new Date(), "yyyy-MM-dd");
const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
const twoDaysAgo = format(subDays(new Date(), 2), "yyyy-MM-dd");

const fixture = {
  daily_logs: [
    { id: "log-today", date: today, overall_pain: 5, fatigue: 3 },
    { id: "log-yesterday", date: yesterday, overall_pain: 2, fatigue: null },
    // Two days ago: intentionally missing a daily_log row to simulate a
    // day with no logs at all. The endpoint should still emit a CSV row.
  ],
  symptoms: [
    {
      log_id: "log-today",
      symptom: "Headache",
      severity: "moderate",
      category: "physical",
      logged_at: `${today}T10:15:00.000Z`,
    },
    {
      log_id: "log-today",
      symptom: "Fatigue",
      severity: "severe",
      category: "physical",
      logged_at: `${today}T14:30:00.000Z`,
    },
  ],
};

vi.mock("@/lib/supabase", () => {
  const buildQuery = (table: string) => {
    const rows =
      table === "daily_logs"
        ? fixture.daily_logs
        : table === "symptoms"
          ? fixture.symptoms
          : [];
    const run = () => Promise.resolve({ data: rows, error: null });
    const chain = {
      select: () => chain,
      gte: () => chain,
      lte: () => chain,
      in: () => chain,
      order: () => run(),
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        run().then(resolve),
    };
    return chain;
  };
  return {
    createServiceClient: () => ({
      from: (table: string) => buildQuery(table),
    }),
  };
});

describe("/api/symptoms/export", () => {
  beforeEach(() => {
    process.env.EXPORT_ADMIN_TOKEN = "secret";
  });
  afterEach(() => {
    delete process.env.EXPORT_ADMIN_TOKEN;
  });

  it("rejects unauthenticated calls with 401", async () => {
    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/symptoms/export");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("rejects calls with a wrong token", async () => {
    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/symptoms/export?token=wrong",
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("emits one CSV row per day in the window, including days with no symptoms", async () => {
    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/symptoms/export?days=3&token=secret",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("x-lanaehealth-export")).toBe(
      "symptoms-including-none-rows",
    );
    const text = await res.text();
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toContain("date");
    expect(lines[0]).toContain("symptom_count");
    expect(lines[0]).toContain("symptoms");
    // header + 3 day rows
    expect(lines).toHaveLength(4);
    const bodyRows = lines.slice(1).join("\n");
    expect(bodyRows).toContain(today);
    expect(bodyRows).toContain(yesterday);
    expect(bodyRows).toContain(twoDaysAgo);
  });

  it("shows zero symptom_count and empty symptoms for days with no logs", async () => {
    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/symptoms/export?days=3&token=secret",
    );
    const res = await GET(req);
    const text = await res.text();
    const lines = text.trim().split("\r\n");
    const twoDaysRow = lines.find((line) => line.startsWith(twoDaysAgo));
    expect(twoDaysRow).toBeTruthy();
    // After the date: overall_pain, fatigue (both empty), then symptom_count=0
    const parts = twoDaysRow!.split(",");
    expect(parts[0]).toBe(twoDaysAgo);
    expect(parts[1]).toBe("");
    expect(parts[2]).toBe("");
    expect(parts[3]).toBe("0");
  });

  it("records symptom labels separated by a pipe and includes severities", async () => {
    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/symptoms/export?days=3&token=secret",
    );
    const res = await GET(req);
    const text = await res.text();
    const lines = text.trim().split("\r\n");
    const todayRow = lines.find((line) => line.startsWith(today));
    expect(todayRow).toBeTruthy();
    expect(todayRow).toContain("Headache|Fatigue");
    expect(todayRow).toContain("Headache=moderate|Fatigue=severe");
  });

  it("clamps the days parameter to the allowed range", async () => {
    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/symptoms/export?days=9999&token=secret",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text.trim().split("\r\n");
    // header + 365 rows max
    expect(lines.length).toBeLessThanOrEqual(366);
  });
});
