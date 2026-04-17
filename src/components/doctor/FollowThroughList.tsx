"use client";

import { CheckSquare } from "lucide-react";
import { format } from "date-fns";
import type { FollowThroughItem } from "@/lib/doctor/follow-through";

interface FollowThroughListProps {
  items: FollowThroughItem[];
}

export function FollowThroughList({ items }: FollowThroughListProps) {
  const relevant = items.filter((i) => i.daysOverdue >= -14);   // overdue or due soon
  if (relevant.length === 0) return null;

  const overdue = relevant.filter((i) => i.daysOverdue > 0);
  const upcoming = relevant.filter((i) => i.daysOverdue <= 0);

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: overdue.length > 0 ? "#DC2626" : "var(--accent-sage)",
        padding: "14px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <CheckSquare size={16} style={{ color: "var(--accent-sage)" }} />
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Follow-through tracker
        </h3>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          margin: "0 0 10px",
          lineHeight: 1.4,
        }}
      >
        Previously ordered actions, overdue or due within 14 days.
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {overdue.map((i, idx) => (
          <li
            key={`o-${idx}`}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(220, 38, 38, 0.06)",
              border: "1px solid rgba(220, 38, 38, 0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <strong style={{ fontSize: 12, color: "#7F1D1D", fontWeight: 700 }}>
                {i.item}
              </strong>
              <span className="tabular" style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", whiteSpace: "nowrap" }}>
                {i.daysOverdue}d overdue
              </span>
            </div>
            <div className="tabular" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              From {i.specialty ?? "visit"} on {format(new Date(i.appointmentDate + "T00:00:00"), "MMM d")}
              {" · due "}
              {format(new Date(i.dueDate + "T00:00:00"), "MMM d")}
            </div>
          </li>
        ))}
        {upcoming.map((i, idx) => (
          <li
            key={`u-${idx}`}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "var(--bg-primary)",
              border: "1px solid var(--border-light)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{i.item}</span>
              <span
                className="tabular"
                style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}
              >
                due in {-i.daysOverdue}d
              </span>
            </div>
            <div className="tabular" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              From {i.specialty ?? "visit"} on {format(new Date(i.appointmentDate + "T00:00:00"), "MMM d")}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
