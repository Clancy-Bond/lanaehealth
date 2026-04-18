"use client";

import { Calendar } from "lucide-react";
import { format } from "date-fns";
import type { Appointment } from "@/lib/types";
import { formatClinicName } from "@/lib/appointments/format";

interface UpcomingAppointmentsProps {
  appointments: Appointment[];
}

/** Specialty color mapping for pill badges */
const SPECIALTY_COLORS: Record<string, { bg: string; text: string }> = {
  "ob/gyn": {
    bg: "rgba(212, 160, 160, 0.15)",
    text: "var(--accent-blush)",
  },
  "internal medicine": {
    bg: "rgba(107, 144, 128, 0.15)",
    text: "var(--accent-sage)",
  },
  cardiology: {
    bg: "rgba(91, 155, 213, 0.15)",
    text: "#5B9BD5",
  },
  dermatology: {
    bg: "rgba(139, 92, 246, 0.15)",
    text: "#8B5CF6",
  },
  neurology: {
    bg: "rgba(249, 115, 22, 0.15)",
    text: "#F97316",
  },
  default: {
    bg: "rgba(107, 114, 128, 0.12)",
    text: "var(--text-secondary)",
  },
};

function getSpecialtyColor(specialty: string | null) {
  if (!specialty) return SPECIALTY_COLORS.default;
  const key = specialty.toLowerCase();
  for (const [match, colors] of Object.entries(SPECIALTY_COLORS)) {
    if (key.includes(match)) return colors;
  }
  return SPECIALTY_COLORS.default;
}

export function UpcomingAppointments({
  appointments,
}: UpcomingAppointmentsProps) {
  // Show up to 3 upcoming appointments
  const upcoming = appointments.slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <section>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 4,
            height: 20,
            borderRadius: 2,
            background: "var(--accent-sage)",
            flexShrink: 0,
          }}
        />
        Upcoming Appointments
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {upcoming.map((appt, i) => {
          const apptDate = new Date(appt.date + "T00:00:00");
          const monthLabel = format(apptDate, "MMM").toUpperCase();
          const dayLabel = format(apptDate, "d");
          const specialtyColor = getSpecialtyColor(appt.specialty);
          const isNext = i === 0;

          return (
            <div
              key={appt.id}
              className="card"
              style={{
                padding: "14px 16px",
                border: isNext
                  ? "1px solid var(--accent-sage)"
                  : "1px solid var(--border-light)",
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                position: "relative",
              }}
            >
              {/* Next appointment badge */}
              {isNext && (
                <span
                  style={{
                    position: "absolute",
                    top: -8,
                    right: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "var(--accent-sage)",
                    color: "var(--text-inverse)",
                  }}
                >
                  Next
                </span>
              )}

              {/* Date badge */}
              <div
                className="tabular"
                style={{
                  minWidth: 48,
                  textAlign: "center",
                  padding: "6px 0",
                  borderRadius: 8,
                  background: isNext
                    ? "var(--accent-sage-muted)"
                    : "var(--bg-elevated)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: isNext
                      ? "var(--accent-sage)"
                      : "var(--text-muted)",
                  }}
                >
                  {monthLabel}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: isNext
                      ? "var(--accent-sage)"
                      : "var(--text-primary)",
                  }}
                >
                  {dayLabel}
                </div>
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 4,
                  }}
                >
                  {/* Specialty pill */}
                  {appt.specialty && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 10px",
                        borderRadius: 12,
                        background: specialtyColor.bg,
                        color: specialtyColor.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {appt.specialty}
                    </span>
                  )}
                </div>

                {/* Doctor name */}
                {appt.doctor_name && (
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 2,
                    }}
                  >
                    {appt.doctor_name}
                  </div>
                )}

                {/* Reason */}
                {appt.reason && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}
                  >
                    {appt.reason}
                  </div>
                )}

                {/* Clinic if available (scheduling codes hidden by formatter) */}
                {formatClinicName(appt.clinic) && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {formatClinicName(appt.clinic)}
                  </div>
                )}
              </div>

              {/* Calendar icon for non-first items */}
              {!isNext && (
                <Calendar
                  size={16}
                  style={{
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Show count if more than 3 */}
      {appointments.length > 3 && (
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          +{appointments.length - 3} more upcoming
        </p>
      )}
    </section>
  );
}
