/**
 * USDA food portion normalizer + nutrient scaler.
 *
 * USDA FoodData Central gives each food a `foodPortions` array (one
 * entry per typical household measurement: "1 cup sliced", "1 large",
 * "1 tbsp", etc.) each with an exact `gramWeight`. We need to
 * - normalize those entries into a stable shape our UI can bind to, and
 * - scale per-serving-size nutrient values to an arbitrary gram amount
 *   so the food-log can respect the portion the user picked.
 *
 * These pure helpers are tested separately from the HTTP client so the
 * scaling math is pinned with zero API fixture mocking.
 */

export interface FoodPortion {
  /** Human label displayed in the picker ("1 medium (7\" to 7-7/8\" long)"). */
  label: string;
  /** Amount of the unit — e.g. 1 for "1 cup", 0.5 for "1/2 cup". */
  amount: number;
  /** Unit string (cup, tbsp, g, etc.) — display only. */
  unit: string;
  /** Grams the amount-unit resolves to. This drives the scaling math. */
  gramWeight: number;
}

export const DEFAULT_HUNDRED_GRAM_PORTION: FoodPortion = {
  label: "100 g",
  amount: 100,
  unit: "g",
  gramWeight: 100,
};

interface RawUsdaPortion {
  amount?: number | string | null;
  gramWeight?: number | string | null;
  portionDescription?: string | null;
  modifier?: string | null;
  measureUnit?: { name?: string | null } | null;
}

function formatAmount(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

function labelFor(raw: RawUsdaPortion, amount: number): string {
  const pd = typeof raw.portionDescription === "string" ? raw.portionDescription.trim() : "";
  const unit = typeof raw.measureUnit?.name === "string" ? raw.measureUnit.name.trim() : "";
  const mod = typeof raw.modifier === "string" ? raw.modifier.trim() : "";

  // USDA uses the sentinel "undetermined" for Foundation foods whose
  // portionDescription is the real label (e.g. "1 medium (7" to 7-7/8")
  // long)"). Prefer portionDescription when it's present and the unit
  // is the undetermined sentinel OR empty.
  if (pd && (!unit || unit === "undetermined")) return pd;

  if (pd) return pd;

  const unitLabel = unit || "unit";
  if (mod) return `${formatAmount(amount)} ${unitLabel}, ${mod}`;
  return `${formatAmount(amount)} ${unitLabel}`;
}

export function parseFoodPortions(raw: unknown): FoodPortion[] {
  const portions: FoodPortion[] = [];
  const seenLabels = new Set<string>();

  if (Array.isArray(raw)) {
    for (const entry of raw as RawUsdaPortion[]) {
      const amount = Number(entry?.amount ?? 1);
      const gramWeight = Number(entry?.gramWeight);
      if (!Number.isFinite(gramWeight) || gramWeight <= 0) continue;

      const label = labelFor(entry, Number.isFinite(amount) && amount > 0 ? amount : 1);
      if (seenLabels.has(label)) continue;
      seenLabels.add(label);

      const unit = typeof entry?.measureUnit?.name === "string" ? entry.measureUnit.name : "unit";
      portions.push({
        label,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
        unit,
        gramWeight,
      });
    }
  }

  // Always append the 100g fallback — gives a clean "by weight" option
  // that works for foods with no portions and for users who weighed.
  if (!seenLabels.has(DEFAULT_HUNDRED_GRAM_PORTION.label)) {
    portions.push({ ...DEFAULT_HUNDRED_GRAM_PORTION });
  }
  return portions;
}

export interface ScalableNutrients {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sodium: number | null;
  sugar?: number | null;
  iron?: number | null;
  calcium?: number | null;
  [k: string]: number | null | undefined;
}

export function scaleNutrientsToGrams<T extends ScalableNutrients>(
  nutrients: T,
  servingSizeG: number,
  gramsEaten: number,
): T {
  if (!Number.isFinite(servingSizeG) || servingSizeG <= 0) {
    return { ...nutrients };
  }
  const factor = gramsEaten / servingSizeG;
  const out: ScalableNutrients = { ...nutrients };
  for (const [k, v] of Object.entries(nutrients)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = Math.round(v * factor * 10) / 10;
    }
  }
  return out as T;
}
