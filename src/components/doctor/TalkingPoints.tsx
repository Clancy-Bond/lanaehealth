"use client";

import { useMemo } from "react";
import { MessageSquareText } from "lucide-react";
import type { DoctorPageData } from "@/app/doctor/page";
import {
  SPECIALIST_CONFIG,
  type SpecialistView,
  type DataBucket,
} from "@/lib/doctor/specialist-config";

interface TalkingPointsProps {
  data: DoctorPageData;
  view?: SpecialistView;
}

interface TalkingPoint {
  prefix: string;
  detail: string;
  priority: number; // lower = higher priority
  bucket: DataBucket;
}

/**
 * Extracts the most important talking points from the patient data.
 * These are pre-computed from the data props -- no AI call needed.
 */
function buildTalkingPoints(
  data: DoctorPageData,
  view: SpecialistView = "pcp"
): TalkingPoint[] {
  const points: TalkingPoint[] = [];
  const weights = SPECIALIST_CONFIG[view].bucketWeights;

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
        bucket: "labs",
      });
    } else if (hasAbnormal) {
      const latest = values[values.length - 1];
      points.push({
        prefix: `${testName} flagged`,
        detail: `Latest: ${latest} ${unit}`,
        priority: 3,
        bucket: "labs",
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
      bucket: "activeProblems",
    });
  }

  // 3. Imaging findings
  for (const study of data.imagingStudies) {
    if (study.findings_summary) {
      points.push({
        prefix: `${study.modality} ${study.body_part}`,
        detail: study.findings_summary,
        priority: 2,
        bucket: "imaging",
      });
    }
  }

  // 4. Suspected conditions from health profile
  for (const condition of data.suspectedConditions) {
    points.push({
      prefix: "Suspected",
      detail: condition,
      priority: 3,
      bucket: "activeProblems",
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
        bucket: "correlations",
      });
    }
  }

  // 6. Vitals concerns
  if (data.latestVitals.hrvAvg !== null && data.latestVitals.hrvAvg < 25) {
    points.push({
      prefix: "Low HRV",
      detail: `${Math.round(data.latestVitals.hrvAvg)}ms average -- autonomic stress indicator`,
      priority: 2,
      bucket: "vitals",
    });
  }

  // 7. Cycle / reproductive signals (only surfaces for bucket=cycle visible)
  if (data.cycleStatus.padChangesHeavyDay || data.cycleStatus.clots || data.cycleStatus.pain) {
    const bits: string[] = [];
    if (data.cycleStatus.pain) bits.push(`pain: ${data.cycleStatus.pain}`);
    if (data.cycleStatus.padChangesHeavyDay)
      bits.push(`heaviest day: ${data.cycleStatus.padChangesHeavyDay}`);
    if (data.cycleStatus.clots) bits.push(`clots: ${data.cycleStatus.clots}`);
    points.push({
      prefix: "Cycle burden",
      detail: bits.join(" | "),
      priority: 2,
      bucket: "cycle",
    });
  }

  // Apply specialist weighting: buckets with weight -1 are dropped;
  // points get effective-priority = priority - bucketWeight (lower = higher)
  const visible = points.filter((p) => weights[p.bucket] >= 0);
  visible.sort((a, b) => {
    const adj = (p: TalkingPoint) => p.priority - weights[p.bucket];
    return adj(a) - adj(b);
  });
  return visible.slice(0, 7);
}

function TalkingPointItem({ point }: { point: TalkingPoint }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 14,
        lineHeight: 1.5,
        color: "var(--text-secondary)",
        marginBottom: 8,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: point.priority <= 1 ? "var(--accent-blush)" : "var(--accent-sage)",
          flexShrink: 0,
          marginTop: 7,
        }}
      />
      <span>
        <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {point.prefix}:
        </strong>{" "}
        {point.detail}
      </span>
    </div>
  );
}

export function TalkingPoints({ data, view = "pcp" }: TalkingPointsProps) {
  const points = useMemo(() => buildTalkingPoints(data, view), [data, view]);

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

      {/* Talking points list -- grouped by category */}
      <div style={{ padding: "0 20px 16px" }}>
        {/* Lab trends */}
        {points.filter(p => p.prefix.includes('trend') || p.prefix.includes('flagged')).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 6px' }}>
              Lab Trends
            </p>
            {points.filter(p => p.prefix.includes('trend') || p.prefix.includes('flagged')).map((point, i) => (
              <TalkingPointItem key={`lab-${i}`} point={point} />
            ))}
          </div>
        )}
        {/* Active concerns */}
        {points.filter(p => p.prefix === 'Active concern' || p.prefix === 'Suspected').length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 6px' }}>
              Active Concerns
            </p>
            {points.filter(p => p.prefix === 'Active concern' || p.prefix === 'Suspected').map((point, i) => (
              <TalkingPointItem key={`concern-${i}`} point={point} />
            ))}
          </div>
        )}
        {/* Other (patterns, vitals, imaging) */}
        {points.filter(p => !p.prefix.includes('trend') && !p.prefix.includes('flagged') && p.prefix !== 'Active concern' && p.prefix !== 'Suspected').length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 6px' }}>
              Other Findings
            </p>
            {points.filter(p => !p.prefix.includes('trend') && !p.prefix.includes('flagged') && p.prefix !== 'Active concern' && p.prefix !== 'Suspected').map((point, i) => (
              <TalkingPointItem key={`other-${i}`} point={point} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
