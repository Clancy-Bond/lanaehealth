// GET /api/expenses/receipt?year=2026[&ids=id1,id2,...]
//
// Returns a single-page PDF itemized receipt suitable for FSA/HSA
// submission. Filters expenses by plan year or an explicit id list.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { buildFsaReceipt } from "@/lib/reports/fsa/receipt-builder";
import type { MedicalExpense } from "@/lib/types";
import { format } from "date-fns";
import { resolveUserId, UserIdUnresolvableError } from "@/lib/auth/resolve-user-id";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const yearParam = searchParams.get("year");
  const idsParam = searchParams.get("ids");

  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isFinite(year)) {
    return NextResponse.json(
      { error: "year must be a number" },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    const r = await resolveUserId();
    userId = r.userId;
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "auth check failed" }, { status: 500 });
  }

  const supabase = createServiceClient();

  // Load expenses (this user only): either by id list or by plan year.
  let query = supabase
    .from("medical_expenses")
    .select("*")
    .eq("user_id", userId)
    .order("service_date", { ascending: true });

  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a comma-separated list of UUIDs" },
        { status: 400 },
      );
    }
    query = query.in("id", ids);
  } else {
    query = query.eq("plan_year", year);
  }

  const { data: expenses, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!expenses || expenses.length === 0) {
    return NextResponse.json(
      {
        error: `no expenses found for ${idsParam ? "given ids" : `plan year ${year}`}`,
      },
      { status: 404 },
    );
  }

  // Pull patient name from health_profile.personal if available (this user)
  let patientName = "Patient";
  const { data: personal } = await supabase
    .from("health_profile")
    .select("content")
    .eq("user_id", userId)
    .eq("section", "personal")
    .maybeSingle();
  if (personal?.content) {
    try {
      const parsed =
        typeof personal.content === "string"
          ? JSON.parse(personal.content)
          : personal.content;
      if (parsed?.full_name) patientName = parsed.full_name;
    } catch {
      // fall through to default
    }
  }

  const pdf = buildFsaReceipt({
    patientName,
    planYear: year,
    expenses: expenses as MedicalExpense[],
    generatedAt: new Date(),
  });

  const filename = `lanaehealth-fsa-receipt-${year}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
