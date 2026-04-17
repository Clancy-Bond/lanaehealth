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
  {
    label: "Stand Test",
    href: "/log/orthostatic",
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
        <path d="M12 2v4" />
        <path d="M10 8h4" />
        <path d="M10 22v-8l-2-2" />
        <path d="M14 22v-8l2-2" />
        <circle cx="12" cy="7" r="1" />
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
      {actions.map((action) => {
        // Scarce Accent Rule: the primary sage CTA is the "Log your check-in"
        // block above. All quick actions are now neutral secondary pills so
        // they don't compete with the single sage-primary on the viewport.
        return (
          <Link
            key={action.label}
            href={action.href}
            className="press-feedback"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              height: 44,
              padding: "0 18px",
              borderRadius: 22,
              background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-sm)",
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
