/**
 * Weight Loss Plan persistence (server-only).
 *
 * Imports the Supabase service-role client. Never import this file
 * from a `'use client'` module : keep client code on
 * `@/lib/calories/weight-plan` for the pure calculator + types.
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase";
import {
  calculateWeightPlan,
  WEIGHT_PLAN_SECTION_KEY,
  type SavedWeightPlan,
  type WeightPlan,
  type WeightPlanInputs,
} from "./weight-plan";

/** Load the persisted plan from health_profile, or null. */
export async function loadWeightPlan(): Promise<SavedWeightPlan | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", WEIGHT_PLAN_SECTION_KEY)
      .maybeSingle();
    if (error || !data) return null;
    const content = (data as { content: unknown }).content;
    if (!content || typeof content !== "object") return null;
    const c = content as Partial<SavedWeightPlan>;
    if (!c.inputs || !c.plan) return null;
    return {
      inputs: c.inputs as WeightPlanInputs,
      plan: c.plan as WeightPlan,
      savedAt: typeof c.savedAt === "string" ? c.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Save the plan into health_profile under section='weight_plan'. */
export async function saveWeightPlan(
  inputs: WeightPlanInputs,
): Promise<{ ok: boolean; plan?: WeightPlan; error?: string }> {
  try {
    const plan = calculateWeightPlan(inputs);
    const payload: SavedWeightPlan = {
      inputs,
      plan,
      savedAt: new Date().toISOString(),
    };
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert(
        { section: WEIGHT_PLAN_SECTION_KEY, content: payload },
        { onConflict: "section" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, plan };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown error",
    };
  }
}
