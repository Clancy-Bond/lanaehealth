"use client";

import Link from "next/link";
import { ClipboardList, Activity, AlertCircle, TrendingUp } from "lucide-react";

interface ActiveProblem {
  id: string;
  problem: string;
  status: string;
}

interface StrongCorrelation {
  id: string;
  effect_description: string | null;
  confidence_level: string;
}

interface SmartCardsProps {
  hasLoggedToday: boolean;
  activeProblems: ActiveProblem[];
  latestSleepScore: number | null;
  avgSleepScore: number | null;
  latestHrv: number | null;
  avgHrv: number | null;
  ouraDate: string | null;
  strongCorrelation?: StrongCorrelation | null;
}

interface CardData {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: { label: string; href: string };
  borderColor?: string;
  prominent?: boolean;
}

/**
 * Generates a prioritized Oura insight based on comparing today's metrics
 * against the 7-day average. Warnings are prioritized over good news.
 */
function getSmartOuraInsight(
  sleepScore: number | null,
  avgSleep: number | null,
  hrv: number | null,
  avgHrvVal: number | null,
): { title: string; description: string; isWarning: boolean } | null {
  type Insight = { title: string; description: string; isWarning: boolean; priority: number };
  const insights: Insight[] = [];

  // HRV below baseline (warning, high priority)
  if (hrv !== null && avgHrvVal !== null && avgHrvVal > 0) {
    const hrvPctDiff = ((hrv - avgHrvVal) / avgHrvVal) * 100;
    if (hrvPctDiff <= -15) {
      insights.push({
        title: "HRV below baseline",
        description: `HRV ${Math.round(hrv)}ms vs avg ${Math.round(avgHrvVal)}ms. This sometimes precedes symptom flares.`,
        isWarning: true,
        priority: 1,
      });
    } else if (hrvPctDiff >= 15) {
      insights.push({
        title: "HRV strong today",
        description: `HRV ${Math.round(hrv)}ms vs avg ${Math.round(avgHrvVal)}ms. Good recovery.`,
        isWarning: false,
        priority: 4,
      });
    }
  }

  // Sleep score below average (warning)
  if (sleepScore !== null && avgSleep !== null) {
    const sleepDiff = sleepScore - avgSleep;
    if (sleepDiff <= -10) {
      insights.push({
        title: "Poor sleep detected",
        description: `Sleep: ${sleepScore} (avg ${Math.round(avgSleep)}). Consider taking it easy today.`,
        isWarning: true,
        priority: 2,
      });
    } else if (sleepDiff >= 10) {
      insights.push({
        title: "Great sleep last night!",
        description: `Sleep: ${sleepScore} (avg ${Math.round(avgSleep)})`,
        isWarning: false,
        priority: 3,
      });
    }
  }

  // Sort: warnings first (priority 1, 2), then good news (3, 4)
  insights.sort((a, b) => a.priority - b.priority);

  if (insights.length > 0) {
    return insights[0];
  }

  // Fallback: show basic stats if no significant deviation
  if (sleepScore !== null || hrv !== null) {
    const parts: string[] = [];
    if (sleepScore !== null) {
      const cmp = avgSleep !== null ? ` (avg ${Math.round(avgSleep)})` : "";
      parts.push(`Sleep: ${sleepScore}${cmp}`);
    }
    if (hrv !== null) {
      const cmp = avgHrvVal !== null ? ` (avg ${Math.round(avgHrvVal)})` : "";
      parts.push(`HRV: ${Math.round(hrv)}ms${cmp}`);
    }
    return {
      title: "Oura Summary",
      description: parts.join("  |  "),
      isWarning: false,
    };
  }

  return null;
}

export function SmartCards({
  hasLoggedToday,
  activeProblems,
  latestSleepScore,
  avgSleepScore,
  latestHrv,
  avgHrv,
  ouraDate,
  strongCorrelation,
}: SmartCardsProps) {
  const cards: CardData[] = [];

  // Card 1: Log check-in (if not logged)
  if (!hasLoggedToday) {
    cards.push({
      id: "log-checkin",
      title: "Log your check-in",
      description:
        "Track pain, energy, and symptoms to build your health picture. Takes under 3 minutes.",
      icon: (
        <ClipboardList
          size={20}
          style={{ color: "var(--accent-sage)" }}
          strokeWidth={2}
        />
      ),
      action: { label: "Log now", href: "/log" },
      prominent: true,
    });
  }

  // Card 2: Active problems (always show if any exist)
  if (activeProblems.length > 0) {
    const problemNames = activeProblems
      .slice(0, 3)
      .map((p) => p.problem)
      .join(", ");
    const moreCount = activeProblems.length > 3 ? activeProblems.length - 3 : 0;
    const suffix = moreCount > 0 ? ` + ${moreCount} more` : "";

    cards.push({
      id: "active-problems",
      title: `${activeProblems.length} active problem${activeProblems.length === 1 ? "" : "s"} being tracked`,
      description: problemNames + suffix,
      icon: (
        <AlertCircle
          size={18}
          style={{ color: "var(--accent-sage)" }}
          strokeWidth={2}
        />
      ),
      action: { label: "View", href: "/doctor" },
    });
  }

  // Card 3: Smart Oura insight with deviation-based messaging
  if (latestSleepScore !== null || latestHrv !== null) {
    const insight = getSmartOuraInsight(
      latestSleepScore,
      avgSleepScore,
      latestHrv,
      avgHrv,
    );

    if (insight) {
      const dateLabel = ouraDate
        ? ouraDate === new Date().toISOString().split("T")[0]
          ? "Last night"
          : `From ${ouraDate}`
        : "Latest reading";

      cards.push({
        id: "oura-insight",
        title: insight.title !== "Oura Summary" ? insight.title : dateLabel,
        description: insight.description,
        icon: (
          <Activity
            size={18}
            style={{
              color: insight.isWarning
                ? "var(--accent-rose)"
                : "var(--accent-sage)",
            }}
            strokeWidth={2}
          />
        ),
        action: { label: "View", href: "/patterns?metric=sleep" },
        borderColor: insight.isWarning ? "var(--accent-rose)" : undefined,
      });
    }
  }

  // Card 4: Strong correlation pattern (if one exists)
  if (strongCorrelation?.effect_description) {
    cards.push({
      id: "pattern-found",
      title: "Pattern found",
      description: strongCorrelation.effect_description,
      icon: (
        <TrendingUp
          size={18}
          style={{ color: "var(--accent-sage)" }}
          strokeWidth={2}
        />
      ),
      action: { label: "View", href: "/patterns" },
    });
  }

  if (cards.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "0 16px",
      }}
    >
      {cards.map((card) => (
        <div
          key={card.id}
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            boxShadow: "var(--shadow-sm)",
            padding: card.prominent ? 20 : 16,
            border: "1px solid var(--border-light)",
            borderLeftWidth: 4,
            borderLeftStyle: "solid",
            borderLeftColor: card.borderColor || "var(--accent-sage)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: card.prominent ? "flex-start" : "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexDirection: card.prominent ? "column" : "row",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
              <div
                style={{
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: card.prominent ? 15 : 14,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    margin: "4px 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  {card.description}
                </p>
              </div>
            </div>

            {card.prominent ? (
              <Link
                href={card.action.href}
                className="touch-target"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-inverse)",
                  background: "var(--accent-sage)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  padding: "10px 24px",
                  borderRadius: 12,
                  marginTop: 4,
                  alignSelf: "flex-start",
                  marginLeft: 30,
                }}
              >
                {card.action.label}
              </Link>
            ) : (
              <Link
                href={card.action.href}
                className="touch-target"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--accent-sage)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  padding: "6px 0",
                  flexShrink: 0,
                }}
              >
                {card.action.label}
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
