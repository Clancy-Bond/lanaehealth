/**
 * POST /api/migraine/attacks
 *
 * Log a new headache/migraine attack into headache_attacks.
 *
 * Fields:
 *   started_at (ISO), ended_at (ISO, optional), severity (0-10),
 *   head_zones (csv -> jsonb array), aura_categories (csv -> jsonb),
 *   triggers (csv -> jsonb), medications_taken (csv -> jsonb),
 *   medication_relief_minutes (int, optional),
 *   notes (text, optional),
 *   cycle_phase (denormalized from caller, optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireUser } from "@/lib/api/require-user";
import { safeErrorMessage, safeErrorResponse } from "@/lib/api/safe-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csv(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((s) => s.length > 0);
  }
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function intOrNull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  const ct = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  try {
    if (ct.includes("application/json")) {
      body = (await req.json()) as Record<string, unknown>;
    } else {
      const fd = await req.formData();
      const multiSelectKeys = new Set([
        "head_zones",
        "aura_categories",
        "triggers",
        "medications_taken",
      ]);
      for (const key of Array.from(new Set([...fd.keys()]))) {
        if (multiSelectKeys.has(key)) {
          body[key] = fd.getAll(key).map((v) => (typeof v === "string" ? v : v.name));
        } else {
          const v = fd.get(key);
          body[key] = typeof v === "string" ? v : v?.name ?? null;
        }
      }
    }
  } catch {
    return NextResponse.json({ error: "Bad body." }, { status: 400 });
  }

  const started_at =
    typeof body.started_at === "string" && body.started_at.length > 0
      ? (body.started_at as string)
      : new Date().toISOString();
  const ended_at = typeof body.ended_at === "string" && body.ended_at.length > 0 ? (body.ended_at as string) : null;
  const severityRaw = Number(body.severity);
  const severity = Number.isFinite(severityRaw) && severityRaw >= 0 && severityRaw <= 10 ? severityRaw : null;

  const row: Record<string, unknown> = {
    started_at,
    ended_at,
    severity,
    head_zones: csv(body.head_zones),
    aura_categories: csv(body.aura_categories),
    triggers: csv(body.triggers),
    medications_taken: csv(body.medications_taken),
    medication_relief_minutes: intOrNull(body.medication_relief_minutes),
    notes: typeof body.notes === "string" && body.notes.length > 0 ? body.notes : null,
    cycle_phase: typeof body.cycle_phase === "string" && body.cycle_phase.length > 0 ? body.cycle_phase : null,
    hit6_score: intOrNull(body.hit6_score),
  };

  const sb = createServiceClient();
  const { error } = await sb.from("headache_attacks").insert(row);
  if (error) {
    return NextResponse.json({ error: safeErrorMessage(error, "attack_insert_failed") }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/topics/migraine?logged=1", req.url), 303);
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
