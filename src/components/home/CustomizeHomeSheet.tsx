"use client";

/**
 * Home customize sheet.
 *
 * Enumerates every legacy widget (metadata in src/lib/home/legacy-widgets.ts)
 * plus every registered widget (src/lib/home/widgets.ts, populated by
 * clone sessions) and shows an on/off toggle per widget. Saves to
 * PUT /api/preferences (hiddenHomeWidgets array).
 *
 * Reorder is intentionally out of scope for this sheet's v1; defaultOrder
 * in each widget's metadata drives display until a drag UI ships.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { LEGACY_WIDGETS, type LegacyWidgetMeta } from "@/lib/home/legacy-widgets";

export interface RegisteredWidgetMeta {
  id: string;
  label: string;
  category: string;
}

interface CustomizeHomeSheetProps {
  open: boolean;
  onClose: () => void;
  /** Metadata for widgets registered via registerWidget(). Passed from the
   *  server component so we don't need a separate API fetch. */
  registeredWidgets: readonly RegisteredWidgetMeta[];
}

interface WidgetRow {
  id: string;
  label: string;
  category: string;
  source: "legacy" | "registered";
}

export function CustomizeHomeSheet({
  open,
  onClose,
  registeredWidgets,
}: CustomizeHomeSheetProps) {
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        setHiddenSet(new Set<string>(data.hiddenHomeWidgets ?? []));
      })
      .catch(() => {
        // non-fatal; start with empty hidden set
      });
  }, [open]);

  const rows: WidgetRow[] = [
    ...LEGACY_WIDGETS.map((w: LegacyWidgetMeta) => ({
      id: w.id,
      label: w.label,
      category: w.category,
      source: "legacy" as const,
    })),
    ...registeredWidgets.map((w) => ({
      id: w.id,
      label: w.label,
      category: w.category,
      source: "registered" as const,
    })),
  ];

  const byCategory = rows.reduce<Record<string, WidgetRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});

  async function toggle(id: string, nextHidden: boolean) {
    const next = new Set(hiddenSet);
    if (nextHidden) next.add(id);
    else next.delete(id);
    setHiddenSet(next);

    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenHomeWidgets: Array.from(next) }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "rgba(0,0,0,0.4)",
        }}
      />
      <div
        role="dialog"
        aria-label="Customize home"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 65,
          maxHeight: "80vh",
          overflowY: "auto",
          background: "var(--bg-card)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: "var(--shadow-lg)",
          padding: "16px 16px calc(24px + var(--safe-bottom))",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 12,
            borderBottom: "1px solid var(--border-light)",
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              Customize home
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
              Toggle which cards show on your home page.
              {saving ? " Saving..." : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 8,
              color: "var(--text-muted)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {Object.entries(byCategory).map(([category, widgets]) => (
          <section key={category} style={{ marginBottom: 20 }}>
            <h3
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--text-muted)",
                margin: "0 0 8px 4px",
              }}
            >
              {category}
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {widgets.map((widget) => {
                const hidden = hiddenSet.has(widget.id);
                return (
                  <li
                    key={widget.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 4px",
                      borderBottom: "1px solid var(--border-light)",
                    }}
                  >
                    <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                      {widget.label}
                    </span>
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={(e) => toggle(widget.id, !e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color: hidden ? "var(--text-muted)" : "var(--accent-sage)",
                          minWidth: 40,
                        }}
                      >
                        {hidden ? "Off" : "On"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
