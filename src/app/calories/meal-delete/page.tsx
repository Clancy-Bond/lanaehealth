/**
 * Calories » Delete meal confirmation
 *
 * MyNetDiary's per-meal overflow has a Delete action. Because this
 * repo holds real patient data and the project CLAUDE.md mandates
 * explicit confirmation before any destructive DB op, we route the
 * Delete click through this confirmation page first.
 *
 * Shows the exact items that will be removed, then POSTs to
 * /api/calories/meal/delete with `confirm=yes`. No deletion happens
 * just from navigation - only from the explicit form submit.
 */

import { createServiceClient } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Entry {
  id: string;
  food_items: string | null;
  calories: number | null;
}

export default async function DeleteMealConfirm({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; meal?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? "";
  const meal = (params.meal ?? "").toLowerCase();

  if (!DATE_RE.test(date) || !VALID_MEALS.has(meal)) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Invalid meal or date. Return to{" "}
          <Link href="/calories/food">Calories &rsaquo; Food</Link>.
        </p>
      </div>
    );
  }

  const sb = createServiceClient();
  const { data: log } = await sb
    .from("daily_logs")
    .select("id")
    .eq("date", date)
    .maybeSingle();
  const logId = (log as { id: string } | null)?.id ?? null;

  let entries: Entry[] = [];
  if (logId) {
    const { data } = await sb
      .from("food_entries")
      .select("id, food_items, calories")
      .eq("log_id", logId)
      .eq("meal_type", meal)
      .order("logged_at", { ascending: true });
    entries = ((data ?? []) as unknown) as Entry[];
  }

  const total = entries.reduce((acc, e) => acc + (e.calories ?? 0), 0);
  const label = meal.charAt(0).toUpperCase() + meal.slice(1);

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 560,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Link
        href={`/calories/food?date=${date}#${meal}`}
        style={{
          fontSize: 12,
          color: "var(--accent-sage)",
          textDecoration: "none",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        &lsaquo; Back to Food
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
        Delete {label} on {date}?
      </h1>
      {entries.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
          No items logged for this meal. Nothing to delete.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            This will permanently remove the following{" "}
            <strong>{entries.length}</strong> item
            {entries.length === 1 ? "" : "s"} ({Math.round(total)} cal total)
            from your food log. This cannot be undone.
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: "var(--bg-card)",
              borderRadius: 12,
              border: "1px solid var(--border-light)",
            }}
          >
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 14px",
                  fontSize: 13,
                }}
              >
                <span>{e.food_items ?? "(unnamed)"}</span>
                <span className="tabular" style={{ color: "var(--text-muted)" }}>
                  {Math.round(e.calories ?? 0)} cal
                </span>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <form action="/api/calories/meal/delete" method="post" style={{ flex: 1 }}>
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="meal" value={meal} />
              <input type="hidden" name="confirm" value="yes" />
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "var(--accent-blush)",
                  color: "var(--text-inverse)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Yes, delete {entries.length} item{entries.length === 1 ? "" : "s"}
              </button>
            </form>
            <Link
              href={`/calories/food?date=${date}#${meal}`}
              style={{
                padding: "12px 20px",
                borderRadius: 10,
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
                border: "1px solid var(--border-light)",
              }}
            >
              Cancel
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
