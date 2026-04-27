/**
 * Typed-error contract for usda-food.ts.
 *
 * USDA returns 404 for a specific fdcId when a Branded product is
 * retired/replaced. Our 7-day search cache can hold those stale fdcIds
 * past their expiry on USDA's side, so getFoodNutrients can throw 404
 * even when the rest of the API is healthy. We pin the typed errors
 * here so callers (the food detail page, the log API) can reliably
 * distinguish "this specific food is gone" from "USDA is down" and
 * render the right copy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  UsdaFoodNotFoundError,
  UsdaApiError,
  getFoodNutrients,
} from "../usda-food";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
      upsert: async () => ({ data: null, error: null }),
      delete: () => ({
        eq: () => ({
          then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(onFulfilled(undefined)),
        }),
      }),
    }),
  }),
}));

describe("usda-food error types", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.USDA_API_KEY = "TEST_KEY";
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("throws UsdaFoodNotFoundError on 404 (retired fdcId)", async () => {
    global.fetch = vi.fn(async () =>
      new Response("", { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(getFoodNutrients(9999999)).rejects.toBeInstanceOf(
      UsdaFoodNotFoundError,
    );
  });

  it("throws UsdaApiError on non-404 errors (rate limit / 5xx)", async () => {
    global.fetch = vi.fn(async () =>
      new Response("rate limited", { status: 429 }),
    ) as unknown as typeof fetch;

    await expect(getFoodNutrients(123456)).rejects.toBeInstanceOf(UsdaApiError);
  });

  it("UsdaFoodNotFoundError carries the offending fdcId", async () => {
    global.fetch = vi.fn(async () =>
      new Response("", { status: 404 }),
    ) as unknown as typeof fetch;

    try {
      await getFoodNutrients(2099999);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UsdaFoodNotFoundError);
      expect((e as UsdaFoodNotFoundError).fdcId).toBe(2099999);
    }
  });

  it("falls back to /foods/search when /food/{id} returns 404 but search has the row", async () => {
    // Simulates the prod bug for fdcId 747997 (Eggs, Grade A, Large,
    // egg white): /food/747997 -> 404, /foods/search?query=747997 ->
    // hit. The fallback must map the search-shape (nutrientId flat,
    // value field) into FoodNutrients and return a real result.
    let directHit = false;
    let searchHit = false;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/food/747997")) {
        directHit = true;
        return new Response("", { status: 404 });
      }
      if (url.includes("/foods/search") && url.includes("747997")) {
        searchHit = true;
        return new Response(
          JSON.stringify({
            foods: [
              {
                fdcId: 747997,
                description: "Eggs, Grade A, Large, egg white",
                dataType: "Foundation",
                foodNutrients: [
                  // Calories under both Branded (1008) and Atwater (2047/2048)
                  // we only ship 1008 here; the helper still resolves it.
                  { nutrientId: 1008, value: 55.0 },
                  { nutrientId: 1003, value: 10.7 }, // protein
                  { nutrientId: 1004, value: 0.0 },  // fat
                  { nutrientId: 1005, value: 2.36 }, // carbs
                  { nutrientId: 1093, value: 166 },  // sodium
                ],
                foodPortions: [],
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("", { status: 500 });
    }) as unknown as typeof fetch;

    const result = await getFoodNutrients(747997);
    expect(directHit).toBe(true);
    expect(searchHit).toBe(true);
    expect(result.fdcId).toBe(747997);
    expect(result.description).toMatch(/eggs/i);
    expect(result.calories).toBe(55);
    expect(result.protein).toBe(10.7);
    expect(result.fat).toBe(0);
    expect(result.carbs).toBe(2.4);
    // Foundation foods without explicit foodPortions fall back to the
    // 100g baseline rather than throwing.
    expect(result.servingSize).toBe(100);
    expect(result.servingUnit).toBe("g");
  });

  it("still throws UsdaFoodNotFoundError when both direct AND search miss", async () => {
    // Genuinely retired branded id: /food/{id} 404 AND search returns
    // an unrelated set (no row matching the requested fdcId). The
    // fallback must NOT silently accept the wrong row.
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/foods/search")) {
        return new Response(
          JSON.stringify({
            foods: [
              { fdcId: 12345, description: "something else", foodNutrients: [] },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    await expect(getFoodNutrients(99999)).rejects.toBeInstanceOf(
      UsdaFoodNotFoundError,
    );
  });

  it("falls back when search returns nutrient rows in the nested shape too", async () => {
    // Defensive: USDA has been seen returning the legacy nested shape
    // ({nutrient:{id}, amount}) inside search results for some food
    // categories. Ensure the helper handles both shapes side-by-side.
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/food/")) return new Response("", { status: 404 });
      return new Response(
        JSON.stringify({
          foods: [
            {
              fdcId: 555555,
              description: "Mixed-shape food",
              foodNutrients: [
                { nutrient: { id: 1008 }, amount: 120 },
                { nutrient: { id: 1003 }, amount: 5 },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await getFoodNutrients(555555);
    expect(result.calories).toBe(120);
    expect(result.protein).toBe(5);
  });
});
