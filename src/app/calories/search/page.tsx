/**
 * Calories &raquo; Food Search
 *
 * MyNetDiary-equivalent food search navigator. Left sidebar with:
 *   Search, Staple Foods, Favorites, Frequent, Recent Meals,
 *   Custom Foods, Curated Recipes, My Recipes, My Meals.
 * Main panel renders results for the active view.
 *
 * URL params drive state (no client-side JS needed for the shell):
 *   ?view=search|favorites|frequent|recent|staple|custom|recipes|my-meals
 *   ?q=<search query>      (search view)
 *   ?meal=breakfast|lunch|dinner|snack (where to add-to on click)
 *
 * Search uses USDA FoodData Central (same source MyNetDiary runs on).
 * Favorites, Frequent, Recent all pull from food_entries history.
 */

import { createServiceClient } from "@/lib/supabase";
import { searchFoods, type FoodSearchResult } from "@/lib/api/usda-food";
import { CaloriesSubNav } from "@/components/calories/SubNav";
import { loadCustomFoods, type CustomFood } from "@/lib/calories/custom-foods";
import { loadRecipes, type Recipe } from "@/lib/calories/recipes";
import { loadFavorites, type Favorite } from "@/lib/calories/favorites";
import { loadMealTemplates, type MealTemplate } from "@/lib/calories/meal-templates";
import { SearchResultKebab } from "@/components/calories/SearchResultKebab";
import Link from "next/link";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

type View =
  | "search"
  | "staple"
  | "favorites"
  | "frequent"
  | "recent"
  | "custom"
  | "recipes"
  | "my-recipes"
  | "my-meals";

interface FoodEntryRow {
  id: string;
  food_items: string | null;
  calories: number | null;
  meal_type: string | null;
  logged_at: string;
}

// MFN parity: six tabs across the top of the Food search view, exact
// labels from MyNetDiary's web app (`food_search_recents.jpg`,
// `web_manage_custom_and_recipe.jpg`). We keep "staple" and "my-meals"
// routable via URL for backward compat with old links but do not show
// them as tabs.
const VIEWS: Array<{ key: View; label: string }> = [
  { key: "search", label: "Search" },
  { key: "favorites", label: "My Favorites" },
  { key: "frequent", label: "My Frequent Foods" },
  { key: "recent", label: "My Recent Meals" },
  { key: "custom", label: "My Custom Foods" },
  { key: "my-recipes", label: "My Recipes" },
];

// Popular staple foods matching MyNetDiary's "Popular [Meal] foods" lists.
// Each is seeded with a common portion and rounded USDA calorie estimate.
// Clicking a row runs a text search so the user can pick the exact USDA
// match (Foundation preferred thanks to our priority sort).
type Staple = { name: string; serving: string; cals: number };

const STAPLES: Record<"breakfast" | "lunch" | "dinner" | "snack", Staple[]> = {
  breakfast: [
    { name: "Orange juice, raw", serving: "1 cup", cals: 112 },
    { name: "Egg, scrambled with salt", serving: "1 large egg", cals: 105 },
    { name: "Egg, whole, raw", serving: "1 large egg", cals: 78 },
    { name: "Whole-wheat bread", serving: "1 slice", cals: 132 },
    { name: "Bananas, raw", serving: "1 medium", cals: 104 },
    { name: "Blueberries, raw", serving: "1 cup", cals: 83 },
    { name: "Coffee, black, no sugar", serving: "1 cup", cals: 2 },
    { name: "Milk, 2% fat", serving: "1 cup", cals: 122 },
    { name: "Oatmeal, cooked with water", serving: "1 cup", cals: 166 },
    { name: "Greek yogurt, plain, nonfat", serving: "1 cup", cals: 100 },
  ],
  lunch: [
    { name: "Turkey breast, roasted", serving: "3 oz", cals: 125 },
    { name: "Chicken breast, cooked", serving: "3 oz", cals: 140 },
    { name: "Tuna in water, canned", serving: "3 oz", cals: 99 },
    { name: "Avocado, raw", serving: "1/2 fruit", cals: 161 },
    { name: "Spinach, raw", serving: "2 cups", cals: 14 },
    { name: "Mixed salad greens", serving: "2 cups", cals: 16 },
    { name: "Tomato, raw", serving: "1 medium", cals: 22 },
    { name: "Whole-wheat bread", serving: "1 slice", cals: 132 },
    { name: "Quinoa, cooked", serving: "1 cup", cals: 222 },
    { name: "Hummus", serving: "2 tbsp", cals: 70 },
    { name: "Olive oil", serving: "1 tbsp", cals: 119 },
  ],
  dinner: [
    { name: "Salmon, atlantic, cooked", serving: "4 oz", cals: 234 },
    { name: "Chicken thigh, baked", serving: "3 oz", cals: 180 },
    { name: "Beef, ground 85%, cooked", serving: "3 oz", cals: 213 },
    { name: "Shrimp, cooked", serving: "3 oz", cals: 84 },
    { name: "Brown rice, cooked", serving: "1 cup", cals: 216 },
    { name: "Sweet potato, baked", serving: "1 medium", cals: 103 },
    { name: "Broccoli, steamed", serving: "1 cup", cals: 55 },
    { name: "Green beans, cooked", serving: "1 cup", cals: 44 },
    { name: "Kale, cooked", serving: "1 cup", cals: 36 },
    { name: "Lentils, cooked", serving: "1 cup", cals: 230 },
    { name: "Tofu, firm", serving: "4 oz", cals: 88 },
  ],
  snack: [
    { name: "Apple, raw", serving: "1 medium", cals: 95 },
    { name: "Almonds, raw", serving: "1 oz (23 nuts)", cals: 164 },
    { name: "Peanut butter", serving: "2 tbsp", cals: 188 },
    { name: "String cheese", serving: "1 piece", cals: 80 },
    { name: "Carrots, baby raw", serving: "1 cup", cals: 53 },
    { name: "Pickles, dill", serving: "1 spear", cals: 4 },
    { name: "Olives, green", serving: "10 olives", cals: 50 },
    { name: "Crackers, whole grain", serving: "5 crackers", cals: 90 },
    { name: "Dark chocolate, 70%", serving: "1 oz", cals: 170 },
    { name: "Electrolyte drink", serving: "12 oz", cals: 35 },
  ],
};

export default async function FoodSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; meal?: string }>;
}) {
  const params = await searchParams;
  const VALID_VIEWS = new Set<View>([
    "search",
    "staple",
    "favorites",
    "frequent",
    "recent",
    "custom",
    "recipes",
    "my-recipes",
    "my-meals",
  ]);
  const view: View = VALID_VIEWS.has(params.view as View)
    ? (params.view as View)
    : "search";
  const query = (params.q ?? "").trim();
  const mealParam = params.meal ?? "breakfast";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: 16,
        maxWidth: 1100,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      {/* Top sub-nav (Dashboard | Food | Analysis) + 6 MFN top tabs */}
      <CaloriesSubNav current="food" />

      <nav
        aria-label="Food search views"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-light)",
          overflowX: "auto",
        }}
      >
        {VIEWS.map((v) => {
          const active = v.key === view;
          const href = `/calories/search?view=${v.key}${mealParam ? `&meal=${mealParam}` : ""}`;
          return (
            <Link
              key={v.key}
              href={href}
              style={{
                padding: "12px 16px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                textDecoration: "none",
                color: active ? "var(--accent-sage)" : "var(--text-secondary)",
                borderBottom: active
                  ? "2px solid var(--accent-sage)"
                  : "2px solid transparent",
                whiteSpace: "nowrap",
              }}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link
          href="/calories/food"
          style={{
            fontSize: 12,
            color: "var(--accent-sage)",
            textDecoration: "none",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          &lsaquo; Back to meals
        </Link>
        <Link
          href="/calories/plan"
          style={{
            fontSize: 12,
            color: "var(--accent-sage)",
            textDecoration: "none",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Settings
        </Link>
      </div>

      {/* Meal picker chip row -- keeps the target meal visible and
          editable when the FAB lands here. */}
      <MealPicker view={view} query={query} selected={mealParam} />

      {/* MFN-style search input: label ABOVE the input, thin underline,
          no bordered card. Only shown for the Search view. */}
      {view === "search" && (
        <form
          action="/calories/search"
          method="get"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <input type="hidden" name="view" value="search" />
          {mealParam && <input type="hidden" name="meal" value={mealParam} />}
          <label
            htmlFor="food-search-q"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--accent-sage)",
            }}
          >
            Please enter food name, brand or restaurant name
          </label>
          <input
            id="food-search-q"
            type="text"
            name="q"
            defaultValue={query}
            autoFocus
            style={{
              padding: "6px 2px",
              fontSize: 16,
              border: "none",
              borderBottom: "1px solid var(--accent-sage)",
              background: "transparent",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </form>
      )}

      {/* View body */}
      <ViewBody view={view} query={query} mealParam={mealParam} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// View bodies
// ────────────────────────────────────────────────────────────────────

async function ViewBody({
  view,
  query,
  mealParam,
}: {
  view: View;
  query: string;
  mealParam: string;
}) {
  if (view === "search") {
    if (query.length < 2) {
      return (
        <EmptyHint
          title="Start typing a food"
          body="Search 1 million+ foods from USDA FoodData Central, the same database MyNetDiary uses. Brand names, restaurants, and generic foods all work."
        />
      );
    }
    let results: FoodSearchResult[] = [];
    let err: string | null = null;
    try {
      results = await searchFoods(query, 20);
    } catch (e) {
      err = e instanceof Error ? e.message : "Search failed.";
    }
    if (err) {
      return <EmptyHint title="Search unavailable" body={err} />;
    }
    if (results.length === 0) {
      return (
        <NoMatchFallback query={query} mealParam={mealParam} />
      );
    }
    // MFN parity: inject up to 5 matching recent foods at the top of
    // the search results, labelled so they visually separate from the
    // USDA catalog below.
    const recents = await findRecentMatches(query, 5);
    return <USDAResultList results={results} mealParam={mealParam} recents={recents} />;
  }

  if (view === "staple") {
    return <StapleList mealParam={mealParam} />;
  }

  if (view === "favorites") {
    return <FavoritesList mealParam={mealParam} />;
  }

  if (view === "frequent") {
    return <FrequentList mealParam={mealParam} />;
  }

  if (view === "recent") {
    return <RecentList mealParam={mealParam} />;
  }

  if (view === "custom") {
    return <CustomList mealParam={mealParam} />;
  }

  if (view === "recipes") {
    return (
      <EmptyHint
        title="Curated recipes"
        body="Condition-aware recipe collection (POTS sodium boosters, migraine-safe meals, endo anti-inflammatory). Coming in the next build pass."
      />
    );
  }

  if (view === "my-recipes") {
    return <MyRecipesList mealParam={mealParam} />;
  }

  if (view === "my-meals") {
    return <MyMealsList mealParam={mealParam} />;
  }

  return null;
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: "32px 20px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
        {body}
      </p>
    </div>
  );
}

function USDAResultList({
  results,
  mealParam,
  recents,
}: {
  results: FoodSearchResult[];
  mealParam: string;
  recents?: FoodSearchResult[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {recents && recents.length > 0 && (
        <>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--accent-sage)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "6px 4px 2px",
            }}
          >
            Recent
          </div>
          {recents.map((r) => (
            <SearchResultRow key={`rec-${r.fdcId}`} result={r} mealParam={mealParam} />
          ))}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "10px 4px 2px",
            }}
          >
            All matches
          </div>
        </>
      )}
      {results.map((r) => (
        <SearchResultRow key={r.fdcId} result={r} mealParam={mealParam} />
      ))}
    </div>
  );
}

// MFN parity: reuses food_entries to surface recent foods that match
// the current query at the top of the search results. We match on a
// naive case-insensitive substring against food_items, keyed on the
// base name (portion label in parentheses is stripped). Returns up
// to `limit` unique fdcIds; when a recent row lacks an fdcId we
// synthesize a name-only entry (no link).
async function findRecentMatches(query: string, limit: number): Promise<FoodSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("food_entries")
      .select("food_items, calories, logged_at")
      .not("food_items", "is", null)
      .order("logged_at", { ascending: false })
      .limit(200);
    const rows = ((data ?? []) as unknown) as Array<{
      food_items: string | null;
      calories: number | null;
    }>;
    const seen = new Set<string>();
    const hits: FoodSearchResult[] = [];
    for (const r of rows) {
      const full = (r.food_items ?? "").toLowerCase();
      if (!full.includes(q)) continue;
      const baseName = (r.food_items ?? "").split(" (")[0].trim();
      const key = baseName.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const match = (r.food_items ?? "").match(/fdcId (\d+)/i);
      const fdcId = match ? Number(match[1]) : 0;
      hits.push({
        fdcId: fdcId || -hits.length - 1, // negative sentinel if unknown fdcId
        description: baseName,
        brandName: null,
        dataType: "Recent",
        score: 0,
        calories: r.calories ?? null,
        servingSize: null,
        servingUnit: null,
        gtinUpc: null,
      });
      if (hits.length >= limit) break;
    }
    return hits;
  } catch {
    return [];
  }
}

function SearchResultRow({ result: r, mealParam }: { result: FoodSearchResult; mealParam: string }) {
  const hasFdc = r.fdcId > 0;
  const href = hasFdc
    ? `/calories/food/${r.fdcId}?meal=${mealParam}`
    : `/calories/search?view=search&meal=${mealParam}&q=${encodeURIComponent(r.description)}`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        color: "var(--text-primary)",
      }}
    >
      <Link
        href={href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: 1,
          minWidth: 0,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: "var(--accent-sage-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {"\u{1F34E}"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.description}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {r.brandName ? `${r.brandName} \u00B7 ` : ""}
            {r.dataType}
          </div>
        </div>
        {typeof r.calories === "number" && Number.isFinite(r.calories) && r.calories > 0 && (
          <span
            className="tabular"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--accent-sage)",
              marginRight: 4,
            }}
          >
            {r.calories}
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2, fontWeight: 600 }}>
              cals
            </span>
          </span>
        )}
      </Link>
      {hasFdc && (
        <SearchResultKebab fdcId={r.fdcId} description={r.description} mealParam={mealParam} />
      )}
    </div>
  );
}

function StapleList({ mealParam }: { mealParam: string }) {
  const mealKey = (["breakfast", "lunch", "dinner", "snack"] as const).includes(
    mealParam as "breakfast" | "lunch" | "dinner" | "snack",
  )
    ? (mealParam as "breakfast" | "lunch" | "dinner" | "snack")
    : "breakfast";
  const staples = STAPLES[mealKey];
  const label = mealKey.charAt(0).toUpperCase() + mealKey.slice(1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--accent-sage)",
          padding: "4px 10px 10px",
        }}
      >
        Popular {label} foods
      </div>
      {staples.map((item) => (
        <Link
          key={item.name}
          href={`/calories/search?view=search&q=${encodeURIComponent(item.name)}&meal=${mealParam}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.serving}</div>
          </div>
          <div
            className="tabular"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--accent-sage)",
            }}
          >
            {item.cals}
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginLeft: 3,
                fontWeight: 600,
              }}
            >
              cals
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function FavoritesList({ mealParam }: { mealParam: string }) {
  const log = await loadFavorites();
  if (log.entries.length === 0) {
    return (
      <EmptyHint
        title="No favorites yet"
        body="Star any food from its detail page to pin it here for one-tap access on future meals."
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {log.entries.map((f: Favorite) => (
        <Link
          key={f.fdcId}
          href={`/calories/food/${f.fdcId}?meal=${mealParam}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <span
            style={{
              fontSize: 18,
              color: "var(--accent-sage)",
            }}
            aria-hidden
          >
            &#9733;
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              USDA fdcId {f.fdcId}
            </div>
          </div>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>&rsaquo;</span>
        </Link>
      ))}
    </div>
  );
}

async function FrequentList({ mealParam }: { mealParam: string }) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("food_entries")
    .select("food_items, calories, meal_type, logged_at")
    .not("food_items", "is", null)
    .order("logged_at", { ascending: false })
    .limit(500);
  const rows = ((data ?? []) as unknown) as FoodEntryRow[];
  const groups = new Map<string, { count: number; cal: number; lastLogged: string }>();
  for (const r of rows) {
    const key = (r.food_items ?? "").trim().toLowerCase();
    if (!key) continue;
    const prev = groups.get(key);
    if (prev) {
      prev.count += 1;
      if (r.logged_at > prev.lastLogged) prev.lastLogged = r.logged_at;
    } else {
      groups.set(key, {
        count: 1,
        cal: r.calories ?? 0,
        lastLogged: r.logged_at,
      });
    }
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 30);
  if (sorted.length === 0) {
    return (
      <EmptyHint
        title="Nothing frequent yet"
        body="Log a few meals and your most-eaten foods will float to the top here."
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {sorted.map(([name, stats]) => (
        <Link
          key={name}
          href={`/calories/search?view=search&q=${encodeURIComponent(name)}&meal=${mealParam}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {name}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              logged{" "}
              <span className="tabular">{stats.count}</span> time
              {stats.count === 1 ? "" : "s"}
            </div>
          </div>
          <div className="tabular" style={{ fontSize: 15, fontWeight: 700 }}>
            {Math.round(stats.cal)}
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginLeft: 3,
                fontWeight: 600,
              }}
            >
              cals
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function RecentList({ mealParam }: { mealParam: string }) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("food_entries")
    .select("id, food_items, calories, meal_type, logged_at")
    .not("food_items", "is", null)
    .order("logged_at", { ascending: false })
    .limit(30);
  const rows = ((data ?? []) as unknown) as FoodEntryRow[];
  if (rows.length === 0) {
    return (
      <EmptyHint
        title="No recent meals yet"
        body="Meals you've logged in the last few days will appear here so you can re-add them with one tap."
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/calories/search?view=search&q=${encodeURIComponent(r.food_items ?? "")}&meal=${mealParam}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {r.food_items ?? "(unnamed)"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {r.meal_type ?? "meal"}{" "}
              &middot;{" "}
              {format(new Date(r.logged_at), "MMM d, h:mm a")}
            </div>
          </div>
          <div className="tabular" style={{ fontSize: 15, fontWeight: 700 }}>
            {Math.round(r.calories ?? 0)}
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginLeft: 3,
                fontWeight: 600,
              }}
            >
              cals
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function CustomList({ mealParam }: { mealParam: string }) {
  const log = await loadCustomFoods();
  if (log.entries.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <EmptyHint
          title="No custom foods yet"
          body="Restaurant meals, homemade recipes, rare brands. If USDA does not have it, create it here and reuse forever."
        />
        <Link
          href="/calories/custom-foods/new"
          className="press-feedback"
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            textAlign: "center",
          }}
        >
          + New custom food
        </Link>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Link
        href="/calories/custom-foods/new"
        className="press-feedback"
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          background: "var(--accent-sage-muted)",
          border: "1px dashed var(--accent-sage)",
          color: "var(--text-primary)",
          textDecoration: "none",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          textAlign: "center",
        }}
      >
        + New custom food
      </Link>
      {log.entries.map((f: CustomFood) => (
        <CustomRow key={f.id} food={f} mealParam={mealParam} />
      ))}
    </div>
  );
}

function CustomRow({ food, mealParam }: { food: CustomFood; mealParam: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{food.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{food.servingLabel}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="tabular" style={{ fontSize: 14, fontWeight: 700 }}>
          {Math.round(food.calories)}
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 3, fontWeight: 600 }}>
            cals
          </span>
        </div>
        <form action="/api/calories/custom-foods/log" method="post">
          <input type="hidden" name="customId" value={food.id} />
          <input type="hidden" name="meal_type" value={mealParam} />
          <button
            type="submit"
            style={{
              padding: "4px 12px",
              borderRadius: 8,
              background: "var(--accent-sage)",
              color: "var(--text-inverse)",
              fontSize: 10,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}

async function MyRecipesList({ mealParam }: { mealParam: string }) {
  const log = await loadRecipes();
  if (log.entries.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <EmptyHint
          title="No recipes yet"
          body="Build a recipe from ingredients. We total calories and macros, divide by servings, and save it so you can log the whole thing with one tap."
        />
        <Link
          href="/calories/recipes/new"
          className="press-feedback"
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            textAlign: "center",
          }}
        >
          + New recipe
        </Link>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Link
        href="/calories/recipes/new"
        className="press-feedback"
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          background: "var(--accent-sage-muted)",
          border: "1px dashed var(--accent-sage)",
          color: "var(--text-primary)",
          textDecoration: "none",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          textAlign: "center",
        }}
      >
        + New recipe
      </Link>
      {log.entries.map((r: Recipe) => (
        <RecipeRow key={r.id} recipe={r} mealParam={mealParam} />
      ))}
    </div>
  );
}

function RecipeRow({ recipe, mealParam }: { recipe: Recipe; mealParam: string }) {
  void mealParam;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{recipe.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {recipe.servings} servings &middot; {recipe.ingredients.length} ingredients
        </div>
      </div>
      <div className="tabular" style={{ fontSize: 14, fontWeight: 700 }}>
        {Math.round(recipe.perServing.calories)}
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 3, fontWeight: 600 }}>
          cal/serving
        </span>
      </div>
    </div>
  );
}

async function MyMealsList({ mealParam }: { mealParam: string }) {
  const log = await loadMealTemplates();
  if (log.entries.length === 0) {
    return (
      <EmptyHint
        title="No saved meals yet"
        body='Save a meal combo you eat often ("typical Tuesday breakfast") from the ⋮ menu on any meal header in the Food tab, then re-add it here with one tap.'
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {log.entries.map((t) => (
        <MealTemplateRow key={t.id} template={t} mealParam={mealParam} />
      ))}
    </div>
  );
}

function MealTemplateRow({
  template,
  mealParam,
}: {
  template: MealTemplate;
  mealParam: string;
}) {
  const totalCals = template.items.reduce((acc, i) => acc + i.calories, 0);
  const mealLabel = template.meal.charAt(0).toUpperCase() + template.meal.slice(1);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{template.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {mealLabel} &middot; {template.items.length} item
          {template.items.length === 1 ? "" : "s"} &middot;{" "}
          <span className="tabular">{Math.round(totalCals)} cal</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <form action="/api/calories/meal-templates/apply" method="post" style={{ margin: 0 }}>
          <input type="hidden" name="templateId" value={template.id} />
          <input type="hidden" name="targetMeal" value={mealParam} />
          <button
            type="submit"
            style={{
              padding: "4px 12px",
              borderRadius: 8,
              background: "var(--accent-sage)",
              color: "var(--text-inverse)",
              fontSize: 11,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Add to {mealParam}
          </button>
        </form>
        <form action="/api/calories/meal-templates/delete" method="post" style={{ margin: 0 }}>
          <input type="hidden" name="templateId" value={template.id} />
          <button
            type="submit"
            aria-label={`Remove "${template.name}" template`}
            title="Remove template"
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: 14,
              border: "1px solid var(--border-light)",
              cursor: "pointer",
            }}
          >
            <span aria-hidden>&times;</span>
          </button>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Meal picker + non-US fallback (polish, 2026-04-19)
// ────────────────────────────────────────────────────────────────────

const MEAL_CHIPS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

/**
 * Small chip row that lets the user retarget the meal without leaving
 * the search flow. Preserves ?view and ?q. Landing here from the FAB
 * means no meal is selected - the chip picker makes the default visible
 * and trivially editable (MyNetDiary never hides the meal target).
 */
function MealPicker({
  view,
  query,
  selected,
}: {
  view: View;
  query: string;
  selected: string;
}) {
  return (
    <div
      role="group"
      aria-label="Choose meal"
      style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          alignSelf: "center",
        }}
      >
        Add to
      </span>
      {MEAL_CHIPS.map((m) => {
        const active = m.key === selected;
        const params = new URLSearchParams({ view, meal: m.key });
        if (query) params.set("q", query);
        return (
          <Link
            key={m.key}
            href={`/calories/search?${params.toString()}`}
            aria-pressed={active}
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid",
              borderColor: active ? "var(--accent-sage)" : "var(--border-light)",
              background: active ? "var(--accent-sage)" : "var(--bg-card)",
              color: active ? "var(--text-inverse)" : "var(--text-secondary)",
            }}
          >
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * No-match fallback that respects the MyNetDiary US-centric-database
 * gripe flagged in docs/competitive/mynetdiary/user-reviews.md. Instead
 * of a dead-end "No results", offer an explicit custom-foods path so
 * non-US, homemade, or obscure foods have somewhere to go.
 *
 * Voice is neutral - we don't apologize, we don't blame the user, we
 * don't guess. Facts + next step, per the voice rule.
 */
function NoMatchFallback({
  query,
  mealParam,
}: {
  query: string;
  mealParam: string;
}) {
  return (
    <div
      style={{
        padding: "24px 20px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          No USDA match for &ldquo;{query}&rdquo;
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          USDA FoodData Central is US-centric, so international brands and
          homemade dishes sometimes aren&rsquo;t there yet. You have two
          good options.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link
          href={`/calories/custom-foods/new?name=${encodeURIComponent(query)}&meal=${mealParam}`}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          Add as custom food
        </Link>
        <Link
          href={`/calories/search?view=search&q=${encodeURIComponent(query.split(" ")[0] ?? "")}&meal=${mealParam}`}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-light)",
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          Try a shorter name
        </Link>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        Custom foods save to your library and rejoin search as your own
        entry - ideal for homemade recipes and non-US brands.
      </p>
    </div>
  );
}
