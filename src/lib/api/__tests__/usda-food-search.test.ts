/**
 * searchFoods regression cover (PR: fix-food-search).
 *
 * The user-facing bug ("USDA database doesn't seem to be connected")
 * traced to a contrast issue in SearchInput, not to the search itself.
 * Even so, we lock the search behavior so a future regression in the
 * data layer can't silently produce empty results: callers must
 * receive a non-empty FoodSearchResult[] when USDA returns hits, and
 * cache hits must be returned untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchFoods } from "../usda-food";

let cachedFn: () => Promise<{ data: unknown }> = async () => ({ data: null });
let upsertSpy = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gt: () => ({
              maybeSingle: async () => cachedFn(),
            }),
          }),
        }),
      }),
      upsert: (...args: unknown[]) => {
        upsertSpy(...args);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));

describe("searchFoods (live USDA path, mocked transport)", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.USDA_API_KEY = "TEST_KEY";
    cachedFn = async () => ({ data: null });
    upsertSpy = vi.fn();
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("returns at least one result for a populated USDA payload", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          foods: [
            {
              fdcId: 748967,
              description: "Eggs, Grade A, Large, egg whole",
              dataType: "Foundation",
              brandName: null,
              brandOwner: null,
              score: 338.2,
              servingSize: 50,
              servingSizeUnit: "g",
              gtinUpc: null,
              foodNutrients: [
                { nutrientId: 1008, value: 148 },
                { nutrientId: 1003, value: 12 },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const results = await searchFoods("egg", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].fdcId).toBe(748967);
    expect(results[0].calories).toBe(148);
    expect(results[0].dataType).toBe("Foundation");
  });

  it("returns the cached payload without hitting USDA when fresh", async () => {
    const cachedPayload = [
      {
        fdcId: 1,
        description: "Cached egg",
        dataType: "Foundation",
        brandName: null,
        score: 1,
        calories: 70,
        servingSize: null,
        servingUnit: null,
        gtinUpc: null,
      },
    ];
    cachedFn = async () => ({ data: { response_json: cachedPayload } });
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const results = await searchFoods("egg", 5);
    expect(results).toEqual(cachedPayload);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("priority-sorts Foundation above Branded results", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          foods: [
            {
              fdcId: 999,
              description: "Branded thing",
              dataType: "Branded",
              brandOwner: "Brand",
              score: 999,
              foodNutrients: [{ nutrientId: 1008, value: 200 }],
            },
            {
              fdcId: 100,
              description: "Whole food",
              dataType: "Foundation",
              score: 100,
              foodNutrients: [{ nutrientId: 1008, value: 50 }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const results = await searchFoods("thing", 5);
    expect(results[0].dataType).toBe("Foundation");
    expect(results[0].fdcId).toBe(100);
  });
});
