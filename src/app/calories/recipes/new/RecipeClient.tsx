"use client";

import { useState } from "react";

interface Ingredient {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sodium: string;
}

const blank = (): Ingredient => ({
  name: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  sodium: "",
});

export default function RecipeClient() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([blank(), blank(), blank()]);

  const addRow = () => setIngredients((prev) => [...prev, blank()]);
  const removeRow = (i: number) =>
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof Ingredient, value: string) =>
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, [field]: value } : ing)));

  // Preview totals.
  const totalCals = ingredients.reduce((acc, i) => acc + (Number(i.calories) || 0), 0);
  const totalProtein = ingredients.reduce((acc, i) => acc + (Number(i.protein) || 0), 0);
  const totalCarbs = ingredients.reduce((acc, i) => acc + (Number(i.carbs) || 0), 0);
  const totalFat = ingredients.reduce((acc, i) => acc + (Number(i.fat) || 0), 0);

  return (
    <form
      action="/api/calories/recipes"
      method="post"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px",
          gap: 12,
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Recipe name</span>
          <input type="text" name="name" required placeholder="Slow-cooker chicken soup" style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Servings</span>
          <input type="number" min="1" max="100" step="1" name="servings" defaultValue={4} required style={inputStyle} />
        </label>
      </section>

      <section
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <span style={labelStyle}>Ingredients</span>
          <button
            type="button"
            onClick={addRow}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent-sage)",
              textDecoration: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            + Add row
          </button>
        </div>

        {ingredients.map((ing, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(140px, 2fr) repeat(5, minmax(60px, 1fr)) 28px",
              gap: 6,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              name="ingredientName"
              placeholder="ingredient"
              value={ing.name}
              onChange={(e) => update(i, "name", e.target.value)}
              style={rowInput}
            />
            <input
              type="number"
              min="0"
              step="0.1"
              name="ingredientCalories"
              placeholder="cal"
              value={ing.calories}
              onChange={(e) => update(i, "calories", e.target.value)}
              style={rowInput}
            />
            <input
              type="number"
              min="0"
              step="0.1"
              name="ingredientProtein"
              placeholder="P"
              value={ing.protein}
              onChange={(e) => update(i, "protein", e.target.value)}
              style={rowInput}
            />
            <input
              type="number"
              min="0"
              step="0.1"
              name="ingredientCarbs"
              placeholder="C"
              value={ing.carbs}
              onChange={(e) => update(i, "carbs", e.target.value)}
              style={rowInput}
            />
            <input
              type="number"
              min="0"
              step="0.1"
              name="ingredientFat"
              placeholder="F"
              value={ing.fat}
              onChange={(e) => update(i, "fat", e.target.value)}
              style={rowInput}
            />
            <input
              type="number"
              min="0"
              step="0.1"
              name="ingredientSodium"
              placeholder="Na"
              value={ing.sodium}
              onChange={(e) => update(i, "sodium", e.target.value)}
              style={rowInput}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label="Remove row"
              disabled={ingredients.length <= 1}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "transparent",
                border: "1px solid var(--border-light)",
                color: "var(--text-muted)",
                cursor: ingredients.length <= 1 ? "default" : "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              &times;
            </button>
          </div>
        ))}

        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--border-light)",
          }}
        >
          <span>
            Totals:{" "}
            <span className="tabular" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              {Math.round(totalCals)}
            </span>{" "}
            cal
          </span>
          <span>
            P <span className="tabular">{totalProtein.toFixed(1)}g</span>
          </span>
          <span>
            C <span className="tabular">{totalCarbs.toFixed(1)}g</span>
          </span>
          <span>
            F <span className="tabular">{totalFat.toFixed(1)}g</span>
          </span>
        </div>
      </section>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={labelStyle}>Notes (optional)</span>
        <textarea
          name="notes"
          rows={3}
          placeholder="prep time, swaps, variations..."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

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
        Save recipe
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border-light)",
  fontSize: 14,
  background: "white",
};

const rowInput: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--border-light)",
  fontSize: 12,
  background: "white",
  minWidth: 0,
};
