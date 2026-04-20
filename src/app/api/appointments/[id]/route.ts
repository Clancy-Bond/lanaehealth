import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { jsonError } from "@/lib/api/json-error";

export const dynamic = 'force-dynamic'
interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchBody = z.object({
  notes: z.string().max(10_000).nullable().optional(),
  action_items: z.string().max(10_000).nullable().optional(),
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id || typeof id !== "string" || id.length > 64) {
      return jsonError(400, "bad_id", undefined, "Missing or invalid appointment id.");
    }

    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return jsonError(400, "bad_content_type", undefined, "Expected application/json.");
    }

    const raw = await request.json().catch(() => null);
    const parsed = PatchBody.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "bad_body", parsed.error, "Invalid body.");
    }
    const body = parsed.data;

    const patch: Record<string, string | null> = {};
    if ("notes" in body) patch.notes = body.notes ?? null;
    if ("action_items" in body) patch.action_items = body.action_items ?? null;
    if ("follow_up_date" in body) patch.follow_up_date = body.follow_up_date ?? null;

    if (Object.keys(patch).length === 0) {
      return jsonError(400, "no_fields", undefined, "No fields to update.");
    }

    const sb = createServiceClient();
    const { error } = await sb.from("appointments").update(patch).eq("id", id);
    if (error) return jsonError(500, "db_update_failed", error);

    return NextResponse.json({ success: true });
  } catch (err) {
    return jsonError(500, "update_failed", err);
  }
}
