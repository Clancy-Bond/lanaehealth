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

  // Helper: mock /food/{id} 404 then /foods/search empty (no fallback hit).
  function mockNotFoundEverywhere() {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/foods/search')) {
        return new Response(JSON.stringify({ foods: [] }), { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
  }

  it("throws UsdaFoodNotFoundError when /food/{id} 404s AND search fallback empty", async () => {
    mockNotFoundEverywhere();
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
    mockNotFoundEverywhere();
    try {
      await getFoodNutrients(2099999);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UsdaFoodNotFoundError);
      expect((e as UsdaFoodNotFoundError).fdcId).toBe(2099999);
    }
  });

  // The user-reported regression. When USDA serves a Foundation food
  // through /foods/search but 404s the same fdcId on /food/{id}, we
  // must not surface "Food not found" -- we should hydrate from the
  // search payload's embedded foodNutrients.
  it("falls back to /foods/search when /food/{id} 404s and search has the food", async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/food/748967')) {
        return new Response("", { status: 404 });
      }
      if (u.includes('/foods/search')) {
        return new Response(JSON.stringify({
          foods: [{
            fdcId: 748967,
            description: "Eggs, Grade A, Large, egg whole",
            dataType: "Foundation",
            foodNutrients: [
              { nutrientId: 1008, value: 148 },
              { nutrientId: 1003, value: 12.4 },
              { nutrientId: 1005, value: 1.0 },
              { nutrientId: 1004, value: 9.96 },
              { nutrientId: 1089, value: 1.67 },
              { nutrientId: 1093, value: 129 },
              { nutrientId: 1087, value: 48 },
            ],
          }],
        }), { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await getFoodNutrients(748967);
    expect(result.fdcId).toBe(748967);
    expect(result.description).toBe("Eggs, Grade A, Large, egg whole");
    expect(result.calories).toBe(148);
    expect(result.protein).toBe(12.4);
    expect(result.fat).toBe(10);
    expect(result.iron).toBe(1.7);
    // Search payload has no servingSize for Foundation foods; we
    // default to 100g so the per-100g nutrients line up.
    expect(result.servingSize).toBe(100);
    expect(result.servingUnit).toBe("g");
    // 100g fallback portion is always appended even when foodPortions absent.
    expect(result.portions.length).toBeGreaterThanOrEqual(1);
    expect(result.portions[result.portions.length - 1].label).toBe("100 g");
  });

  it("does not fall back when search returns a stub (no nutrients)", async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/food/')) return new Response("", { status: 404 });
      if (u.includes('/foods/search')) {
        return new Response(JSON.stringify({
          foods: [{ fdcId: 555, description: "Stub", foodNutrients: [] }],
        }), { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    await expect(getFoodNutrients(555)).rejects.toBeInstanceOf(UsdaFoodNotFoundError);
  });
});
