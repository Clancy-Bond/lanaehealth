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
  it("returns a 100g fallback portion when the array is empty", () => {
    const out = parseFoodPortions([]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      label: "100 g",
      gramWeight: 100,
      amount: 100,
      unit: "g",
    });
  });

  it("maps a single USDA portion into our FoodPortion shape", () => {
    const out = parseFoodPortions([
      {
        id: 81740,
        amount: 1,
        gramWeight: 118,
        portionDescription: "1 medium (7\" to 7-7/8\" long)",
        measureUnit: { id: 9999, name: "undetermined", abbreviation: "undetermined" },
      },
    ]);
    expect(out).toHaveLength(2); // the mapped portion PLUS the 100g fallback
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

  it("skips portions with missing or invalid gramWeight", () => {
    const out = parseFoodPortions([
      { amount: 1, gramWeight: 0, measureUnit: { name: "cup" } },
      { amount: 1, gramWeight: -5, measureUnit: { name: "cup" } },
      { amount: 1, gramWeight: "notanumber", measureUnit: { name: "cup" } },
      { amount: 1, gramWeight: 118, measureUnit: { name: "medium" } },
    ]);
    // only the valid portion + the 100g fallback survive
    expect(out.map((p) => p.gramWeight)).toEqual([118, 100]);
  });

  it("deduplicates portions with identical labels", () => {
    const out = parseFoodPortions([
      { amount: 1, gramWeight: 100, measureUnit: { name: "cup" } },
      { amount: 1, gramWeight: 105, measureUnit: { name: "cup" } }, // dupe label
    ]);
    // keep only first of dupe, plus 100g fallback; so 2 total
    expect(out).toHaveLength(2);
    expect(out[0].gramWeight).toBe(100);
    expect(out[1]).toEqual(DEFAULT_HUNDRED_GRAM_PORTION);
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
