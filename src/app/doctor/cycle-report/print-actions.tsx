"use client";

/**
 * Client-side action buttons for the Cycle Report page.
 * Kept in its own file so the parent page can stay a server component
 * that reads Supabase directly.
 */

export default function CycleReportPrintActions() {
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
