"use client";

import { useState, useMemo, useCallback } from "react";
import type { MedicalTimelineEvent, TimelineEventType } from "@/lib/types";
import { AddEventForm } from "./AddEventForm";

// ── Filter types ──────────────────────────────────────────────────

type FilterId = "all" | TimelineEventType;

const filterChips: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "diagnosis", label: "Diagnoses" },
  { id: "test", label: "Tests" },
  { id: "medication_change", label: "Medications" },
  { id: "imaging", label: "Imaging" },
  { id: "symptom_onset", label: "Symptoms" },
  { id: "appointment", label: "Appointments" },
  { id: "hospitalization", label: "Hospital" },
];

// ── Color mapping using CSS variables from globals.css ────────────

function eventColor(type: TimelineEventType): string {
  switch (type) {
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
      return "#EF4444";
    default:
      return "var(--text-muted)";
  }
}

function eventTypeLabel(type: TimelineEventType): string {
  switch (type) {
    case "diagnosis":
      return "Diagnosis";
    case "symptom_onset":
      return "Symptom";
    case "test":
      return "Test";
    case "medication_change":
      return "Medication";
    case "appointment":
      return "Appointment";
    case "imaging":
      return "Imaging";
    case "hospitalization":
      return "Hospital";
    default:
      return type;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function significanceBadge(
  sig: string
): { label: string; bg: string; color: string } | null {
  switch (sig) {
    case "critical":
      return {
        label: "Critical",
        bg: "rgba(239, 68, 68, 0.12)",
        color: "#EF4444",
      };
    case "important":
      return {
        label: "Important",
        bg: "rgba(217, 169, 78, 0.14)",
        color: "#D9A94E",
      };
    default:
      return null;
  }
}

// ── Main component ────────────────────────────────────────────────

interface TimelineClientProps {
  events: MedicalTimelineEvent[];
}

export function TimelineClient({ events: initialEvents }: TimelineClientProps) {
  const [events, setEvents] = useState<MedicalTimelineEvent[]>(initialEvents);
  const [filter, setFilter] = useState<FilterId>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.event_type === filter);
  }, [events, filter]);

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleEventAdded = useCallback((newEvent: MedicalTimelineEvent) => {
    setEvents((prev) => {
      const updated = [newEvent, ...prev];
      // Re-sort by event_date descending
      updated.sort(
        (a, b) =>
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      );
      return updated;
    });
  }, []);

  // Count per type for badge numbers on chips
  const countByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      map.set(e.event_type, (map.get(e.event_type) || 0) + 1);
    }
    return map;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="mt-4 space-y-4">
        <AddEventForm onEventAdded={handleEventAdded} />
        <div className="text-center py-12">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--bg-elevated)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p
            className="text-base font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            No timeline events yet
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Add your first event using the button above
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Add Event */}
      <AddEventForm onEventAdded={handleEventAdded} />

      {/* Filter chips */}
      <div
        className="flex gap-2 overflow-x-auto hide-scrollbar pb-3"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {filterChips.map((chip) => {
          const isActive = filter === chip.id;
          const count =
            chip.id === "all"
              ? events.length
              : countByType.get(chip.id) || 0;

          return (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              className="touch-target rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
              style={
                isActive
                  ? {
                      background: "var(--accent-sage)",
                      color: "var(--text-inverse)",
                    }
                  : {
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {chip.label}
              {count > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    opacity: isActive ? 0.8 : 0.5,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtered count */}
      <p
        className="text-xs mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        {filter !== "all" && " matching filter"}
      </p>

      {/* No results for current filter */}
      {filtered.length === 0 && (
        <div
          className="text-center py-10 rounded-xl"
          style={{ background: "var(--bg-elevated)" }}
        >
          <p
            className="text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No {filterChips.find((c) => c.id === filter)?.label?.toLowerCase() || "events"} recorded
          </p>
        </div>
      )}

      {/* Vertical timeline */}
      {filtered.length > 0 && (
        <div className="relative ml-4">
          {/* Connecting vertical line */}
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: 2,
              background: "var(--border)",
              borderRadius: 1,
            }}
          />

          {filtered.map((event, idx) => {
            const color = eventColor(event.event_type);
            const isExpanded = expandedId === event.id;
            const sigBadge = significanceBadge(event.significance);
            const isLast = idx === filtered.length - 1;

            return (
              <div
                key={event.id}
                className={`relative pl-7 ${isLast ? "" : "pb-5"}`}
              >
                {/* Colored dot */}
                <div
                  className="absolute"
                  style={{
                    left: -5,
                    top: 6,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: color,
                    border: `2.5px solid var(--bg-primary)`,
                    boxShadow: `0 0 0 2px ${color}33`,
                  }}
                />

                <button
                  onClick={() => toggle(event.id)}
                  className="w-full text-left"
                  style={{ cursor: "pointer" }}
                >
                  {/* Date row */}
                  <time
                    className="block text-sm font-semibold"
                    dateTime={event.event_date}
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatDate(event.event_date)}
                  </time>

                  {/* Title */}
                  <p
                    className="text-sm font-medium mt-0.5"
                    style={{
                      color: "var(--text-primary)",
                      lineHeight: 1.4,
                    }}
                  >
                    {event.title}
                  </p>

                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${color}1A`,
                        color,
                      }}
                    >
                      {eventTypeLabel(event.event_type)}
                    </span>
                    {sigBadge && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: sigBadge.bg,
                          color: sigBadge.color,
                        }}
                      >
                        {sigBadge.label}
                      </span>
                    )}
                  </div>

                  {/* Expanded: description */}
                  {isExpanded && event.description && (
                    <div
                      className="mt-3 rounded-lg p-3"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      <p
                        className="text-sm whitespace-pre-wrap"
                        style={{
                          color: "var(--text-secondary)",
                          lineHeight: "1.6",
                          margin: 0,
                        }}
                      >
                        {event.description}
                      </p>
                    </div>
                  )}

                  {/* Expanded: linked data */}
                  {isExpanded &&
                    event.linked_data &&
                    Object.keys(event.linked_data).length > 0 && (
                      <div className="mt-2">
                        <p
                          className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Linked Data
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Object.entries(event.linked_data).map(
                            ([key, val]) => (
                              <span
                                key={key}
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  background: "var(--bg-elevated)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {key}: {String(val)}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Expand hint */}
                  {!isExpanded && event.description && (
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Tap to expand
                    </p>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
