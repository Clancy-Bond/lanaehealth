/**
 * GET /api/symptoms/export
 *
 * Symptom-centric daily CSV. One row per calendar date in the window,
 * with a comma-delimited "symptoms" column. Crucially, dates with no
 * logged symptoms still appear as a row with an empty symptoms list.
 *
 * This is the Bearable-fail fix: Bearable's official export silently
 * drops "none" rows, so users can never prove a symptom-free day. Our
 * export does the opposite.
 *
 * Query params:
 *   ?days=28  (default 28, min 1, max 365)
 *
 * Auth: gated by EXPORT_ADMIN_TOKEN (same pattern as /api/export/full).
 * Returns 401 when the token is missing or does not match.
 *
 * Content-Type: text/csv
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { format, subDays } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DailyLogRow {
  id: string;
  date: string;
  overall_pain: number | null;
  fatigue: number | null;
}

interface SymptomRow {
  log_id: string;
  symptom: string;
  severity: string | null;
  category: string;
  logged_at: string;
}

function extractAdminToken(req: NextRequest): string | null {
  const header = req.headers.get("x-export-admin-token");
  if (header) return header;
  const fromQuery = req.nextUrl.searchParams.get("token");
  if (fromQuery) return fromQuery;
  return null;
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const expected = process.env.EXPORT_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "EXPORT_ADMIN_TOKEN is not configured on the server; symptom export is disabled",
      },
      { status: 401 },
    );
  }
  const provided = extractAdminToken(req);
  if (!provided || provided !== expected) {
    return NextResponse.json(
      {
        error:
          "symptom export requires a matching admin token (header x-export-admin-token or ?token=)",
      },
      { status: 401 },
    );
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days") ?? "28");
  const days = Number.isFinite(daysParam)
    ? Math.max(1, Math.min(365, Math.floor(daysParam)))
    : 28;

  const today = format(new Date(), "yyyy-MM-dd");
  const cutoffDate = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  const sb = createServiceClient();

  const { data: logsData, error: logsErr } = await sb
    .from("daily_logs")
    .select("id, date, overall_pain, fatigue")
    .gte("date", cutoffDate)
    .lte("date", today)
    .order("date", { ascending: true });

  if (logsErr) {
    return NextResponse.json(
      { error: `Could not load daily_logs: ${logsErr.message}` },
      { status: 500 },
    );
  }
  const logs = (logsData ?? []) as DailyLogRow[];
  const logIds = logs.map((l) => l.id);

  let symptoms: SymptomRow[] = [];
  if (logIds.length > 0) {
    const { data: symptomRows } = await sb
      .from("symptoms")
      .select("log_id, symptom, severity, category, logged_at")
      .in("log_id", logIds);
    symptoms = (symptomRows ?? []) as SymptomRow[];
  }

  const byLogId = new Map<string, SymptomRow[]>();
  for (const s of symptoms) {
    const arr = byLogId.get(s.log_id) ?? [];
    arr.push(s);
    byLogId.set(s.log_id, arr);
  }

  const dateToLog = new Map<string, DailyLogRow>();
  for (const l of logs) dateToLog.set(l.date, l);

  const rows: string[] = [];
  const header = [
    "date",
    "overall_pain",
    "fatigue",
    "symptom_count",
    "symptoms",
    "severities",
    "earliest_logged_at",
    "latest_logged_at",
  ];
  rows.push(header.map(escapeCsv).join(","));

  for (let i = 0; i < days; i++) {
    const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
    const log = dateToLog.get(date) ?? null;
    const logSymptoms = log ? byLogId.get(log.id) ?? [] : [];

    const symptomLabels = logSymptoms.map((s) => s.symptom);
    const severities = logSymptoms
      .map((s) => `${s.symptom}=${s.severity ?? "unrated"}`)
      .join("|");

    let earliest = "";
    let latest = "";
    if (logSymptoms.length > 0) {
      const sorted = [...logSymptoms].sort((a, b) =>
        a.logged_at < b.logged_at ? -1 : 1,
      );
      earliest = sorted[0].logged_at;
      latest = sorted[sorted.length - 1].logged_at;
    }

    rows.push(
      [
        date,
        log?.overall_pain ?? "",
        log?.fatigue ?? "",
        logSymptoms.length,
        symptomLabels.join("|"),
        severities,
        earliest,
        latest,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  const csv = rows.join("\r\n") + "\r\n";
  const filename = `symptoms-${cutoffDate}-to-${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Lanaehealth-Export": "symptoms-including-none-rows",
    },
  });
}
