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
  /** Amount of the unit - e.g. 1 for "1 cup", 0.5 for "1/2 cup". */
  amount: number;
  /** Unit string (cup, tbsp, g, etc.) - display only. */
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
  const rawUnit = typeof raw.measureUnit?.name === "string" ? raw.measureUnit.name.trim() : "";
  const mod = typeof raw.modifier === "string" ? raw.modifier.trim() : "";

  // USDA uses the literal string "undetermined" as a sentinel on
  // Foundation foods; treat it like an empty unit so we never render
  // phrases like "1 undetermined, medium".
  const unit = rawUnit === "undetermined" ? "" : rawUnit;

  if (pd) return pd;

  if (unit && mod) return `${formatAmount(amount)} ${unit}, ${mod}`;
  if (unit) return `${formatAmount(amount)} ${unit}`;
  if (mod) return `${formatAmount(amount)} ${mod}`;
  return `${formatAmount(amount)} serving`;
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

  // Always append the 100g fallback - gives a clean "by weight" option
  // that works for foods with no portions and for users who weighed.
  if (!seenLabels.has(DEFAULT_HUNDRED_GRAM_PORTION.label)) {
    portions.push({ ...DEFAULT_HUNDRED_GRAM_PORTION });
  }

  // MFN parity: when USDA returns sparse portions (often only "100 g"
  // for Foundation foods like egg whites or raw produce), augment the
  // chip strip with common kitchen-weight options so the user has real
  // choices without typing into the inline numeric input. Only weight
  // units -- volume conversions (fl oz, tsp, cup) require food-specific
  // densities we do not have, so we stay honest and weight-only here.
  // This is purely additive: any USDA-reported portion still wins
  // because we dedupe by label.
  if (portions.length <= 2) {
    for (const fallback of COMMON_WEIGHT_PORTIONS) {
      if (!seenLabels.has(fallback.label)) {
        seenLabels.add(fallback.label);
        portions.push({ ...fallback });
      }
    }
  }
  return portions;
}

/**
 * Common gram-weight portions appended when USDA returns very few
 * portion entries. Sorted small to large so the chip strip reads
 * left-to-right naturally. 28 g approximates 1 oz, 240 g approximates
 * 1 cup, the others fill the typical serving range.
 */
const COMMON_WEIGHT_PORTIONS: FoodPortion[] = [
  { label: "1 oz (28 g)", amount: 28, unit: "g", gramWeight: 28 },
  { label: "50 g", amount: 50, unit: "g", gramWeight: 50 },
  { label: "150 g", amount: 150, unit: "g", gramWeight: 150 },
  { label: "200 g", amount: 200, unit: "g", gramWeight: 200 },
  { label: "1 cup (240 g)", amount: 240, unit: "g", gramWeight: 240 },
];

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
