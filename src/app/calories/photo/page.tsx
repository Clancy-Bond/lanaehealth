/**
 * Calories &raquo; Photo log
 *
 * AI meal photo identification (MyFitnessPal "Meal Scan" / Lose It
 * "Snap It" pattern, but free). Uses the existing /api/food/identify
 * endpoint that calls Claude Vision and enriches with USDA nutrients.
 *
 * Client component: file upload -> base64 -> identify -> confirm.
 */

import PhotoClient from "./PhotoClient";
import Link from "next/link";
import { CaloriesSubNav } from "@/components/calories/SubNav";

export const dynamic = "force-dynamic";

export default function PhotoPage() {
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
      <Link href="/calories" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        &lsaquo; Calories
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Calories &middot; Photo log
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Snap a meal</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
          Take or upload a photo of your meal. Claude Vision identifies
          every visible food, estimates portions and calories, and
          pulls USDA nutrient data for each item. Review, tweak, and
          add to your log.
        </p>
        <CaloriesSubNav current="food" />
      </div>

      <PhotoClient />
    </div>
  );
}
