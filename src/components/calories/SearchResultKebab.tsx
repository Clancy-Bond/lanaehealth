"use client";

/**
 * MFN parity: ⋮ menu on every search result row.
 *
 * Reference: s3.amazonaws.com/img.mynetdiary.com/help/web/food_search_recents.jpg
 *
 * MFN's kebab opens a small menu that lets the user log the food
 * directly to a chosen meal on today's date, or open the detail page.
 * We POST to /api/food/log with one-serving defaults; the user can
 * still tap the row to open the detail for portion picking.
 */

import { useEffect, useRef, useState } from "react";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Meal = (typeof MEALS)[number];

export function SearchResultKebab({
  fdcId,
  description,
  mealParam,
}: {
  fdcId: number;
  description: string;
  mealParam: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const log = async (meal: Meal) => {
    setLoading(meal);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("fdcId", String(fdcId));
      fd.append("meal_type", meal);
      fd.append("servings", "1");
      const res = await fetch("/api/food/log", {
        method: "POST",
        body: fd,
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not log.");
      }
      window.location.href = `/calories/food#${meal}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Log failed.");
      setLoading(null);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-label={`More actions for ${description}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          color: "var(--text-secondary)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        <span aria-hidden>&#8942;</span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: 30,
            right: 0,
            minWidth: 200,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: 4,
            zIndex: 30,
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              fontSize: 10,
              color: "var(--text-muted)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Log to today
          </div>
          {MEALS.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitem"
              disabled={loading !== null}
              onClick={() => log(m)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "8px 10px",
                background: m === mealParam ? "var(--accent-sage-muted)" : "transparent",
                border: "none",
                textAlign: "left",
                fontSize: 13,
                color: "var(--text-primary)",
                fontFamily: "inherit",
                borderRadius: 6,
                cursor: loading !== null ? "wait" : "pointer",
                textTransform: "capitalize",
              }}
            >
              <span>{m}</span>
              {loading === m && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>…</span>
              )}
            </button>
          ))}
          <div style={{ height: 1, margin: "4px 0", background: "var(--border-light)" }} />
          <a
            role="menuitem"
            href={`/calories/food/${fdcId}?meal=${mealParam}`}
            style={{
              display: "block",
              padding: "8px 10px",
              fontSize: 13,
              color: "var(--text-primary)",
              textDecoration: "none",
              borderRadius: 6,
            }}
          >
            Open details
          </a>
          {error && (
            <p style={{ padding: "4px 10px", fontSize: 11, color: "var(--accent-blush)", margin: 0 }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
