"use client";

import { useMemo } from "react";
import { MessageSquareText } from "lucide-react";
import type { DoctorPageData } from "@/app/doctor/page";

interface TalkingPointsProps {
  data: DoctorPageData;
}

interface TalkingPoint {
  prefix: string;
  detail: string;
  priority: number; // lower = higher priority
}

/**
 * Extracts the most important talking points from the patient data.
 * These are pre-computed from the data props -- no AI call needed.
 */
function buildTalkingPoints(data: DoctorPageData): TalkingPoint[] {
  const points: TalkingPoint[] = [];

  // 1. Lab trends: find labs tested multiple times and flag declining/concerning trends
  const labsByTest = new Map<string, { values: number[]; unit: string; dates: string[] }>();
  for (const lab of data.allLabs) {
    if (lab.value === null) continue;
    const key = lab.test_name;
    if (!labsByTest.has(key)) {
      labsByTest.set(key, { values: [], unit: lab.unit || "", dates: [] });
    }
    const entry = labsByTest.get(key)!;
    entry.values.push(lab.value);
    entry.dates.push(lab.date);
  }

  for (const [testName, { values, unit }] of labsByTest) {
    if (values.length < 2) continue;
    const first = values[0];
    const last = values[values.length - 1];
    // Flag if the latest value is lower than the first and the test has abnormal flags
    const hasAbnormal = data.abnormalLabs.some(
      (l) => l.test_name === testName
    );
    if (hasAbnormal && last < first) {
      const trend = values.map((v) => `${v}`).join(" -> ");
      points.push({
        prefix: `${testName} trend`,
        detail: `${trend} ${unit} -- declining despite treatment`,
        priority: 1,
      });
    } else if (hasAbnormal) {
      const latest = values[values.length - 1];
      points.push({
        prefix: `${testName} flagged`,
        detail: `Latest: ${latest} ${unit}`,
        priority: 3,
      });
    }
  }

  // 2. Active problems with frequency/severity data
  for (const problem of data.activeProblems) {
    const detail = problem.latestData
      ? `${problem.problem}: ${problem.latestData}`
      : problem.problem;
    points.push({
      prefix: "Active concern",
      detail,
      priority: problem.status === "worsening" ? 1 : 2,
    });
  }

  // 3. Imaging findings
  for (const study of data.imagingStudies) {
    if (study.findings_summary) {
      points.push({
        prefix: `${study.modality} ${study.body_part}`,
        detail: study.findings_summary,
        priority: 2,
      });
    }
  }

  // 4. Suspected conditions from health profile
  for (const condition of data.suspectedConditions) {
    points.push({
      prefix: "Suspected",
      detail: condition,
      priority: 3,
    });
  }

  // 5. Strong correlations
  const strongCorrelations = data.correlations.filter(
    (c) => c.confidenceLevel === "strong"
  );
  for (const corr of strongCorrelations.slice(0, 2)) {
    if (corr.effectDescription) {
      points.push({
        prefix: "Pattern found",
        detail: corr.effectDescription,
        priority: 4,
      });
    }
  }

  // 6. Vitals concerns
  if (data.latestVitals.hrvAvg !== null && data.latestVitals.hrvAvg < 25) {
    points.push({
      prefix: "Low HRV",
      detail: `${Math.round(data.latestVitals.hrvAvg)}ms average -- autonomic stress indicator`,
      priority: 2,
    });
  }

  // Sort by priority and take top 7
  points.sort((a, b) => a.priority - b.priority);
  return points.slice(0, 7);
}

export function TalkingPoints({ data }: TalkingPointsProps) {
  const points = useMemo(() => buildTalkingPoints(data), [data]);

  if (points.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: "var(--accent-sage)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <MessageSquareText
          size={20}
          style={{ color: "var(--accent-sage)", flexShrink: 0 }}
        />
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          What to Tell the Doctor
        </h2>
      </div>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          margin: 0,
          padding: "0 20px 12px",
          lineHeight: 1.4,
        }}
      >
        Key points to discuss at your appointment, generated from your health data.
      </p>

      {/* Talking points list */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: "0 20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {points.map((point, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent-sage)",
                flexShrink: 0,
                marginTop: 7,
              }}
            />
            <span>
              <strong
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                {point.prefix}:
              </strong>{" "}
              {point.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
