/**
 * Weight Loss Plan Calculator.
 *
 * Methodology, formulas, and clamps cited at
 * docs/research/weight-loss-calculation-methodology.md.
 *
 * Pure functions only. No I/O. Persistence lives in a separate module
 * (weight-plan-store.ts) so this file is safe to import from client
 * components without dragging in the Supabase service role client.
 */

// ── Types ──────────────────────────────────────────────────────────

export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export interface WeightPlanInputs {
  currentWeightKg: number;
  heightCm: number;
  ageYears: number;
  /** BMR formula sex. Non-binary users default to 'female' for the
   * safer (lower) maintenance estimate. */
  sex: Sex;
  activityLevel: ActivityLevel;
  goalWeightKg: number;
  /** User picks 0.25 / 0.5 / 0.75 / 1.0 kg/week. Clamped here to the
   * safe range and to a 1%-bodyweight ceiling. */
  weeklyRateKg: number;
  conditions?: {
    POTS?: boolean;
    migraine?: boolean;
    cycle?: boolean;
  };
}

export interface WeightPlanMacros {
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
}

export interface WeightPlan {
  /** Mifflin-St Jeor BMR in kcal/day. */
  bmr: number;
  /** TDEE = BMR * activity multiplier. */
  tdee: number;
  /** Daily calorie target after applying the safe deficit. */
  targetCalories: number;
  /** Daily kcal removed from TDEE to hit the chosen weekly rate. */
  deficit: number;
  /** Weeks from current to goal at the (clamped) rate. */
  weeksToGoal: number;
  /** Effective weekly rate after safety clamps. May be < requested. */
  effectiveWeeklyRateKg: number;
  /** Target ISO date (YYYY-MM-DD) when goal would be met at this pace. */
  targetDate: string;
  macros: WeightPlanMacros;
  /** Plain-English NC voice alerts. Empty when no clamps fired. */
  warnings: string[];
  /** Refeed / diet-break copy when sustained deficit is large. */
  refeedRecommendation?: string;
  /** Condition-specific adjustments surfaced when relevant. */
  conditionAdjustments?: string[];
  /** Suggested per-meal split of targetCalories. */
  mealSplit: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snacks: number;
  };
}

// Persisted shape lives here (no DB import) so client code can
// typecheck against it. The actual store helpers live in
// weight-plan-store.ts.
export interface SavedWeightPlan {
  inputs: WeightPlanInputs;
  plan: WeightPlan;
  savedAt: string;
}
export const WEIGHT_PLAN_SECTION_KEY = "weight_plan";

// ── Constants from the research doc ────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const KCAL_PER_KG_BODYFAT = 7700;
/** Safe weekly loss range in kg from CDC / NHLBI (1-2 lb/week). */
const MIN_WEEKLY_RATE_KG = 0.1;
const MAX_WEEKLY_RATE_KG = 1.0;
/** Athlete cutting ceiling of 1% bodyweight per week (ISSN). */
const MAX_PCT_BODYWEIGHT_PER_WEEK = 0.01;
/** Calorie floors below which adequate micronutrient intake from food
 * alone is unreliable per CDC/AHA. */
const MIN_CALORIES_FEMALE = 1200;
const MIN_CALORIES_MALE = 1500;

// Macro defaults (ISSN protein band; fat 0.9 g/kg with 20% kcal floor).
const PROTEIN_G_PER_KG_DEFAULT = 1.8;
const PROTEIN_G_PER_KG_AGGRESSIVE = 2.0;
const FAT_G_PER_KG = 0.9;
const FAT_KCAL_FLOOR_PCT = 0.2;
const CARB_FLOOR_G = 100;

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FAT = 9;

const MEAL_SPLIT = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.35,
  snacks: 0.1,
} as const;

// ── Pure helpers ───────────────────────────────────────────────────

/** Mifflin-St Jeor BMR. Female fallback for non-binary callers. */
export function mifflinStJeor(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: Sex,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

export function activityMultiplier(level: ActivityLevel): number {
  return ACTIVITY_MULTIPLIERS[level];
}

/** Clamp a weekly rate to the safe range and to 1% of bodyweight. */
function clampWeeklyRate(
  requested: number,
  currentWeightKg: number,
): { rate: number; clamped: boolean; reason: string | null } {
  const pctCeiling = currentWeightKg * MAX_PCT_BODYWEIGHT_PER_WEEK;
  const ceiling = Math.min(MAX_WEEKLY_RATE_KG, pctCeiling);
  if (requested > ceiling) {
    const reason =
      pctCeiling < MAX_WEEKLY_RATE_KG
        ? `Capped at 1% of body weight per week (${ceiling.toFixed(2)} kg) to protect lean mass.`
        : `Capped at 1.0 kg per week, the upper end of the medical safe range.`;
    return { rate: ceiling, clamped: true, reason };
  }
  if (requested < MIN_WEEKLY_RATE_KG) {
    return {
      rate: MIN_WEEKLY_RATE_KG,
      clamped: true,
      reason: `Slowed to ${MIN_WEEKLY_RATE_KG} kg per week minimum so the math still yields a deficit.`,
    };
  }
  return { rate: requested, clamped: false, reason: null };
}

function calorieFloor(sex: Sex): number {
  return sex === "male" ? MIN_CALORIES_MALE : MIN_CALORIES_FEMALE;
}

function addDaysISO(weeks: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + Math.round(weeks * 7));
  return d.toISOString().slice(0, 10);
}

// ── Macro composition ──────────────────────────────────────────────

function computeMacros(
  targetCalories: number,
  currentWeightKg: number,
  weeklyRateKg: number,
): WeightPlanMacros {
  // Aggressive deficits get the upper end of the protein band to
  // protect lean mass (Helms et al. 2014, ISSN 2017).
  const proteinPerKg =
    weeklyRateKg >= 0.75
      ? PROTEIN_G_PER_KG_AGGRESSIVE
      : PROTEIN_G_PER_KG_DEFAULT;

  let proteinG = Math.round(currentWeightKg * proteinPerKg);
  let fatG = Math.round(currentWeightKg * FAT_G_PER_KG);

  // Fat floor: 20% of total kcal (hormone synthesis, fat-soluble vits).
  const fatFloorG = Math.round((targetCalories * FAT_KCAL_FLOOR_PCT) / KCAL_PER_G_FAT);
  if (fatG < fatFloorG) fatG = fatFloorG;

  const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;
  const fatKcal = fatG * KCAL_PER_G_FAT;
  const carbsKcal = targetCalories - proteinKcal - fatKcal;

  // Carb floor; if below, shave fat (we never trim protein in a deficit).
  let carbsG = Math.max(0, Math.round(carbsKcal / KCAL_PER_G_CARB));
  if (carbsG < CARB_FLOOR_G) {
    const need = CARB_FLOOR_G - carbsG;
    const fatRedG = Math.min(fatG - fatFloorG, need);
    if (fatRedG > 0) {
      fatG -= fatRedG;
      carbsG += fatRedG;
    }
  }
  // Recompute exact kcal totals so percentages always sum to ~100.
  const finalProteinKcal = proteinG * KCAL_PER_G_PROTEIN;
  const finalFatKcal = fatG * KCAL_PER_G_FAT;
  const finalCarbsKcal = carbsG * KCAL_PER_G_CARB;
  const totalKcal =
    finalProteinKcal + finalFatKcal + finalCarbsKcal || 1;

  return {
    proteinG,
    carbsG,
    fatG,
    proteinPercent: Math.round((finalProteinKcal / totalKcal) * 100),
    carbsPercent: Math.round((finalCarbsKcal / totalKcal) * 100),
    fatPercent: Math.round((finalFatKcal / totalKcal) * 100),
  };
}

// ── Condition-aware adjustments ────────────────────────────────────

function buildConditionAdjustments(
  conditions: WeightPlanInputs["conditions"],
): string[] {
  const adj: string[] = [];
  if (conditions?.POTS) {
    adj.push(
      "POTS: aim for 3,000 to 5,000 mg sodium daily, even while losing weight. Restricting salt makes orthostatic symptoms worse.",
    );
  }
  if (conditions?.migraine) {
    adj.push(
      "Migraine: keep deficits modest (no more than TDEE minus 500). Long fasts and sharp blood-sugar drops are common triggers, so eat every 3 to 4 hours.",
    );
  }
  if (conditions?.cycle) {
    adj.push(
      "Cycle: heavy periods cost roughly 30 to 40 mg iron each month, so keep iron-rich foods in the plan and consider a smaller deficit during the late luteal and menstrual phase.",
    );
  }
  return adj;
}

// ── Main: calculateWeightPlan ──────────────────────────────────────

export function calculateWeightPlan(inputs: WeightPlanInputs): WeightPlan {
  const warnings: string[] = [];

  // 1. BMR + TDEE
  const bmr = Math.round(
    mifflinStJeor(
      inputs.currentWeightKg,
      inputs.heightCm,
      inputs.ageYears,
      inputs.sex,
    ),
  );
  const tdee = Math.round(bmr * activityMultiplier(inputs.activityLevel));

  // 2. Clamp the requested rate to safe bounds.
  const clampResult = clampWeeklyRate(
    inputs.weeklyRateKg,
    inputs.currentWeightKg,
  );
  let effectiveWeeklyRateKg = clampResult.rate;
  if (clampResult.clamped && clampResult.reason) {
    warnings.push(clampResult.reason);
  }

  // 3. Daily deficit from weekly rate (7700 kcal per kg of fat).
  let deficit = Math.round((effectiveWeeklyRateKg * KCAL_PER_KG_BODYFAT) / 7);
  let targetCalories = tdee - deficit;

  // 4. Calorie floor: if target sinks below floor, slow the rate.
  const floor = calorieFloor(inputs.sex);
  if (targetCalories < floor) {
    targetCalories = floor;
    deficit = Math.max(0, tdee - floor);
    const newWeekly = (deficit * 7) / KCAL_PER_KG_BODYFAT;
    effectiveWeeklyRateKg = Math.round(newWeekly * 100) / 100;
    warnings.push(
      `Your target landed below ${floor} kcal, the safe minimum for adequate nutrition. The weekly rate was slowed to ${effectiveWeeklyRateKg.toFixed(2)} kg per week so meals can still cover vitamins and minerals.`,
    );
  }

  // 5. If the TDEE is so low that even a small deficit hits the floor.
  if (tdee <= floor + 50) {
    warnings.push(
      "Your maintenance calories are already close to the safe minimum. Losing weight at this size needs medical supervision rather than a self-directed plan.",
    );
  }

  // 6. Macros.
  const macros = computeMacros(
    targetCalories,
    inputs.currentWeightKg,
    effectiveWeeklyRateKg,
  );

  // 7. Weeks to goal + target date.
  const kgToLose = Math.max(0, inputs.currentWeightKg - inputs.goalWeightKg);
  const weeksToGoal =
    effectiveWeeklyRateKg > 0
      ? Math.ceil(kgToLose / effectiveWeeklyRateKg)
      : 0;
  const targetDate = addDaysISO(weeksToGoal);

  if (kgToLose <= 0) {
    warnings.push(
      "You're already at or below your goal weight. Switch to maintenance instead of a deficit.",
    );
  }

  // 8. Refeed recommendation.
  let refeedRecommendation: string | undefined;
  if (effectiveWeeklyRateKg >= 0.5 && weeksToGoal >= 8) {
    refeedRecommendation =
      "Plan a 7 to 14 day diet break at maintenance every 8 to 12 weeks. Sustained deficits trigger adaptive thermogenesis, which is why progress slows after a couple of months. A short break protects your metabolism and is not a setback.";
  }

  // 9. Condition-aware copy.
  const conditionAdjustments = buildConditionAdjustments(inputs.conditions);

  // 10. Meal split.
  const mealSplit = {
    breakfast: Math.round(targetCalories * MEAL_SPLIT.breakfast),
    lunch: Math.round(targetCalories * MEAL_SPLIT.lunch),
    dinner: Math.round(targetCalories * MEAL_SPLIT.dinner),
    snacks: Math.round(targetCalories * MEAL_SPLIT.snacks),
  };

  return {
    bmr,
    tdee,
    targetCalories,
    deficit,
    weeksToGoal,
    effectiveWeeklyRateKg,
    targetDate,
    macros,
    warnings,
    refeedRecommendation,
    conditionAdjustments:
      conditionAdjustments.length > 0 ? conditionAdjustments : undefined,
    mealSplit,
  };
}
