// PATCH /api/expenses/[id]    update an expense (e.g., mark claimed)
// DELETE /api/expenses/[id]   remove an expense

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { MedicalExpenseInput } from "@/lib/types";
import { jsonError } from "@/lib/api/json-error";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: Partial<MedicalExpenseInput>;
  try {
    body = (await req.json()) as Partial<MedicalExpenseInput>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Whitelist what can be patched so callers can't override created_at etc.
  const patch: Record<string, unknown> = {};
  const ALLOWED = [
    "service_date",
    "provider_or_vendor",
    "description",
    "amount_cents",
    "category",
    "letter_of_medical_necessity",
    "receipt_url",
    "notes",
    "appointment_id",
    "claimed",
    "claimed_at",
    "plan_year",
  ] as const;
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key as keyof typeof body];
  }

  // Auto-stamp claimed_at when `claimed` flips true and no explicit value given
  if (patch.claimed === true && !("claimed_at" in patch)) {
    patch.claimed_at = new Date().toISOString();
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("medical_expenses")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return jsonError(500, "expenses_update_failed", error);
  }
  if (!data) {
    return jsonError(404, "not_found", undefined, "not found");
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("medical_expenses")
    .delete()
    .eq("id", id);

  if (error) {
    return jsonError(500, "expenses_delete_failed", error);
  }
  return NextResponse.json({ ok: true });
}
