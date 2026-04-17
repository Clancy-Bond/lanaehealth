"use client";

import { useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { Users, Calendar } from "lucide-react";
import type { DoctorPageData } from "@/app/doctor/page";
import { generateHypotheses } from "@/lib/doctor/hypotheses";
import type { SpecialistView } from "@/lib/doctor/specialist-config";

interface CrossAppointmentOverlayProps {
  data: DoctorPageData;
  currentView: SpecialistView;
}

function specialtyToView(s: string | null): SpecialistView | null {
  if (!s) return null;
  if (/ob.?gyn|gyn|gyno|reproductive/i.test(s)) return "obgyn";
  if (/cardio|heart|electrophys/i.test(s)) return "cardiology";
  if (/primary|internal|family|pcp/i.test(s)) return "pcp";
  return null;
}

interface HypothesisCoverage {
  hypothesisName: string;
  evaluatingAppointments: Array<{
    specialty: string;
    date: string;
    daysAway: number;
    isCurrentView: boolean;
  }>;
}

export function CrossAppointmentOverlay({
  data,
  currentView,
}: CrossAppointmentOverlayProps) {
  const coverage = useMemo((): HypothesisCoverage[] => {
    const hypotheses = generateHypotheses(data);
    const now = new Date();

    const upcoming = (data.upcomingAppointments ?? []).slice(0, 6);

    return hypotheses.map((h) => {
      const evaluating: HypothesisCoverage["evaluatingAppointments"] = [];
      for (const appt of upcoming) {
        const view = specialtyToView(appt.specialty);
        if (view && h.relevantTo.includes(view)) {
          evaluating.push({
            specialty: appt.specialty ?? "Unknown",
            date: appt.date,
            daysAway: differenceInDays(new Date(appt.date + "T00:00:00"), now),
            isCurrentView: view === currentView,
          });
        }
      }
      return {
        hypothesisName: h.name,
        evaluatingAppointments: evaluating,
      };
    });
  }, [data, currentView]);

  const withCoverage = coverage.filter((c) => c.evaluatingAppointments.length > 0);

  if (withCoverage.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        padding: "14px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Users size={16} style={{ color: "var(--accent-sage)" }} />
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Who evaluates what
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
        Prevent repeating the same story. This visit should focus on what&apos;s bolded.
      </p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {withCoverage.map((c, i) => (
          <li
            key={i}
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
              paddingBottom: 6,
              borderBottom:
                i === withCoverage.length - 1 ? "none" : "1px dashed var(--border-light)",
            }}
          >
            <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {c.hypothesisName.split(":")[0].split("(")[0].trim()}
            </strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {c.evaluatingAppointments.map((a, j) => (
                <span
                  key={j}
                  className="tabular"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: a.isCurrentView ? 700 : 500,
                    background: a.isCurrentView
                      ? "var(--accent-sage-muted)"
                      : "var(--bg-primary)",
                    color: a.isCurrentView
                      ? "var(--accent-sage)"
                      : "var(--text-muted)",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  <Calendar size={10} />
                  {a.specialty}{" "}
                  {a.daysAway === 0
                    ? "today"
                    : a.daysAway === 1
                    ? "tmrw"
                    : a.daysAway > 0
                    ? `${a.daysAway}d`
                    : format(new Date(a.date + "T00:00:00"), "M/d")}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
