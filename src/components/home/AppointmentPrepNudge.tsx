/**
 * Appointment Prep Nudge
 *
 * Surfaces specialty-specific pre-visit logging prompts when an appointment
 * is within a short window. The goal: the brief the doctor sees should
 * contain data the patient logged in the days before, not just stale data.
 *
 * Currently:
 *   - Cardiology within 3 days + orthostatic_tests empty or >7d old
 *     -> prompts a 10-min active stand test (the CIE's #1 urgent action).
 *   - OB/GYN within 3 days + cycle_entries/pain logs sparse recently
 *     -> prompts cycle/pain logging.
 *
 * Degrades gracefully: returns null if no match or if the user already
 * logged what's needed.
 */

import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { differenceInDays } from "date-fns";
import type { Appointment } from "@/lib/types";

export interface OrthostaticSummary {
  count: number;
  latestDate: string | null;
  latestPeakRise: number | null;
}

interface AppointmentPrepNudgeProps {
  nextAppt: Appointment | null;
  orthostatic: OrthostaticSummary;
}

function specialtyKind(s: string | null): "cardiology" | "obgyn" | "other" {
  if (!s) return "other";
  const l = s.toLowerCase();
  if (/cardio|heart|electrophys/.test(l)) return "cardiology";
  if (/ob.?gyn|gyn|gyno|reproductive/.test(l)) return "obgyn";
  return "other";
}

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return differenceInDays(new Date(), new Date(dateStr + "T00:00:00"));
}

export function AppointmentPrepNudge({ nextAppt, orthostatic }: AppointmentPrepNudgeProps) {
  if (!nextAppt) return null;

  const daysUntil = differenceInDays(new Date(nextAppt.date + "T00:00:00"), new Date());
  if (daysUntil < 0 || daysUntil > 3) return null;

  const kind = specialtyKind(nextAppt.specialty);

  // Cardiology nudge: need recent orthostatic data
  if (kind === "cardiology") {
    const lastTestAge = daysAgo(orthostatic.latestDate);
    const needsTest = orthostatic.count < 3 || lastTestAge === null || lastTestAge > 7;
    if (!needsTest) return null;

    const headline =
      orthostatic.count === 0
        ? "Cardiology in " +
          (daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `${daysUntil}d`) +
          " — log a stand test now"
        : `Log ${Math.max(0, 3 - orthostatic.count)} more stand test${
            3 - orthostatic.count === 1 ? "" : "s"
          } before Monday`;

    const subline =
      orthostatic.count === 0
        ? "Engine's #1 urgent action is orthostatic vitals. Takes 10 min. Changes POTS score +/-25 points."
        : `You've logged ${orthostatic.count}. POTS criteria need 3+ positive tests on separate days.`;

    return (
      <Link
        href="/log/orthostatic"
        className="press-feedback"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 16px",
          padding: "12px 16px",
          borderRadius: 12,
          background:
            "linear-gradient(135deg, rgba(220, 38, 38, 0.10) 0%, rgba(220, 38, 38, 0.02) 100%)",
          border: "2px solid #DC2626",
          textDecoration: "none",
          color: "#7F1D1D",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Activity size={20} style={{ color: "#DC2626", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#DC2626",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 2,
            }}
          >
            Pre-visit prep
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7F1D1D", lineHeight: 1.3 }}>
            {headline}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
            {subline}
          </div>
        </div>
        <ArrowRight size={18} style={{ color: "#DC2626", flexShrink: 0 }} />
      </Link>
    );
  }

  // OB/GYN nudge (lightweight — mostly a reminder, since cycle already tracked via NC)
  if (kind === "obgyn") {
    return (
      <Link
        href="/log"
        className="press-feedback"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 16px",
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(212, 160, 160, 0.10)",
          border: "1px solid var(--accent-blush)",
          textDecoration: "none",
          color: "var(--text-primary)",
        }}
      >
        <Activity size={18} style={{ color: "var(--accent-blush)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent-blush)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 2,
            }}
          >
            Pre-visit prep
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            OB/GYN in {daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `${daysUntil}d`}
            {" — log today's symptoms"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Pain, flow, and dyspareunia entries strengthen the endometriosis case.
          </div>
        </div>
        <ArrowRight size={16} style={{ color: "var(--accent-blush)", flexShrink: 0 }} />
      </Link>
    );
  }

  return null;
}
