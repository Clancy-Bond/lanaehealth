/**
 * Calories » Per-meal overflow menu
 *
 * MyNetDiary shows a ⋮ button on each meal header with Copy / Reorder
 * / Delete actions. We mirror it with a native `<details>` + `<summary>`
 * panel so it stays server-rendered (no client state, no hydration
 * risk). Each action is either a form post or a link.
 *
 * Actions:
 *   - Copy to tomorrow: POST /api/calories/meal/copy (additive; safe)
 *   - Save as template: stub, points to /calories/search?view=my-meals
 *     (GAP #11 lands the real save flow)
 *   - Reorder: stub, points to /log (GAP #8 ships dedicated reorder
 *     in a follow-up; in the meantime /log is where users already
 *     edit individual rows)
 *   - Delete: links to /calories/meal-delete?date=X&meal=Y which
 *     confirms first, then POSTs to /api/calories/meal/delete. This
 *     routing honors the project-level ZERO-data-loss rule.
 */

import { format, addDays } from "date-fns";

export function MealOverflow({
  date,
  meal,
  hasItems,
}: {
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  hasItems: boolean;
}) {
  const tomorrow = format(addDays(new Date(date + "T00:00:00"), 1), "yyyy-MM-dd");

  return (
    <details
      style={{ position: "relative", display: "inline-block" }}
      className="meal-overflow"
    >
      <summary
        aria-label={`More actions for ${meal}`}
        title={`More actions for ${meal}`}
        style={{
          listStyle: "none",
          cursor: "pointer",
          width: 24,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          color: "var(--text-secondary)",
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        <span aria-hidden>&#8942;</span>
      </summary>
      <div
        role="menu"
        style={{
          position: "absolute",
          top: 28,
          right: 0,
          minWidth: 220,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: 10,
          boxShadow: "var(--shadow-md)",
          padding: 4,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* Copy to tomorrow */}
        <form
          action="/api/calories/meal/copy"
          method="post"
          style={{ margin: 0 }}
        >
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="meal" value={meal} />
          <input type="hidden" name="targetDate" value={tomorrow} />
          <button
            type="submit"
            role="menuitem"
            disabled={!hasItems}
            style={overflowItemButtonStyle(!hasItems)}
          >
            <span aria-hidden style={{ marginRight: 8 }}>&#128203;</span>
            Copy to tomorrow
          </button>
        </form>

        {/* Save as My Meal template (GAP #11) */}
        <form
          action="/api/calories/meal-templates/save"
          method="post"
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
          }}
        >
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="meal" value={meal} />
          <input
            type="text"
            name="name"
            placeholder="Save as (name)"
            required
            disabled={!hasItems}
            aria-label={`Template name for ${meal}`}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              padding: "4px 6px",
              border: "1px solid var(--border-light)",
              borderRadius: 6,
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={!hasItems}
            aria-label="Save as template"
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: hasItems ? "var(--accent-sage)" : "var(--border-light)",
              color: hasItems ? "var(--text-inverse)" : "var(--text-muted)",
              fontSize: 11,
              fontWeight: 700,
              border: "none",
              cursor: hasItems ? "pointer" : "not-allowed",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Save
          </button>
        </form>

        {/* Reorder stub */}
        <a
          href={`/log#${meal}`}
          role="menuitem"
          style={overflowItemLinkStyle(false)}
        >
          <span aria-hidden style={{ marginRight: 8 }}>&#8597;</span>
          Reorder in Log
        </a>

        <div
          role="separator"
          style={{
            height: 1,
            margin: "4px 0",
            background: "var(--border-light)",
          }}
        />

        {/* Delete (routes to confirmation page) */}
        <a
          href={`/calories/meal-delete?date=${date}&meal=${meal}`}
          role="menuitem"
          style={{
            ...overflowItemLinkStyle(!hasItems),
            color: hasItems ? "var(--accent-blush)" : "var(--text-muted)",
          }}
          aria-disabled={!hasItems}
        >
          <span aria-hidden style={{ marginRight: 8 }}>&#128465;</span>
          Delete all items
        </a>
      </div>
    </details>
  );
}

function overflowItemButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    fontFamily: "inherit",
    borderRadius: 6,
    opacity: disabled ? 0.6 : 1,
  };
}

function overflowItemLinkStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    textDecoration: "none",
    fontSize: 13,
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    borderRadius: 6,
    opacity: disabled ? 0.6 : 1,
    pointerEvents: disabled ? "none" : "auto",
  };
}
