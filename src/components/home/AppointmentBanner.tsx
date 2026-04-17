import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { Appointment } from "@/lib/types";

interface AppointmentBannerProps {
  next: Appointment | null;
  mostRecentPast: Appointment | null;
}

/**
 * Map a specialty string to the best matching doctor brief view.
 * Falls back to "pcp" for anything unrecognized.
 */
function specialtyToView(s: string | null): "pcp" | "obgyn" | "cardiology" {
  if (!s) return "pcp";
  const l = s.toLowerCase();
  if (/ob.?gyn|gyn|gyno|reproductive|obst/i.test(l)) return "obgyn";
  if (/cardio|heart|electrophys/i.test(l)) return "cardiology";
  return "pcp";
}

export function AppointmentBanner({ next, mostRecentPast }: AppointmentBannerProps) {
  const now = new Date();

  // Priority 1: Post-visit capture prompt (appointment was 0-2 days ago and
  // has no action_items yet)
  if (mostRecentPast) {
    const daysAgo = differenceInDays(now, new Date(mostRecentPast.date + "T00:00:00"));
    const needsCapture = daysAgo >= 0 && daysAgo <= 2 && !mostRecentPast.action_items;
    if (needsCapture) {
      return (
        <Link
          href={`/doctor/post-visit?id=${mostRecentPast.id}`}
          className="press-feedback"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            margin: "0 16px",
            borderRadius: 12,
            background:
              "linear-gradient(135deg, rgba(212, 160, 160, 0.12) 0%, rgba(212, 160, 160, 0.04) 100%)",
            border: "1px solid var(--accent-blush)",
            textDecoration: "none",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-sm)",
            transition: "transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
          }}
        >
          <Calendar size={18} style={{ color: "var(--accent-blush)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              Capture notes from {mostRecentPast.specialty ?? "your visit"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {daysAgo === 0 ? "Today" : `${daysAgo}d ago`}
              {mostRecentPast.doctor_name ? `, ${mostRecentPast.doctor_name}` : ""}
            </div>
          </div>
          <ArrowRight size={16} style={{ color: "var(--accent-blush)" }} />
        </Link>
      );
    }
  }

  // Priority 2: Upcoming appointment within 7 days
  if (!next) return null;
  const daysUntil = differenceInDays(new Date(next.date + "T00:00:00"), now);
  if (daysUntil < 0 || daysUntil > 7) return null;

  const view = specialtyToView(next.specialty);
  const when =
    daysUntil === 0
      ? "today"
      : daysUntil === 1
      ? "tomorrow"
      : `in ${daysUntil}d (${format(new Date(next.date + "T00:00:00"), "EEE MMM d")})`;

  return (
    <Link
      href={`/doctor?v=${view}`}
      className="press-feedback"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        margin: "0 16px",
        borderRadius: 12,
        background:
          "linear-gradient(135deg, rgba(107, 144, 128, 0.12) 0%, rgba(107, 144, 128, 0.04) 100%)",
        border: "1px solid var(--accent-sage)",
        textDecoration: "none",
        color: "var(--text-primary)",
        boxShadow: "var(--shadow-sm)",
        transition: "transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
      }}
    >
      <Calendar size={18} style={{ color: "var(--accent-sage)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {next.specialty ?? "Appointment"} {when}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Tap to open prep brief ({view.toUpperCase()} view)
          {next.doctor_name ? `, ${next.doctor_name}` : ""}
        </div>
      </div>
      <ArrowRight size={16} style={{ color: "var(--accent-sage)" }} />
    </Link>
  );
}
