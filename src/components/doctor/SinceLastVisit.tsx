"use client";

import { useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { ArrowUpRight, Beaker, Image as ImageIcon, Calendar } from "lucide-react";
import type { DoctorPageData } from "@/app/doctor/page";

interface SinceLastVisitProps {
  data: DoctorPageData;
}

interface Change {
  kind: "lab" | "imaging" | "timeline" | "appointment";
  date: string;
  title: string;
  detail: string;
  flag?: "normal" | "low" | "high" | "critical";
  citation: string; // row id or date-based reference
}

function summarizeChanges(
  data: DoctorPageData,
  since: string
): Change[] {
  const sinceTs = new Date(since + "T00:00:00").getTime();
  const out: Change[] = [];

  // New labs since last visit
  for (const lab of data.allLabs) {
    const ts = new Date(lab.date + "T00:00:00").getTime();
    if (ts <= sinceTs) continue;
    const value = lab.value !== null ? `${lab.value}${lab.unit ? ` ${lab.unit}` : ""}` : "result";
    const flagStr = lab.flag && lab.flag !== "normal" ? ` (${lab.flag})` : "";
    out.push({
      kind: "lab",
      date: lab.date,
      title: lab.test_name,
      detail: `${value}${flagStr}`,
      flag: (lab.flag as Change["flag"]) ?? "normal",
      citation: `lab_results.id=${lab.id}`,
    });
  }

  // New imaging since last visit
  for (const img of data.imagingStudies) {
    const ts = new Date(img.study_date + "T00:00:00").getTime();
    if (ts <= sinceTs) continue;
    out.push({
      kind: "imaging",
      date: img.study_date,
      title: `${img.modality} ${img.body_part}`,
      detail: img.findings_summary ?? "study completed",
      citation: `imaging_studies.id=${img.id}`,
    });
  }

  // New timeline events since last visit
  for (const e of data.timelineEvents) {
    const ts = new Date(e.event_date + "T00:00:00").getTime();
    if (ts <= sinceTs) continue;
    out.push({
      kind: "timeline",
      date: e.event_date,
      title: e.title,
      detail: e.description ?? e.event_type,
      citation: `medical_timeline.id=${e.id}`,
    });
  }

  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function iconFor(kind: Change["kind"]) {
  const size = 14;
  switch (kind) {
    case "lab":
      return <Beaker size={size} />;
    case "imaging":
      return <ImageIcon size={size} />;
    case "appointment":
      return <Calendar size={size} />;
    default:
      return <ArrowUpRight size={size} />;
  }
}

function flagBg(flag?: Change["flag"]) {
  if (flag === "critical") return "rgba(220, 38, 38, 0.12)";
  if (flag === "high") return "rgba(234, 179, 8, 0.12)";
  if (flag === "low") return "rgba(59, 130, 246, 0.12)";
  return "rgba(107, 144, 128, 0.10)";
}

function flagText(flag?: Change["flag"]) {
  if (flag === "critical") return "#DC2626";
  if (flag === "high") return "#CA8A04";
  if (flag === "low") return "#2563EB";
  return "var(--accent-sage)";
}

export function SinceLastVisit({ data }: SinceLastVisitProps) {
  const lastDate = data.lastAppointmentDate;
  const changes = useMemo(
    () => (lastDate ? summarizeChanges(data, lastDate) : []),
    [data, lastDate]
  );

  if (!lastDate) {
    return (
      <section
        style={{
          background: "var(--bg-card)",
          borderRadius: 16,
          border: "1px solid var(--border-light)",
          padding: "16px 20px",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            margin: "0 0 6px",
          }}
        >
          Since last visit
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          No prior appointment on file. This is baseline.
        </p>
      </section>
    );
  }

  const daysAgo = differenceInDays(new Date(), new Date(lastDate + "T00:00:00"));

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: "var(--accent-blush)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 8px" }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            margin: "0 0 4px",
          }}
        >
          Since last visit
        </p>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {changes.length} change{changes.length === 1 ? "" : "s"}
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-muted)",
              marginLeft: 8,
            }}
          >
            since {format(new Date(lastDate + "T00:00:00"), "MMM d, yyyy")}
            {daysAgo > 0 ? ` (${daysAgo}d ago)` : ""}
          </span>
        </h2>
      </div>

      <div style={{ padding: "0 20px 16px" }}>
        {changes.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0" }}>
            No new labs, imaging, or tracked events since last visit.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {changes.slice(0, 10).map((c, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: flagBg(c.flag),
                    color: flagText(c.flag),
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {iconFor(c.kind)}
                </span>
                <span style={{ flex: 1 }}>
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {c.title}
                  </strong>{" "}
                  <span style={{ color: "var(--text-secondary)" }}>{c.detail}</span>
                  <span
                    className="cite"
                    style={{
                      display: "inline-block",
                      marginLeft: 6,
                      fontSize: 10,
                      color: "var(--text-muted)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                    title={c.citation}
                  >
                    {format(new Date(c.date + "T00:00:00"), "M/d")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {changes.length > 10 && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            +{changes.length - 10} more. See full brief for details.
          </p>
        )}
      </div>
    </section>
  );
}
