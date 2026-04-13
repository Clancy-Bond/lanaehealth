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
        justifyContent: "center",
        gap: 10,
        padding: "0 16px",
      }}
    >
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 44,
            padding: "0 18px",
            borderRadius: 22,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
            transition: "opacity 150ms ease",
            boxShadow: "0 2px 8px rgba(107, 144, 128, 0.25)",
          }}
        >
          {action.icon}
          {action.label}
        </Link>
      ))}
    </div>
  );
}
