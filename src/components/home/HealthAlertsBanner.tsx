import Link from "next/link";
import { AlertOctagon, CheckSquare, ArrowRight } from "lucide-react";
import type { RedFlag } from "@/lib/doctor/red-flags";
import type { FollowThroughItem } from "@/lib/doctor/follow-through";

interface HealthAlertsBannerProps {
  redFlags: RedFlag[];
  followThrough: FollowThroughItem[];
}

export function HealthAlertsBanner({ redFlags, followThrough }: HealthAlertsBannerProps) {
  const overdue = followThrough.filter((i) => i.daysOverdue > 0);

  if (redFlags.length === 0 && overdue.length === 0) return null;

  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {redFlags.length > 0 && (
        <Link
          href="/doctor"
          className="press-feedback"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(220, 38, 38, 0.08)",
            border: "2px solid #DC2626",
            textDecoration: "none",
            color: "#7F1D1D",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <AlertOctagon size={18} style={{ color: "#DC2626", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {redFlags.length === 1 ? "Red flag" : `${redFlags.length} red flags`}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7F1D1D", lineHeight: 1.35 }}>
              {redFlags[0].headline}
              {redFlags.length > 1 && ` · +${redFlags.length - 1} more`}
            </div>
          </div>
          <ArrowRight size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
        </Link>
      )}

      {overdue.length > 0 && (
        <Link
          href="/doctor"
          className="press-feedback"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(234, 179, 8, 0.08)",
            border: "1px solid #CA8A04",
            textDecoration: "none",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <CheckSquare size={18} style={{ color: "#CA8A04", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#854D0E", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {overdue.length === 1 ? "Overdue follow-up" : `${overdue.length} overdue follow-ups`}
            </div>
            <div
              className="tabular"
              style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {overdue[0].item.slice(0, 60)}
              {overdue[0].item.length > 60 ? "..." : ""}
              {" · "}
              {overdue[0].daysOverdue}d late
            </div>
          </div>
          <ArrowRight size={16} style={{ color: "#CA8A04", flexShrink: 0 }} />
        </Link>
      )}
    </div>
  );
}
