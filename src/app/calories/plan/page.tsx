/**
 * Calories &raquo; Plan
 *
 * Editable calorie + macro + weight goal editor. Values persist to
 * health_profile.section='nutrition_goals'.
 *
 * Layout mirrors MyNetDiary's Plan tab but with LanaeHealth's
 * condition-aware defaults baked in (POTS sodium 3000mg, not the
 * generic 2300mg guideline).
 */

import { loadNutritionGoals } from "@/lib/calories/goals";
import { CaloriesSubNav } from "@/components/calories/SubNav";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary (desk, minimal movement)",
  light: "Light (walking, light housework)",
  moderate: "Moderate (3-4 workouts/week)",
  active: "Active (daily exercise)",
  very_active: "Very Active (intense training)",
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const showSaved = sp.saved === "1";
  const goals = await loadNutritionGoals();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: "16px",
        maxWidth: 820,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      {/* Breadcrumb */}
      <Link
        href="/calories"
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path
            d="M12.5 5L7.5 10L12.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Calories
      </Link>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Calories &middot; Plan
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          Goals &amp; targets
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          Editable. Values here drive the Calorie Budget on the dashboard and
          the macro targets in the food log. Defaults match what Lanae sees
          in MyNetDiary so the numbers line up across apps.
        </p>
        <CaloriesSubNav current="dashboard" />
      </div>

      {showSaved && (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--accent-sage-muted)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid var(--accent-sage)",
          }}
        >
          Saved. New targets are live on the dashboard.
        </div>
      )}

      <form
        action="/api/calories/plan"
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        {/* Calorie target */}
        <Section title="Calorie target">
          <NumberField
            label="Daily calories"
            name="calorieTarget"
            defaultValue={goals.calorieTarget}
            min={800}
            max={5000}
            step={1}
            unit="cal"
            hint="MyNetDiary's default for Lanae is 1761 cal/day."
          />
        </Section>

        {/* Macros */}
        <Section title="Macronutrients">
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-secondary)",
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            <input
              type="checkbox"
              name="macrosManual"
              value="true"
              defaultChecked={goals.macrosManual}
            />
            Manual macro grams (otherwise auto-split 45/20/35 from calories)
          </label>
          <Grid>
            <NumberField
              label="Carbs"
              name="carbsG"
              defaultValue={goals.macros.carbsG}
              min={0}
              max={600}
              unit="g"
            />
            <NumberField
              label="Protein"
              name="proteinG"
              defaultValue={goals.macros.proteinG}
              min={0}
              max={400}
              unit="g"
            />
            <NumberField
              label="Fat"
              name="fatG"
              defaultValue={goals.macros.fatG}
              min={0}
              max={300}
              unit="g"
            />
            <NumberField
              label="Fiber"
              name="fiberG"
              defaultValue={goals.macros.fiberG}
              min={0}
              max={100}
              unit="g"
              hint="25g is the general adult target. Chronic IBS may tolerate less at first."
            />
            <NumberField
              label="Sodium"
              name="sodiumMg"
              defaultValue={goals.macros.sodiumMg}
              min={500}
              max={15000}
              unit="mg"
              hint="POTS-adjusted: 3000-10000 mg/day supports blood volume. Generic guideline is 2300 mg."
            />
            <NumberField
              label="Calcium"
              name="calciumMg"
              defaultValue={goals.macros.calciumMg}
              min={0}
              max={3000}
              unit="mg"
            />
          </Grid>
        </Section>

        {/* Weight */}
        <Section title="Weight plan">
          <Grid>
            <NumberField
              label="Current weight"
              name="currentKg"
              defaultValue={goals.weight.currentKg ?? ""}
              min={20}
              max={400}
              step={0.1}
              unit="kg"
              hint="Optional. Leave blank if you'd rather not set one."
            />
            <NumberField
              label="Target weight"
              name="targetKg"
              defaultValue={goals.weight.targetKg ?? ""}
              min={20}
              max={400}
              step={0.1}
              unit="kg"
            />
            <DateField
              label="Target date"
              name="targetDate"
              defaultValue={goals.weight.targetDate ?? ""}
              hint="When you'd like to reach the target. Used for the weight plan chart."
            />
          </Grid>
        </Section>

        {/* Activity level */}
        <Section title="Activity level">
          <select
            name="activityLevel"
            defaultValue={goals.activityLevel}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border-light)",
              background: "white",
              fontSize: 14,
              width: "100%",
              maxWidth: 420,
            }}
          >
            {Object.entries(ACTIVITY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Section>

        <button
          type="submit"
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            boxShadow: "var(--shadow-md)",
            alignSelf: "flex-start",
          }}
        >
          Save targets
        </button>
      </form>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px 18px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  min,
  max,
  step = 1,
  unit,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: number | string;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-light)",
          background: "white",
        }}
      >
        <input
          type="number"
          name={name}
          defaultValue={defaultValue}
          min={min}
          max={max}
          step={step}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 15,
            fontWeight: 600,
            background: "transparent",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
          {unit}
        </span>
      </div>
      {hint && (
        <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function DateField({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </span>
      <input
        type="date"
        name={name}
        defaultValue={defaultValue}
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-light)",
          background: "white",
          fontSize: 14,
        }}
      />
      {hint && (
        <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
    </label>
  );
}
