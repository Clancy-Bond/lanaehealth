/**
 * Portion parsing + nutrient scaling for USDA food detail.
 *
 * These test the pure logic that powers MyNetDiary-parity portion
 * pickers (1 cup / 1 tbsp / 1 large / 1 oz etc.) on the food detail
 * page. USDA gives us the raw foodPortions array; we have to
 * normalize it and compute a gramWeight so the log endpoint can
 * scale calories + macros correctly.
 */

import { describe, it, expect } from "vitest";
import {
  parseFoodPortions,
  scaleNutrientsToGrams,
  DEFAULT_HUNDRED_GRAM_PORTION,
} from "../usda-portions";

describe("parseFoodPortions", () => {
  /*
   * MFN parity: when USDA returns sparse portions (most Foundation
   * foods only ship one), parseFoodPortions augments the chip strip
   * with common kitchen-weight options (1 oz / 50 g / 150 g / 200 g /
   * 1 cup ≈ 240 g) so the user has real choices on the food detail
   * screen. The augmentation only fires when the parsed list has 2
   * or fewer entries, so foods with rich portion data (e.g. branded
   * items with 5+ portions) are unaffected.
   */
  const COMMON_WEIGHT_LABELS = ["1 oz (28 g)", "50 g", "150 g", "200 g", "1 cup (240 g)"];

  it("returns a 100g fallback + common weights when USDA portions are empty", () => {
    const out = parseFoodPortions([]);
    // 100g fallback + 5 common weights
    expect(out).toHaveLength(1 + COMMON_WEIGHT_LABELS.length);
    expect(out[0]).toMatchObject({
      label: "100 g",
      gramWeight: 100,
      amount: 100,
      unit: "g",
    });
    for (const label of COMMON_WEIGHT_LABELS) {
      expect(out.some((p) => p.label === label)).toBe(true);
    }
  });

  it("maps a single USDA portion into our FoodPortion shape (and augments with common weights)", () => {
    const out = parseFoodPortions([
      {
        id: 81740,
        amount: 1,
        gramWeight: 118,
        portionDescription: "1 medium (7\" to 7-7/8\" long)",
        measureUnit: { id: 9999, name: "undetermined", abbreviation: "undetermined" },
      },
    ]);
    // mapped + 100g fallback + 5 common weights
    expect(out).toHaveLength(2 + COMMON_WEIGHT_LABELS.length);
    expect(out[0]).toMatchObject({
      gramWeight: 118,
      amount: 1,
      label: '1 medium (7" to 7-7/8" long)',
    });
    expect(out[1]).toEqual(DEFAULT_HUNDRED_GRAM_PORTION);
  });

  it("prefers portionDescription and falls back to modifier + measureUnit.name", () => {
    const out = parseFoodPortions([
      // portionDescription empty, modifier + measureUnit give the label
      { amount: 1, gramWeight: 8, modifier: "sliced", measureUnit: { name: "cup" } },
      // no modifier, use measureUnit name
      { amount: 0.5, gramWeight: 7, measureUnit: { name: "tbsp" } },
    ]);
    expect(out[0].label).toBe("1 cup, sliced");
    expect(out[1].label).toBe("0.5 tbsp");
  });

  it("skips portions with missing or invalid gramWeight (and augments because list is sparse)", () => {
    const out = parseFoodPortions([
      { amount: 1, gramWeight: 0, measureUnit: { name: "cup" } },
      { amount: 1, gramWeight: -5, measureUnit: { name: "cup" } },
      { amount: 1, gramWeight: "notanumber", measureUnit: { name: "cup" } },
      { amount: 1, gramWeight: 118, measureUnit: { name: "medium" } },
    ]);
    // valid portion + 100g fallback first
    expect(out[0].gramWeight).toBe(118);
    expect(out[1].gramWeight).toBe(100);
    // common weights appended (sparse-augment branch)
    for (const label of COMMON_WEIGHT_LABELS) {
      expect(out.some((p) => p.label === label)).toBe(true);
    }
  });

  it("deduplicates portions with identical labels (and augments because list is sparse)", () => {
    const out = parseFoodPortions([
      { amount: 1, gramWeight: 100, measureUnit: { name: "cup" } },
      { amount: 1, gramWeight: 105, measureUnit: { name: "cup" } }, // dupe label
    ]);
    expect(out[0].gramWeight).toBe(100);
    expect(out[1]).toEqual(DEFAULT_HUNDRED_GRAM_PORTION);
    for (const label of COMMON_WEIGHT_LABELS) {
      expect(out.some((p) => p.label === label)).toBe(true);
    }
  });

  it("does NOT augment with common weights when USDA returns rich portion data", () => {
    // A branded item with 5 portions -- parsed list will have 6
    // entries (5 portions + 100g fallback), past the augmentation
    // threshold of 2. Common weights should NOT be appended.
    const out = parseFoodPortions([
      { amount: 1, gramWeight: 50, measureUnit: { name: "small" } },
      { amount: 1, gramWeight: 80, measureUnit: { name: "medium" } },
      { amount: 1, gramWeight: 100, measureUnit: { name: "large" } },
      { amount: 1, gramWeight: 150, measureUnit: { name: "xl" } },
      { amount: 0.5, gramWeight: 25, measureUnit: { name: "small_half" } },
    ]);
    expect(out).toHaveLength(6); // 5 portions + 100g fallback, no common weights
    expect(out.some((p) => p.label === "1 oz (28 g)")).toBe(false);
    expect(out.some((p) => p.label === "1 cup (240 g)")).toBe(false);
  });
});

describe("scaleNutrientsToGrams", () => {
  const nutrientsPer100g = {
    calories: 89,
    protein: 1.1,
    fat: 0.3,
    carbs: 22.8,
    fiber: 2.6,
    sodium: 1,
    sugar: 12.2,
    iron: 0.26,
    calcium: 5,
  };

  it("returns identity when gramsEaten === servingSizeG", () => {
    const out = scaleNutrientsToGrams(nutrientsPer100g, 100, 100);
    expect(out.calories).toBe(89);
    expect(out.protein).toBe(1.1);
  });

  it("scales linearly when gramsEaten > servingSizeG", () => {
    const out = scaleNutrientsToGrams(nutrientsPer100g, 100, 200);
    expect(out.calories).toBe(178);
    expect(out.carbs).toBeCloseTo(45.6, 1);
  });

  it("scales down when gramsEaten < servingSizeG", () => {
    const out = scaleNutrientsToGrams(nutrientsPer100g, 100, 50);
    expect(out.calories).toBeCloseTo(44.5, 1);
    expect(out.fiber).toBeCloseTo(1.3, 1);
  });

  it("handles a 118g banana from per-100g nutrients", () => {
    const out = scaleNutrientsToGrams(nutrientsPer100g, 100, 118);
    expect(out.calories).toBeCloseTo(105, 0); // 89 * 1.18 ≈ 105
  });

  it("preserves null nutrients", () => {
    const out = scaleNutrientsToGrams(
      { ...nutrientsPer100g, iron: null, calcium: null },
      100,
      200,
    );
    expect(out.iron).toBeNull();
    expect(out.calcium).toBeNull();
  });

  it("returns a copy when servingSizeG is 0 or missing (no divide by zero)", () => {
    const out = scaleNutrientsToGrams(nutrientsPer100g, 0, 200);
    expect(out.calories).toBe(89); // untouched
  });
});
