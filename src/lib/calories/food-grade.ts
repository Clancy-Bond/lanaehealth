/**
 * Food quality grade (A-F).
 *
 * MyNetDiary calls this "Fd. Grade" and keeps the formula proprietary.
 * Ours is a transparent heuristic that rewards nutrient density and
 * penalizes ultra-processed markers. Grades are NOT a moral judgment;
 * they are a rapid at-a-glance signal on a food's nutrient profile
 * per calorie.
 *
 * Inputs: USDA-style per-serving macros.
 * Output: { score: 0-100, grade: "A" | "B" | "C" | "D" | "F", reasons }
 *
 * Rules (from publicly published food-scoring systems like NutriScore
 * and Harvard's nutrient density index, adapted):
 *
 *   Baseline 60.
 *   Positives (up to +45):
 *     +fiber density (g per 100 kcal)   -> +0 to +15
 *     +protein density (g per 100 kcal) -> +0 to +12
 *     +omega-3 present                  -> +3
 *     +vitamin C present                -> +3
 *     +iron density                     -> +0 to +5
 *     +calcium density                  -> +0 to +5
 *     +low sodium density               -> +0 to +5 (if <100mg/100kcal)
 *
 *   Negatives (up to -55):
 *     -trans fat present       -> -15 (hard penalty)
 *     -saturated fat density   -> 0 to -10
 *     -added sugar density     -> 0 to -12 (use sugar as proxy)
 *     -sodium density          -> 0 to -10 (if >400mg/100kcal)
 *     -very low fiber          -> 0 to -5 (if <0.5g/100kcal)
 *     -ultra-processed hint    -> -3 if food name contains
 *                                 markers (optional, caller decides)
 *
 *   Clamp 0-100, map to grade:
 *     90+  A  / 80-89 B  / 65-79 C  / 50-64 D  / <50 F
 */

export type FoodGrade = "A" | "B" | "C" | "D" | "F";

export interface GradeInput {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  satFat?: number | null;
  transFat?: number | null;
  carbs: number | null;
  sugar?: number | null;
  fiber: number | null;
  sodium: number | null;
  iron?: number | null;
  calcium?: number | null;
  vitaminC?: number | null;
  omega3?: number | null;
  /** Optional: description used to spot ultra-processed markers. */
  description?: string | null;
}

export interface GradeResult {
  score: number;
  grade: FoodGrade;
  reasons: Array<{ sign: "+" | "-"; text: string; delta: number }>;
}

const ULTRA_PROCESSED_MARKERS = [
  "soda",
  "cola",
  "candy",
  "chips",
  "cookie",
  "cookies",
  "doughnut",
  "donut",
  "icing",
  "pastry",
  "instant noodle",
  "ramen",
  "frosted",
  "toaster pastry",
];

export function gradeFood(input: GradeInput): GradeResult {
  const calories = num(input.calories, 0);
  const reasons: GradeResult["reasons"] = [];
  let score = 60;

  if (calories <= 0) {
    // Zero-cal items (e.g. black coffee, water): pass through as B.
    return { score: 85, grade: "B", reasons: [{ sign: "+", text: "Zero calorie item", delta: 25 }] };
  }

  const per100 = 100 / calories;
  const fiber = num(input.fiber, 0);
  const protein = num(input.protein, 0);
  const sugar = num(input.sugar, 0);
  const sodium = num(input.sodium, 0);
  const satFat = num(input.satFat, 0);
  const transFat = num(input.transFat, 0);
  const iron = num(input.iron, 0);
  const calcium = num(input.calcium, 0);
  const vitaminC = num(input.vitaminC, 0);
  const omega3 = num(input.omega3, 0);

  // ── Positives ──────────────────────────────────────────────────────
  const fiberDensity = fiber * per100;
  const fiberBoost = Math.min(15, Math.round(fiberDensity * 3));
  if (fiberBoost > 0) {
    add(reasons, "+", "Fiber dense", fiberBoost);
    score += fiberBoost;
  } else if (fiberDensity < 0.5) {
    add(reasons, "-", "Low fiber density", 5);
    score -= 5;
  }

  const proteinDensity = protein * per100;
  const proteinBoost = Math.min(12, Math.round(proteinDensity * 1.5));
  if (proteinBoost > 0) {
    add(reasons, "+", "Protein dense", proteinBoost);
    score += proteinBoost;
  }

  if (omega3 > 0.1) {
    add(reasons, "+", "Omega-3 present", 3);
    score += 3;
  }
  if (vitaminC > 5) {
    add(reasons, "+", "Vitamin C present", 3);
    score += 3;
  }
  const ironDensity = iron * per100;
  if (ironDensity > 0.3) {
    const boost = Math.min(5, Math.round(ironDensity * 3));
    add(reasons, "+", "Iron dense", boost);
    score += boost;
  }
  const calciumDensity = calcium * per100;
  if (calciumDensity > 15) {
    const boost = Math.min(5, Math.round(calciumDensity / 15));
    add(reasons, "+", "Calcium dense", boost);
    score += boost;
  }
  const sodiumDensity = sodium * per100;
  if (sodiumDensity < 100) {
    const boost = Math.min(5, Math.round((100 - sodiumDensity) / 20));
    if (boost > 0) {
      add(reasons, "+", "Low sodium for the calories", boost);
      score += boost;
    }
  }

  // ── Negatives ──────────────────────────────────────────────────────
  if (transFat > 0) {
    add(reasons, "-", "Trans fat present", 15);
    score -= 15;
  }
  const satDensity = satFat * per100;
  if (satDensity > 2) {
    const penalty = Math.min(10, Math.round((satDensity - 2) * 2));
    add(reasons, "-", "Saturated fat dense", penalty);
    score -= penalty;
  }
  const sugarDensity = sugar * per100;
  if (sugarDensity > 5) {
    const penalty = Math.min(12, Math.round((sugarDensity - 5) * 1.2));
    add(reasons, "-", "High sugar density", penalty);
    score -= penalty;
  }
  if (sodiumDensity > 400) {
    const penalty = Math.min(10, Math.round((sodiumDensity - 400) / 60));
    add(reasons, "-", "High sodium density", penalty);
    score -= penalty;
  }

  // Ultra-processed heuristic (optional, low weight).
  const desc = (input.description ?? "").toLowerCase();
  if (desc && ULTRA_PROCESSED_MARKERS.some((m) => desc.includes(m))) {
    add(reasons, "-", "Ultra-processed marker", 3);
    score -= 3;
  }

  score = Math.round(Math.max(0, Math.min(100, score)));
  const grade = toGrade(score);
  return { score, grade, reasons: reasons.sort((a, b) => b.delta - a.delta).slice(0, 6) };
}

function add(reasons: GradeResult["reasons"], sign: "+" | "-", text: string, delta: number): void {
  reasons.push({ sign, text, delta });
}

function num(v: number | null | undefined, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  return Number.isFinite(v) ? v : fallback;
}

function toGrade(score: number): FoodGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function gradeColor(grade: FoodGrade): string {
  switch (grade) {
    case "A":
      return "var(--accent-sage)";
    case "B":
      return "var(--accent-sage)";
    case "C":
      return "var(--phase-luteal)";
    case "D":
      return "var(--accent-blush-light)";
    case "F":
      return "var(--accent-blush)";
  }
}
