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
        const isPrimary = idx < 2;
        return (
          <Link
            key={action.label}
            href={action.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              height: 44,
              padding: "0 18px",
              borderRadius: 22,
              background: isPrimary
                ? "linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)"
                : "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
              color: isPrimary ? "var(--text-inverse)" : "var(--text-secondary)",
              fontSize: 13,
              fontWeight: isPrimary ? 700 : 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "all 150ms ease",
              border: "none",
              boxShadow: isPrimary
                ? "0 1px 2px rgba(107,144,128,0.25), 0 4px 14px rgba(107,144,128,0.32), inset 0 1px 0 rgba(255,255,255,0.15)"
                : "0 1px 2px rgba(107,144,128,0.04), 0 3px 10px rgba(26,26,46,0.05)",
              letterSpacing: "-0.01em",
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
