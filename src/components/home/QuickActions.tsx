"use client";

import Link from "next/link";

const actions = [
  {
    label: "Log Pain",
    href: "/log",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a5 5 0 0 1 5 5c0 4-5 7-5 11" />
        <path d="M12 18a5 5 0 0 1-5-5c0-4 5-7 5-11" />
        <circle cx="12" cy="20" r="1" />
      </svg>
    ),
  },
  {
    label: "Log Period",
    href: "/log",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
  },
  {
    label: "Scan Labs",
    href: "/records",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
  },
  {
    label: "Ask AI",
    href: "/chat",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export function QuickActions() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
        padding: "0 16px",
      }}
    >
      {actions.map((action, idx) => {
        // First two actions (Log Pain, Log Period) are primary; rest are secondary
        const isPrimary = idx < 2;
        return (
          <Link
            key={action.label}
            href={action.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 42,
              padding: "0 14px",
              borderRadius: 22,
              background: isPrimary ? "var(--accent-sage)" : "var(--bg-card)",
              color: isPrimary ? "var(--text-inverse)" : "var(--accent-sage)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "all 150ms ease",
              border: isPrimary ? "none" : "1.5px solid var(--accent-sage)",
              boxShadow: isPrimary ? "0 2px 8px rgba(107, 144, 128, 0.25)" : "none",
            }}
          >
            {action.icon}
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
