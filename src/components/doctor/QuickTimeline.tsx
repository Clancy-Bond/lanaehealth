"use client";

import { format } from "date-fns";
import type { MedicalTimelineEvent } from "@/lib/types";

interface QuickTimelineProps {
  events: MedicalTimelineEvent[];
}

// ── Event type colors ──────────────────────────────────────────────

function getEventColor(eventType: string): string {
  switch (eventType) {
    case "diagnosis":
      return "var(--event-diagnosis)";
    case "symptom_onset":
      return "var(--event-symptom)";
    case "test":
      return "var(--event-test)";
    case "medication_change":
      return "var(--event-medication)";
    case "appointment":
      return "var(--event-appointment)";
    case "imaging":
      return "var(--event-imaging)";
    case "hospitalization":
      return "#DC2626";
    default:
      return "var(--text-muted)";
  }
}

function getSignificanceBorder(significance: string): string {
  switch (significance) {
    case "critical":
      return "2px solid #DC2626";
    case "important":
      return "2px solid var(--accent-sage)";
    default:
      return "2px solid var(--border)";
  }
}

// ── Main component ─────────────────────────────────────────────────

export function QuickTimeline({ events }: QuickTimelineProps) {
  if (events.length === 0) {
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
          Medical Timeline
        </h2>
        <div
          className="card"
          style={{ padding: 16, textAlign: "center" }}
        >
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            No key medical events recorded
          </p>
        </div>
      </section>
    );
  }

  // Events already sorted desc from server (most recent first)
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
        Medical Timeline
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: "var(--text-muted)",
            marginLeft: "auto",
          }}
        >
          {events.length} key events
        </span>
      </h2>

      <div className="card" style={{ padding: "12px 16px" }}>
        {events.map((event, i) => {
          const dotColor = getEventColor(event.event_type);
          const isLast = i === events.length - 1;

          return (
            <div
              key={event.id}
              style={{
                display: "flex",
                gap: 12,
                position: "relative",
                paddingBottom: isLast ? 0 : 14,
              }}
            >
              {/* Date column */}
              <div
                style={{
                  width: 58,
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  paddingTop: 2,
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {format(new Date(event.event_date + "T00:00:00"), "M/d/yy")}
              </div>

              {/* Dot + line */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                  width: 16,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: dotColor,
                    border: getSignificanceBorder(event.significance),
                    flexShrink: 0,
                    marginTop: 3,
                  }}
                />
                {!isLast && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      background: "var(--border)",
                      marginTop: 4,
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                  }}
                >
                  {event.title}
                </div>
                {event.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                      marginTop: 2,
                    }}
                  >
                    {event.description.length > 120
                      ? event.description.slice(0, 120) + "..."
                      : event.description}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: `${dotColor}18`,
                      color: dotColor,
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {event.event_type.replace("_", " ")}
                  </span>
                  {event.significance === "critical" && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: "rgba(220, 38, 38, 0.12)",
                        color: "#DC2626",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      Critical
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
