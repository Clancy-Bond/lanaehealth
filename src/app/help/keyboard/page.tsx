/**
 * /help/keyboard - Keyboard shortcuts reference
 *
 * Lists every keyboard shortcut in the app, grouped by surface.
 * Linked from CommandPalette so `cmd+k ? Enter` takes you here.
 */

import Link from "next/link";

export const metadata = {
  title: "Keyboard shortcuts - LanaeHealth",
};

interface Shortcut {
  keys: string[];
  action: string;
}

interface Group {
  title: string;
  items: Shortcut[];
}

const GROUPS: Group[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["\u2318", "K"], action: "Open command palette" },
      { keys: ["Ctrl", "K"], action: "Open command palette (Windows/Linux)" },
      { keys: ["Esc"], action: "Close palette / dialog" },
      { keys: ["\u2191", "\u2193"], action: "Move selection in palette" },
      { keys: ["Enter"], action: "Activate selection" },
    ],
  },
  {
    title: "Calories",
    items: [
      { keys: ["Go", "Calories"], action: "Type 'calories' in palette + Enter" },
      { keys: ["Go", "Food"], action: "Type 'food' in palette for meal log" },
      { keys: ["Go", "Plan"], action: "Type 'plan' in palette for targets" },
      { keys: ["Go", "Photo"], action: "Type 'photo' for AI meal scan" },
      { keys: ["Go", "Search"], action: "Type 'usda' or 'search' for food DB" },
    ],
  },
  {
    title: "Cycle",
    items: [
      { keys: ["Go", "Cycle"], action: "Type 'cycle' in palette for today view" },
      { keys: ["Go", "BBT"], action: "Type 'bbt' for temperature log" },
      { keys: ["Go", "Hormones"], action: "Type 'estrogen' (or any hormone)" },
    ],
  },
  {
    title: "Labs & Medical",
    items: [
      { keys: ["Go", "Labs"], action: "Type 'labs' or 'trend'" },
      { keys: ["Go", "POTS"], action: "Type 'pots' for orthostatic page" },
      { keys: ["Go", "Migraine"], action: "Type 'migraine' or 'ichd'" },
      { keys: ["Go", "Emergency"], action: "Type 'ems' or 'emergency' for wallet card" },
    ],
  },
  {
    title: "Weight & Activity",
    items: [
      { keys: ["Go", "Weigh-in"], action: "Type 'weight' or 'kg'" },
    ],
  },
];

export default function KeyboardHelpPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 16,
        maxWidth: 820,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        &lsaquo; Home
      </Link>

      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Keyboard shortcuts</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
          The fastest way to move around LanaeHealth is the command
          palette. Press{" "}
          <Kbd>{"\u2318"}</Kbd> <Kbd>K</Kbd> (or <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>{" "}
          on Windows/Linux) from any page. Type a few letters, press
          <Kbd>Enter</Kbd>. Arrow keys scroll the list, Escape closes.
        </p>
      </div>

      {GROUPS.map((g) => (
        <section
          key={g.title}
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-muted)",
              margin: 0,
              marginBottom: 10,
            }}
          >
            {g.title}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                    minWidth: 160,
                  }}
                >
                  {s.keys.map((k, j) => (
                    <Kbd key={j}>{k}</Kbd>
                  ))}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>{s.action}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        background: "var(--bg-primary)",
        border: "1px solid var(--border-light)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
        fontSize: 11,
        fontFamily: "var(--font-geist-mono), monospace",
        fontWeight: 600,
        color: "var(--text-primary)",
      }}
    >
      {children}
    </kbd>
  );
}
