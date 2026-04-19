/**
 * Calories &raquo; Food detail page
 *
 * Shows full USDA nutrient profile for one fdcId, with a portion /
 * serving selector and "Add to [meal]" action. Mirrors what Lanae
 * sees when she taps a food in MyNetDiary's search result.
 *
 * URL: /calories/food/[fdcId]?meal=breakfast&servings=1
 * fdcId = USDA FoodData Central id.
 * Server component. No client state needed for v1.
 */

import { getFoodNutrients, analyzeIronAbsorption, type FoodNutrients } from "@/lib/api/usda-food";
import { scaleNutrientsToGrams, type FoodPortion } from "@/lib/api/usda-portions";
import { gradeFood, gradeColor } from "@/lib/calories/food-grade";
import { isFavorited } from "@/lib/calories/favorites";
import { FdaNutritionFacts } from "@/components/calories/FdaNutritionFacts";
import Link from "next/link";

export const dynamic = "force-dynamic";

function parseServings(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(20, n);
}

function parseGramsPerUnit(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10000, n);
}

function parseMeal(raw: string | undefined): "breakfast" | "lunch" | "dinner" | "snack" {
  const v = (raw ?? "breakfast").toLowerCase();
  if (v === "lunch" || v === "dinner" || v === "snack") return v;
  return "breakfast";
}

// Scale a nutrient value by the effective gram ratio, rounding for display.
function s(value: number | null, ratio: number, digits = 0): string {
  if (value === null) return "\u2014";
  return (value * ratio).toFixed(digits);
}

// Pick the portion whose gramWeight matches the URL param. Falls back
// to the first portion in the list (which is USDA's own first entry
// for Foundation foods; 100g fallback otherwise).
function resolvePortion(
  portions: FoodPortion[],
  gramsPerUnit: number | null,
): FoodPortion | null {
  if (portions.length === 0) return null;
  if (gramsPerUnit === null) return portions[0];
  const match = portions.find((p) => Math.abs(p.gramWeight - gramsPerUnit) < 0.5);
  return match ?? portions[0];
}

export default async function FoodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ fdcId: string }>;
  searchParams: Promise<{ meal?: string; servings?: string; gramsPerUnit?: string }>;
}) {
  const { fdcId: fdcIdRaw } = await params;
  const sp = await searchParams;
  const fdcId = Number(fdcIdRaw);
  const servings = parseServings(sp.servings);
  const gramsPerUnitParam = parseGramsPerUnit(sp.gramsPerUnit);
  const meal = parseMeal(sp.meal);

  let nutrients: FoodNutrients | null = null;
  let err: string | null = null;
  try {
    nutrients = await getFoodNutrients(fdcId);
  } catch (e) {
    err = e instanceof Error ? e.message : "Failed to load food.";
  }

  if (err || !nutrients) {
    return (
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        <Link href="/calories/search" style={{ fontSize: 13, color: "var(--text-muted)" }}>
          &lsaquo; Back to search
        </Link>
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Food not found</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {err ?? "USDA could not return this item."}
          </p>
        </div>
      </div>
    );
  }

  const portions = nutrients.portions ?? [];
  const selectedPortion = resolvePortion(portions, gramsPerUnitParam);
  const servingSizeG = nutrients.servingSize ?? 100;
  const perUnitG = selectedPortion ? selectedPortion.gramWeight : servingSizeG;
  const gramsEaten = perUnitG * servings;
  // Display ratio: per-servingSize nutrients scaled to gramsEaten.
  const mult = servingSizeG > 0 ? gramsEaten / servingSizeG : servings;
  const iron = analyzeIronAbsorption(nutrients);
  const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);
  const favorited = await isFavorited(fdcId).catch(() => false);
  const scaledForGrade = scaleNutrientsToGrams(
    {
      calories: nutrients.calories,
      protein: nutrients.protein,
      fat: nutrients.fat,
      carbs: nutrients.carbs,
      fiber: nutrients.fiber,
      sugar: nutrients.sugar,
      sodium: nutrients.sodium,
      iron: nutrients.iron,
      calcium: nutrients.calcium,
      vitaminC: nutrients.vitaminC,
      omega3: nutrients.omega3,
    },
    servingSizeG,
    gramsEaten,
  );
  const grade = gradeFood({
    ...scaledForGrade,
    description: nutrients.description,
  });

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 860,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        paddingBottom: 96,
      }}
    >
      {/* Breadcrumb */}
      <Link
        href={`/calories/search?meal=${meal}`}
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        &lsaquo; Back to search
      </Link>

      {/* Hero */}
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent-sage)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 4,
          }}
        >
          USDA &middot; fdcId {nutrients.fdcId}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, margin: 0, flex: 1 }}>
            {nutrients.description}
          </h1>
          {/* Favorite star toggle (MFN parity GAP #10) */}
          <form action="/api/calories/favorites/toggle" method="post" style={{ display: "inline" }}>
            <input type="hidden" name="fdcId" value={nutrients.fdcId} />
            <input type="hidden" name="name" value={nutrients.description} />
            <input type="hidden" name="returnTo" value={`/calories/food/${nutrients.fdcId}?meal=${meal}&servings=${servings}&gramsPerUnit=${perUnitG}`} />
            <button
              type="submit"
              aria-label={favorited ? "Unstar this food" : "Star this food"}
              style={{
                width: 40,
                height: 40,
                padding: 0,
                borderRadius: 10,
                background: favorited ? "var(--accent-sage-muted)" : "var(--bg-card)",
                border: favorited ? "1px solid var(--accent-sage)" : "1px solid var(--border-light)",
                cursor: "pointer",
                fontSize: 20,
                color: favorited ? "var(--accent-sage)" : "var(--text-muted)",
                lineHeight: 1,
              }}
            >
              {favorited ? "\u2605" : "\u2606"}
            </button>
          </form>
        </div>
        {nutrients.servingSize !== null && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Serving: {nutrients.servingSize}
            {nutrients.servingUnit ?? "g"} per reference portion
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 10,
              background: gradeColor(grade.grade),
              color: "var(--text-inverse)",
              fontSize: 22,
              fontWeight: 800,
            }}
            title={`Food grade ${grade.grade} (score ${grade.score}/100)`}
          >
            {grade.grade}
          </span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Food quality grade
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {grade.reasons
                .slice(0, 3)
                .map((r) => `${r.sign}${r.text}`)
                .join(" \u00B7 ")}
            </div>
          </div>
        </div>
      </div>

      {/* Portion + Add row - two sibling forms (not nested) because
          nested <form> elements are invalid HTML and caused a React
          hydration error #418 in production. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Portion selector form (GET, re-renders the page with
            ?servings=X&gramsPerUnit=Y) */}
        <form
          action={`/calories/food/${fdcId}`}
          method="get"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            flex: "1 1 auto",
          }}
        >
          <input type="hidden" name="meal" value={meal} />
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Amount
          </label>
          <input
            type="number"
            step="0.25"
            min="0.25"
            max="20"
            name="servings"
            defaultValue={servings}
            aria-label="Amount"
            style={{
              width: 72,
              padding: "6px 10px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid var(--border-light)",
              background: "white",
            }}
          />
          <select
            name="gramsPerUnit"
            defaultValue={selectedPortion?.gramWeight ?? ""}
            aria-label="Portion"
            style={{
              padding: "6px 10px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid var(--border-light)",
              background: "white",
              minWidth: 160,
            }}
          >
            {portions.map((p) => (
              <option key={`${p.label}-${p.gramWeight}`} value={p.gramWeight}>
                {p.label} · {Math.round(p.gramWeight)} g
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              background: "var(--accent-sage-muted)",
              color: "var(--text-primary)",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Recalc
          </button>
          <span
            className="tabular"
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            ≈ {Math.round(gramsEaten)} g total
          </span>
        </form>
        {/* Separate Add form (POST). Mirrors whatever portion + amount
            the Recalc form produced (both are driven by the URL). */}
        <form
          action={`/api/food/log`}
          method="post"
          style={{ display: "inline-flex", marginLeft: "auto" }}
        >
          <input type="hidden" name="fdcId" value={fdcId} />
          <input type="hidden" name="meal_type" value={meal} />
          <input type="hidden" name="servings" value={servings} />
          <input type="hidden" name="gramsPerUnit" value={perUnitG} />
          {selectedPortion && (
            <input type="hidden" name="portionLabel" value={selectedPortion.label} />
          )}
          <button
            type="submit"
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 10,
              background: "var(--accent-sage)",
              color: "var(--text-inverse)",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Add to {mealLabel}
          </button>
        </form>
      </div>

      {/* 2-column below the portion picker:
          left = our existing macro breakdown + micronutrient grid,
          right = MFN-style FDA Nutrition Facts card. */}
      <div
        className="food-detail-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* Big macro tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <BigStatTile
              label="Calories"
              value={s(nutrients.calories, mult, 0)}
              unit="kcal"
              accent="var(--accent-sage)"
            />
            <BigStatTile label="Protein" value={s(nutrients.protein, mult, 1)} unit="g" />
            <BigStatTile label="Carbs" value={s(nutrients.carbs, mult, 1)} unit="g" />
            <BigStatTile label="Total fat" value={s(nutrients.fat, mult, 1)} unit="g" />
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <FdaNutritionFacts
            servingLabel={`${servings}× ${selectedPortion?.label ?? `${servingSizeG} g`} · ${Math.round(gramsEaten)} g`}
            calories={nutrients.calories !== null ? nutrients.calories * mult : null}
            totalFat={nutrients.fat !== null ? nutrients.fat * mult : null}
            satFat={null}
            transFat={null}
            sodium={nutrients.sodium !== null ? nutrients.sodium * mult : null}
            totalCarbs={nutrients.carbs !== null ? nutrients.carbs * mult : null}
            fiber={nutrients.fiber !== null ? nutrients.fiber * mult : null}
            sugar={nutrients.sugar !== null ? nutrients.sugar * mult : null}
            protein={nutrients.protein !== null ? nutrients.protein * mult : null}
            iron={nutrients.iron !== null ? nutrients.iron * mult : null}
            calcium={nutrients.calcium !== null ? nutrients.calcium * mult : null}
            vitaminC={nutrients.vitaminC !== null ? nutrients.vitaminC * mult : null}
            vitaminD={nutrients.vitaminD !== null ? nutrients.vitaminD * mult : null}
            potassium={nutrients.potassium !== null ? nutrients.potassium * mult : null}
            gradeLetter={grade.grade}
          />
        </div>
        <style>{`
          @media (max-width: 900px) {
            .food-detail-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>

      {/* Detail grid */}
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 10,
          }}
        >
          Macros &amp; micronutrients (for {servings}× {selectedPortion?.label ?? `${servingSizeG} g`} · {Math.round(gramsEaten)} g)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            fontSize: 13,
          }}
        >
          <Row label="Fiber" value={s(nutrients.fiber, mult, 1)} unit="g" />
          <Row label="Sugar" value={s(nutrients.sugar, mult, 1)} unit="g" />
          <Row label="Sodium" value={s(nutrients.sodium, mult, 0)} unit="mg" />
          <Row label="Calcium" value={s(nutrients.calcium, mult, 0)} unit="mg" />
          <Row label="Iron" value={s(nutrients.iron, mult, 1)} unit="mg" />
          <Row label="Vitamin C" value={s(nutrients.vitaminC, mult, 1)} unit="mg" />
          <Row label="Vitamin D" value={s(nutrients.vitaminD, mult, 1)} unit="mcg" />
          <Row label="Vitamin B12" value={s(nutrients.vitaminB12, mult, 2)} unit="mcg" />
          <Row label="Magnesium" value={s(nutrients.magnesium, mult, 0)} unit="mg" />
          <Row label="Zinc" value={s(nutrients.zinc, mult, 2)} unit="mg" />
          <Row label="Potassium" value={s(nutrients.potassium, mult, 0)} unit="mg" />
          <Row label="Omega-3" value={s(nutrients.omega3, mult, 2)} unit="g" />
          <Row label="Folate" value={s(nutrients.folate, mult, 0)} unit="mcg" />
        </div>
      </div>

      {/* Iron absorption context (existing analyzeIronAbsorption helper) */}
      {iron && (iron.ironContent ?? 0) > 0.5 && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "var(--accent-sage-muted)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 11, color: "var(--accent-sage)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
            Iron absorption context (for endo / chronic anemia)
          </div>
          <div>
            {iron.ironContent?.toFixed(1) ?? '0'} mg iron per serving &middot;{" "}
            {iron.isHemeIron ? "heme (better absorbed)" : "non-heme"} &middot;{" "}
            net absorption: <strong>{iron.netAbsorptionScore}</strong>
          </div>
          {iron.absorptionEnhancers.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              Enhancers: {iron.absorptionEnhancers.join(", ")}
            </div>
          )}
          {iron.absorptionInhibitors.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Inhibitors: {iron.absorptionInhibitors.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BigStatTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span
        className="tabular"
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: accent ?? "var(--text-primary)",
        }}
      >
        {value}
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginLeft: 4,
            fontWeight: 600,
          }}
        >
          {unit}
        </span>
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "6px 8px",
        borderRadius: 8,
        background: "var(--bg-primary)",
      }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="tabular" style={{ fontWeight: 600 }}>
        {value}
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 3 }}>
          {unit}
        </span>
      </span>
    </div>
  );
}
