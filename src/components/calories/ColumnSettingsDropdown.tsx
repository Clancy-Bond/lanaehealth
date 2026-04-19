"use client";

/**
 * MFN-parity column settings gear dropdown.
 *
 * MyNetDiary's ⚙ in the Food-tab column header opens a menu with:
 *   - Show Nutrients in Food Log ▸
 *   - Hide Nutrients from Food Log ▸
 *   - Hide Time
 *   - Sort by ▸
 *   - Settings
 * Reference:
 *   s3.amazonaws.com/img.mynetdiary.com/help/web/customie_meal_log.jpg
 *
 * Show/Hide + Sort by are stubs for now (writing to health_profile
 * will land in a follow-up commit). "Settings" links out to
 * /calories/plan where the calorie + macro targets live today.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function ColumnSettingsDropdown() {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-label="Food log column settings"
        title="Food log column settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 26,
          height: 26,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          border: "none",
          background: "transparent",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: 32,
            right: 0,
            minWidth: 260,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: 4,
            zIndex: 30,
          }}
        >
          <MenuItem label="Show Nutrients in Food Log" chevron disabled />
          <MenuItem label="Hide Nutrients from Food Log" chevron disabled />
          <MenuItem label="Hide Time" disabled />
          <MenuItem label="Sort by" chevron disabled />
          <div style={{ height: 1, margin: "4px 0", background: "var(--border-light)" }} />
          <Link
            href="/calories/plan"
            role="menuitem"
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--text-primary)",
              textDecoration: "none",
              borderRadius: 6,
            }}
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  chevron = false,
  disabled = false,
}: {
  label: string;
  chevron?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={disabled ? "Coming soon" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "8px 12px",
        background: "transparent",
        border: "none",
        textAlign: "left",
        fontSize: 13,
        color: disabled ? "var(--text-muted)" : "var(--text-primary)",
        fontFamily: "inherit",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span>{label}</span>
      {chevron && (
        <span aria-hidden style={{ fontSize: 11, color: "var(--text-muted)" }}>
          &rsaquo;
        </span>
      )}
    </button>
  );
}
