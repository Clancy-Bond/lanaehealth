/**
 * Create a custom food. Simple nutrition-label entry form.
 *
 * Accepts optional `?name=` and `?meal=` params so the "No USDA match"
 * fallback on /calories/search can hand off the query as a prefilled
 * starter - Lanae types her query once, not twice.
 */

import Link from "next/link";

export const metadata = { title: "New custom food - LanaeHealth" };

export default async function NewCustomFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; meal?: string }>;
}) {
  const sp = await searchParams;
  const prefilledName = (sp.name ?? "").trim();
  const meal = sp.meal ?? "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 16,
        maxWidth: 700,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <Link
        href="/calories/search?view=custom"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        &lsaquo; Custom foods
      </Link>

      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>New custom food</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
          Enter the nutrition facts from a label, menu, or recipe. Save once; log from Recent or Frequent afterward.
        </p>
      </div>

      <form
        action="/api/calories/custom-foods"
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {meal && <input type="hidden" name="returnMeal" value={meal} />}
        <Field
          label="Food name"
          name="name"
          placeholder="Grandma's chicken soup"
          defaultValue={prefilledName}
          required
        />
        <Field label="Serving label" name="servingLabel" placeholder="1 bowl, 1 cup, 100 g..." required />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <NumField label="Calories" name="calories" unit="kcal" required />
          <NumField label="Protein" name="protein" unit="g" />
          <NumField label="Carbs" name="carbs" unit="g" />
          <NumField label="Fat" name="fat" unit="g" />
          <NumField label="Fiber" name="fiber" unit="g" />
          <NumField label="Sugar" name="sugar" unit="g" />
          <NumField label="Sodium" name="sodium" unit="mg" />
          <NumField label="Calcium" name="calcium" unit="mg" />
          <NumField label="Iron" name="iron" unit="mg" />
        </div>

        <Field label="Notes (optional)" name="notes" placeholder="prep time, source, variants..." />

        <button
          type="submit"
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            alignSelf: "flex-start",
          }}
        >
          Save food
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
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
        {required && <span style={{ color: "var(--accent-blush)" }}> *</span>}
      </span>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--border-light)",
          fontSize: 14,
          background: "white",
        }}
      />
    </label>
  );
}

function NumField({
  label,
  name,
  unit,
  required,
}: {
  label: string;
  name: string;
  unit: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
        {required && <span style={{ color: "var(--accent-blush)" }}> *</span>}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-light)",
          background: "white",
        }}
      >
        <input
          type="number"
          step="0.01"
          min="0"
          name={name}
          required={required}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 14,
            fontWeight: 600,
            background: "transparent",
            minWidth: 0,
          }}
        />
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{unit}</span>
      </div>
    </label>
  );
}
