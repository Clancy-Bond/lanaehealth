/**
 * Recipe builder form. Client component so we can dynamically add
 * ingredient rows without a server round-trip per row.
 */

import RecipeClient from "./RecipeClient";
import Link from "next/link";

export const metadata = { title: "New recipe - LanaeHealth" };

export default function NewRecipePage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        maxWidth: 820,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <Link
        href="/calories/search?view=my-recipes"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        &lsaquo; My recipes
      </Link>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>New recipe</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
          Add ingredients with calories + macros. We total them and
          divide by servings to get per-serving nutrition. Log the whole
          recipe from Recent or My Recipes.
        </p>
      </div>
      <RecipeClient />
    </div>
  );
}
