"use client";

/**
 * Client-side print action for the pre-visit prep sheet.
 * Kept separate so the parent sheet can stay a server component.
 */

export function PreVisitPrintActions() {
  return (
    <div
      className="no-print"
      style={{ display: "flex", gap: 8, flexShrink: 0 }}
    >
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          appearance: "none",
          background: "var(--accent-sage)",
          color: "var(--text-inverse)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          padding: "8px 14px",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          cursor: "pointer",
          minHeight: 44,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        Print or save PDF
      </button>
    </div>
  );
}
