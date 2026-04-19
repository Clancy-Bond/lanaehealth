"use client";

/**
 * Calories » Per-meal ⋮ — "Move Food entries" modal (MFN parity).
 *
 * MyNetDiary's kebab on each meal header opens a modal titled
 * "Move Food entries" with:
 *   - checkbox list of items currently under the meal
 *   - date picker (default = current view date)
 *   - meal dropdown (default = current meal)
 *   - SAVE | CANCEL
 * Reference: s3.amazonaws.com/img.mynetdiary.com/help/web/copy_move_delete.jpg
 *
 * This replaces our earlier Copy/Save/Reorder/Delete dropdown which
 * was a different feature set from MFN.
 */

import { useCallback, useEffect, useState } from "react";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealOverflowItem {
  id: string;
  name: string;
  amountLabel: string;
}

export function MealOverflow({
  date,
  meal,
  items,
}: {
  date: string;
  meal: Meal;
  items: MealOverflowItem[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetDate, setTargetDate] = useState(date);
  const [targetMeal, setTargetMeal] = useState<Meal>(meal);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default all items checked on modal open, matching MFN.
  useEffect(() => {
    if (open) {
      setSelected(new Set(items.map((i) => i.id)));
      setTargetDate(date);
      setTargetMeal(meal);
      setError(null);
    }
  }, [open, items, date, meal]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSubmit = useCallback(async () => {
    if (selected.size === 0) {
      setError("Select at least one item.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const id of selected) fd.append("ids", id);
      fd.append("targetDate", targetDate);
      fd.append("targetMeal", targetMeal);
      const res = await fetch("/api/calories/food-entries/move", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Move failed.");
      }
      // Navigate to the new location so the user lands on the moved items.
      window.location.href = `/calories/food?date=${targetDate}#${targetMeal}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed.");
      setSubmitting(false);
    }
  }, [selected, targetDate, targetMeal]);

  const hasItems = items.length > 0;

  return (
    <>
      <button
        type="button"
        aria-label={`More actions for ${meal}`}
        title={`More actions for ${meal}`}
        disabled={!hasItems}
        onClick={() => hasItems && setOpen(true)}
        style={{
          width: 24,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          color: hasItems ? "var(--text-secondary)" : "var(--text-muted)",
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1,
          userSelect: "none",
          background: "transparent",
          border: "none",
          cursor: hasItems ? "pointer" : "not-allowed",
          opacity: hasItems ? 1 : 0.5,
        }}
      >
        <span aria-hidden>&#8942;</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="move-food-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "var(--bg-card)",
              borderRadius: 10,
              padding: "24px 28px",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h2
              id="move-food-title"
              style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text-primary)" }}
            >
              Move Food entries
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
              Change selected entries
            </p>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 18px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {items.map((i) => (
                <li key={i.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    id={`move-${i.id}`}
                    checked={selected.has(i.id)}
                    onChange={() => toggle(i.id)}
                    style={{ width: 16, height: 16 }}
                  />
                  <label
                    htmlFor={`move-${i.id}`}
                    style={{ fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}
                  >
                    {i.name}
                    <span style={{ color: "var(--text-muted)" }}>, {i.amountLabel}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label
                  style={{ fontSize: 11, color: "var(--accent-sage)", fontWeight: 600 }}
                  htmlFor="move-date"
                >
                  Date
                </label>
                <input
                  id="move-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label
                  style={{ fontSize: 11, color: "var(--accent-sage)", fontWeight: 600 }}
                  htmlFor="move-meal"
                >
                  Meal
                </label>
                <select
                  id="move-meal"
                  value={targetMeal}
                  onChange={(e) => setTargetMeal(e.target.value as Meal)}
                  style={inputStyle}
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snacks</option>
                </select>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: "var(--accent-blush)", margin: "0 0 10px" }}>{error}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting || selected.size === 0}
                style={{
                  padding: "8px 18px",
                  border: "none",
                  background: "transparent",
                  color: submitting ? "var(--text-muted)" : "var(--accent-sage)",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                style={{
                  padding: "8px 18px",
                  border: "none",
                  background: "transparent",
                  color: "var(--accent-sage)",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 4px",
  fontSize: 14,
  border: "none",
  borderBottom: "1px solid var(--border-light)",
  background: "transparent",
  color: "var(--text-primary)",
  outline: "none",
};
