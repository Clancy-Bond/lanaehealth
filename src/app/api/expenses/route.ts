// GET  /api/expenses?year=2026            list expenses (optionally by plan year)
// POST /api/expenses                       create a new expense
//
// Backs the Expenses page and the FSA receipt generator.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireUser } from "@/lib/api/require-user";
import { safeErrorMessage, safeErrorResponse } from "@/lib/api/safe-error";
import type {
  MedicalExpense,
  MedicalExpenseInput,
  MedicalExpenseCategory,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: MedicalExpenseCategory[] = [
  "office_visit",
  "prescription",
  "lab_imaging",
  "device",
  "subscription",
  "supplement",
  "therapy",
  "dental_vision",
  "travel_medical",
  "other",
];

// --- GET ------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  const year = req.nextUrl.searchParams.get("year");
  const supabase = createServiceClient();

  let query = supabase
    .from("medical_expenses")
    .select("*")
    .order("service_date", { ascending: false });

  if (year) {
    const n = Number(year);
    if (!Number.isFinite(n)) {
      return NextResponse.json(
        { error: "year must be a number" },
        { status: 400 },
      );
    }
    query = query.eq("plan_year", n);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: safeErrorMessage(error, "list_failed") }, { status: 500 });
  }

  const expenses = (data ?? []) as MedicalExpense[];
  const totalCents = expenses.reduce(
    (sum, e) => sum + (e.amount_cents ?? 0),
    0,
  );

  return NextResponse.json({
    expenses,
    total_cents: totalCents,
    count: expenses.length,
  });
}

// --- POST -----------------------------------------------------------------

type CreateBody = Partial<MedicalExpenseInput>;

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Required fields validation
  const required: Array<keyof MedicalExpenseInput> = [
    "service_date",
    "provider_or_vendor",
    "description",
    "amount_cents",
    "category",
  ];
  for (const f of required) {
    if (body[f] === undefined || body[f] === null || body[f] === "") {
      return NextResponse.json(
        { error: `missing required field: ${f}` },
        { status: 400 },
      );
    }
  }

  if (!VALID_CATEGORIES.includes(body.category as MedicalExpenseCategory)) {
    return NextResponse.json(
      {
        error: `invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const amountCents = Number(body.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return NextResponse.json(
      { error: "amount_cents must be a non-negative integer" },
      { status: 400 },
    );
  }

  const planYear =
    body.plan_year ?? Number(String(body.service_date).slice(0, 4));

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("medical_expenses")
    .insert({
      service_date: body.service_date,
      provider_or_vendor: body.provider_or_vendor,
      description: body.description,
      amount_cents: Math.round(amountCents),
      category: body.category,
      letter_of_medical_necessity:
        body.letter_of_medical_necessity ?? false,
      receipt_url: body.receipt_url ?? null,
      notes: body.notes ?? null,
      appointment_id: body.appointment_id ?? null,
      claimed: body.claimed ?? false,
      claimed_at: body.claimed_at ?? null,
      plan_year: planYear,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: safeErrorMessage(error, "insert_failed") }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
