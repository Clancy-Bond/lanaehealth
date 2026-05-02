import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireUser } from "@/lib/api/require-user";
import { safeErrorMessage, safeErrorResponse } from "@/lib/api/safe-error";

export const dynamic = 'force-dynamic'
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, ctx: RouteContext) {
  try {
    await requireUser(request);
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing appointment id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      notes?: string | null;
      action_items?: string | null;
      follow_up_date?: string | null;
    };

    const patch: Record<string, string | null> = {};
    if (Object.prototype.hasOwnProperty.call(body, "notes")) patch.notes = body.notes ?? null;
    if (Object.prototype.hasOwnProperty.call(body, "action_items"))
      patch.action_items = body.action_items ?? null;
    if (Object.prototype.hasOwnProperty.call(body, "follow_up_date"))
      patch.follow_up_date = body.follow_up_date ?? null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const sb = createServiceClient();
    const { error } = await sb.from("appointments").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json({ error: safeErrorMessage(error, "update_failed") }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeErrorResponse(err, "update_failed");
  }
}
