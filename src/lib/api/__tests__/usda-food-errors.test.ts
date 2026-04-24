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
});
