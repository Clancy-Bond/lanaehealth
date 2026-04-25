import { describe, expect, it } from "vitest";
import {
  activityMultiplier,
  calculateWeightPlan,
  mifflinStJeor,
  type WeightPlanInputs,
} from "../weight-plan";

/*
 * Reference values cross-checked against:
 *  - Worked Mifflin male: 30y, 80kg, 178cm = 1768 BMR.
 *  - Worked Mifflin female: 25y, 60kg, 165cm = 1345 BMR.
 *  - Medscape calculator (https://reference.medscape.com/calculator/846).
 *  - ATHLEAN-X TDEE calculator activity multipliers.
 */

const baseFemale: WeightPlanInputs = {
  currentWeightKg: 67.3,
  heightCm: 170,
  ageYears: 24,
  sex: "female",
  activityLevel: "moderate",
  goalWeightKg: 60,
  weeklyRateKg: 0.5,
};

describe("mifflinStJeor", () => {
  it("matches a worked male reference (30y, 80kg, 178cm)", () => {
    // 10*80 + 6.25*178 - 5*30 + 5 = 800 + 1112.5 - 150 + 5 = 1767.5
    const bmr = mifflinStJeor(80, 178, 30, "male");
    expect(Math.round(bmr)).toBe(1768);
  });

  it("matches a young-female reference (25y, 60kg, 165cm)", () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    const bmr = mifflinStJeor(60, 165, 25, "female");
    expect(Math.round(bmr)).toBe(1345);
  });

  it("returns the male BMR ~166 kcal higher than female for matched inputs", () => {
    const m = mifflinStJeor(70, 175, 30, "male");
    const f = mifflinStJeor(70, 175, 30, "female");
    expect(Math.round(m - f)).toBe(166);
  });

  it("computes Lanae's BMR (24F, 67.3kg, 170cm) close to 1455", () => {
    const bmr = mifflinStJeor(67.3, 170, 24, "female");
    // 673 + 1062.5 - 120 - 161 = 1454.5
    expect(Math.round(bmr)).toBe(1455);
  });
});

describe("activityMultiplier", () => {
  it("uses the published Katch-McArdle / NASM tier values", () => {
    expect(activityMultiplier("sedentary")).toBe(1.2);
    expect(activityMultiplier("light")).toBe(1.375);
    expect(activityMultiplier("moderate")).toBe(1.55);
    expect(activityMultiplier("active")).toBe(1.725);
    expect(activityMultiplier("very_active")).toBe(1.9);
  });
});

describe("calculateWeightPlan", () => {
  it("computes a coherent baseline plan for Lanae", () => {
    const plan = calculateWeightPlan(baseFemale);
    expect(plan.bmr).toBe(1455);
    // 1455 * 1.55 = 2255.25 → 2255
    expect(plan.tdee).toBe(2255);
    // 0.5 kg/wk * 7700 / 7 = 550
    expect(plan.deficit).toBe(550);
    expect(plan.targetCalories).toBe(2255 - 550);
  });

  it("clamps the weekly rate to 1% of bodyweight", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      currentWeightKg: 60,
      weeklyRateKg: 1.0, // 1.0 > 0.6 (1% of 60kg)
    });
    expect(plan.effectiveWeeklyRateKg).toBeCloseTo(0.6, 5);
    expect(plan.warnings.some((w) => /1% of body weight/i.test(w))).toBe(true);
  });

  it("clamps to the absolute 1.0 kg/week ceiling for heavier users", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      currentWeightKg: 120,
      weeklyRateKg: 1.5,
    });
    expect(plan.effectiveWeeklyRateKg).toBe(1.0);
    expect(plan.warnings.some((w) => /1\.0 kg/i.test(w))).toBe(true);
  });

  it("raises the calorie target back to 1200 when a deficit would push it below", () => {
    const plan = calculateWeightPlan({
      currentWeightKg: 50,
      heightCm: 160,
      ageYears: 60,
      sex: "female",
      activityLevel: "sedentary",
      goalWeightKg: 45,
      weeklyRateKg: 1.0,
    });
    expect(plan.targetCalories).toBeGreaterThanOrEqual(1200);
    expect(plan.warnings.some((w) => /below 1200/i.test(w))).toBe(true);
  });

  it("raises male targets to 1500 floor instead of 1200", () => {
    const plan = calculateWeightPlan({
      currentWeightKg: 60,
      heightCm: 170,
      ageYears: 70,
      sex: "male",
      activityLevel: "sedentary",
      goalWeightKg: 55,
      weeklyRateKg: 1.0,
    });
    expect(plan.targetCalories).toBeGreaterThanOrEqual(1500);
  });

  it("macro grams sum to within 1% of target calories", () => {
    const plan = calculateWeightPlan(baseFemale);
    const macroKcal =
      plan.macros.proteinG * 4 + plan.macros.carbsG * 4 + plan.macros.fatG * 9;
    const drift = Math.abs(macroKcal - plan.targetCalories) / plan.targetCalories;
    expect(drift).toBeLessThan(0.01);
  });

  it("macro percentages sum to ~100", () => {
    const plan = calculateWeightPlan(baseFemale);
    const total =
      plan.macros.proteinPercent +
      plan.macros.carbsPercent +
      plan.macros.fatPercent;
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(2);
  });

  it("uses the aggressive protein band when weekly rate is at the high end", () => {
    const slow = calculateWeightPlan({ ...baseFemale, weeklyRateKg: 0.25 });
    const fast = calculateWeightPlan({ ...baseFemale, weeklyRateKg: 0.75 });
    expect(fast.macros.proteinG).toBeGreaterThanOrEqual(slow.macros.proteinG);
  });

  it("respects a 100g carb floor when possible", () => {
    const plan = calculateWeightPlan({ ...baseFemale, weeklyRateKg: 0.5 });
    expect(plan.macros.carbsG).toBeGreaterThanOrEqual(100);
  });

  it("computes weeks-to-goal honestly", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      currentWeightKg: 70,
      goalWeightKg: 60,
      weeklyRateKg: 0.5,
    });
    // 10 kg / 0.5 = 20 weeks
    expect(plan.weeksToGoal).toBe(20);
    expect(plan.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("warns when the user is already at goal", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      currentWeightKg: 60,
      goalWeightKg: 65,
    });
    expect(plan.warnings.some((w) => /already at or below your goal/i.test(w))).toBe(
      true,
    );
  });

  it("emits a refeed recommendation for sustained moderate deficits", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      currentWeightKg: 75,
      goalWeightKg: 65,
      weeklyRateKg: 0.5,
    });
    expect(plan.refeedRecommendation).toBeDefined();
    expect(plan.refeedRecommendation).toMatch(/diet break|adaptive thermogenesis/i);
  });

  it("omits the refeed for short plans", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      currentWeightKg: 62,
      goalWeightKg: 60,
      weeklyRateKg: 0.25,
    });
    expect(plan.refeedRecommendation).toBeUndefined();
  });

  it("includes POTS-specific sodium guidance when POTS is flagged", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      conditions: { POTS: true },
    });
    expect(plan.conditionAdjustments).toBeDefined();
    expect(
      plan.conditionAdjustments?.some((a) => /sodium/i.test(a) && /POTS/.test(a)),
    ).toBe(true);
  });

  it("includes migraine guidance when migraine is flagged", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      conditions: { migraine: true },
    });
    expect(plan.conditionAdjustments?.some((a) => /migraine/i.test(a))).toBe(true);
  });

  it("includes cycle / iron guidance when cycle is flagged", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      conditions: { cycle: true },
    });
    expect(plan.conditionAdjustments?.some((a) => /iron|cycle/i.test(a))).toBe(true);
  });

  it("merges multiple condition adjustments without dropping any", () => {
    const plan = calculateWeightPlan({
      ...baseFemale,
      conditions: { POTS: true, migraine: true, cycle: true },
    });
    expect(plan.conditionAdjustments?.length).toBe(3);
  });

  it("provides a meal split summing to (approximately) the target", () => {
    const plan = calculateWeightPlan(baseFemale);
    const sum =
      plan.mealSplit.breakfast +
      plan.mealSplit.lunch +
      plan.mealSplit.dinner +
      plan.mealSplit.snacks;
    expect(Math.abs(sum - plan.targetCalories)).toBeLessThanOrEqual(2);
  });
});
