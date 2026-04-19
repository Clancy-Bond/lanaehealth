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

const VIEWS: Array<{ key: View; label: string; icon: string }> = [
  { key: "search", label: "Search", icon: "\u{1F50D}" },
  { key: "staple", label: "Staple Foods", icon: "\u{1F4C1}" },
  { key: "favorites", label: "Favorites", icon: "\u{2B50}" },
  { key: "frequent", label: "Frequent Foods", icon: "\u{1F501}" },
  { key: "recent", label: "Recent Meals", icon: "\u{1F559}" },
  { key: "custom", label: "Custom Foods", icon: "\u{1F958}" },
  { key: "recipes", label: "Curated Recipes", icon: "\u{1F4D6}" },
  { key: "my-recipes", label: "My Recipes", icon: "\u{1F4DD}" },
  { key: "my-meals", label: "My Meals", icon: "\u{1F37D}" },
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
  const view: View =
    (VIEWS.find((v) => v.key === params.view)?.key as View | undefined) ?? "search";
  const query = (params.q ?? "").trim();
  const mealParam = params.meal ?? "breakfast";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 20,
        padding: 16,
        maxWidth: 1200,
        margin: "0 auto",
        paddingBottom: 96,
      }}
      className="food-search-layout"
    >
      {/* Left sidebar */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "4px 10px",
            marginBottom: 4,
          }}
        >
          Navigator
        </div>
        {VIEWS.map((v) => {
          const active = v.key === view;
          const href = `/calories/search?view=${v.key}${mealParam ? `&meal=${mealParam}` : ""}`;
          return (
            <Link
              key={v.key}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                background: active ? "var(--accent-sage-muted)" : "transparent",
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 14 }}>{v.icon}</span>
              <span>{v.label}</span>
            </Link>
          );
        })}
      </aside>

      {/* Main panel */}
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Link
            href="/calories/food"
            style={{
              fontSize: 12,
              color: "var(--accent-sage)",
              textDecoration: "none",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            &lsaquo; Back to meals
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {VIEWS.find((v) => v.key === view)?.label}
          </h1>
          <CaloriesSubNav current="food" />
        </div>

        {/* Search form */}
        <form
          action="/calories/search"
          method="get"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "8px 12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 10,
          }}
        >
          <input type="hidden" name="view" value="search" />
          {mealParam && <input type="hidden" name="meal" value={mealParam} />}
          <span style={{ fontSize: 14, color: "var(--text-muted)" }} aria-hidden>
            {"\u{1F50D}"}
          </span>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="food name, brand, or restaurant"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "4px 14px",
              borderRadius: 8,
              background: "var(--accent-sage)",
              color: "var(--text-inverse)",
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Search
          </button>
        </form>

        {/* View body */}
        <ViewBody view={view} query={query} mealParam={mealParam} />
      </main>

      <style>{`
        @media (max-width: 767px) {
          .food-search-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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
        <EmptyHint
          title="No matches"
          body={`No USDA foods match "${query}". Try a shorter or more general name.`}
        />
      );
    }
    return <USDAResultList results={results} mealParam={mealParam} />;
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
    return (
      <EmptyHint
        title="Meal templates"
        body='Save a meal combo you eat often ("typical Tuesday breakfast") and add it with one tap. Coming in the next build pass.'
      />
    );
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
}: {
  results: FoodSearchResult[];
  mealParam: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {results.map((r) => (
        <Link
          key={r.fdcId}
          href={`/calories/food/${r.fdcId}?meal=${mealParam}`}
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          >
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      ))}
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
